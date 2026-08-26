"""
Answer Relevancy Metric.
"""

from __future__ import annotations

from evalgate.core.types import AssertionConfig, AssertionResult, AssertionType, TestCase
from evalgate.metrics.base import BaseSemanticMetric


class RelevancyMetric(BaseSemanticMetric):
    """
    Measures how directly and concisely the response answers the input prompt
    without unnecessary filler or off-topic information.
    """

    async def evaluate(
        self,
        assertion: AssertionConfig,
        completion: str,
        test_case: TestCase,
    ) -> AssertionResult:
        query_str = str(
            test_case.vars.get("query") or test_case.vars.get("input") or test_case.vars
        )

        judge_prompt = f"""
Evaluate the relevancy of the Generated Completion to the Input Query.
Criteria:
- Does the response directly address what was asked?
- Is there irrelevant filler or evasive non-answers?

[Input Query]:
{query_str}

[Generated Completion]:
{completion}

Respond ONLY with valid JSON in this schema:
{{
  "score": 1.0,
  "is_relevant": true,
  "reasoning": "explanation of relevancy rating"
}}
Score must be a float between 0.0 (totally irrelevant) and 1.0 (perfectly relevant and direct).
"""

        parsed = await self._invoke_structured_judge(judge_prompt)
        score = float(parsed.get("score", 0.0))
        threshold = assertion.threshold if assertion.threshold is not None else 0.85
        passed = score >= threshold

        return AssertionResult(
            assertion_type=AssertionType.RELEVANCY,
            passed=passed,
            score=score,
            threshold=threshold,
            reason=parsed.get("reasoning", f"Relevancy score: {score:.2f}"),
        )
