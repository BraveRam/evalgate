"""
Deterministic and Mathematical Evaluation Assertions.
"""

from __future__ import annotations

import ast
import json
import re

import jsonschema

from evalgate.core.types import AssertionConfig, AssertionResult, AssertionType, TestCase
from evalgate.targets.base import TargetOutput


def strip_codeblock(text: str, lang: str | None = None) -> str:
    """Strip markdown codeblock formatting if present."""
    cleaned = text.strip()
    if lang and cleaned.startswith(f"```{lang}"):
        cleaned = cleaned[len(lang) + 3 :]
    elif cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    return cleaned.strip()


def calculate_levenshtein_similarity(s1: str, s2: str) -> float:
    """
    Compute normalized Levenshtein string similarity in range [0.0, 1.0].
    """
    if not s1 and not s2:
        return 1.0
    if not s1 or not s2:
        return 0.0

    len1, len2 = len(s1), len(s2)
    dp = [[0] * (len2 + 1) for _ in range(len1 + 1)]

    for i in range(len1 + 1):
        dp[i][0] = i
    for j in range(len2 + 1):
        dp[0][j] = j

    for i in range(1, len1 + 1):
        for j in range(1, len2 + 1):
            cost = 0 if s1[i - 1] == s2[j - 1] else 1
            dp[i][j] = min(
                dp[i - 1][j] + 1,  # deletion
                dp[i][j - 1] + 1,  # insertion
                dp[i - 1][j - 1] + cost,  # substitution
            )

    distance = dp[len1][len2]
    max_len = max(len1, len2)
    return round(1.0 - (distance / max_len), 4)


