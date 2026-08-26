"""
Tests for LangGraph State Machine, SuiteRunner, and Arena Comparator.
"""

from pathlib import Path

import pytest

from evalgate.core.graph import run_test_case
from evalgate.core.storage import StorageEngine
from evalgate.core.types import (
    AssertionConfig,
    AssertionType,
    SuiteConfig,
    TargetConfig,
    TargetType,
    TestCase,
)
from evalgate.runner.runner import SuiteRunner, calculate_percentiles, compare_arena


def test_calculate_percentiles():
    assert calculate_percentiles([]) == (0.0, 0.0, 0.0)
    assert calculate_percentiles([100.0]) == (100.0, 100.0, 100.0)

    # 10 values from 10 to 100
    latencies = [10.0 * i for i in range(1, 11)]
    avg, p50, p95 = calculate_percentiles(latencies)
    assert avg == 55.0
    assert p50 == 50.0
    assert p95 == 100.0


@pytest.mark.asyncio
async def test_langgraph_pipeline_execution():
    target = TargetConfig(
        type=TargetType.PROMPT,
        model="mock/simulator",
        template="Translate to French: {{text}}",
    )
    test_case = TestCase(
        id="case-1",
        vars={"text": "Hello"},
        assertions=[AssertionConfig(type=AssertionType.MAX_LATENCY_MS, value=1000.0)],
    )

    result = await run_test_case(
        test_case=test_case,
        target_config=target,
    )

    assert result.test_id == "case-1"
    assert result.passed is True
    assert len(result.assertion_results) == 1
    assert result.assertion_results[0].passed is True


@pytest.mark.asyncio
async def test_suite_runner_parallel_execution(tmp_path: Path):
    db_file = tmp_path / "runner_test.db"
    storage = StorageEngine(db_path=db_file)
    runner = SuiteRunner(storage=storage)

    suite = SuiteConfig(
        name="parallel-test-suite",
        target=TargetConfig(
            type=TargetType.PROMPT,
            model="mock/simulator",
            template="Count: {{num}}",
        ),
        tests=[
            TestCase(
                id=f"test-{i}",
                vars={"num": i},
                assertions=[AssertionConfig(type=AssertionType.MAX_LATENCY_MS, value=1000.0)],
            )
            for i in range(5)
        ],
    )

    run_result = await runner.run_suite(suite, concurrency=3)

    assert run_result.suite_name == "parallel-test-suite"
    assert run_result.total_tests == 5
    assert run_result.passed_tests == 5
    assert run_result.passed is True
    assert run_result.pass_rate == 1.0
    assert len(run_result.results) == 5

    # Verify saved in storage
    fetched = await storage.get_run(run_result.run_id)
    assert fetched is not None
    assert fetched.run_id == run_result.run_id


@pytest.mark.asyncio
async def test_arena_model_comparison(tmp_path: Path):
    db_file = tmp_path / "arena_test.db"
    storage = StorageEngine(db_path=db_file)

    suite = SuiteConfig(
        name="arena-shootout-suite",
        target=TargetConfig(
            type=TargetType.PROMPT,
            model="mock/simulator",
            template="Evaluate: {{input}}",
        ),
        tests=[
            TestCase(
                id="t1",
                vars={"input": "test"},
                assertions=[AssertionConfig(type=AssertionType.MAX_LATENCY_MS, value=1000.0)],
            )
        ],
    )

    arena_result = await compare_arena(
        suite=suite,
        model_a="mock/model-a",
        model_b="mock/model-b",
        storage=storage,
    )

    assert arena_result.suite_name == "arena-shootout-suite"
    assert arena_result.model_a == "mock/model-a"
    assert arena_result.model_b == "mock/model-b"
    assert arena_result.run_a.total_tests == 1
    assert arena_result.run_b.total_tests == 1
    assert isinstance(arena_result.pass_rate_delta, float)
