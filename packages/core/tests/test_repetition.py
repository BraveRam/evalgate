"""Repeated evaluations preserve attempt evidence and legacy gate semantics."""

import asyncio
import json
from collections import Counter
from pathlib import Path

import pytest
import yaml
from fastapi.testclient import TestClient
from pydantic import ValidationError
from typer.testing import CliRunner

from evalgate.api.app import create_app
from evalgate.cli.main import app
from evalgate.core.baselines import BaselineSnapshot, compare_to_baseline
from evalgate.core.cost import estimate_suite_cost
from evalgate.core.repetition import attempt_counts
from evalgate.core.storage import StorageEngine
from evalgate.core.types import SuiteConfig, TestCaseResult
from evalgate.providers.mock import MockProvider
from evalgate.runner.runner import SuiteRunner


def suite(**updates):
    data = dict(
        name="repeat-demo",
        target={"model": "mock/simulator", "template": "Hello"},
        tests=[
            {"id": "a", "assertions": [{"type": "contains", "value": "Hello"}]},
            {"id": "b", "repeat": 2},
        ],
        min_pass_rate=0.5,
    )
    data.update(updates)
    return SuiteConfig.model_validate(data)


@pytest.mark.parametrize("value", [0, -1, 101, True, 1.5, "3"])
def test_invalid_repeat_rejected_at_all_configuration_levels(value):
    with pytest.raises(ValidationError):
        suite(repeat=value)
    with pytest.raises(ValidationError):
        suite(tests=[{"id": "a", "repeat": value}])
    with pytest.raises(ValueError):
        attempt_counts(suite(), value)


def test_repeat_precedence_and_cost_account_for_mixed_counts():
    config = suite(repeat=3)
    assert attempt_counts(config) == [3, 2]
    assert attempt_counts(config, 4) == [4, 2]
    estimate = estimate_suite_cost(config, repeat=4)
    one = estimate_suite_cost(suite(tests=[{"id": "a"}]))
    assert estimate["total_tests"] == 2
    assert estimate["total_attempts"] == 6
    assert estimate["estimated_output_tokens"] == 6 * 150
    assert estimate["estimated_input_tokens"] == 6 * one["estimated_input_tokens"]


async def test_attempt_aggregation_order_progress_and_shared_concurrency(monkeypatch, tmp_path):
    seen = Counter()
    active = peak = 0
    events = []

    async def execute(test_case, **kwargs):
        nonlocal active, peak
        index = seen[test_case.id]
        seen[test_case.id] += 1
        active += 1
        peak = max(peak, active)
        await asyncio.sleep(0.005 * (3 - index))
        active -= 1
        passed = test_case.id == "b" or index != 1
        return TestCaseResult(
            test_id=test_case.id,
            passed=passed,
            completion=str(index),
            input_tokens=2,
            output_tokens=3,
            total_tokens=5,
            latency_ms=10 * (index + 1),
            cost_usd=0.01,
        )

    monkeypatch.setattr("evalgate.runner.runner.run_test_case", execute)
    storage = StorageEngine(tmp_path / "runs.db")
    result = await SuiteRunner(storage).run_suite(
        suite(repeat=3),
        judge_provider=MockProvider(),
        concurrency=2,
        on_test_complete=events.append,
    )
    assert peak == 2 and len(events) == 5
    assert sorted(e.attempt_index for e in events if e.test_id == "a") == [1, 2, 3]
    assert result.total_tests == 2 and result.total_attempts == 5
    assert result.passed_attempts == 4 and result.pass_rate == 0.8
    assert result.passed_tests == 1 and result.inconsistent_tests == 1 and result.passed
    first = result.results[0]
    assert [a.completion for a in first.attempts] == ["0", "1", "2"]
    assert first.completion == "1" and first.attempt_count == 3
    assert first.passed_attempts == 2 and first.inconsistent
    assert first.latency_ms == 20 and first.total_tokens == 15
    assert result.total_tokens == 25 and result.total_cost_usd == 0.05
    assert result.p50_latency_ms == 20 and result.p95_latency_ms == 30
    restored = await storage.get_run(result.run_id)
    assert restored.model_dump() == result.model_dump()
    baseline = await storage.set_baseline(result.run_id)
    assert BaselineSnapshot.model_validate_json(baseline.model_dump_json()).run == restored


async def test_repeated_baseline_rate_changes_need_explicit_gate(tmp_path):
    config = suite(tests=[{"id": "a"}], min_pass_rate=0.5)
    run = await SuiteRunner(StorageEngine(tmp_path / "test.db")).run_suite(
        config,
        repeat=4,
        judge_provider=MockProvider(),
        save_to_storage=False,
    )
    snapshot = BaselineSnapshot(run=run.model_copy(deep=True))
    run.results[0].attempts[0].passed = False
    run.results[0].passed = False
    run.pass_rate = 0.75
    report = compare_to_baseline(run, snapshot)
    assert report.regressed_test_ids == ["a"] and report.passed
    assert report.cases[0].baseline_attempts == report.cases[0].current_attempts == 4
    assert report.cases[0].success_rate_delta == -0.25
    run.metadata["max_success_rate_drop"] = 0.25
    assert compare_to_baseline(run, snapshot).passed
    run.metadata["max_success_rate_drop"] = 0.24
    report = compare_to_baseline(run, snapshot)
    assert not report.passed and report.gated_regressed_test_ids == ["a"]
    run.passed = False
    run.metadata["max_success_rate_drop"] = None
    assert not compare_to_baseline(run, snapshot).passed


