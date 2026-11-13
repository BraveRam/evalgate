"""
Regression tests for External Dataset Loaders (JSONL / CSV) and Trace-to-Test.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from evalgate.api.app import app
from evalgate.cli.loader import SuiteLoadError, load_suite_from_yaml
from evalgate.core.types import AttemptResult, SuiteConfig, TargetConfig, TargetType, TestCase
from evalgate.mcp.server import create_mcp_server
from evalgate.runner.runner import SuiteRunner


def _write_suite_yaml(path: Path, *, dataset: str | list[str] | None = None, tests: list[dict] | None = None) -> None:
    lines = [
        f"name: {path.stem}",
        "target:",
        "  type: prompt",
        "  model: mock/simulator",
        "  template: 'Answer: {{question}}'",
        "default_assertions:",
        "  - type: not_contains",
        "    value: FORBIDDEN",
    ]
    if isinstance(dataset, str):
        lines.append(f"dataset: {dataset}")
    elif isinstance(dataset, list):
        lines.append("dataset:")
        for item in dataset:
            lines.append(f"  - {item}")
    if tests:
        lines.append("tests:")
        for tc in tests:
            lines.append(f"  - id: {tc['id']}")
            if "vars" in tc:
                lines.append("    vars:")
                for k, v in tc["vars"].items():
                    lines.append(f"      {k}: {json.dumps(v)}")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def test_load_suite_with_jsonl_and_csv_datasets(tmp_path: Path) -> None:
    sub_dir = tmp_path / "suites"
    sub_dir.mkdir()

    jsonl_file = sub_dir / "cases.jsonl"
    jsonl_file.write_text(
        "\n".join(
            [
                json.dumps({"id": "j1", "vars": {"question": "What is EvalGate?"}, "ground_truth": "An eval framework"}),
                json.dumps({"vars": {"question": "Missing ID row"}, "context": ["doc-a", "doc-b"]}),
            ]
        )
        + "\n",
        encoding="utf-8",
    )

    csv_file = sub_dir / "cases.csv"
    # UTF-8 BOM + JSON array context + plain string context + omitted ID
    csv_content = (
        "\ufeffid,question,ground_truth,context,tier\n"
        'c1,"How to refund?","Contact support","[""policy-1"",""policy-2""]",gold\n'
        ',"No ID CSV row","","plain context string",silver\n'
    )
    csv_file.write_text(csv_content, encoding="utf-8")

    suite_file = sub_dir / "support.yaml"
    _write_suite_yaml(
        suite_file,
        dataset=["cases.jsonl", "cases.csv"],
        tests=[{"id": "inline-1", "vars": {"question": "Inline question"}}],
    )

    suite = load_suite_from_yaml(suite_file)
    assert [tc.id for tc in suite.tests] == [
        "inline-1",
        "j1",
        "cases.jsonl:2",
        "c1",
        "cases.csv:2",
    ]
    assert suite.tests[1].ground_truth == "An eval framework"
    assert suite.tests[2].context == ["doc-a", "doc-b"]
    assert suite.tests[3].context == ["policy-1", "policy-2"]
    assert suite.tests[3].vars == {"question": "How to refund?", "tier": "gold"}
    assert suite.tests[4].context == "plain context string"
    assert suite.tests[4].ground_truth is None
    assert suite.tests[4].vars == {"question": "No ID CSV row", "tier": "silver"}


def test_autoload_and_dedupe_sibling_regressions_jsonl(tmp_path: Path) -> None:
    suite_file = tmp_path / "rag.yaml"
    regressions_file = tmp_path / "rag.regressions.jsonl"
    regressions_file.write_text(
        json.dumps({"id": "reg-1", "vars": {"question": "Regression Q"}}) + "\n",
        encoding="utf-8",
    )

    # Auto-loaded when not listed in dataset:
    _write_suite_yaml(suite_file, tests=[{"id": "base-1", "vars": {"question": "Base Q"}}])
    suite_auto = load_suite_from_yaml(suite_file)
    assert [tc.id for tc in suite_auto.tests] == ["base-1", "reg-1"]

    # Deduped when explicitly listed in dataset:
    _write_suite_yaml(
        suite_file,
        dataset="rag.regressions.jsonl",
        tests=[{"id": "base-1", "vars": {"question": "Base Q"}}],
    )
    suite_explicit = load_suite_from_yaml(suite_file)
    assert [tc.id for tc in suite_explicit.tests] == ["base-1", "reg-1"]


def test_duplicate_ids_and_traversal_rejected_on_load(tmp_path: Path) -> None:
    suite_dir = tmp_path / "evals"
    suite_dir.mkdir()
    outside = tmp_path / "secret.jsonl"
    outside.write_text(json.dumps({"id": "x", "vars": {"question": "hi"}}) + "\n", encoding="utf-8")

    suite_file = suite_dir / "dup.yaml"
    _write_suite_yaml(suite_file, dataset="../secret.jsonl")
    with pytest.raises(SuiteLoadError, match="escapes suite directory"):
        load_suite_from_yaml(suite_file)

    dup_jsonl = suite_dir / "cases.jsonl"
    dup_jsonl.write_text(json.dumps({"id": "same-id", "vars": {"question": "q"}}) + "\n", encoding="utf-8")
    _write_suite_yaml(
        suite_file,
        dataset="cases.jsonl",
        tests=[{"id": "same-id", "vars": {"question": "inline"}}],
    )
    with pytest.raises(SuiteLoadError, match="Duplicate test case IDs"):
        load_suite_from_yaml(suite_file)


@pytest.mark.asyncio
async def test_runner_preserves_trace_inputs_and_backward_compat() -> None:
    # Backward compatibility: legacy AttemptResult without vars/context/ground_truth
    legacy = AttemptResult.model_validate({"test_id": "legacy-1", "passed": True})
    assert legacy.vars is None
    assert legacy.context is None
    assert legacy.ground_truth is None

    suite = SuiteConfig(
        name="trace-fields-test",
        target=TargetConfig(
            type=TargetType.PROMPT,
            model="mock/simulator",
            template="Hi {{name}}",
        ),
        tests=[
            TestCase(
                id="t1",
                vars={"name": "Alice"},
                context=["ctx-1"],
                ground_truth="Hi Alice",
            )
        ],
    )
    runner = SuiteRunner()
    res = await runner.run_suite(suite, save_to_storage=False)
    assert len(res.results) == 1
    assert res.results[0].vars == {"name": "Alice"}
    assert res.results[0].context == ["ctx-1"]
    assert res.results[0].ground_truth == "Hi Alice"


def test_save_trace_api_endpoint_and_safety(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.chdir(tmp_path)
    evals_dir = tmp_path / "evals"
    evals_dir.mkdir()

    suite_file = evals_dir / "demo.yaml"
    _write_suite_yaml(suite_file, tests=[{"id": "seed-1", "vars": {"question": "Hello"}}])
    original_yaml = suite_file.read_text(encoding="utf-8")

    client = TestClient(app)

    # Save trace -> creates demo.regressions.jsonl without touching demo.yaml
    resp = client.post(
        "/api/v1/suites/demo/save-trace",
        json={
            "id": "trace-reg-1",
            "description": "Regression from run",
            "vars": {"question": "Scrubbed question"},
            "context": ["doc1"],
            "ground_truth": "Expected answer",
            "assertions": [{"type": "contains", "value": "Expected"}],
            "metadata": {
                "tag": "support",
                "timestamp": "2026-01-01T00:00:00Z",
                "latency_ms": 123.4,
                "cost_usd": 0.002,
                "raw_response": {"secret": "token"},
            },
        },
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["test_id"] == "trace-reg-1"
    assert body["dataset_path"] == "evals/demo.regressions.jsonl"
    assert body["test_case"]["metadata"] == {"tag": "support"}
    assert suite_file.read_text(encoding="utf-8") == original_yaml

    # Reloading suite now includes the saved regression case
    get_resp = client.get("/api/v1/suites/demo")
    assert get_resp.status_code == 200
    assert [t["id"] for t in get_resp.json()["tests"]] == ["seed-1", "trace-reg-1"]

    # Duplicate ID rejected with 409
    dup_resp = client.post(
        "/api/v1/suites/demo/save-trace",
        json={"id": "trace-reg-1", "vars": {"question": "dup"}},
    )
    assert dup_resp.status_code == 409

    # Reject .csv target and path traversal
    csv_resp = client.post(
        "/api/v1/suites/demo/save-trace",
        json={"id": "trace-reg-2", "vars": {}, "target_dataset": "cases.csv"},
    )
    assert csv_resp.status_code == 400

    trav_resp = client.post(
        "/api/v1/suites/demo/save-trace",
        json={"id": "trace-reg-2", "vars": {}, "target_dataset": "../outside.jsonl"},
    )
    assert trav_resp.status_code == 400


@pytest.mark.asyncio
async def test_mcp_save_trace_to_dataset(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.chdir(tmp_path)
    evals_dir = tmp_path / "evals"
    evals_dir.mkdir()
    suite_file = evals_dir / "mcp_demo.yaml"
    _write_suite_yaml(suite_file, tests=[{"id": "base", "vars": {"question": "Hi"}}])

    server = create_mcp_server()
    result = await server.call_tool(
        "evalgate_save_trace_to_dataset",
        {
            "suite_path": str(suite_file),
            "test_id": "mcp-reg-1",
            "vars": {"question": "MCP trace"},
            "metadata": {"latency_ms": 50, "source": "mcp"},
        },
    )
    # Extract structured payload from CallToolResult
    payload = result.structured_content or {}
    if "result" in payload:
        payload = payload["result"]
    assert payload["saved"] is True
    assert payload["test_id"] == "mcp-reg-1"
    assert payload["test_case"]["metadata"] == {"source": "mcp"}
    reloaded = load_suite_from_yaml(suite_file)
    assert [t.id for t in reloaded.tests] == ["base", "mcp-reg-1"]

    # Path traversal outside suite directory must be rejected even if inside repo cwd
    trav_result = await server.call_tool(
        "evalgate_save_trace_to_dataset",
        {
            "suite_path": str(suite_file),
            "test_id": "mcp-reg-escape",
            "vars": {"question": "Escape"},
            "target_dataset": "../outside.jsonl",
        },
    )
    trav_payload = trav_result.structured_content or {}
    if "result" in trav_payload:
        trav_payload = trav_payload["result"]
    assert "error" in trav_payload
    assert "escapes" in trav_payload["error"]
