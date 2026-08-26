"""
Prompt Template Variable Interpolation and Extraction Engine.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Set

from jinja2 import BaseLoader, Environment, select_autoescape

# Regex for simple {{variable_name}} matching
VAR_PATTERN = re.compile(r"\{\{\s*([a-zA-Z0-9_\.\-]+)\s*\}\}")


def extract_template_variables(template: str) -> List[str]:
    """
    Extract unique variable names used in a prompt template.
    """
    if not template:
        return []
    matches = VAR_PATTERN.findall(template)
    seen: Set[str] = set()
    result: List[str] = []
    for m in matches:
        var_name = m.strip()
        if var_name not in seen:
            seen.add(var_name)
            result.append(var_name)
    return result


def render_template(template: str, variables: Dict[str, Any]) -> str:
    """
    Render prompt template with provided variable dictionary.
    Supports both standard Jinja2 formatting and simple {{variable}} interpolation.
    """
    if not template:
        return ""

    try:
        env = Environment(
            loader=BaseLoader(),
            autoescape=select_autoescape(default=False),
            trim_blocks=True,
            lstrip_blocks=True,
        )
        jinja_template = env.from_string(template)
        return jinja_template.render(**variables)
    except Exception:
        # Fallback to regex string replacement if Jinja encounters custom syntax
        def replace_var(match: re.Match[str]) -> str:
            var_name = match.group(1).strip()
            val = variables.get(var_name, match.group(0))
            if isinstance(val, (dict, list)):
                import json

                return json.dumps(val, indent=2)
            return str(val)

        return VAR_PATTERN.sub(replace_var, template)