async def test_legacy_runs_are_single_attempt_and_keep_regression_gate(tmp_path):
    run = await SuiteRunner(StorageEngine(tmp_path / "test.db")).run_suite(
        suite(tests=[{"id": "a"}]),
        judge_provider=MockProvider(),
        save_to_storage=False,
    )
    payload = run.model_dump()
    for field in ("total_attempts", "passed_attempts", "inconsistent_tests"):
        payload.pop(field)
    for case in payload["results"]:
        for field in (
            "attempts",
            "attempt_index",
            "attempt_count",
            "passed_attempts",
            "success_rate",
            "inconsistent",
        ):
            case.pop(field)
    old = type(run).model_validate(payload)
    assert old.total_attempts == 1 and old.results[0].success_rate == 1
    baseline = BaselineSnapshot(run=old)
    run.results[0].passed = False
    assert not compare_to_baseline(run, baseline).passed


def write_suite(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    Path("evals").mkdir()
    path = Path("evals/repeat.yaml")
    path.write_text(yaml.safe_dump(suite().model_dump(mode="json")))
    return path


def test_cli_api_and_websocket_repeated_workflow(tmp_path, monkeypatch):
    path = write_suite(tmp_path, monkeypatch)
    cli = CliRunner()
    result = cli.invoke(app, ["run", str(path), "--repeat", "3", "--json"])
    assert result.exit_code == 0, result.output
    run = json.loads(result.output)
    assert run["total_attempts"] == 5 and run["passed_attempts"] == 5
    estimate = cli.invoke(app, ["cost", str(path), "--repeat", "3", "--json"])
    assert json.loads(estimate.output)["total_attempts"] == 5
    with TestClient(create_app()) as client:
        assert client.post("/api/v1/suites/repeat-demo/run", json={"repeat": 0}).status_code == 422
        assert (
            client.post("/api/v1/suites/repeat-demo/run", json={"repeat": True}).status_code == 422
        )
        estimated = client.post("/api/v1/suites/repeat-demo/estimate-cost", json={"repeat": 4})
        assert estimated.json()["total_attempts"] == 6
        response = client.post("/api/v1/suites/repeat-demo/run", json={"repeat": 3})
        assert response.status_code == 200 and response.json()["total_attempts"] == 5
        run_id = response.json()["run_id"]
        stored = client.get(f"/api/v1/runs/{run_id}").json()
        assert stored["results"][0]["attempt_count"] == 3
        assert (
            client.put("/api/v1/baselines/repeat-demo", json={"run_id": run_id}).status_code == 200
        )
        with client.websocket_connect("/api/v1/ws/run") as ws:
            ws.send_json({"suite_name": "repeat-demo", "repeat": 3, "concurrency": 2})
            started = ws.receive_json()
            assert started["total_attempts"] == 5 and started["total_tests"] == 2
            events = [ws.receive_json() for _ in range(5)]
            assert all(e["type"] == "test_complete" for e in events)
            assert {e["data"]["attempt_index"] for e in events} == {1, 2, 3}
            finished = ws.receive_json()
            assert finished["type"] == "run_finished" and finished["data"]["passed"]
        with client.websocket_connect("/api/v1/ws/run") as ws:
            ws.send_json({"suite_name": "repeat-demo", "repeat": 101})
            assert ws.receive_json()["type"] == "error"


async def test_mcp_repetition_tools_expose_attempts(tmp_path, monkeypatch):
    from evalgate.mcp.server import create_mcp_server

    path = write_suite(tmp_path, monkeypatch)
    server = create_mcp_server()

    async def call(name, **kwargs):
        response = await server.call_tool(name, {"suite_path": str(path), **kwargs})
        result = response.structured_content
        return result.get("result", result)

    run = await call("evalgate_run_suite", repeat=3)
    assert run["total_attempts"] == 5 and run["passed_attempts"] == 5
    assert run["reliability"][0]["attempt_count"] == 3
    cost = await call("evalgate_estimate_cost", repeat=3)
    assert cost["total_attempts"] == 5
    arena = await call(
        "evalgate_compare_models", model_a="mock/simulator", model_b="mock/simulator", repeat=3
    )
    assert arena["model_a_pass_rate"] == arena["model_b_pass_rate"] == 1.0


async def test_baseline_reports_changed_nonrepresentative_attempt(tmp_path):
    config = suite(tests=[{"id": "a"}])
    run = await SuiteRunner(StorageEngine(tmp_path / "test.db")).run_suite(
        config,
        repeat=2,
        judge_provider=MockProvider(),
        save_to_storage=False,
    )
    snapshot = BaselineSnapshot(run=run.model_copy(deep=True))
    run.results[0].attempts[1].completion = "Changed second output"
    comparison = compare_to_baseline(run, snapshot)
    assert comparison.changed_test_ids == ["a"] and comparison.passed
    assert "+Changed second output" in comparison.cases[0].output_diff


async def test_arena_detects_rate_differences_even_when_both_cases_fail(monkeypatch, tmp_path):
    from evalgate.runner.runner import compare_arena

    seen = Counter()

    async def execute(test_case, target_config, **kwargs):
        index = seen[target_config.model]
        seen[target_config.model] += 1
        limit = 1 if target_config.model == "mock/a" else 2
        return TestCaseResult(test_id=test_case.id, passed=index < limit)

    monkeypatch.setattr("evalgate.runner.runner.run_test_case", execute)
    comparison = await compare_arena(
        suite(tests=[{"id": "a"}], min_pass_rate=0.0),
        "mock/a",
        "mock/b",
        storage=StorageEngine(tmp_path / "runs.db"),
        repeat=3,
    )
    assert not comparison.run_a.results[0].passed and not comparison.run_b.results[0].passed
    assert comparison.mismatched_test_ids == ["a"]
    assert comparison.pass_rate_delta > 0
