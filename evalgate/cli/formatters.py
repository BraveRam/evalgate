"""
Rich Terminal Display Formatters for EvalGate.
"""

from __future__ import annotations

from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from evalgate.core.types import ArenaComparisonResult, SuiteConfig, SuiteRunResult

console = Console()


def render_header_panel(suite: SuiteConfig, target_model: str, concurrency: int) -> None:
    """Render the evaluation suite launch header."""
    info_text = (
        f"[bold cyan]Suite:[/] {suite.name}  |  "
        f"[bold cyan]Target Model:[/] [yellow]{target_model}[/]  |  "
        f"[bold cyan]Min Pass Rate:[/] {suite.min_pass_rate * 100:.0f}%  |  "
        f"[bold cyan]Concurrency:[/] {concurrency}  |  "
        f"[bold cyan]Tests:[/] {len(suite.tests)}"
    )
    if suite.description:
        info_text += f"\n[dim]{suite.description}[/dim]"

    console.print(Panel(info_text, title="[bold magenta]EvalGate Test Execution[/]", expand=False))


def render_run_summary(result: SuiteRunResult, verbose: bool = False) -> None:
    """Render the detailed results table and final pass/fail gate status."""
    table = Table(title="[bold]Test Case Results[/]", expand=True)
    table.add_column("ID", style="bold cyan", no_wrap=True)
    table.add_column("Status", justify="center", no_wrap=True)
    table.add_column("Latency", justify="right")
    table.add_column("Tokens", justify="right")
    table.add_column("Cost", justify="right")
    table.add_column("Assertions Summary", justify="left")

    for tc in result.results:
        status_pill = "[bold green]PASS[/]" if tc.passed else "[bold red]FAIL[/]"
        passed_asserts = sum(1 for a in tc.assertion_results if a.passed)
        total_asserts = len(tc.assertion_results)

        assert_str = (
            f"{passed_asserts}/{total_asserts} passed"
            if total_asserts > 0
            else "[dim]No assertions[/dim]"
        )

        if not tc.passed:
            failed_reasons = [
                f"[red]• {a.reason}[/red]" for a in tc.assertion_results if not a.passed
            ]
            if tc.error:
                failed_reasons.append(f"[red]• Error: {tc.error}[/red]")
            if failed_reasons:
                assert_str += "\n" + "\n".join(failed_reasons[:2])

        table.add_row(
            tc.test_id,
            status_pill,
            f"{tc.latency_ms:.0f}ms",
            str(tc.total_tokens),
            f"${tc.cost_usd:.5f}",
            assert_str,
        )

    console.print(table)

    # Verbose drilldown
    if verbose:
        for tc in result.results:
            status_text = "[green]PASSED[/]" if tc.passed else "[red]FAILED[/]"
            console.print(
                Panel(
                    f"[bold]Completion Output:[/]\n{tc.completion}\n\n"
                    f"[bold]Latency:[/] {tc.latency_ms:.1f}ms | "
                    f"[bold]Tokens:[/] {tc.total_tokens} (in: {tc.input_tokens}, "
                    f"out: {tc.output_tokens}) | [bold]Cost:[/] ${tc.cost_usd:.6f}",
                    title=f"[bold cyan]Detail: {tc.test_id}[/] - {status_text}",
                    expand=False,
                )
            )

    # Gate Outcome Summary Panel
    gate_badge = (
        "[bold white on green]  PASSED QUALITY GATE  [/]"
        if result.passed
        else "[bold white on red]  FAILED QUALITY GATE  [/]"
    )

    pass_details = (
        f"([green]{result.passed_tests} passed[/green], "
        f"[red]{result.failed_tests} failed[/red] of {result.total_tests})"
    )
    stats_text = (
        f"{gate_badge}\n\n"
        f"[bold]Pass Rate:[/] {result.pass_rate * 100:.1f}% {pass_details}\n"
        f"[bold]Latency:[/] Avg: [cyan]{result.avg_latency_ms:.0f}ms[/cyan] | "
        f"P50: [cyan]{result.p50_latency_ms:.0f}ms[/cyan] | "
        f"P95: [cyan]{result.p95_latency_ms:.0f}ms[/cyan]\n"
        f"[bold]Tokens:[/] {result.total_tokens:,} total  |  "
        f"[bold]Estimated Cost:[/] [yellow]${result.total_cost_usd:.6f}[/yellow]\n"
        f"[dim]Run ID: {result.run_id}[/dim]"
    )

    console.print(Panel(stats_text, title="[bold]Summary[/]", expand=False))


