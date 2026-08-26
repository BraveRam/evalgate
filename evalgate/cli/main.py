"""
EvalGate Command-Line Interface Entrypoint.
"""

import typer
from rich.console import Console

app = typer.Typer(
    name="evalgate",
    help="🛡️ EvalGate — Fast, local-first prompt evaluation, regression testing, and quality gates.",
    add_completion=False,
)
console = Console()


@app.callback()
def main_callback() -> None:
    """EvalGate CLI entrypoint."""
    pass


@app.command()
def version() -> None:
    """Show the current EvalGate version."""
    from evalgate import __version__

    console.print(f"[bold cyan]EvalGate[/bold cyan] version [green]{__version__}[/green]")


if __name__ == "__main__":
    app()
