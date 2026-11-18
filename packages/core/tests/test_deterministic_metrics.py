"""
Tests for Deterministic and Mathematical Evaluators.
"""

import json

import pytest

from evalgate.core.types import AssertionConfig, AssertionType, TestCase
from evalgate.metrics.deterministic import (
    calculate_levenshtein_similarity,
    evaluate_deterministic_assertion,
)
from evalgate.metrics.registry import evaluate_assertion


def test_levenshtein_similarity():
    assert calculate_levenshtein_similarity("kitten", "sitting") > 0.5
    assert calculate_levenshtein_similarity("exact match", "exact match") == 1.0
    assert calculate_levenshtein_similarity("", "") == 1.0
    assert calculate_levenshtein_similarity("abc", "") == 0.0


def test_json_schema_assertion():
    schema = {
        "type": "object",
        "properties": {
            "name": {"type": "string"},
            "age": {"type": "number"},
        },
        "required": ["name", "age"],
    }
    assertion = AssertionConfig(type=AssertionType.JSON_SCHEMA, value=schema)
    test_case = TestCase(id="t1")

    # Valid JSON
    valid_completion = '```json\n{"name": "Alice", "age": 30}\n```'
    res = evaluate_deterministic_assertion(assertion, valid_completion, test_case)
    assert res.passed is True
    assert res.score == 1.0

    # Invalid JSON syntax
    broken_json = '{"name": "Alice", "age": '
    res_broken = evaluate_deterministic_assertion(assertion, broken_json, test_case)
    assert res_broken.passed is False

    # Valid JSON but failing Schema
    wrong_schema = '{"name": "Alice"}'
    res_wrong = evaluate_deterministic_assertion(assertion, wrong_schema, test_case)
    assert res_wrong.passed is False
    assert "age" in str(res_wrong.reason)


@pytest.mark.parametrize(
    ("schema", "completion", "expected_passed"),
    [
        (json.dumps({"type": "object", "required": ["priority"]}), "{}", False),
        (json.dumps({"type": "object", "required": ["priority"]}), '{"priority":"HIGH"}', True),
        (False, "{}", False),
        ("false", "{}", False),
        ("not JSON", "{}", False),
        ({"type": "unknown-type"}, "{}", False),
        ([], "{}", False),
        ({}, "{}", True),
    ],
)
def test_json_schema_strings_and_invalid_schemas(schema, completion, expected_passed):
    assertion = AssertionConfig(type=AssertionType.JSON_SCHEMA, value=schema)
    result = evaluate_deterministic_assertion(assertion, completion, TestCase(id="schema"))
    assert result.passed is expected_passed


def test_python_ast_assertion():
    assertion = AssertionConfig(type=AssertionType.PYTHON_AST)
    test_case = TestCase(id="t1")

    # Valid Python code
    valid_code = "```python\ndef add(a, b):\n    return a + b\n```"
    res = evaluate_deterministic_assertion(assertion, valid_code, test_case)
    assert res.passed is True

    # Invalid Python syntax
    invalid_code = "def broken(a, b return a +"
    res_invalid = evaluate_deterministic_assertion(assertion, invalid_code, test_case)
    assert res_invalid.passed is False
    assert "syntax error" in res_invalid.reason.lower()


def test_sql_syntax_assertion():
    assertion = AssertionConfig(type=AssertionType.SQL_SYNTAX)
    test_case = TestCase(id="t1")

    valid_sql = "```sql\nSELECT id, name FROM users WHERE active = 1;\n```"
    res = evaluate_deterministic_assertion(assertion, valid_sql, test_case)
    assert res.passed is True

    invalid_sql = "This is not SQL at all."
    res_invalid = evaluate_deterministic_assertion(assertion, invalid_sql, test_case)
    assert res_invalid.passed is False


