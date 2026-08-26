"""
Comprehensive Unit and Integration Tests for EvalGate MCP Server.
"""

import json
from pathlib import Path
from typing import Any

import pytest

from evalgate.mcp.server import create_mcp_server


@pytest.fixture
def mcp_server():
    return create_mcp_server()


@pytest.fixture
def sample_suite_yaml(tmp_path: Path) -> Path:
    suite_file = tmp_path / "mcp_test_suite.yaml"
    suite_file.write_text(
        """name: "mcp-test-suite"
description: "Suite for testing MCP integration"
min_pass_rate: 1.0

target:
  type: "prompt"
  model: "mock/simulator"
  template: "Output {{text}}"

tests:
  - id: "mcp-t1"
    vars:
      text: "hello world"
    assertions:
      - type: "max_latency_ms"
        value: 5000.0
""",
        encoding="utf-8",
    )
    return suite_file


@pytest.fixture
def failing_suite_yaml(tmp_path: Path) -> Path:
    suite_file = tmp_path / "mcp_fail_suite.yaml"
    suite_file.write_text(
        """name: "mcp-failing-suite"
min_pass_rate: 1.0

target:
  type: "prompt"
  model: "mock/simulator"
  template: "Output {{text}}"

tests:
  - id: "mcp-f1"
    vars:
      text: "hello"
    assertions:
      - type: "contains"
        value: "NON_EXISTENT_KEYWORD"
        strict: true
""",
        encoding="utf-8",
    )
    return suite_file


async def call_tool(server: Any, name: str, args: dict[str, Any]) -> Any:
    """Helper to invoke MCP tools and extract result data."""
    res = await server.call_tool(name, args)
    if res.structured_content and "result" in res.structured_content:
        return res.structured_content["result"]
    if res.structured_content:
        return res.structured_content
    if res.content and len(res.content) > 0:
        return json.loads(res.content[0].text)
    return {}


@pytest.mark.asyncio
async def test_mcp_run_suite_success(mcp_server, sample_suite_yaml: Path):
    res = await call_tool(mcp_server, "evalgate_run_suite", {"suite_path": str(sample_suite_yaml)})
    assert res["passed"] is True
    assert res["suite_name"] == "mcp-test-suite"
    assert res["total_tests"] == 1
    assert res["passed_tests"] == 1
    assert res["failed_tests"] == 0
    assert "run_id" in res


@pytest.mark.asyncio
async def test_mcp_run_suite_failure(mcp_server, failing_suite_yaml: Path):
    res = await call_tool(mcp_server, "evalgate_run_suite", {"suite_path": str(failing_suite_yaml)})
    assert res["passed"] is False
    assert res["failed_tests"] == 1
    assert len(res["failed_cases"]) == 1
    assert res["failed_cases"][0]["test_id"] == "mcp-f1"


@pytest.mark.asyncio
async def test_mcp_run_suite_invalid_path(mcp_server):
    res = await call_tool(mcp_server, "evalgate_run_suite", {"suite_path": "nonexistent_file.yaml"})
    assert res["passed"] is False
    assert "error" in res


@pytest.mark.asyncio
async def test_mcp_compare_models(mcp_server, sample_suite_yaml: Path):
    res = await call_tool(
        mcp_server,
        "evalgate_compare_models",
        {
            "suite_path": str(sample_suite_yaml),
            "model_a": "mock/a",
            "model_b": "mock/b",
        },
    )
    assert res["suite_name"] == "mcp-test-suite"
    assert res["model_a"] == "mock/a"
    assert res["model_b"] == "mock/b"
    assert "pass_rate_delta" in res
    assert "cost_delta_usd" in res


@pytest.mark.asyncio
async def test_mcp_compare_models_invalid_path(mcp_server):
    res = await call_tool(
        mcp_server,
        "evalgate_compare_models",
        {
            "suite_path": "nonexistent_file.yaml",
            "model_a": "mock/a",
            "model_b": "mock/b",
        },
    )
    assert "error" in res


