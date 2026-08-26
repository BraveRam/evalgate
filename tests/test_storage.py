"""
Tests for Async SQLite Storage Engine.
"""

from pathlib import Path

import pytest

from evalgate.core.storage import StorageEngine
from evalgate.core.types import (
    AssertionConfig,
    AssertionResult,
    AssertionType,
    SuiteConfig,
    SuiteRunResult,
    TargetConfig,
    TargetType,
    TestCase,
    TestCaseResult,
)


@pytest.mark.asyncio
async def test_storage_suite_crud(tmp_path: Path):
    db_file = tmp_path / "test_runs.db"
    storage = StorageEngine(db_path=db_file)
    await storage.init_db()

    suite = SuiteConfig(
        name="storage-test-suite",
        description="Testing SQLite storage for suites",
        target=TargetConfig(
            type=TargetType.PROMPT, model="openai/gpt-4o-mini", template="Answer: {{query}}"
        ),
        tests=[
            TestCase(
                id="test-1",
                vars={"query": "Hello"},
                assertions=[AssertionConfig(type=AssertionType.CONTAINS, value="Hello")],
            )
        ],
    )

    # Save
    await storage.save_suite(suite)

    # Get
    retrieved = await storage.get_suite("storage-test-suite")
    assert retrieved is not None
    assert retrieved.name == "storage-test-suite"
    assert len(retrieved.tests) == 1
    assert retrieved.tests[0].id == "test-1"

    # List
    all_suites = await storage.list_suites()
    assert len(all_suites) == 1
    assert all_suites[0].name == "storage-test-suite"


@pytest.mark.asyncio
async def test_storage_run_persistence(tmp_path: Path):
    db_file = tmp_path / "test_runs.db"
    storage = StorageEngine(db_path=db_file)
    await storage.init_db()

    run = SuiteRunResult(
        run_id="run-001",
        suite_name="storage-test-suite",
        target_model="openai/gpt-4o-mini",
        target_provider="openai",
        passed=True,
        pass_rate=1.0,
        total_tests=1,
        passed_tests=1,
        failed_tests=0,
        avg_latency_ms=310.5,
        p50_latency_ms=310.5,
        p95_latency_ms=310.5,
        total_tokens=120,
        total_cost_usd=0.00008,
        results=[
            TestCaseResult(
                test_id="test-1",
                passed=True,
                completion="Hello World",
                latency_ms=310.5,
                input_tokens=80,
                output_tokens=40,
                total_tokens=120,
                cost_usd=0.00008,
                assertion_results=[
                    AssertionResult(
                        assertion_type=AssertionType.CONTAINS,
                        passed=True,
                        reason="Found substring 'Hello'",
                    )
                ],
            )
        ],
    )

    # Save run
    await storage.save_run(run)

    # Retrieve run
    fetched_run = await storage.get_run("run-001")
    assert fetched_run is not None
    assert fetched_run.run_id == "run-001"
    assert fetched_run.passed is True
    assert len(fetched_run.results) == 1
    assert fetched_run.results[0].completion == "Hello World"

    # List runs
    runs = await storage.list_runs(suite_name="storage-test-suite")
    assert len(runs) == 1

    # Historical metrics
    metrics = await storage.get_historical_metrics("storage-test-suite")
    assert len(metrics) == 1
    assert metrics[0]["run_id"] == "run-001"
    assert metrics[0]["pass_rate"] == 1.0
