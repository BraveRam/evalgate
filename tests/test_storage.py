"""
Tests for Async SQLite Storage Engine.
"""

from datetime import datetime, timedelta, timezone
from pathlib import Path

import aiosqlite
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
async def test_storage_suite_crud_and_upsert(tmp_path: Path):
    db_file = tmp_path / "test_runs.db"
    storage = StorageEngine(db_path=db_file)

    # Nonexistent lookup returns None
    assert await storage.get_suite("nonexistent") is None

    suite = SuiteConfig(
        name="storage-test-suite",
        description="Initial description",
        target=TargetConfig(
            type=TargetType.PROMPT,
            model="openai/gpt-4o-mini",
            template="Answer: {{query}}",
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

    # Retrieve
    retrieved = await storage.get_suite("storage-test-suite")
    assert retrieved is not None
    assert retrieved.name == "storage-test-suite"
    assert retrieved.description == "Initial description"
    assert len(retrieved.tests) == 1

    # Upsert with new description
    suite.description = "Updated description"
    await storage.save_suite(suite)

    updated = await storage.get_suite("storage-test-suite")
    assert updated is not None
    assert updated.description == "Updated description"

    # List
    all_suites = await storage.list_suites()
    assert len(all_suites) == 1
    assert all_suites[0].name == "storage-test-suite"


@pytest.mark.asyncio
async def test_storage_run_persistence_and_idempotency(tmp_path: Path):
    db_file = tmp_path / "test_runs.db"
    storage = StorageEngine(db_path=db_file)

    # Nonexistent run returns None
    assert await storage.get_run("nonexistent-run") is None

    def make_run(run_id: str, pass_val: bool = True) -> SuiteRunResult:
        return SuiteRunResult(
            run_id=run_id,
            suite_name="storage-test-suite",
            target_model="openai/gpt-4o-mini",
            target_provider="openai",
            passed=pass_val,
            pass_rate=1.0 if pass_val else 0.0,
            total_tests=1,
            passed_tests=1 if pass_val else 0,
            failed_tests=0 if pass_val else 1,
            avg_latency_ms=310.5,
            p50_latency_ms=310.5,
            p95_latency_ms=310.5,
            total_tokens=120,
            total_cost_usd=0.00008,
            results=[
                TestCaseResult(
                    test_id="test-1",
                    passed=pass_val,
                    completion="Hello World",
                    latency_ms=310.5,
                    input_tokens=80,
                    output_tokens=40,
                    total_tokens=120,
                    cost_usd=0.00008,
                    assertion_results=[
                        AssertionResult(
                            assertion_type=AssertionType.CONTAINS,
                            passed=pass_val,
                            reason="Found substring 'Hello'",
                        )
                    ],
                )
            ],
        )

    # 1. Save run
    run = make_run("run-001")
    await storage.save_run(run)

    fetched = await storage.get_run("run-001")
    assert fetched is not None
    assert fetched.run_id == "run-001"
    assert len(fetched.results) == 1

    # 2. Re-save the EXACT same run_id (Idempotency test)
    updated_run = make_run("run-001", pass_val=False)
    await storage.save_run(updated_run)

    # Verify run updated
    refetched = await storage.get_run("run-001")
    assert refetched is not None
    assert refetched.passed is False

    # 3. Test list_runs with and without suite filter
    all_runs = await storage.list_runs()
    assert len(all_runs) == 1

    filtered_runs = await storage.list_runs(suite_name="storage-test-suite")
    assert len(filtered_runs) == 1

    empty_runs = await storage.list_runs(suite_name="nonexistent-suite")
    assert len(empty_runs) == 0

    # 4. Verify test_results table does NOT have duplicate rows for this run_id
    async with aiosqlite.connect(db_file) as db:
        async with db.execute(
            "SELECT COUNT(*) FROM test_results WHERE run_id = 'run-001';"
        ) as cursor:
            count = (await cursor.fetchone())[0]
            assert count == 1, f"Expected 1 test_result row, found {count} (duplicate row bug!)"


@pytest.mark.asyncio
async def test_historical_metrics_returns_recent_window_chronologically(tmp_path: Path):
    db_file = tmp_path / "test_runs.db"
    storage = StorageEngine(db_path=db_file)

    now = datetime.now(timezone.utc)

    # Create 10 runs spaced 1 hour apart (run_0 is oldest, run_9 is newest)
    for i in range(10):
        timestamp = now - timedelta(hours=(10 - i))
        run = SuiteRunResult(
            run_id=f"run-{i:02d}",
            suite_name="trend-suite",
            timestamp=timestamp,
            target_model="openai/gpt-4o",
            target_provider="openai",
            passed=True,
            pass_rate=i / 10.0,
            total_tests=1,
            passed_tests=1,
            failed_tests=0,
            avg_latency_ms=100.0 + i,
            p50_latency_ms=100.0 + i,
            p95_latency_ms=100.0 + i,
            total_tokens=100,
            total_cost_usd=0.001,
            results=[],
        )
        await storage.save_run(run)

    # Fetch with limit=3: must return the 3 MOST RECENT runs (run-07, run-08, run-09) ordered ASC
    metrics = await storage.get_historical_metrics("trend-suite", limit=3)

    assert len(metrics) == 3
    assert metrics[0]["run_id"] == "run-07"
    assert metrics[1]["run_id"] == "run-08"
    assert metrics[2]["run_id"] == "run-09"
    # Ensure sorted chronologically ASC
    assert metrics[0]["timestamp"] < metrics[1]["timestamp"] < metrics[2]["timestamp"]
