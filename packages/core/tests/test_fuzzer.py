"""
Comprehensive Tests for Deterministic Suite Fuzzing & Edge-Case Generation.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from typer.testing import CliRunner

from evalgate.api.app import app as fastapi_app
from evalgate.cli.loader import load_suite_from_yaml
from evalgate.cli.main import app as cli_app
from evalgate.core.fuzzer import (
    INJECTION_SENTINEL,
    FuzzCategory,
    generate_fuzz_cases,
)
from evalgate.core.types import (
    AssertionConfig,
    AssertionType,
    SuiteConfig,
    TargetConfig,
    TargetType,
    TestCase,
)
from evalgate.mcp.server import create_mcp_server

client = TestClient(fastapi_app)
cli_runner = CliRunner()


def test_generate_fuzz_cases_preserves_structural_assertions_and_ignores_case_specific():
    suite = SuiteConfig(
        name="classifier-suite",
        target=TargetConfig(
            type=TargetType.STRUCTURED_OUTPUT,
            model="mock/simulator",
            template='Classify ticket: "{{ticket}}"',
            json_schema={
                "type": "object",
                "properties": {"category": {"type": "string"}},
                "required": ["category"],
            },
        ),
        tests=[
            TestCase(
                id="billing-1",
                vars={"ticket": "Double charged $99"},
                assertions=[
                    AssertionConfig(
                        type=AssertionType.JSON_SCHEMA,
                        value={"type": "object", "required": ["category"]},
                    ),
                    AssertionConfig(
                        type=AssertionType.CONTAINS,
                        value="billing",
                    ),
                ],
            )
        ],
    )

    generated = generate_fuzz_cases(suite, max_cases=5)
    assert len(generated) == 5

    categories = [g.category for g in generated]
    assert categories == [
        FuzzCategory.EMPTY,
        FuzzCategory.INJECTION,
        FuzzCategory.ESCAPING,
        FuzzCategory.BOUNDARY,
        FuzzCategory.UNICODE,
    ]

    for item in generated:
        assert item.source_test_id == "billing-1"
        assert item.target_variable == "ticket"
        assert item.test_case.id.startswith("billing-1-fuzz-")
        assertion_types = [a.type for a in item.test_case.assertions]
        # Structural JSON_SCHEMA preserved; case-specific CONTAINS ("billing") dropped
        assert AssertionType.JSON_SCHEMA in assertion_types
        assert AssertionType.CONTAINS not in assertion_types

    # Injection case must include NOT_CONTAINS sentinel assertion
    injection_case = next(g for g in generated if g.category == FuzzCategory.INJECTION)
    assert INJECTION_SENTINEL in injection_case.test_case.vars["ticket"]
    assert any(
        a.type == AssertionType.NOT_CONTAINS and a.value == INJECTION_SENTINEL
        for a in injection_case.test_case.assertions
    )


def test_generate_fuzz_cases_derives_target_json_schema_and_deduplicates_ids():
    suite = SuiteConfig(
        name="schema-target-suite",
        target=TargetConfig(
            type=TargetType.STRUCTURED_OUTPUT,
            model="mock/simulator",
            template="Analyze {{query}} for {{user}}",
            json_schema={"type": "object"},
        ),
        tests=[
            TestCase(
                id="case-1",
                vars={"query": "refund", "user": "Alice"},
                assertions=[],
            ),
            TestCase(
                id="case-1-fuzz-empty",
                vars={"query": "already exists", "user": "Bob"},
                assertions=[],
            ),
        ],
    )

    generated = generate_fuzz_cases(
        suite,
        categories=[FuzzCategory.EMPTY],
        max_cases=3,
    )
    assert len(generated) == 3
    # First seed's empty case ID collides with existing "case-1-fuzz-empty", so it gets "-2"
    assert generated[0].test_case.id == "case-1-fuzz-empty-2"
    assert any(a.type == AssertionType.JSON_SCHEMA for a in generated[0].test_case.assertions)
    # Third case mutates secondary variable ("user")
    assert generated[2].target_variable == "user"


def test_generate_fuzz_cases_validates_max_cases():
    suite = SuiteConfig(name="s", tests=[TestCase(id="t1", vars={"x": "1"})])
    with pytest.raises(ValueError, match="max_cases"):
        generate_fuzz_cases(suite, max_cases=0)
    with pytest.raises(ValueError, match="max_cases"):
        generate_fuzz_cases(suite, max_cases=51)
    with pytest.raises(ValueError, match="max_cases"):
        generate_fuzz_cases(suite, max_cases=True)


def test_cli_fuzz_dry_run_and_save(tmp_path: Path):
    suite_file = tmp_path / "fuzz_cli.yaml"
    suite_file.write_text(
        """name: "fuzz-cli-suite"