def evaluate_deterministic_assertion(
    assertion: AssertionConfig,
    completion: str = "",
    test_case: TestCase | None = None,
    latency_ms: float = 0.0,
    total_tokens: int = 0,
    cost_usd: float = 0.0,
    cost_tracked: bool = True,
    output: TargetOutput | None = None,
) -> AssertionResult:
    """
    Evaluate a deterministic mathematical or syntactic assertion against an LLM completion.
    """
    if output is not None:
        completion = output.completion
        latency_ms = output.latency_ms
        total_tokens = output.total_tokens
        cost_usd = output.cost_usd
        cost_tracked = output.cost_tracked

    atype = assertion.type
    expected = assertion.value
    ground_truth = test_case.ground_truth if test_case else None

    # 1. JSON Schema Validation
    if atype == AssertionType.JSON_SCHEMA:
        if expected is None or (isinstance(expected, str) and not expected.strip()):
            return AssertionResult(
                assertion_type=atype,
                passed=False,
                score=0.0,
                reason="Assertion 'json_schema' requires a non-empty schema object or string",
            )
        schema = expected
        if isinstance(schema, str):
            try:
                schema = json.loads(schema)
            except json.JSONDecodeError as err:
                return AssertionResult(
                    assertion_type=atype,
                    passed=False,
                    score=0.0,
                    reason=f"Invalid JSON schema: {err}",
                )
        if not isinstance(schema, (dict, bool)):
            return AssertionResult(
                assertion_type=atype,
                passed=False,
                score=0.0,
                reason="JSON schema must be an object or a boolean",
            )
        try:
            cleaned = strip_codeblock(completion, "json")
            parsed_json = json.loads(cleaned)
            jsonschema.validate(instance=parsed_json, schema=schema)
            return AssertionResult(
                assertion_type=atype,
                passed=True,
                score=1.0,
                reason="Completion is valid JSON conforming to the schema",
                details={"parsed": parsed_json},
            )
        except json.JSONDecodeError as err:
            return AssertionResult(
                assertion_type=atype,
                passed=False,
                score=0.0,
                reason=f"Failed to parse output as valid JSON: {err}",
            )
        except jsonschema.ValidationError as err:
            return AssertionResult(
                assertion_type=atype,
                passed=False,
                score=0.0,
                reason=f"JSON schema validation failed: {err.message}",
                details={"path": list(err.path)},
            )
        except jsonschema.SchemaError as err:
            return AssertionResult(
                assertion_type=atype,
                passed=False,
                score=0.0,
                reason=f"Invalid JSON schema: {err.message}",
            )

    # 2. Python AST Syntax Validation
    if atype == AssertionType.PYTHON_AST:
        try:
            cleaned = strip_codeblock(completion, "python")
            ast.parse(cleaned)
            return AssertionResult(
                assertion_type=atype,
                passed=True,
                score=1.0,
                reason="Completion contains syntactically valid Python code",
            )
        except SyntaxError as err:
            return AssertionResult(
                assertion_type=atype,
                passed=False,
                score=0.0,
                reason=f"Python syntax error on line {err.lineno}: {err.msg}",
            )

    # 3. SQL Syntax Validation
    if atype == AssertionType.SQL_SYNTAX:
        cleaned = strip_codeblock(completion.rstrip(";"), "sql")
        sql_keywords = ("SELECT", "INSERT", "UPDATE", "DELETE", "CREATE", "ALTER", "DROP", "WITH")
        first_word = cleaned.split()[0].upper() if cleaned.split() else ""
        has_balanced_parens = cleaned.count("(") == cleaned.count(")")

        if first_word in sql_keywords and has_balanced_parens:
            return AssertionResult(
                assertion_type=atype,
                passed=True,
                score=1.0,
                reason="Completion is structured as a valid SQL statement",
            )
        return AssertionResult(
            assertion_type=atype,
            passed=False,
            score=0.0,
            reason="Output does not start with a valid SQL keyword or has unbalanced parentheses",
        )

    # 4. String Matchers
    if atype in (
        AssertionType.CONTAINS,
        AssertionType.NOT_CONTAINS,
        AssertionType.STARTS_WITH,
        AssertionType.ENDS_WITH,
        AssertionType.REGEX,
    ):
        if expected is None or (isinstance(expected, str) and not expected.strip()):
            return AssertionResult(
                assertion_type=atype,
                passed=False,
                score=0.0,
                reason=f"Assertion '{atype.value}' requires a non-empty string value",
            )

        target = str(expected)
        if atype == AssertionType.CONTAINS:
            passed = target in completion
            msg = f"{'Found' if passed else 'Did not find'} substring: '{target}'"
        elif atype == AssertionType.NOT_CONTAINS:
            passed = target not in completion
            prefix = "Correctly omitted" if passed else "Contained forbidden"
            msg = f"{prefix} substring: '{target}'"
        elif atype == AssertionType.STARTS_WITH:
            passed = completion.strip().startswith(target)
            msg = f"Completion {'starts' if passed else 'does not start'} with '{target}'"
        elif atype == AssertionType.ENDS_WITH:
            passed = completion.strip().endswith(target)
            msg = f"Completion {'ends' if passed else 'does not end'} with '{target}'"
        elif atype == AssertionType.REGEX:
            try:
                passed = bool(re.search(target, completion, re.MULTILINE))
                msg = f"Regex pattern '{target}' {'matched' if passed else 'failed to match'}"
            except re.error as err:
                return AssertionResult(
                    assertion_type=atype,
                    passed=False,
                    score=0.0,
                    reason=f"Invalid regex pattern '{target}': {err}",
                )

        return AssertionResult(
            assertion_type=atype,
            passed=passed,
            score=1.0 if passed else 0.0,
            reason=msg,
        )

    if atype in (AssertionType.EXACT, AssertionType.EXACT_MATCH):
        if expected is None and ground_truth is None:
            return AssertionResult(
                assertion_type=atype,
                passed=False,
                score=0.0,
                reason="Exact match requires an expected value or test case ground_truth",
            )
        target_str = str(expected if expected is not None else ground_truth)
        passed = completion.strip() == target_str.strip()
        return AssertionResult(
            assertion_type=atype,
            passed=passed,
            score=1.0 if passed else 0.0,
            reason=f"Completion {'matches' if passed else 'does not match'} expected value exactly",
        )

    # 5. Levenshtein String Similarity
    if atype == AssertionType.LEVENSHTEIN:
        if expected is None and ground_truth is None:
            return AssertionResult(
                assertion_type=atype,
                passed=False,
                score=0.0,
                threshold=assertion.threshold if assertion.threshold is not None else 0.85,
                reason=(
                    "Levenshtein similarity requires an expected value or test case ground_truth"
                ),
            )
        ref = str(expected if expected is not None else ground_truth)
        similarity = calculate_levenshtein_similarity(completion.strip(), ref.strip())
        threshold = assertion.threshold if assertion.threshold is not None else 0.85
        passed = similarity >= threshold
        return AssertionResult(
            assertion_type=atype,
            passed=passed,
            score=similarity,
            threshold=threshold,
            reason=f"Levenshtein similarity is {similarity:.2f} (required >= {threshold:.2f})",
        )

    # 6. Performance & Budget SLOs
    if atype == AssertionType.MAX_LATENCY_MS:
        try:
            max_limit = float(expected if expected is not None else 1000.0)
        except (ValueError, TypeError) as err:
            return AssertionResult(
                assertion_type=atype,
                passed=False,
                score=0.0,
                reason=f"Malformed numeric value '{expected}' for {atype.value}: {err}",
                details={"infra_error": True},
            )
        passed = latency_ms <= max_limit
        status_word = "within" if passed else "exceeded"
        score = (
            (1.0 if passed else 0.0)
            if max_limit == 0
            else round(max(0.0, 1.0 - (latency_ms / max_limit)), 2)
        )
        return AssertionResult(
            assertion_type=atype,
            passed=passed,
            score=score,
            threshold=max_limit,
            reason=f"Latency {latency_ms:.1f}ms {status_word} budget {max_limit:.1f}ms",
        )

    if atype == AssertionType.MAX_TOKENS:
        try:
            max_limit = int(expected if expected is not None else 1000)
        except (ValueError, TypeError) as err:
            return AssertionResult(
                assertion_type=atype,
                passed=False,
                score=0.0,
                reason=f"Malformed numeric value '{expected}' for {atype.value}: {err}",
                details={"infra_error": True},
            )
        passed = total_tokens <= max_limit
        status_word = "within" if passed else "exceeded"
        return AssertionResult(
            assertion_type=atype,
            passed=passed,
            score=1.0 if passed else 0.0,
            threshold=float(max_limit),
            reason=f"Total tokens {total_tokens} {status_word} budget {max_limit}",
        )

    if atype == AssertionType.MAX_COST_USD:
        try:
            max_limit = float(expected if expected is not None else 0.01)
        except (ValueError, TypeError) as err:
            return AssertionResult(
                assertion_type=atype,
                passed=False,
                score=0.0,
                reason=f"Malformed numeric value '{expected}' for {atype.value}: {err}",
                details={"infra_error": True},
            )

        if not cost_tracked:
            return AssertionResult(
                assertion_type=atype,
                passed=False,
                score=0.0,
                threshold=max_limit,
                reason="Inference cost was not reported by provider or could not be tracked",
                details={"cost_tracked": False},
            )

        passed = cost_usd <= max_limit
        status_word = "within" if passed else "exceeded"
        return AssertionResult(
            assertion_type=atype,
            passed=passed,
            score=1.0 if passed else 0.0,
            threshold=max_limit,
            reason=f"Total cost ${cost_usd:.6f} {status_word} budget ${max_limit:.6f}",
        )

    return AssertionResult(
        assertion_type=atype,
        passed=False,
        reason=f"Unsupported deterministic assertion type: {atype}",
    )
