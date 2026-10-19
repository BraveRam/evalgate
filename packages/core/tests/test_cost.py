"""Preflight estimation handles template inputs and draft suites without inference."""

from evalgate.core.cost import estimate_suite_cost
from evalgate.core.pricing import estimate_tokens
from evalgate.core.types import SuiteConfig, TargetConfig, TestCase


def test_estimate_renders_context_and_system_variables():
    suite = SuiteConfig(
        name="context-suite",
        target=TargetConfig(
            template="Context: {{context}} Query: {{query}}",
            system_prompt="Answer in {{language}}",
        ),
        tests=[
            TestCase(
                id="one", vars={"query": "Revenue?", "language": "English"}, context=["Revenue: $5"]
            )
        ],
    )
    estimate = estimate_suite_cost(suite)
    assert estimate["estimated_input_tokens"] == estimate_tokens(
        "Answer in English\nRevenue: $5\nContext: Revenue: $5 Query: Revenue?"
    )


def test_estimate_empty_draft_is_zero():
    estimate = estimate_suite_cost(SuiteConfig(name="draft"))
    assert estimate["total_tests"] == 0
    assert estimate["total_estimated_tokens"] == 0
    assert estimate["estimated_cost_usd"] == 0
    assert estimate["cost_per_test_usd"] == 0
