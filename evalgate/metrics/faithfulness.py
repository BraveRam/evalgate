"""
Faithfulness & Groundedness Metric (RAG Evaluator).
"""

from __future__ import annotations

from evalgate.core.types import AssertionConfig, AssertionResult, AssertionType, TestCase
from evalgate.metrics.base import BaseSemanticMetric


class FaithfulnessMetric(BaseSemanticMetric):
    """
    Evaluates whether the completion is factually grounded in the provided reference context.
    Extracts atomic claims and verifies each claim against the context.
    """

    async def evaluate(
        self,
        assertion: AssertionConfig,
        completion: str,
        test_case: TestCase,
    ) -> AssertionResult:
        context_str = (
            "\n---\n".join(test_case.context)
            if isinstance(test_case.context, list)
            else str(test_case.context or test_case.ground_truth or "")
        )

        if not context_str.strip():
            # If no context provided, faithfulness cannot be evaluated against references
            return AssertionResult(
                assertion_type=AssertionType.FAITHFULNESS,
                passed=False,
                score=0.0,
                reason="No reference context or ground truth provided for faithfulness eval.",
            )

        judge_prompt = f"""
Given the Reference Context and the Generated Completion:
1. Extract all atomic factual statements made in the Generated Completion.
2. For each statement, determine if it can be directly inferred from the Reference Context.
3. Output a normalized faithfulness score between 0.0 and 1.0 (verified_claims / total_claims).

[Reference Context]:
{context_str}

[Generated Completion]:
{completion}

Respond ONLY with valid JSON in this schema:
{{
  "claims": [
    {{"claim": "statement text", "supported": true, "reason": "why supported or unsupported"}}
  ],
  "score": 0.0,
  "reasoning": "brief summary of faithfulness evaluation"
}}
"""

        parsed = await self._invoke_structured_judge(judge_prompt)
        score = float(parsed.get("score", 0.0))
        threshold = assertion.threshold if assertion.threshold is not None else 0.85
        passed = score >= threshold

        return AssertionResult(
            assertion_type=AssertionType.FAITHFULNESS,
            passed=passed,
            score=score,
            threshold=threshold,
            reason=parsed.get("reasoning", f"Faithfulness score: {score:.2f}"),
            details={"claims": parsed.get("claims", [])},
        )