def test_string_matchers():
    test_case = TestCase(id="t1")

    # Contains
    c_assertion = AssertionConfig(type=AssertionType.CONTAINS, value="SUCCESS")
    assert (
        evaluate_deterministic_assertion(c_assertion, "Status: SUCCESS", test_case).passed is True
    )
    assert evaluate_deterministic_assertion(c_assertion, "Status: ERROR", test_case).passed is False

    # Not Contains
    nc_assertion = AssertionConfig(type=AssertionType.NOT_CONTAINS, value="FORBIDDEN")
    assert evaluate_deterministic_assertion(nc_assertion, "Clean output", test_case).passed is True
    assert (
        evaluate_deterministic_assertion(nc_assertion, "Contains FORBIDDEN word", test_case).passed
        is False
    )

    # Starts With
    sw_assertion = AssertionConfig(type=AssertionType.STARTS_WITH, value="PREFIX")
    assert (
        evaluate_deterministic_assertion(sw_assertion, "PREFIX: Content", test_case).passed is True
    )
    assert (
        evaluate_deterministic_assertion(sw_assertion, "Other: Content", test_case).passed is False
    )

    # Ends With
    ew_assertion = AssertionConfig(type=AssertionType.ENDS_WITH, value="DONE")
    assert (
        evaluate_deterministic_assertion(ew_assertion, "All tasks DONE", test_case).passed is True
    )
    assert (
        evaluate_deterministic_assertion(ew_assertion, "All tasks PENDING", test_case).passed
        is False
    )

    # Regex
    regex_assertion = AssertionConfig(type=AssertionType.REGEX, value=r"Order #\d{4}")
    assert (
        evaluate_deterministic_assertion(
            regex_assertion, "Your Order #1234 has shipped", test_case
        ).passed
        is True
    )
    assert (
        evaluate_deterministic_assertion(regex_assertion, "No order number found", test_case).passed
        is False
    )


def test_budget_and_slo_assertions():
    test_case = TestCase(id="t1")

    # Latency SLO
    lat_assertion = AssertionConfig(type=AssertionType.MAX_LATENCY_MS, value=500.0)
    assert (
        evaluate_deterministic_assertion(lat_assertion, "Text", test_case, latency_ms=420.0).passed
        is True
    )
    assert (
        evaluate_deterministic_assertion(lat_assertion, "Text", test_case, latency_ms=650.0).passed
        is False
    )

    # Token Budget
    tok_assertion = AssertionConfig(type=AssertionType.MAX_TOKENS, value=100)
    assert (
        evaluate_deterministic_assertion(tok_assertion, "Text", test_case, total_tokens=85).passed
        is True
    )
    assert (
        evaluate_deterministic_assertion(tok_assertion, "Text", test_case, total_tokens=150).passed
        is False
    )

    # Cost Budget
    cost_assertion = AssertionConfig(type=AssertionType.MAX_COST_USD, value=0.001)
    assert (
        evaluate_deterministic_assertion(cost_assertion, "Text", test_case, cost_usd=0.0004).passed
        is True
    )
    assert (
        evaluate_deterministic_assertion(cost_assertion, "Text", test_case, cost_usd=0.0025).passed
        is False
    )


def test_explicit_zero_budget_limits():
    test_case = TestCase(id="zero-limits")
    for assertion_type, metric_name, amount in [
        (AssertionType.MAX_LATENCY_MS, "latency_ms", 1.0),
        (AssertionType.MAX_TOKENS, "total_tokens", 1),
        (AssertionType.MAX_COST_USD, "cost_usd", 0.005),
    ]:
        assertion = AssertionConfig(type=assertion_type, value=0)
        failed = evaluate_deterministic_assertion(
            assertion, "Text", test_case, **{metric_name: amount}
        )
        passed = evaluate_deterministic_assertion(assertion, "Text", test_case)
        assert failed.passed is False
        assert failed.threshold == 0
        assert passed.passed is True
        assert passed.threshold == 0
    assert failed.score == 0.0