@pytest.mark.asyncio
async def test_mcp_evaluate_completion_deterministic(mcp_server):
    # 1. Passing assertions
    res = await call_tool(
        mcp_server,
        "evalgate_evaluate_completion",
        {
            "completion": "def add(a, b):\n    return a + b",
            "assertions": [
                {"type": "python_ast", "strict": True},
                {"type": "contains", "value": "def add", "strict": True},
            ],
        },
    )
    assert res["all_passed"] is True
    assert res["passed_assertions"] == 2
    assert res["failed_assertions"] == 0

    # 2. Failing assertion
    fail_res = await call_tool(
        mcp_server,
        "evalgate_evaluate_completion",
        {
            "completion": "Hello world",
            "assertions": [
                {"type": "contains", "value": "missing keyword", "strict": True},
            ],
        },
    )
    assert fail_res["all_passed"] is False
    assert fail_res["failed_assertions"] == 1


@pytest.mark.asyncio
async def test_mcp_evaluate_completion_semantic_judge(mcp_server):
    res = await call_tool(
        mcp_server,
        "evalgate_evaluate_completion",
        {
            "completion": "ACME Corp revenue was $45.2M.",
            "context": ["ACME Corp recorded $45.2M in revenue in Q3 2024."],
            "ground_truth": "ACME revenue is $45.2M.",
            "assertions": [
                {"type": "faithfulness", "threshold": 0.8, "strict": True},
                {"type": "hallucination", "threshold": 0.8, "strict": True},
            ],
            "judge_model": "mock/simulator",
        },
    )
    assert res["total_assertions"] == 2
    assert res["all_passed"] is True


@pytest.mark.asyncio
async def test_mcp_evaluate_completion_invalid_assertion(mcp_server):
    res = await call_tool(
        mcp_server,
        "evalgate_evaluate_completion",
        {
            "completion": "test",
            "assertions": [{"type": "unknown_invalid_assertion_type_xyz"}],
        },
    )
    assert res["all_passed"] is False
    assert "error" in res


@pytest.mark.asyncio
async def test_mcp_list_and_trends(mcp_server, sample_suite_yaml: Path):
    # 1. Run suite to record data in SQLite
    await call_tool(mcp_server, "evalgate_run_suite", {"suite_path": str(sample_suite_yaml)})

    # 2. List runs
    runs = await call_tool(
        mcp_server,
        "evalgate_list_runs",
        {"suite_name": "mcp-test-suite", "limit": 10},
    )
    assert isinstance(runs, list)
    assert len(runs) >= 1
    assert runs[0]["suite_name"] == "mcp-test-suite"

    # 3. Trends
    trends = await call_tool(
        mcp_server,
        "evalgate_get_historical_trends",
        {"suite_name": "mcp-test-suite", "limit": 10},
    )
    assert trends["suite_name"] == "mcp-test-suite"
    assert trends["data_points"] >= 1
    assert len(trends["trends"]) >= 1


@pytest.mark.asyncio
async def test_mcp_list_suites(mcp_server, tmp_path: Path):
    # Create temp suites directory
    eval_dir = tmp_path / "test_suites"
    eval_dir.mkdir()
    (eval_dir / "suite_a.yaml").write_text(
        """name: "suite-a"
description: "Suite Alpha"
target:
  type: "prompt"
  model: "mock/simulator"
tests: []
""",
        encoding="utf-8",
    )
    (eval_dir / "suite_b.yml").write_text(
        """name: "suite-b"
target:
  type: "prompt"
  model: "mock/simulator"
tests:
  - id: "t1"
""",
        encoding="utf-8",
    )

    discovered = await call_tool(mcp_server, "evalgate_list_suites", {"search_dir": str(eval_dir)})
    assert len(discovered) == 2
    names = [s["name"] for s in discovered]
    assert "suite-a" in names
    assert "suite-b" in names