def render_arena_summary(comparison: ArenaComparisonResult) -> None:
    """Render side-by-side benchmark comparison between Model A and Model B."""
    table = Table(
        title=f"[bold]Arena Benchmark Shootout: {comparison.model_a} vs {comparison.model_b}[/]",
        expand=True,
    )
    table.add_column("Metric", style="bold")
    table.add_column(f"Model A: {comparison.model_a}", justify="right")
    table.add_column(f"Model B: {comparison.model_b}", justify="right")
    table.add_column("Delta (B - A)", justify="right")

    # Pass rate row
    pr_a = comparison.run_a.pass_rate * 100
    pr_b = comparison.run_b.pass_rate * 100
    delta_pr = comparison.pass_rate_delta * 100
    pr_color = "green" if delta_pr > 0 else "red" if delta_pr < 0 else "dim"
    table.add_row(
        "Pass Rate",
        f"{pr_a:.1f}%",
        f"{pr_b:.1f}%",
        f"[{pr_color}]{delta_pr:+.1f}%[/{pr_color}]",
    )

    # Latency row (Lower is better)
    p50_a = comparison.run_a.p50_latency_ms
    p50_b = comparison.run_b.p50_latency_ms
    delta_lat = comparison.latency_p50_delta_ms
    lat_color = "green" if delta_lat < 0 else "red" if delta_lat > 0 else "dim"
    table.add_row(
        "P50 Latency",
        f"{p50_a:.0f}ms",
        f"{p50_b:.0f}ms",
        f"[{lat_color}]{delta_lat:+.0f}ms[/{lat_color}]",
    )

    # Cost row (Lower is better)
    cost_a = comparison.run_a.total_cost_usd
    cost_b = comparison.run_b.total_cost_usd
    delta_cost = comparison.cost_delta_usd
    cost_color = "green" if delta_cost < 0 else "red" if delta_cost > 0 else "dim"
    table.add_row(
        "Total Cost",
        f"${cost_a:.5f}",
        f"${cost_b:.5f}",
        f"[{cost_color}]{delta_cost:+.5f}[/{cost_color}]",
    )

    # Tokens
    table.add_row(
        "Total Tokens",
        f"{comparison.run_a.total_tokens:,}",
        f"{comparison.run_b.total_tokens:,}",
        f"{comparison.run_b.total_tokens - comparison.run_a.total_tokens:+,}",
    )

    console.print(table)

    if comparison.mismatched_test_ids:
        console.print(
            f"[yellow]Mismatched Outcomes on Tests:[/] {', '.join(comparison.mismatched_test_ids)}"
        )


def render_runs_list(runs: list[SuiteRunResult]) -> None:
    """Render list of historical evaluation runs."""
    table = Table(title="[bold]Evaluation Runs History[/]", expand=False)
    table.add_column("Run ID", style="bold cyan", no_wrap=True)
    table.add_column("Suite", style="bold")
    table.add_column("Model", style="yellow")
    table.add_column("Status", justify="center")
    table.add_column("Pass", justify="right")
    table.add_column("P50", justify="right")
    table.add_column("Cost", justify="right")

    for r in runs:
        status_pill = "[bold green]PASS[/]" if r.passed else "[bold red]FAIL[/]"
        table.add_row(
            r.run_id,
            r.suite_name,
            r.target_model,
            status_pill,
            f"{r.pass_rate * 100:.1f}%",
            f"{r.p50_latency_ms:.0f}ms",
            f"${r.total_cost_usd:.5f}",
        )

    console.print(table)
