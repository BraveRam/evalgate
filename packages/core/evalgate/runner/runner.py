"""
Concurrent Async Test Suite Runner and Arena Model Comparator.
"""

from __future__ import annotations

import asyncio
import math
import uuid
from datetime import datetime, timezone
from typing import Any

from evalgate.core.baselines import BaselineSnapshot, compare_to_baseline
from evalgate.core.graph import run_test_case
from evalgate.core.repetition import attempt_counts
from evalgate.core.storage import StorageEngine
from evalgate.core.types import (
    ArenaComparisonResult,
    AttemptResult,
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


def validate_concurrency(concurrency: int) -> int:
    """Validate the shared concurrency bound for every runner entry point."""
    if (
        isinstance(concurrency, bool)
        or not isinstance(concurrency, int)
        or not 1 <= concurrency <= 50
    ):
        raise ValueError("concurrency must be an integer between 1 and 50")
    return concurrency


def validate_min_pass_rate(value: float) -> float:
    """Validate an override using the same range as SuiteConfig."""
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not 0.0 <= value <= 1.0:
        raise ValueError("min_pass_rate must be between 0.0 and 1.0")
    return float(value)


def validate_run_inputs(suite: SuiteConfig, concurrency: int) -> None:
    validate_concurrency(concurrency)
    validate_min_pass_rate(suite.min_pass_rate)
    if not suite.tests:
        raise ValueError("Cannot run a suite with zero tests")
    ids = [case.id for case in suite.tests]
    if len(set(ids)) != len(ids) or any(not test_id.strip() for test_id in ids):
        raise ValueError("Runs require unique, non-empty test IDs")


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
        on_test_complete: Any | None = None,
        baseline: BaselineSnapshot | None = None,
        repeat: int | None = None,
        max_success_rate_drop: float | None = None,
    ) -> SuiteRunResult:
        """
        Execute all test cases in a SuiteConfig concurrently with bounded concurrency.
        """
        validate_run_inputs(suite, concurrency)
        counts = attempt_counts(suite, repeat)
        drop = (
            suite.max_success_rate_drop if max_success_rate_drop is None else max_success_rate_drop
        )
        if drop is not None:
            drop = validate_min_pass_rate(drop)
        if baseline is None and save_to_storage:
            baseline = await self.storage.get_baseline(suite.name)
        if baseline is not None:
            if baseline.run.suite_name != suite.name:
                raise ValueError("Baseline and candidate must belong to the same suite")
        target = target_override or suite.target
        semaphore = asyncio.Semaphore(concurrency)

        # Default judge provider if not provided
        if judge_provider is None:
            judge_provider = get_provider(model="openai/gpt-4o-mini")

        async def _run_single(tc: TestCase, index: int) -> TestCaseResult:
            async with semaphore:
                res = await run_test_case(
                    test_case=tc,
                    target_config=target,
                    default_assertions=suite.default_assertions,
                    judge_provider=judge_provider,
                )
                res.attempt_index = index
                if on_test_complete:
                    on_test_complete(res)
                return res

        # Run all test cases in parallel
        tasks = [
            _run_single(tc, index + 1)
            for tc, count in zip(suite.tests, counts)
            for index in range(count)
        ]
        attempts: list[TestCaseResult] = await asyncio.gather(*tasks)
        results: list[TestCaseResult] = []
        offset = 0
        for count in counts:
            group = attempts[offset : offset + count]
            offset += count
            if count == 1:
                results.append(group[0])
                continue
            representative = next((a for a in group if not a.passed), group[0])
            summary = representative.model_copy(deep=True)
            summary.attempt_index = None
            summary.attempts = [
                AttemptResult.model_validate(
                    {key: getattr(a, key) for key in AttemptResult.model_fields}
                )
                for a in group
            ]
            summary.passed = all(a.passed for a in group)
            summary.latency_ms = sum(a.latency_ms for a in group) / count
            for field in ("input_tokens", "output_tokens", "total_tokens", "cost_usd"):
                setattr(summary, field, sum(getattr(a, field) for a in group))
            results.append(summary)

        # Compute Aggregations
        total_tests = len(results)
        passed_tests = sum(1 for r in results if r.passed)
        failed_tests = total_tests - passed_tests
        pass_rate = sum(a.passed for a in attempts) / len(attempts)

        latencies = [a.latency_ms for a in attempts]
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
            pass_rate=round(pass_rate, 4),
            total_tests=total_tests,
            passed_tests=passed_tests,
            failed_tests=failed_tests,
            avg_latency_ms=avg_lat,
            p50_latency_ms=p50_lat,
            p95_latency_ms=p95_lat,
            total_tokens=total_tokens,
            total_cost_usd=total_cost,
            results=results,
            metadata={"max_success_rate_drop": drop},
        )

        if baseline is not None:
            comparison = compare_to_baseline(run_result, baseline)
            run_result.metadata["baseline_comparison"] = comparison.model_dump(mode="json")
            run_result.passed = comparison.passed

        if save_to_storage:
            await self.storage.save_run(run_result)

        return run_result


async def compare_arena(
    suite: SuiteConfig,
    model_a: str,
    model_b: str,
    storage: StorageEngine | None = None,
    concurrency: int = 10,
    repeat: int | None = None,
) -> ArenaComparisonResult:
    """
    Run an A/B benchmark shootout comparing Model A vs Model B on the exact same suite.
    """
    runner = SuiteRunner(storage=storage)

    target_a = suite.target.model_copy(update={"model": model_a})
    target_b = suite.target.model_copy(update={"model": model_b})

    # Run both models concurrently
    run_a, run_b = await asyncio.gather(
        runner.run_suite(suite, target_override=target_a, concurrency=concurrency, repeat=repeat),
        runner.run_suite(suite, target_override=target_b, concurrency=concurrency, repeat=repeat),
    )

    pass_rate_delta = round(run_b.pass_rate - run_a.pass_rate, 4)
    latency_delta = round(run_b.p50_latency_ms - run_a.p50_latency_ms, 2)
    cost_delta = round(run_b.total_cost_usd - run_a.total_cost_usd, 6)

    # Find mismatched test cases
    results_a_map = {r.test_id: r.success_rate for r in run_a.results}
    results_b_map = {r.test_id: r.success_rate for r in run_b.results}

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