@pytest.mark.parametrize(
    "assertion_type",
    [
        AssertionType.CONTAINS,
        AssertionType.NOT_CONTAINS,
        AssertionType.STARTS_WITH,
        AssertionType.ENDS_WITH,
        AssertionType.REGEX,
    ],
)
def test_matchers_fail_closed_when_value_is_missing(assertion_type):
    assertion = AssertionConfig.model_construct(
        type=assertion_type,
        value=None,
        strict=True,
    )
    result = evaluate_deterministic_assertion(assertion, "anything at all", TestCase(id="t"))
    assert result.passed is False
    assert "requires a non-empty" in (result.reason or "")


def test_exact_without_value_or_ground_truth_fails_on_empty_completion():
    assertion = AssertionConfig(type=AssertionType.EXACT)
    result = evaluate_deterministic_assertion(assertion, "", TestCase(id="t"))
    assert result.passed is False


@pytest.mark.asyncio
async def test_malformed_numeric_value_becomes_failed_assertion():
    assertion = AssertionConfig(type=AssertionType.MAX_LATENCY_MS, value="oops")
    result = await evaluate_assertion(
        assertion=assertion,
        completion="anything",
        test_case=TestCase(id="t"),
        latency_ms=1.0,
    )
    assert result.passed is False
    assert result.details.get("infra_error") is True
    assert "oops" in (result.reason or "")


@pytest.mark.asyncio
async def test_malformed_token_budget_becomes_failed_assertion():
    assertion = AssertionConfig(type=AssertionType.MAX_TOKENS, value="many")
    result = await evaluate_assertion(
        assertion=assertion,
        completion="anything",
        test_case=TestCase(id="t"),
        total_tokens=5,
    )
    assert result.passed is False
    assert result.details.get("infra_error") is True


def test_max_cost_usd_fails_closed_when_cost_is_untracked():
    assertion = AssertionConfig(type=AssertionType.MAX_COST_USD, value=0.01)
    result = evaluate_deterministic_assertion(
        assertion,
        "anything",
        TestCase(id="t"),
        cost_usd=0.0,
        cost_tracked=False,
    )
    assert result.passed is False
    assert "not reported" in (result.reason or "")


def test_string_matchers_with_zero_value_do_not_falsely_match_arbitrary_string():
    contains_zero = AssertionConfig(type=AssertionType.CONTAINS, value=0)
    result = evaluate_deterministic_assertion(
        contains_zero, "completely different", TestCase(id="t")
    )
    assert result.passed is False

    match_zero = evaluate_deterministic_assertion(contains_zero, "exit code: 0", TestCase(id="t"))
    assert match_zero.passed is True


def test_levenshtein_without_value_or_ground_truth_fails_on_empty_completion():
    assertion = AssertionConfig(type=AssertionType.LEVENSHTEIN)
    result = evaluate_deterministic_assertion(assertion, "", TestCase(id="t"))
    assert result.passed is False
    assert result.score == 0.0


def test_json_schema_fails_closed_when_schema_is_missing():
    assertion = AssertionConfig(type=AssertionType.JSON_SCHEMA, value=None)
    result = evaluate_deterministic_assertion(assertion, "{}", TestCase(id="t"))
    assert result.passed is False
    assert "requires a non-empty" in (result.reason or "")


def test_evaluate_deterministic_assertion_with_target_output():
    from evalgate.targets.base import TargetOutput

    assertion = AssertionConfig(type=AssertionType.MAX_LATENCY_MS, value=50.0)
    output = TargetOutput(completion="hello", latency_ms=25.0)
    result = evaluate_deterministic_assertion(assertion, output=output)
    assert result.passed is True
    assert result.threshold == 50.0


def test_string_matchers_fail_closed_on_empty_or_whitespace_value():
    for atype in [
        AssertionType.CONTAINS,
        AssertionType.NOT_CONTAINS,
        AssertionType.STARTS_WITH,
        AssertionType.ENDS_WITH,
        AssertionType.REGEX,
    ]:
        assertion = AssertionConfig(type=atype, value="   ")
        result = evaluate_deterministic_assertion(assertion, "some text", TestCase(id="t"))
        assert result.passed is False
        assert "requires a non-empty string value" in (result.reason or "")
