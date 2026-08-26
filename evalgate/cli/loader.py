"""
YAML Evaluation Suite Loader and Schema Validator.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml
from pydantic import ValidationError

from evalgate.core.types import SuiteConfig


class SuiteLoadError(Exception):
    """Raised when an evaluation suite YAML cannot be found, parsed, or validated."""

    pass


def load_suite_from_yaml(file_path: Path | str) -> SuiteConfig:
    """
    Load, parse, and validate an evaluation suite YAML file into a SuiteConfig.
    """
    path = Path(file_path)
    if not path.exists():
        raise SuiteLoadError(f"Evaluation suite file not found: {path.resolve()}")

    try:
        raw_content = path.read_text(encoding="utf-8")
        parsed_yaml: Any = yaml.safe_load(raw_content)
    except yaml.YAMLError as err:
        raise SuiteLoadError(f"Invalid YAML syntax in {path.name}: {err}") from err
    except Exception as err:
        raise SuiteLoadError(f"Error reading file {path.name}: {err}") from err

    if not isinstance(parsed_yaml, dict):
        raise SuiteLoadError(
            f"Suite file {path.name} must contain a valid YAML mapping at the root."
        )

    try:
        return SuiteConfig.model_validate(parsed_yaml)
    except ValidationError as err:
        errors = err.errors()
        messages = [f"  - {' -> '.join(str(loc) for loc in e['loc'])}: {e['msg']}" for e in errors]
        formatted_err = "\n".join(messages)
        raise SuiteLoadError(f"Schema validation failed for {path.name}:\n{formatted_err}") from err
