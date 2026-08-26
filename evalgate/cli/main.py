"""
EvalGate CLI - Quality Gates, Prompt Regression Testing & LLM Evaluation Platform.
"""

from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Annotated, Optional

import typer
from rich.console import Console

from evalgate import __version__
from evalgate.cli.formatters import (
    render_arena_summary,
    render_header_panel,
    render_run_summary,
    render_runs_list,
)
from evalgate.cli.loader import SuiteLoadError, load_suite_from_yaml
from evalgate.core.storage import StorageEngine
from evalgate.providers.factory import get_provider
from evalgate.runner.runner import SuiteRunner, compare_arena

app = typer.Typer(
    name="evalgate",
    help="Fast local-first prompt engineering, regression testing, and evaluation platform.",
    add_completion=False,
)
console = Console()


@app.command()
def version() -> None:
    """Print the current version of EvalGate."""
    console.print(f"[bold cyan]EvalGate[/] version [green]{__version__}[/]")


@app.command()
def init(
    target_dir: Annotated[
        Path,
        typer.Option("--dir", "-d", help="Directory where evaluation suites will be created."),
    ] = Path("evals"),
) -> None:
    """
    Scaffold example evaluation suites and local EvalGate directory structure.
    """
    target_dir.mkdir(parents=True, exist_ok=True)
    dot_evalgate = Path(".evalgate")
    dot_evalgate.mkdir(parents=True, exist_ok=True)

    # 1. RAG QA Suite
    rag_yaml = target_dir / "rag_qa.yaml"
    if not rag_yaml.exists():
        rag_yaml.write_text(
            """name: "rag-qa-suite"
description: "Evaluates RAG faithfulness, hallucination, and answer relevancy"
min_pass_rate: 1.0

target:
  type: "rag"
  model: "openai/gpt-4o-mini"
  temperature: 0.0

default_assertions:
  - type: "faithfulness"
    threshold: 0.85
    strict: true
  - type: "max_latency_ms"
    value: 3000.0
    strict: false

tests:
  - id: "rag-case-1"
    vars:
      query: "What was the company revenue in Q3 2024?"
    context:
      - "In Q3 2024, ACME Corp recorded a total revenue of $45.2M, reflecting a 12% YoY growth."
    ground_truth: "ACME Corp recorded $45.2M in Q3 2024."
    assertions:
      - type: "contains"
        value: "45.2M"
        strict: true
      - type: "hallucination"
        threshold: 0.90
        strict: true
""",
            encoding="utf-8",
        )

    # 2. SQL Generator Suite
    sql_yaml = target_dir / "sql_generator.yaml"
    if not sql_yaml.exists():
        sql_yaml.write_text(
            """name: "sql-generator-suite"
description: "Evaluates text-to-SQL generation and SQL syntax validity"
min_pass_rate: 1.0

target:
  type: "prompt"
  model: "openai/gpt-4o-mini"
  temperature: 0.0
  template: |
    Generate a standard SQL query for SQLite given the schema:
    Schema: users(id INTEGER PRIMARY KEY, email TEXT, active BOOLEAN, created_at TIMESTAMP)
    User Request: {{request}}
    Return ONLY the raw SQL query.

tests:
  - id: "active-users-query"
    vars:
      request: "Find all active users ordered by creation date"
    assertions:
      - type: "sql_syntax"
        strict: true
      - type: "contains"
        value: "active = 1"
        strict: false
""",
            encoding="utf-8",
        )

    # 3. Classifier & Structured Output Suite
    classifier_yaml = target_dir / "classifier.yaml"
    if not classifier_yaml.exists():
        classifier_yaml.write_text(
            """name: "support-ticket-classifier"
description: "Classifies support tickets and generates structured JSON output"
min_pass_rate: 1.0

target:
  type: "structured_output"
  model: "openai/gpt-4o-mini"
  temperature: 0.0
  template: |
    Classify this support ticket: "{{ticket}}"
  json_schema:
    type: "object"
    properties:
      category:
        type: "string"
        enum: ["billing", "technical", "feature_request"]
      priority:
        type: "string"
        enum: ["low", "medium", "high", "urgent"]
      sentiment:
        type: "string"
        enum: ["positive", "neutral", "frustrated"]
    required: ["category", "priority", "sentiment"]

tests:
  - id: "urgent-billing-case"
    vars:
      ticket: "I was double charged $99 for my subscription! Please fix this immediately!"
    assertions:
      - type: "json_schema"
        value:
          type: "object"
          properties:
            category: {"type": "string"}
            priority: {"type": "string"}
          required: ["category", "priority"]
        strict: true
      - type: "contains"
        value: "billing"
        strict: true
""",
            encoding="utf-8",
        )

    console.print("[bold green]Initialized EvalGate workspace![/]")
    console.print(f"  • Created suites directory: [cyan]{target_dir}/[/]")
    console.print(
        f"  • Scaffolding [cyan]{rag_yaml.name}[/], "
        f"[cyan]{sql_yaml.name}[/], [cyan]{classifier_yaml.name}[/]"
    )
    console.print(f"\nRun your first evaluation with: [bold yellow]evalgate run {rag_yaml}[/]")


