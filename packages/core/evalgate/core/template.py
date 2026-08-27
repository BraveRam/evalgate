"""
Prompt Template Variable Interpolation and Extraction Engine.
"""

from __future__ import annotations

import json
import re
from typing import Any

from jinja2 import BaseLoader, StrictUndefined, TemplateSyntaxError, UndefinedError
from jinja2.sandbox import SandboxedEnvironment

# Regex for valid identifier {{variable_name}}
VAR_PATTERN = re.compile(r"\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}")


class TemplateVariableMissingError(ValueError):
    """Raised when a required template variable is not supplied in the test vars."""

    pass


class TemplateSecurityError(ValueError):
    """Raised when a template violates Jinja sandbox security constraints."""

    pass


def extract_template_variables(template: str) -> list[str]:
    """
    Extract unique variable names used in a prompt template.
    """
    if not template:
        return []
    matches = VAR_PATTERN.findall(template)
    seen: set[str] = set()
    result: list[str] = []
    for m in matches:
        var_name = m.strip()
        if var_name not in seen:
            seen.add(var_name)
            result.append(var_name)
    return result


def render_template(template: str, variables: dict[str, Any]) -> str:
    """
    Render prompt template safely using a SandboxedEnvironment and StrictUndefined.

    Raises:
        TemplateVariableMissingError: If a required variable is omitted.
        TemplateSecurityError: If an unsafe attribute access is attempted.
    """
    if not template:
        return ""

    try:
        env = SandboxedEnvironment(
            loader=BaseLoader(),
            autoescape=False,
            trim_blocks=True,
            lstrip_blocks=True,
            undefined=StrictUndefined,
        )
        jinja_template = env.from_string(template)
        return jinja_template.render(**variables)

    except UndefinedError as exc:
        raise TemplateVariableMissingError(
            f"Missing required template variable: {exc.message}"
        ) from exc

    except TemplateSyntaxError:
        # Graceful fallback for non-Jinja syntax with simple {{var}} regex matching
        def replace_var(match: re.Match[str]) -> str:
            var_name = match.group(1).strip()
            if var_name not in variables:
                raise TemplateVariableMissingError(
                    f"Missing required template variable: '{var_name}'"
                )
            val = variables[var_name]
            if isinstance(val, (dict, list)):
                return json.dumps(val, indent=2)
            return str(val)

        return VAR_PATTERN.sub(replace_var, template)

    except Exception as exc:
        # Sandbox security or generic Jinja execution failure
        raise TemplateSecurityError(f"Template execution failed or was blocked: {exc}") from exc
