"""
EvalGate CLI Package.
"""

from evalgate.cli.loader import SuiteLoadError, load_suite_from_yaml
from evalgate.cli.main import app

__all__ = [
    "app",
    "load_suite_from_yaml",
    "SuiteLoadError",
]
