"""
Tests for Deterministic and Mathematical Evaluators.
"""

from evalgate.core.types import AssertionConfig, AssertionType, TestCase
from evalgate.metrics.deterministic import (
    calculate_levenshtein_similarity,
    evaluate_deterministic_assertion,
)


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