@app.command()
def run(
    suite_path: Annotated[
        Path,
        typer.Argument(help="Path to evaluation suite YAML file."),
    ],
    model: Annotated[
        Optional[str],
        typer.Option("--model", "-m", help="Override target model name."),
    ] = None,
    judge: Annotated[
        Optional[str],
        typer.Option("--judge", "-j", help="Override semantic judge model name."),
    ] = None,
    concurrency: Annotated[
        int,
        typer.Option("--concurrency", "-c", help="Number of concurrent test executions."),
    ] = 10,
    min_pass_rate: Annotated[
        Optional[float],
        typer.Option("--min-pass-rate", help="Override required pass rate threshold [0.0 - 1.0]."),
    ] = None,
    verbose: Annotated[
        bool,
        typer.Option("--verbose", "-v", help="Display full completion outputs and debug details."),
    ] = False,
    no_save: Annotated[
        bool,
        typer.Option("--no-save", help="Do not persist run results to local SQLite database."),
    ] = False,
    json_output: Annotated[
        bool,
        typer.Option("--json", help="Output raw JSON results (useful for CI/CD scripting)."),
    ] = False,
) -> None:
    """
    Execute an evaluation suite against an LLM target and enforce quality gates.
    """
    try:
        suite = load_suite_from_yaml(suite_path)
    except SuiteLoadError as err:
        console.print(f"[bold red]Error loading suite:[/] {err}")
        raise typer.Exit(code=1)

    # Apply overrides
    target = suite.target
    if model:
        target = target.model_copy(update={"model": model})
    if min_pass_rate is not None:
        suite = suite.model_copy(update={"min_pass_rate": min_pass_rate})

    judge_provider = get_provider(model=judge) if judge else None

    if not json_output:
        render_header_panel(suite, target.model, concurrency)

    runner = SuiteRunner()

    status_msg = "" if json_output else "[bold green]Executing evaluation suite...[/]"
    with console.status(status_msg):
        run_result = asyncio.run(
            runner.run_suite(
                suite=suite,
                target_override=target,
                judge_provider=judge_provider,
                concurrency=concurrency,
                save_to_storage=not no_save,
            )
        )

    if json_output:
        # Print JSON to stdout
        console.print(run_result.model_dump_json(indent=2))
    else:
        render_run_summary(run_result, verbose=verbose)

    # Exit code: 0 if passed gate, 1 if failed
    if not run_result.passed:
        raise typer.Exit(code=1)


@app.command()
def compare(
    suite_path: Annotated[
        Path,
        typer.Argument(help="Path to evaluation suite YAML file."),
    ],
    model_a: Annotated[
        str,
        typer.Option("--model-a", "-a", help="First model to benchmark."),
    ] = "openai/gpt-4o-mini",
    model_b: Annotated[
        str,
        typer.Option("--model-b", "-b", help="Second model to benchmark."),
    ] = "anthropic/claude-3-5-sonnet",
    concurrency: Annotated[
        int,
        typer.Option("--concurrency", "-c", help="Number of concurrent test executions."),
    ] = 10,
) -> None:
    """
    Run an A/B benchmark shootout comparing two LLMs on the exact same evaluation suite.
    """
    try:
        suite = load_suite_from_yaml(suite_path)
    except SuiteLoadError as err:
        console.print(f"[bold red]Error loading suite:[/] {err}")
        raise typer.Exit(code=1)

    with console.status(f"[bold green]Running Arena Shootout: {model_a} vs {model_b}...[/]"):
        comparison = asyncio.run(
            compare_arena(
                suite=suite,
                model_a=model_a,
                model_b=model_b,
                concurrency=concurrency,
            )
        )

    render_arena_summary(comparison)


@app.command(name="list")
def list_runs(
    suite: Annotated[
        Optional[str],
        typer.Option("--suite", "-s", help="Filter runs by evaluation suite name."),
    ] = None,
    limit: Annotated[
        int,
        typer.Option("--limit", "-n", help="Maximum number of historical runs to display."),
    ] = 20,
) -> None:
    """
    List past evaluation runs from the local SQLite database.
    """
    storage = StorageEngine()
    runs = asyncio.run(storage.list_runs(suite_name=suite, limit=limit))
    if not runs:
        console.print("[yellow]No evaluation runs found in database.[/]")
        return

    render_runs_list(runs)


@app.command()
def view(
    run_id: Annotated[
        str,
        typer.Argument(help="Run ID to view."),
    ],
    verbose: Annotated[
        bool,
        typer.Option("--verbose", "-v", help="Display full completion outputs and details."),
    ] = True,
) -> None:
    """
    View detailed results of a past evaluation run.
    """
    storage = StorageEngine()
    run = asyncio.run(storage.get_run(run_id))
    if not run:
        console.print(f"[bold red]Run not found:[/] {run_id}")
        raise typer.Exit(code=1)

    render_run_summary(run, verbose=verbose)
