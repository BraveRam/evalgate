"""
Intent Classification and Action Adherence Metric.
"""

from __future__ import annotations

from evalgate.core.types import AssertionConfig, AssertionResult, AssertionType, TestCase
from evalgate.metrics.base import BaseSemanticMetric


class IntentMetric(BaseSemanticMetric):
    """
    Evaluates whether the model correctly fulfilled the expected intent, action, or categorization.
    """

    async def evaluate(
        self,
        assertion: AssertionConfig,
        completion: str,
        test_case: TestCase,
    ) -> AssertionResult:
        expected_intent = str(assertion.value or test_case.ground_truth or "")
        user_input = str(
            test_case.vars.get("query") or test_case.vars.get("input") or test_case.vars
        )

        judge_prompt = f"""
Evaluate whether the Generated Completion fulfills the Expected Intent given the User Input.

[User Input]:
{user_input}

[Expected Intent / Action]:
{expected_intent}

[Generated Completion]:
{completion}

Respond ONLY with valid JSON in this schema:
{{
  "intent_fulfilled": true,
  "score": 1.0,
  "reasoning": "explanation of intent match"
}}
Score must be between 0.0 (wrong intent/failed action) and 1.0 (perfect intent execution).
"""

        parsed = await self._invoke_structured_judge(judge_prompt)
        score = float(parsed.get("score", 0.0))
        threshold = assertion.threshold if assertion.threshold is not None else 0.85
        passed = score >= threshold and bool(parsed.get("intent_fulfilled", True))

        return AssertionResult(
            assertion_type=AssertionType.INTENT,
            passed=passed,
            score=score,
            threshold=threshold,
            reason=parsed.get("reasoning", f"Intent score: {score:.2f}"),
        )
