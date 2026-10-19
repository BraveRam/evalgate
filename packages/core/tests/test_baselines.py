"""Regression baselines preserve per-case quality even at an unchanged pass rate."""

import json
from pathlib import Path

import httpx
import pytest
import yaml
from pydantic import ValidationError
from typer.testing import CliRunner

from evalgate.api.app import create_app
from evalgate.cli.main import app
from evalgate.core.baselines import BaselineSnapshot, compare_to_baseline
from evalgate.core.storage import StorageEngine
from evalgate.core.types import SuiteRunResult, TestCaseResult


def make_run(run_id: str = "run_good", **updates) -> SuiteRunResult:
    values = dict(
        run_id=run_id,
        suite_name="baseline-demo",
        target_model="mock/simulator",
        target_provider="mock",
        passed=True,
        pass_rate=0.5,
        total_tests=2,
        passed_tests=1,
        failed_tests=1,
        avg_latency_ms=10,
        p50_latency_ms=10,
        p95_latency_ms=10,
        total_tokens=20,
        total_cost_usd=0.01,
        results=[
            TestCaseResult(test_id="a", passed=True, completion="hello"),
            TestCaseResult(test_id="b", passed=False, completion="old"),
        ],
    )
    values.update(updates)
    return SuiteRunResult(**values)


def test_equal_pass_rate_still_detects_new_failure_and_output_diff():
    baseline = BaselineSnapshot(run=make_run())
    candidate = make_run(
        "run_new",
        results=[
            TestCaseResult(test_id="b", passed=True, completion="new"),
            TestCaseResult(test_id="a", passed=False, completion="wrong"),
        ],
        total_cost_usd=0.015,
        p50_latency_ms=12,
    )
    report = compare_to_baseline(candidate, baseline)
    assert report.pass_rate_delta == 0
    assert not report.passed
    assert report.regressed_test_ids == ["a"]
    assert report.improved_test_ids == ["b"]
    assert report.changed_test_ids == ["a", "b"]
    assert "+wrong" in report.cases[0].output_diff
    assert report.cost_delta_usd == 0.005
    assert report.latency_p50_delta_ms == 2


def test_output_changes_alone_do_not_fail_gate_and_missing_tests_do():
    snapshot = BaselineSnapshot(run=make_run())
    candidate = make_run("changed")
    candidate.results[0].completion = "different but acceptable"
    assert compare_to_baseline(candidate, snapshot).passed
    candidate.results.pop(0)
    candidate.total_tests = 1
    report = compare_to_baseline(candidate, snapshot)
    assert not report.passed
    assert report.missing_test_ids == ["a"]


def test_added_tests_are_reported_and_existing_suite_gate_is_preserved():
    snapshot = BaselineSnapshot(run=make_run())
    candidate = make_run("added", total_tests=3)
    candidate.results.append(TestCaseResult(test_id="c", passed=True, completion="new test"))
    report = compare_to_baseline(candidate, snapshot)
    assert report.added_test_ids == ["c"]
    assert report.passed
    candidate.passed = False
    assert not compare_to_baseline(candidate, snapshot).passed


@pytest.mark.parametrize(
    "updates",
    [
        {"passed": False},
        {"total_tests": 0, "results": []},
        {"total_tests": 3},
        {"results": [TestCaseResult(test_id="a", passed=True)] * 2},
    ],
)
def test_invalid_baselines_are_rejected(updates):
    with pytest.raises(ValueError):
        BaselineSnapshot(run=make_run(**updates))


def test_mismatched_suites_and_unsupported_versions_are_rejected():
    snapshot = BaselineSnapshot(run=make_run())
    with pytest.raises(ValueError, match="same suite"):
        compare_to_baseline(make_run(suite_name="different"), snapshot)
    data = snapshot.model_dump(mode="json")
    data["schema_version"] = 2
    with pytest.raises(ValidationError):
        BaselineSnapshot.model_validate(data)


@pytest.mark.asyncio
async def test_snapshot_survives_run_deletion_and_can_be_replaced(tmp_path: Path):
    storage = StorageEngine(tmp_path / "runs.db")
    await storage.save_run(make_run())
    await storage.set_baseline("run_good")
    assert await storage.delete_run("run_good")
    snapshot = await StorageEngine(tmp_path / "runs.db").get_baseline("baseline-demo")
    assert snapshot and snapshot.run.run_id == "run_good"
    await storage.save_run(make_run("replacement"))
    await storage.set_baseline("replacement")
    snapshot = await storage.get_baseline("baseline-demo")
    assert snapshot and snapshot.run.run_id == "replacement"
    assert await storage.delete_baseline("baseline-demo")
    assert await storage.get_baseline("baseline-demo") is None


