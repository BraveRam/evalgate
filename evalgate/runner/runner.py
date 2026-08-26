"""
Concurrent Async Test Suite Runner and Arena Model Comparator.
"""

from __future__ import annotations

import asyncio
import math
import uuid
from datetime import datetime, timezone

from evalgate.core.graph import run_test_case
from evalgate.core.storage import StorageEngine
from evalgate.core.types import (
    ArenaComparisonResult,
    SuiteConfig,
    SuiteRunResult,
    TargetConfig,
    TestCase,
    TestCaseResult,
)
from evalgate.providers.base import BaseProvider
from evalgate.providers.factory import get_provider


def calculate_percentiles(latencies: list[float]) -> tuple[float, float, float]:
    """
    Compute average, P50 (median), and P95 latency percentiles from a list of latencies.
    """
    if not latencies:
        return 0.0, 0.0, 0.0

    sorted_latencies = sorted(latencies)
    n = len(sorted_latencies)
    avg_val = sum(sorted_latencies) / n

    # P50 (Median)
    p50_idx = int(math.ceil(0.50 * n)) - 1
    p50_val = sorted_latencies[max(0, p50_idx)]

    # P95
    p95_idx = int(math.ceil(0.95 * n)) - 1
    p95_val = sorted_latencies[max(0, p95_idx)]

    return round(avg_val, 2), round(p50_val, 2), round(p95_val, 2)


class SuiteRunner:
    """
    Concurrent async runner executing complete evaluation suites against targets and LLMs.
    """

    def __init__(self, storage: StorageEngine | None = None):
        self.storage = storage or StorageEngine()

    async def run_suite(
        self,
        suite: SuiteConfig,
        target_override: TargetConfig | None = None,
        judge_provider: BaseProvider | None = None,
        concurrency: int = 10,
        save_to_storage: bool = True,
    ) -> SuiteRunResult:
        """
        Execute all test cases in a SuiteConfig concurrently with bounded concurrency.
        """
        target = target_override or suite.target
        semaphore = asyncio.Semaphore(concurrency)

        # Default judge provider if not provided
        if judge_provider is None:
            judge_provider = get_provider(model="openai/gpt-4o-mini")

        async def _run_single(tc: TestCase) -> TestCaseResult:
            async with semaphore:
                return await run_test_case(
                    test_case=tc,
                    target_config=target,
                    default_assertions=suite.default_assertions,
                    judge_provider=judge_provider,
                )

        # Run all test cases in parallel
        tasks = [_run_single(tc) for tc in suite.tests]
        results: list[TestCaseResult] = await asyncio.gather(*tasks)

        # Compute Aggregations
        total_tests = len(results)
        passed_tests = sum(1 for r in results if r.passed)
        failed_tests = total_tests - passed_tests
        pass_rate = round(passed_tests / total_tests, 4) if total_tests > 0 else 1.0

        latencies = [r.latency_ms for r in results]
        avg_lat, p50_lat, p95_lat = calculate_percentiles(latencies)

        total_tokens = sum(r.total_tokens for r in results)
        total_cost = round(sum(r.cost_usd for r in results), 6)

        run_id = f"run_{uuid.uuid4().hex[:12]}"
        suite_passed = pass_rate >= suite.min_pass_rate

        run_result = SuiteRunResult(
            run_id=run_id,
            suite_name=suite.name,
            timestamp=datetime.now(timezone.utc),
            target_model=target.model,
            target_provider=target.provider or "auto",
            passed=suite_passed,
            pass_rate=pass_rate,
            total_tests=total_tests,
            passed_tests=passed_tests,
            failed_tests=failed_tests,
            avg_latency_ms=avg_lat,
            p50_latency_ms=p50_lat,
            p95_latency_ms=p95_lat,
            total_tokens=total_tokens,
            total_cost_usd=total_cost,
            results=results,
        )

        if save_to_storage:
            await self.storage.save_run(run_result)

        return run_result


async def compare_arena(
    suite: SuiteConfig,
    model_a: str,
    model_b: str,
    storage: StorageEngine | None = None,
    concurrency: int = 10,
) -> ArenaComparisonResult:
    """
    Run an A/B benchmark shootout comparing Model A vs Model B on the exact same suite.
    """
    runner = SuiteRunner(storage=storage)

    target_a = suite.target.model_copy(update={"model": model_a})
    target_b = suite.target.model_copy(update={"model": model_b})

    # Run both models concurrently
    run_a, run_b = await asyncio.gather(
        runner.run_suite(suite, target_override=target_a, concurrency=concurrency),
        runner.run_suite(suite, target_override=target_b, concurrency=concurrency),
    )

    pass_rate_delta = round(run_b.pass_rate - run_a.pass_rate, 4)
    latency_delta = round(run_b.p50_latency_ms - run_a.p50_latency_ms, 2)
    cost_delta = round(run_b.total_cost_usd - run_a.total_cost_usd, 6)

    # Find mismatched test cases
    results_a_map = {r.test_id: r.passed for r in run_a.results}
    results_b_map = {r.test_id: r.passed for r in run_b.results}

    mismatched = [
        t_id for t_id in results_a_map if results_a_map.get(t_id) != results_b_map.get(t_id)
    ]

    return ArenaComparisonResult(
        suite_name=suite.name,
        model_a=model_a,
        model_b=model_b,
        run_a=run_a,
        run_b=run_b,
        pass_rate_delta=pass_rate_delta,
        latency_p50_delta_ms=latency_delta,
        cost_delta_usd=cost_delta,
        mismatched_test_ids=mismatched,
    )
