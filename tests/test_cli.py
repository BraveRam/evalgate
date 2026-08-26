"""
Comprehensive Unit and Integration Tests for EvalGate CLI.
"""

import json
from pathlib import Path

import pytest
from typer.testing import CliRunner

from evalgate import __version__
from evalgate.cli.loader import SuiteLoadError, load_suite_from_yaml
from evalgate.cli.main import app

runner = CliRunner()


def test_cli_version():
    result = runner.invoke(app, ["version"])
    assert result.exit_code == 0
    assert __version__ in result.stdout
    assert "EvalGate" in result.stdout


def test_cli_mcp_and_studio_commands(monkeypatch: pytest.MonkeyPatch):
    # MCP command
    monkeypatch.setattr("evalgate.mcp.server.run_mcp_server", lambda transport="stdio": None)
    mcp_res = runner.invoke(app, ["mcp", "--transport", "sse"])
    assert mcp_res.exit_code == 0
    assert "Starting EvalGate MCP Server" in mcp_res.stdout

    # Studio command
    monkeypatch.setattr("uvicorn.run", lambda *args, **kwargs: None)
    studio_res = runner.invoke(app, ["studio", "--port", "3001"])
    assert studio_res.exit_code == 0
    assert "http://127.0.0.1:3001" in studio_res.stdout


def test_cli_init_and_idempotency(tmp_path: Path):
    target_dir = tmp_path / "evals_test"

    # First init creates files
    result1 = runner.invoke(app, ["init", "--dir", str(target_dir)])
    assert result1.exit_code == 0
    assert (target_dir / "rag_qa.yaml").exists()
    assert (target_dir / "sql_generator.yaml").exists()
    assert (target_dir / "classifier.yaml").exists()
    assert "Created template suite" in result1.stdout

    # Second init skips existing files
    result2 = runner.invoke(app, ["init", "--dir", str(target_dir)])
    assert result2.exit_code == 0
    assert "Skipped existing file" in result2.stdout


def test_suite_loader(tmp_path: Path):
    # 1. Valid YAML loading
    valid_file = tmp_path / "valid.yaml"
    valid_file.write_text(
        """name: "valid-suite"
target:
  type: "prompt"
  model: "mock/simulator"
  template: "Say {{word}}"
tests:
  - id: "t1"
    vars: {word: "hi"}
""",
        encoding="utf-8",
    )
    suite = load_suite_from_yaml(valid_file)
    assert suite.name == "valid-suite"
    assert len(suite.tests) == 1

    # 2. File not found
    with pytest.raises(SuiteLoadError, match="not found"):
        load_suite_from_yaml(tmp_path / "nonexistent.yaml")

    # 3. Invalid YAML syntax
    broken_yaml = tmp_path / "broken.yaml"
    broken_yaml.write_text("name: : broken syntax", encoding="utf-8")
    with pytest.raises(SuiteLoadError, match="Invalid YAML syntax"):
        load_suite_from_yaml(broken_yaml)

    # 4. Schema validation failure (extra forbidden field)
    schema_broken = tmp_path / "schema_broken.yaml"
    schema_broken.write_text(
        """name: "bad-schema"
target:
  type: "prompt"
  model: "mock/simulator"
invalid_unknown_key: "bad"
tests: []
""",
        encoding="utf-8",
    )
    with pytest.raises(SuiteLoadError, match="Schema validation failed"):
        load_suite_from_yaml(schema_broken)


def test_cli_run_passing_suite(tmp_path: Path):
    suite_file = tmp_path / "pass_suite.yaml"
    suite_file.write_text(
        """name: "passing-suite"
target:
  type: "prompt"
  model: "mock/simulator"
  template: "Echo {{query}}"
tests:
  - id: "case-1"
    vars: {query: "world"}
    assertions:
      - type: "max_latency_ms"
        value: 5000.0
""",
        encoding="utf-8",
    )

    result = runner.invoke(app, ["run", str(suite_file)])
    assert result.exit_code == 0
    assert "PASSED QUALITY GATE" in result.stdout
    assert "passing-suite" in result.stdout


def test_cli_run_overrides(tmp_path: Path):
    suite_file = tmp_path / "override_suite.yaml"
    suite_file.write_text(
        """name: "override-suite"
target:
  type: "prompt"
  model: "mock/original"
  template: "Echo {{query}}"
min_pass_rate: 1.0
tests:
  - id: "case-1"
    vars: {query: "world"}
    assertions:
      - type: "max_latency_ms"
        value: 5000.0
""",
        encoding="utf-8",
    )

    result = runner.invoke(
        app,
        [
            "run",
            str(suite_file),
            "--model",
            "mock/overridden",
            "--min-pass-rate",
            "0.8",
            "--verbose",
        ],
    )
    assert result.exit_code == 0
    assert "PASSED QUALITY GATE" in result.stdout
    assert "mock/overridden" in result.stdout