description: "CLI fuzzing test"
min_pass_rate: 1.0

target:
  type: "prompt"
  model: "mock/simulator"
  template: "Echo: {{text}}"

tests:
  - id: "base-case"
    vars:
      text: "Hello world"
    assertions:
      - type: "not_contains"
        value: "FORBIDDEN"
        strict: true
""",
        encoding="utf-8",
    )

    res = cli_runner.invoke(
        cli_app,
        [
            "fuzz",
            str(suite_file),
            "--categories",
            "empty,injection",
            "--max-cases",
            "2",
            "--run",
            "--save",
            "--json",
        ],
    )
    assert res.exit_code == 0, res.output
    payload = json.loads(res.stdout)
    assert payload["suite_name"] == "fuzz-cli-suite"
    assert len(payload["generated_cases"]) == 2
    assert payload["saved_count"] == 2
    assert payload["dry_run_result"] is not None
    assert payload["dry_run_result"]["total_tests"] == 2

    reloaded = load_suite_from_yaml(suite_file)
    assert len(reloaded.tests) == 3
    assert reloaded.tests[1].id == "base-case-fuzz-empty"
    assert reloaded.tests[2].id == "base-case-fuzz-injection"


def test_api_fuzz_suite_endpoint(tmp_path: Path):
    suite_dir = Path("evals")
    suite_dir.mkdir(parents=True, exist_ok=True)
    suite_file = suite_dir / "fuzz_api_temp_suite.yaml"
    suite_file.write_text(
        """name: "fuzz-api-temp-suite"
description: "API fuzz test"
min_pass_rate: 1.0

target:
  type: "prompt"
  model: "mock/simulator"
  template: "Query: {{q}}"

tests:
  - id: "q1"
    vars:
      q: "select users"
    assertions:
      - type: "sql_syntax"
        strict: true
""",
        encoding="utf-8",
    )
    try:
        res = client.post(
            "/api/v1/suites/fuzz-api-temp-suite/fuzz",
            json={
                "categories": ["empty", "injection", "escaping"],
                "max_cases": 3,
                "run_immediately": True,
                "save_to_suite": True,
            },
        )
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["suite_name"] == "fuzz-api-temp-suite"
        assert len(data["generated_cases"]) == 3
        assert data["saved_count"] == 3
        assert data["dry_run_result"]["total_tests"] == 3
        assert len(data["suite"]["tests"]) == 4
    finally:
        suite_file.unlink(missing_ok=True)


@pytest.mark.asyncio
async def test_mcp_fuzz_suite_tool(tmp_path: Path):
    suite_file = tmp_path / "mcp_fuzz.yaml"
    suite_file.write_text(
        """name: "mcp-fuzz-suite"
target:
  type: "prompt"
  model: "mock/simulator"
  template: "Summarize {{doc}}"
tests:
  - id: "d1"
    vars:
      doc: "Quarterly revenue grew 15%."
""",
        encoding="utf-8",
    )
    mcp_server = create_mcp_server()
    tool_fn = mcp_server._tool_manager._tools["evalgate_fuzz_suite"].fn
    res = await tool_fn(
        suite_path=str(suite_file),
        categories=["injection", "boundary"],
        max_cases=2,
        run_immediately=True,
        save_to_suite=True,
    )
    assert "error" not in res
    assert res["suite_name"] == "mcp-fuzz-suite"
    assert len(res["generated_cases"]) == 2
    assert res["saved_count"] == 2
    assert res["dry_run_result"]["total_tests"] == 2
