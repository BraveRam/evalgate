"""
Deterministic and Mathematical Evaluation Assertions.
"""

from __future__ import annotations

import ast
import json
import re

import jsonschema

from evalgate.core.types import AssertionConfig, AssertionResult, AssertionType, TestCase


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
    completion: str,
    test_case: TestCase,
    latency_ms: float = 0.0,
    total_tokens: int = 0,
    cost_usd: float = 0.0,
) -> AssertionResult:
    """
    Evaluate a deterministic mathematical or syntactic assertion against an LLM completion.
    """
    atype = assertion.type
    expected = assertion.value

    # 1. JSON Schema Validation
    if atype == AssertionType.JSON_SCHEMA:
        schema = expected if isinstance(expected, dict) else None
        try:
            # Clean markdown codeblocks if LLM returned ```json ... ```
            cleaned = completion.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            elif cleaned.startswith("```"):
                cleaned = cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()

            parsed_json = json.loads(cleaned)
            if schema:
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

    # 2. Python AST Syntax Validation
    if atype == AssertionType.PYTHON_AST:
        try:
            cleaned = completion.strip()
            if cleaned.startswith("```python"):
                cleaned = cleaned[9:]
            elif cleaned.startswith("```"):
                cleaned = cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()

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
        cleaned = completion.strip().rstrip(";")
        if cleaned.startswith("```sql"):
            cleaned = cleaned[6:]
        elif cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

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

    # 4. String Matchers: Contains / Not Contains / Starts / Ends / Regex
    if atype == AssertionType.CONTAINS:
        target_str = str(expected or "")
        passed = target_str in completion
        return AssertionResult(
            assertion_type=atype,
            passed=passed,
            score=1.0 if passed else 0.0,
            reason=f"{'Found' if passed else 'Did not find'} substring: '{target_str}'",
        )

    if atype in (AssertionType.EXACT, AssertionType.EXACT_MATCH):
        target_str = str(expected or test_case.ground_truth or "")
        passed = completion.strip() == target_str.strip()
        return AssertionResult(
            assertion_type=atype,
            passed=passed,
            score=1.0 if passed else 0.0,
            reason=f"Completion {'matches' if passed else 'does not match'} expected value exactly",
        )

    if atype == AssertionType.NOT_CONTAINS:
        target_str = str(expected or "")
        passed = target_str not in completion
        prefix = "Correctly omitted" if passed else "Contained forbidden"
        return AssertionResult(
            assertion_type=atype,
            passed=passed,
            score=1.0 if passed else 0.0,
            reason=f"{prefix} substring: '{target_str}'",
        )

    if atype == AssertionType.STARTS_WITH:
        target_str = str(expected or "")
        passed = completion.strip().startswith(target_str)
        return AssertionResult(
            assertion_type=atype,
            passed=passed,
            score=1.0 if passed else 0.0,
            reason=f"Completion {'starts' if passed else 'does not start'} with '{target_str}'",
        )

    if atype == AssertionType.ENDS_WITH:
        target_str = str(expected or "")
        passed = completion.strip().endswith(target_str)
        return AssertionResult(
            assertion_type=atype,
            passed=passed,
            score=1.0 if passed else 0.0,
            reason=f"Completion {'ends' if passed else 'does not end'} with '{target_str}'",
        )

    if atype == AssertionType.REGEX:
        pattern = str(expected or "")
        try:
            match = bool(re.search(pattern, completion, re.MULTILINE))
            return AssertionResult(
                assertion_type=atype,
                passed=match,
                score=1.0 if match else 0.0,
                reason=f"Regex pattern '{pattern}' {'matched' if match else 'failed to match'}",
            )
        except re.error as err:
            return AssertionResult(
                assertion_type=atype,
                passed=False,
                score=0.0,
                reason=f"Invalid regex pattern '{pattern}': {err}",
            )

    # 5. Levenshtein String Similarity
    if atype == AssertionType.LEVENSHTEIN:
        ref = str(expected or test_case.ground_truth or "")
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
        max_limit = float(expected or 1000.0)
        passed = latency_ms <= max_limit
        status_word = "within" if passed else "exceeded"
        return AssertionResult(
            assertion_type=atype,
            passed=passed,
            score=round(max(0.0, 1.0 - (latency_ms / max_limit)), 2),
            threshold=max_limit,
            reason=f"Latency {latency_ms:.1f}ms {status_word} budget {max_limit:.1f}ms",
        )

    if atype == AssertionType.MAX_TOKENS:
        max_limit = int(expected or 1000)
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
        max_limit = float(expected or 0.01)
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
