"""
Dynamic Custom Metric Evaluator.
"""

from __future__ import annotations

from evalgate.core.types import AssertionConfig, AssertionResult, AssertionType, TestCase
from evalgate.metrics.base import BaseSemanticMetric


class DynamicRubricMetric(BaseSemanticMetric):
    """
    Evaluates completion against arbitrary, user-defined grading rubrics on the fly.
    """

    async def evaluate(
        self,
        assertion: AssertionConfig,
        completion: str,
        test_case: TestCase,
    ) -> AssertionResult:
        rubric = str(assertion.rubric or assertion.value or "Evaluate overall output quality.")
        context_str = str(test_case.context or test_case.ground_truth or test_case.vars)

        judge_prompt = f"""
Evaluate the Generated Completion strictly against the following Custom Rubric.

[Custom Rubric & Criteria]:
{rubric}

[Input Variables & Context]:
{context_str}

[Generated Completion]:
{completion}

Respond ONLY with valid JSON in this schema:
{{
  "score": 1.0,
  "passed": true,
  "reasoning": "detailed evaluation explaining why the output meets or fails the rubric"
}}
Score must be a float between 0.0 (fails rubric) and 1.0 (exceeds criteria).
"""

        parsed = await self._invoke_structured_judge(judge_prompt)
        score = float(parsed.get("score", 0.0))
        threshold = assertion.threshold if assertion.threshold is not None else 0.85
        passed = score >= threshold and bool(parsed.get("passed", True))

        return AssertionResult(
            assertion_type=AssertionType.DYNAMIC_RUBRIC,
            passed=passed,
            score=score,
            threshold=threshold,
            reason=parsed.get("reasoning", f"Dynamic rubric score: {score:.2f}"),
        )
