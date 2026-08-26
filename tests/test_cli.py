"""
Tests for EvalGate CLI Entrypoint.
"""

from typer.testing import CliRunner

from evalgate import __version__
from evalgate.cli.main import app

runner = CliRunner()


def test_cli_version():
    result = runner.invoke(app, ["version"])
    assert result.exit_code == 0
    assert __version__ in result.stdout
    assert "EvalGate" in result.stdout
