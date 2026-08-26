"""
Unified Metric Evaluator Registry.
"""

from __future__ import annotations

from evalgate.core.types import AssertionConfig, AssertionResult, AssertionType, TestCase
from evalgate.metrics.base import BaseSemanticMetric
from evalgate.metrics.bias import BiasMetric
from evalgate.metrics.coherence import CoherenceMetric
from evalgate.metrics.deterministic import evaluate_deterministic_assertion
from evalgate.metrics.dynamic import DynamicRubricMetric
from evalgate.metrics.faithfulness import FaithfulnessMetric
from evalgate.metrics.hallucination import HallucinationMetric
from evalgate.metrics.intent import IntentMetric
from evalgate.metrics.relevancy import RelevancyMetric
from evalgate.providers.base import BaseProvider
from evalgate.providers.factory import get_provider

# Mapping of semantic assertion types to their evaluator classes
SEMANTIC_METRIC_MAP: dict[AssertionType, type[BaseSemanticMetric]] = {
    AssertionType.FAITHFULNESS: FaithfulnessMetric,
    AssertionType.HALLUCINATION: HallucinationMetric,
    AssertionType.RELEVANCY: RelevancyMetric,
    AssertionType.COHERENCE: CoherenceMetric,
    AssertionType.BIAS: BiasMetric,
    AssertionType.INTENT: IntentMetric,
    AssertionType.DYNAMIC_RUBRIC: DynamicRubricMetric,
}


async def evaluate_assertion(
    assertion: AssertionConfig,
    completion: str,
    test_case: TestCase,
    default_judge_provider: BaseProvider | None = None,
    latency_ms: float = 0.0,
    total_tokens: int = 0,
    cost_usd: float = 0.0,
) -> AssertionResult:
    """
    Dispatcher evaluating either a deterministic assertion or a semantic LLM-as-a-judge metric.
    """
    atype = assertion.type

    # 1. Deterministic / Mathematical Evaluator
    if atype not in SEMANTIC_METRIC_MAP:
        return evaluate_deterministic_assertion(
            assertion=assertion,
            completion=completion,
            test_case=test_case,
            latency_ms=latency_ms,
            total_tokens=total_tokens,
            cost_usd=cost_usd,
        )

    # 2. Semantic LLM-as-a-Judge Evaluator
    judge_provider = default_judge_provider
    if assertion.judge_model:
        judge_provider = get_provider(model=assertion.judge_model)
    elif judge_provider is None:
        judge_provider = get_provider(model="openai/gpt-4o-mini")

    metric_class = SEMANTIC_METRIC_MAP[atype]
    metric_instance = metric_class(judge_provider=judge_provider)

    try:
        return await metric_instance.evaluate(
            assertion=assertion,
            completion=completion,
            test_case=test_case,
        )
    except Exception as exc:
        return AssertionResult(
            assertion_type=atype,
            passed=False,
            score=0.0,
            reason=f"Semantic judge evaluation failed: {exc}",
        )
