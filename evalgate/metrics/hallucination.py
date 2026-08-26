"""
Hallucination Detection Metric.
"""

from __future__ import annotations

from evalgate.core.types import AssertionConfig, AssertionResult, AssertionType, TestCase
from evalgate.metrics.base import BaseSemanticMetric


class HallucinationMetric(BaseSemanticMetric):
    """
    Evaluates whether the completion introduces fabricated facts, contradictory claims,
    or unsubstantiated extrapolations.
    """

    async def evaluate(
        self,
        assertion: AssertionConfig,
        completion: str,
        test_case: TestCase,
    ) -> AssertionResult:
        context_str = str(test_case.context or test_case.ground_truth or test_case.vars)

        judge_prompt = f"""
Evaluate whether the Generated Completion contains any hallucinations, fabricated information,
or contradictions given the Ground Truth / Context.

[Ground Truth / Context]:
{context_str}

[Generated Completion]:
{completion}

Respond ONLY with valid JSON in this schema:
{{
  "hallucination_detected": false,
  "score": 1.0,
  "hallucinations": ["list of hallucinated statements, if any"],
  "reasoning": "explanation of whether any fabrication occurred"
}}
Score calculation: 1.0 = zero hallucinations (fully grounded), 0.0 = completely hallucinated.
"""

        parsed = await self._invoke_structured_judge(judge_prompt)
        score = float(parsed.get("score", 0.0))
        threshold = assertion.threshold if assertion.threshold is not None else 0.85
        passed = score >= threshold and not parsed.get("hallucination_detected", False)

        return AssertionResult(
            assertion_type=AssertionType.HALLUCINATION,
            passed=passed,
            score=score,
            threshold=threshold,
            reason=parsed.get("reasoning", f"Hallucination score: {score:.2f}"),
            details={"hallucinations": parsed.get("hallucinations", [])},
        )