def test_cli_run_malformed_suite_exits_1(tmp_path: Path):
    broken_file = tmp_path / "malformed.yaml"
    broken_file.write_text("invalid: yaml: syntax: [", encoding="utf-8")

    result = runner.invoke(app, ["run", str(broken_file)])
    assert result.exit_code == 1
    assert "Error loading suite" in result.stdout


def test_cli_compare_malformed_suite_exits_1(tmp_path: Path):
    broken_file = tmp_path / "malformed_compare.yaml"
    broken_file.write_text("invalid: yaml: syntax: [", encoding="utf-8")

    result = runner.invoke(app, ["compare", str(broken_file)])
    assert result.exit_code == 1
    assert "Error loading suite" in result.stdout


def test_cli_run_failing_suite_closes_gate(tmp_path: Path):
    suite_file = tmp_path / "fail_suite.yaml"
    suite_file.write_text(
        """name: "failing-suite"
target:
  type: "prompt"
  model: "mock/simulator"
  template: "Echo {{query}}"
tests:
  - id: "case-fail"
    vars: {query: "world"}
    assertions:
      - type: "contains"
        value: "NON_EXISTENT_KEYWORD"
        strict: true
""",
        encoding="utf-8",
    )

    result = runner.invoke(app, ["run", str(suite_file)])
    assert result.exit_code == 1  # Gate closed!
    assert "FAILED QUALITY GATE" in result.stdout


def test_cli_run_json_output(tmp_path: Path):
    suite_file = tmp_path / "json_suite.yaml"
    suite_file.write_text(
        """name: "json-suite"
target:
  type: "prompt"
  model: "mock/simulator"
  template: "Echo {{query}}"
tests:
  - id: "case-1"
    vars: {query: "hello"}
""",
        encoding="utf-8",
    )

    result = runner.invoke(app, ["run", str(suite_file), "--json"])
    assert result.exit_code == 0
    parsed = json.loads(result.stdout)
    assert parsed["suite_name"] == "json-suite"
    assert parsed["passed"] is True
    assert len(parsed["results"]) == 1


def test_cli_compare(tmp_path: Path):
    suite_file = tmp_path / "compare_suite.yaml"
    suite_file.write_text(
        """name: "compare-suite"
target:
  type: "prompt"
  model: "mock/simulator"
  template: "Prompt {{query}}"
tests:
  - id: "t1"
    vars: {query: "arena"}
""",
        encoding="utf-8",
    )

    result = runner.invoke(
        app,
        ["compare", str(suite_file), "--model-a", "mock/a", "--model-b", "mock/b"],
    )
    assert result.exit_code == 0
    assert "Arena Benchmark Shootout" in result.stdout
    assert "Pass Rate" in result.stdout


def test_cli_list_and_view(tmp_path: Path):
    # 1. Run a suite to populate storage
    suite_file = tmp_path / "history_suite.yaml"
    suite_file.write_text(
        """name: "history-suite"
target:
  type: "prompt"
  model: "mock/simulator"
  template: "Data {{query}}"
tests:
  - id: "t1"
    vars: {query: "hist"}
""",
        encoding="utf-8",
    )
    run_res = runner.invoke(app, ["run", str(suite_file), "--json"])
    parsed = json.loads(run_res.stdout)
    run_id = parsed["run_id"]

    # 2. List runs
    list_res = runner.invoke(app, ["list"])
    assert list_res.exit_code == 0
    assert "Evaluation Runs History" in list_res.stdout
    assert "histor" in list_res.stdout

    # 3. View specific run
    view_res = runner.invoke(app, ["view", run_id])
    assert view_res.exit_code == 0
    assert run_id in view_res.stdout
    assert "PASSED QUALITY GATE" in view_res.stdout

    # 4. View nonexistent run
    bad_view = runner.invoke(app, ["view", "nonexistent_run_id"])
    assert bad_view.exit_code == 1
    assert "Run not found" in bad_view.stdout


def test_cli_list_empty_filter():
    list_res = runner.invoke(app, ["list", "--suite", "non_existent_suite_name_12345"])
    assert list_res.exit_code == 0
    assert "No evaluation runs found" in list_res.stdout
