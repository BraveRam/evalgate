"""Shared preflight cost estimation for the CLI, REST API, and MCP server."""

from __future__ import annotations

import json
from typing import Any

from evalgate.core.pricing import calculate_cost, estimate_tokens
from evalgate.core.template import render_template
from evalgate.core.types import SuiteConfig


def estimate_suite_cost(
    suite: SuiteConfig,
    model: str | None = None,
    estimated_output_tokens_per_test: int = 150,
) -> dict[str, Any]:
    """Estimate target inference usage without executing models or saving a run."""
    if estimated_output_tokens_per_test < 1:
        raise ValueError("Estimated output tokens per test must be at least 1")

    target_model = model or suite.target.model
    total_input_tokens = 0
    for test_case in suite.tests:
        context = test_case.context
        context_str = "\n".join(context) if isinstance(context, list) else (context or "")
        variables = dict(test_case.vars)
        if context is not None:
            variables["context"] = context_str
        rendered = (
            render_template(suite.target.template, variables)
            if suite.target.template
            else json.dumps(test_case.vars)
        )
        system_prompt = render_template(suite.target.system_prompt or "", variables)
        total_input_tokens += estimate_tokens(f"{system_prompt}\n{context_str}\n{rendered}")

    total_tests = len(suite.tests)
    total_output_tokens = total_tests * estimated_output_tokens_per_test
    total_cost = calculate_cost(target_model, total_input_tokens, total_output_tokens)
    return {
        "suite_name": suite.name,
        "target_model": target_model,
        "total_tests": total_tests,
        "estimated_input_tokens": total_input_tokens,
        "estimated_output_tokens": total_output_tokens,
        "total_estimated_tokens": total_input_tokens + total_output_tokens,
        "estimated_cost_usd": round(total_cost, 6),
        "cost_per_test_usd": round(total_cost / total_tests, 6) if total_tests else 0.0,
    }
