"""
Coherence and Logical Structure Metric.
"""

from __future__ import annotations

from evalgate.core.types import AssertionConfig, AssertionResult, AssertionType, TestCase
from evalgate.metrics.base import BaseSemanticMetric


class CoherenceMetric(BaseSemanticMetric):
    """
    Evaluates logical flow, clarity, grammatical soundness, and absence of self-contradictions.
    """

    async def evaluate(
        self,
        assertion: AssertionConfig,
        completion: str,
        test_case: TestCase,
    ) -> AssertionResult:
        judge_prompt = f"""
Evaluate the coherence, structural clarity, and readability of the following text.
Criteria:
1. Logical flow & transitions between ideas
2. Clarity of thought & grammatical correctness
3. Absence of self-contradictions or repetitive loops

[Text to Evaluate]:
{completion}

Respond ONLY with valid JSON in this schema:
{{
  "score": 1.0,
  "is_coherent": true,
  "reasoning": "summary of logical flow and clarity"
}}
Score must be a float between 0.0 (incoherent/broken) and 1.0 (flawless logic and structure).
"""

        parsed = await self._invoke_structured_judge(judge_prompt)
        raw_score = float(parsed.get("score", 0.0))
        score = max(0.0, min(1.0, raw_score))
        threshold = assertion.threshold if assertion.threshold is not None else 0.85
        passed = score >= threshold

        return AssertionResult(
            assertion_type=AssertionType.COHERENCE,
            passed=passed,
            score=score,
            threshold=threshold,
            reason=parsed.get("reasoning", f"Coherence score: {score:.2f}"),
        )