def write_suite(path: Path, swap: bool = False):
    path.write_text(
        yaml.safe_dump(
            {
                "name": "baseline-demo",
                "min_pass_rate": 0.5,
                "target": {"model": "mock/simulator", "template": "Echo {{word}}"},
                "tests": [
                    {
                        "id": "a",
                        "vars": {"word": "hello"},
                        "assertions": [
                            {"type": "contains", "value": "NEVER" if swap else "Echo hello"}
                        ],
                    },
                    {
                        "id": "b",
                        "vars": {"word": "bye"},
                        "assertions": [
                            {"type": "contains", "value": "Echo bye" if swap else "NEVER"}
                        ],
                    },
                ],
            }
        )
    )


def test_cli_baseline_export_and_portable_ci_gate(tmp_path: Path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    cli = CliRunner()
    suite_path = tmp_path / "suite.yaml"
    write_suite(suite_path)
    first = cli.invoke(app, ["run", str(suite_path), "--json"])
    assert first.exit_code == 0, first.output
    first_data = json.loads(first.stdout)
    artifact = tmp_path / "baseline.json"
    pinned = cli.invoke(app, ["baseline", first_data["run_id"], "--output", str(artifact)])
    assert pinned.exit_code == 0, pinned.output
    assert BaselineSnapshot.model_validate_json(artifact.read_text()).schema_version == 1

    write_suite(suite_path, swap=True)
    local = cli.invoke(app, ["run", str(suite_path), "--json"])
    assert local.exit_code == 1, local.output
    assert json.loads(local.stdout)["metadata"]["baseline_comparison"]["regressed_test_ids"] == [
        "a"
    ]

    fresh = tmp_path / "ci"
    fresh.mkdir()
    monkeypatch.chdir(fresh)
    candidate = cli.invoke(
        app, ["run", str(suite_path), "--baseline", str(artifact), "--no-save", "--json"]
    )
    assert candidate.exit_code == 1, candidate.output
    data = json.loads(candidate.stdout)
    assert data["pass_rate"] == first_data["pass_rate"] == 0.5
    assert data["metadata"]["baseline_comparison"]["regressed_test_ids"] == ["a"]
    assert not (fresh / ".evalgate").exists()
    write_suite(suite_path)
    unchanged = cli.invoke(
        app, ["run", str(suite_path), "--baseline", str(artifact), "--no-save", "--json"]
    )
    assert unchanged.exit_code == 0, unchanged.output


def test_cli_rejects_bad_baseline_before_running(tmp_path: Path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    suite_path = tmp_path / "suite.yaml"
    write_suite(suite_path)
    bad = tmp_path / "bad.json"
    bad.write_text('{"schema_version": 99}')
    result = CliRunner().invoke(app, ["run", str(suite_path), "--baseline", str(bad)])
    assert result.exit_code == 1
    assert "Invalid baseline" in result.output
    assert not (tmp_path / ".evalgate").exists()


@pytest.mark.asyncio
async def test_api_baseline_lifecycle_and_comparison(tmp_path: Path, monkeypatch):
    db_path = tmp_path / "api.db"
    monkeypatch.setattr("evalgate.core.storage.DEFAULT_DB_PATH", db_path)
    storage = StorageEngine(db_path)
    await storage.save_run(make_run())
    await storage.save_run(make_run("run_failed", passed=False))
    await storage.save_run(make_run("run_other", suite_name="other"))
    transport = httpx.ASGITransport(app=create_app())
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        url = "/api/v1/baselines/baseline-demo"
        assert (await client.get(url)).json() is None
        assert (await client.put(url, json={"run_id": "absent"})).status_code == 404
        assert (await client.put(url, json={"run_id": "run_other"})).status_code == 400
        assert (await client.put(url, json={"run_id": "run_failed"})).status_code == 400
        response = await client.put(url, json={"run_id": "run_good"})
        assert response.status_code == 200
        assert response.json()["schema_version"] == 1
        assert (await client.get(url)).json()["run"]["run_id"] == "run_good"
        report = await client.get("/api/v1/runs/run_good/baseline-comparison")
        assert report.status_code == 200
        assert report.json()["passed"]
        assert (await client.delete(url)).status_code == 200
        assert (await client.get("/api/v1/runs/run_good/baseline-comparison")).status_code == 404
