"""
Tests for Semantic LLM-as-a-Judge Metrics using Mock Judge.
"""

import json

import pytest

from evalgate.core.types import AssertionConfig, AssertionType, TestCase
from evalgate.metrics.bias import BiasMetric
from evalgate.metrics.coherence import CoherenceMetric
from evalgate.metrics.dynamic import DynamicRubricMetric
from evalgate.metrics.faithfulness import FaithfulnessMetric
from evalgate.metrics.hallucination import HallucinationMetric
from evalgate.metrics.intent import IntentMetric
from evalgate.metrics.relevancy import RelevancyMetric
from evalgate.providers.mock import MockProvider


@pytest.mark.asyncio
async def test_faithfulness_metric():
    mock_judge_response = json.dumps(
        {
            "claims": [{"claim": "Revenue grew 10%", "supported": True}],
            "score": 1.0,
            "reasoning": "All statements supported by context.",
        }
    )
    judge = MockProvider(mock_response=mock_judge_response)
    metric = FaithfulnessMetric(judge_provider=judge)

    assertion = AssertionConfig(type=AssertionType.FAITHFULNESS, threshold=0.85)
    test_case = TestCase(
        id="t1",
        context="Company revenue grew 10% in Q3.",
    )

    res = await metric.evaluate(assertion, "Revenue grew 10%", test_case)
    assert res.passed is True
    assert res.score == 1.0
    assert "supported by context" in res.reason.lower()


@pytest.mark.asyncio
async def test_faithfulness_metric_missing_context():
    judge = MockProvider()
    metric = FaithfulnessMetric(judge_provider=judge)

    assertion = AssertionConfig(type=AssertionType.FAITHFULNESS)
    test_case = TestCase(id="t1", context="")

    res = await metric.evaluate(assertion, "Some statement", test_case)
    assert res.passed is False
    assert "no reference context" in res.reason.lower()


@pytest.mark.asyncio
async def test_hallucination_metric():
    mock_judge_response = json.dumps(
        {
            "hallucination_detected": False,
            "score": 1.0,
            "reasoning": "No hallucinated claims.",
        }
    )
    judge = MockProvider(mock_response=mock_judge_response)
    metric = HallucinationMetric(judge_provider=judge)

    assertion = AssertionConfig(type=AssertionType.HALLUCINATION, threshold=0.85)
    test_case = TestCase(id="t1", ground_truth="Paris is the capital of France.")

    res = await metric.evaluate(assertion, "Paris is the capital of France.", test_case)
    assert res.passed is True
    assert res.score == 1.0


@pytest.mark.asyncio
async def test_relevancy_metric():
    mock_judge_response = json.dumps(
        {
            "is_relevant": True,
            "score": 0.95,
            "reasoning": "Direct and relevant answer.",
        }
    )
    judge = MockProvider(mock_response=mock_judge_response)
    metric = RelevancyMetric(judge_provider=judge)

    assertion = AssertionConfig(type=AssertionType.RELEVANCY, threshold=0.80)
    test_case = TestCase(id="t1", vars={"query": "What is 2+2?"})

    res = await metric.evaluate(assertion, "2+2 is 4.", test_case)
    assert res.passed is True
    assert res.score == 0.95


@pytest.mark.asyncio
async def test_coherence_metric():
    mock_judge_response = json.dumps(
        {
            "is_coherent": True,
            "score": 0.92,
            "reasoning": "Well structured paragraph.",
        }
    )
    judge = MockProvider(mock_response=mock_judge_response)
    metric = CoherenceMetric(judge_provider=judge)

    assertion = AssertionConfig(type=AssertionType.COHERENCE, threshold=0.85)
    test_case = TestCase(id="t1")

    res = await metric.evaluate(assertion, "First step... Second step...", test_case)
    assert res.passed is True
    assert res.score == 0.92


@pytest.mark.asyncio
async def test_bias_metric():
    mock_judge_response = json.dumps(
        {
            "bias_detected": False,
            "score": 1.0,
            "reasoning": "Unbiased and safe.",
        }
    )
    judge = MockProvider(mock_response=mock_judge_response)
    metric = BiasMetric(judge_provider=judge)

    assertion = AssertionConfig(type=AssertionType.BIAS, threshold=0.90)
    test_case = TestCase(id="t1")

    res = await metric.evaluate(assertion, "Neutral explanation.", test_case)
    assert res.passed is True
    assert res.score == 1.0


@pytest.mark.asyncio
async def test_intent_metric():
    mock_judge_response = json.dumps(
        {
            "intent_fulfilled": True,
            "score": 1.0,
            "reasoning": "Correct refund intent.",
        }
    )
    judge = MockProvider(mock_response=mock_judge_response)
    metric = IntentMetric(judge_provider=judge)

    assertion = AssertionConfig(type=AssertionType.INTENT, value="PROCESS_REFUND")
    test_case = TestCase(id="t1", vars={"query": "I want my money back"})

    res = await metric.evaluate(assertion, "Refund initiated.", test_case)
    assert res.passed is True
    assert res.score == 1.0


@pytest.mark.asyncio
async def test_dynamic_rubric_metric():
    mock_judge_response = json.dumps(
        {
            "passed": True,
            "score": 0.96,
            "reasoning": "Followed all empathetic instructions.",
        }
    )
    judge = MockProvider(mock_response=mock_judge_response)
    metric = DynamicRubricMetric(judge_provider=judge)

    assertion = AssertionConfig(
        type=AssertionType.DYNAMIC_RUBRIC,
        rubric="Did the assistant apologize warmly?",
        threshold=0.90,
    )
    test_case = TestCase(id="t1")

    res = await metric.evaluate(assertion, "I am so sorry for the delay!", test_case)
    assert res.passed is True
    assert res.score == 0.96


@pytest.mark.asyncio
async def test_evaluate_assertion_dispatcher():
    from evalgate.metrics.registry import evaluate_assertion

    test_case = TestCase(id="t1")

    # 1. Deterministic via dispatcher
    det_assertion = AssertionConfig(type=AssertionType.CONTAINS, value="SUCCESS")
    det_res = await evaluate_assertion(det_assertion, "SUCCESS: Done", test_case)
    assert det_res.passed is True

    # 2. Semantic via dispatcher with mock judge
    mock_resp_json = json.dumps({"score": 1.0, "is_coherent": True, "reasoning": "Good"})
    mock_judge = MockProvider(mock_response=mock_resp_json)
    sem_assertion = AssertionConfig(type=AssertionType.COHERENCE, threshold=0.8)
    sem_res = await evaluate_assertion(
        sem_assertion,
        "Clear text",
        test_case,
        default_judge_provider=mock_judge,
    )
    assert sem_res.passed is True
    assert sem_res.score == 1.0
