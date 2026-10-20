"""
Async SQLite Storage Engine for EvalGate Suites and Historical Run Records.
"""

from __future__ import annotations

import asyncio
import json
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, AsyncGenerator

import aiosqlite

from evalgate.core.baselines import BaselineSnapshot
from evalgate.core.types import (
    PromptArenaResult,
    PromptArenaSummary,
    SuiteConfig,
    SuiteRunResult,
)

DEFAULT_DB_DIR = Path(".evalgate")
DEFAULT_DB_PATH = DEFAULT_DB_DIR / "runs.db"


class StorageEngine:
    """Manages SQLite persistence for evaluation suites and historical run records."""

    def __init__(self, db_path: Path | None = None):
        self.db_path = db_path or DEFAULT_DB_PATH
        self._initialized = False
        self._lock = asyncio.Lock()

    @asynccontextmanager
    async def _connect(self) -> AsyncGenerator[aiosqlite.Connection, None]:
        """
        Internal connection helper that automatically ensures the database schema
        is initialized once, and configures PRAGMA foreign_keys=ON and busy_timeout
        on every single connection.
        """
        if not self._initialized:
            async with self._lock:
                if not self._initialized:
                    await self._run_init_ddl()

        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("PRAGMA foreign_keys = ON;")
            await db.execute("PRAGMA busy_timeout = 5000;")
            yield db

    async def _run_init_ddl(self) -> None:
        """Run DDL schema migrations once."""
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("PRAGMA busy_timeout = 5000;")
            await db.execute("PRAGMA journal_mode = WAL;")
            await db.execute("PRAGMA foreign_keys = ON;")

            # Table for Suites
            await db.execute("""
                CREATE TABLE IF NOT EXISTS suites (
                    id TEXT PRIMARY KEY,
                    name TEXT UNIQUE NOT NULL,
                    description TEXT,
                    config_json TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)

            # Table for Runs
            await db.execute("""
                CREATE TABLE IF NOT EXISTS runs (
                    run_id TEXT PRIMARY KEY,
                    suite_name TEXT NOT NULL,
                    timestamp TIMESTAMP NOT NULL,
                    target_model TEXT NOT NULL,
                    target_provider TEXT NOT NULL,
                    passed BOOLEAN NOT NULL,
                    pass_rate REAL NOT NULL,
                    total_tests INTEGER NOT NULL,
                    passed_tests INTEGER NOT NULL,
                    failed_tests INTEGER NOT NULL,
                    avg_latency_ms REAL NOT NULL,
                    p50_latency_ms REAL NOT NULL,
                    p95_latency_ms REAL NOT NULL,
                    total_tokens INTEGER NOT NULL,
                    total_cost_usd REAL NOT NULL,
                    raw_json TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)

            # Table for individual test results
            await db.execute("""
                CREATE TABLE IF NOT EXISTS test_results (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    run_id TEXT NOT NULL,
                    test_id TEXT NOT NULL,
                    passed BOOLEAN NOT NULL,
                    latency_ms REAL NOT NULL,
                    total_tokens INTEGER NOT NULL,
                    cost_usd REAL NOT NULL,
                    completion TEXT,
                    error TEXT,
                    raw_json TEXT NOT NULL,
                    FOREIGN KEY(run_id) REFERENCES runs(run_id) ON DELETE CASCADE
                );
            """)

            await db.execute("""
                CREATE TABLE IF NOT EXISTS prompt_comparisons (
                    comparison_id TEXT PRIMARY KEY,
                    suite_name TEXT NOT NULL,
                    model TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    pass_rate_a REAL NOT NULL,
                    pass_rate_b REAL NOT NULL,
                    raw_json TEXT NOT NULL
                );
            """)
            await db.execute(
                "CREATE INDEX IF NOT EXISTS idx_prompt_comparisons_date "
                "ON prompt_comparisons(created_at DESC);"
            )

            # Covering indexes
            await db.execute("""
                CREATE TABLE IF NOT EXISTS baselines (
                    suite_name TEXT PRIMARY KEY,
                    raw_json TEXT NOT NULL
                );
            """)
            await db.execute(
                "CREATE INDEX IF NOT EXISTS idx_runs_suite ON runs(suite_name, timestamp DESC);"
            )
            await db.execute(
                "CREATE INDEX IF NOT EXISTS idx_test_results_run ON test_results(run_id);"
            )
            await db.execute(
                "CREATE INDEX IF NOT EXISTS idx_test_results_test ON test_results(test_id);"
            )

            await db.commit()
            self._initialized = True

    async def init_db(self) -> None:
        """Public method to explicitly initialize the database."""
        if not self._initialized:
            await self._run_init_ddl()

    async def save_suite(self, suite: SuiteConfig) -> None:
        """Upsert a suite configuration."""
        config_json = suite.model_dump_json()

        async with self._connect() as db:
            await db.execute(
                """
                INSERT INTO suites (id, name, description, config_json, updated_at)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(name) DO UPDATE SET
                    description = excluded.description,
                    config_json = excluded.config_json,
                    updated_at = CURRENT_TIMESTAMP;
            """,
                (suite.name, suite.name, suite.description, config_json),
            )
            await db.commit()

    async def get_suite(self, name: str) -> SuiteConfig | None:
        """Fetch a suite configuration by name."""
        async with self._connect() as db:
            query = "SELECT config_json FROM suites WHERE name = ?;"
            async with db.execute(query, (name,)) as cursor:
                row = await cursor.fetchone()
                if not row:
                    return None
                data = json.loads(row[0])
                return SuiteConfig.model_validate(data)

    async def list_suites(self) -> list[SuiteConfig]:
        """List all saved test suites."""
        async with self._connect() as db:
            async with db.execute("SELECT config_json FROM suites ORDER BY name ASC;") as cursor:
                rows = await cursor.fetchall()
                return [SuiteConfig.model_validate(json.loads(r[0])) for r in rows]

    async def save_run(self, run: SuiteRunResult) -> None:
        """
        Persist a complete evaluation run and its test case results idempotently.
        Deletes any previous test_results for this run_id to avoid duplicate rows on re-save.
        """
        raw_json = run.model_dump_json()

        insert_run_sql = """
            INSERT OR REPLACE INTO runs (
                run_id, suite_name, timestamp, target_model, target_provider,
                passed, pass_rate, total_tests, passed_tests, failed_tests,
                avg_latency_ms, p50_latency_ms, p95_latency_ms,
                total_tokens, total_cost_usd, raw_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """

        async with self._connect() as db:
            # 1. Upsert run record
            await db.execute(
                insert_run_sql,
                (
                    run.run_id,
                    run.suite_name,
                    run.timestamp.isoformat(),
                    run.target_model,
                    run.target_provider,
                    1 if run.passed else 0,
                    run.pass_rate,
                    run.total_tests,
                    run.passed_tests,
                    run.failed_tests,
                    run.avg_latency_ms,
                    run.p50_latency_ms,
                    run.p95_latency_ms,
                    run.total_tokens,
                    run.total_cost_usd,
                    raw_json,
                ),
            )

            # 2. Delete existing test results to guarantee idempotency on re-save
            await db.execute("DELETE FROM test_results WHERE run_id = ?;", (run.run_id,))

            # 3. Insert fresh test results
            insert_test_sql = """
                INSERT INTO test_results (
                    run_id, test_id, passed, latency_ms,
                    total_tokens, cost_usd, completion, error, raw_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
            """

            for tr in run.results:
                await db.execute(
                    insert_test_sql,
                    (
                        run.run_id,
                        tr.test_id,
                        1 if tr.passed else 0,
                        tr.latency_ms,
                        tr.total_tokens,
                        tr.cost_usd,
                        tr.completion,
                        tr.error,
                        tr.model_dump_json(),
                    ),
                )

            await db.commit()

    async def get_run(self, run_id: str) -> SuiteRunResult | None:
        """Fetch a run result by ID."""
        async with self._connect() as db:
            query = "SELECT raw_json FROM runs WHERE run_id = ?;"
            async with db.execute(query, (run_id,)) as cursor:
                row = await cursor.fetchone()
                if not row:
                    return None
                return SuiteRunResult.model_validate(json.loads(row[0]))

    async def get_baseline(self, suite_name: str) -> BaselineSnapshot | None:
        async with self._connect() as db:
            async with db.execute(
                "SELECT raw_json FROM baselines WHERE suite_name = ?", (suite_name,)
            ) as cursor:
                row = await cursor.fetchone()
                return BaselineSnapshot.model_validate_json(row[0]) if row else None

    async def set_baseline(self, run_id: str) -> BaselineSnapshot:
        run = await self.get_run(run_id)
        if run is None:
            raise ValueError(f"Run '{run_id}' not found")
        baseline = BaselineSnapshot(run=run)
        async with self._connect() as db:
            await db.execute(
                "INSERT INTO baselines (suite_name, raw_json) VALUES (?, ?) "
                "ON CONFLICT(suite_name) DO UPDATE SET raw_json = excluded.raw_json",
                (run.suite_name, baseline.model_dump_json()),
            )
            await db.commit()
        return baseline

    async def delete_baseline(self, suite_name: str) -> bool:
        async with self._connect() as db:
            cursor = await db.execute("DELETE FROM baselines WHERE suite_name = ?", (suite_name,))
            await db.commit()
            return cursor.rowcount > 0

    async def list_runs(
        self,
        suite_name: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[SuiteRunResult]:
        """List historical run results, optionally filtered by suite."""
        params: tuple[Any, ...]
        async with self._connect() as db:
            if suite_name:
                query = (
                    "SELECT raw_json FROM runs WHERE suite_name = ? "
                    "ORDER BY timestamp DESC LIMIT ? OFFSET ?;"
                )
                params = (suite_name, limit, offset)
            else:
                query = "SELECT raw_json FROM runs ORDER BY timestamp DESC LIMIT ? OFFSET ?;"
                params = (limit, offset)

            async with db.execute(query, params) as cursor:
                rows = await cursor.fetchall()
                return [SuiteRunResult.model_validate(json.loads(r[0])) for r in rows]

    async def delete_run(self, run_id: str) -> bool:
        """Delete an evaluation run and cascaded test results."""
        async with self._connect() as db:
            cursor = await db.execute("DELETE FROM runs WHERE run_id = ?;", (run_id,))
            await db.commit()
            return cursor.rowcount > 0

    async def get_historical_metrics(
        self,
        suite_name: str,
        limit: int = 30,
    ) -> list[dict[str, Any]]:
        """
        Fetch the most recent N historical metric points, ordered chronologically (ASC)
        so that regression trend charts always show the latest window of activity.
        """
        async with self._connect() as db:
            query = """
                SELECT run_id, timestamp, target_model, passed, pass_rate,
                       avg_latency_ms, p50_latency_ms, p95_latency_ms,
                       total_tokens, total_cost_usd
                FROM (
                    SELECT run_id, timestamp, target_model, passed, pass_rate,
                           avg_latency_ms, p50_latency_ms, p95_latency_ms,
                           total_tokens, total_cost_usd
                    FROM runs
                    WHERE suite_name = ?
                    ORDER BY timestamp DESC
                    LIMIT ?
                )
                ORDER BY timestamp ASC;
            """
            async with db.execute(query, (suite_name, limit)) as cursor:
                rows = await cursor.fetchall()
                return [
                    {
                        "run_id": r[0],
                        "timestamp": r[1],
                        "target_model": r[2],
                        "passed": bool(r[3]),
                        "pass_rate": r[4],
                        "avg_latency_ms": r[5],
                        "p50_latency_ms": r[6],
                        "p95_latency_ms": r[7],
                        "total_tokens": r[8],
                        "total_cost_usd": r[9],
                    }
                    for r in rows
                ]


    async def save_prompt_comparison(self, result: PromptArenaResult) -> None:
        async with self._connect() as db:
            await db.execute(
                "INSERT INTO prompt_comparisons "
                "(comparison_id, suite_name, model, created_at, "
                "pass_rate_a, pass_rate_b, raw_json) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (
                    result.comparison_id, result.suite_snapshot.name, result.model,
                    result.created_at.isoformat(), result.comparison.run_a.pass_rate,
                    result.comparison.run_b.pass_rate, result.model_dump_json(),
                ),
            )
            await db.commit()

    async def get_prompt_comparison(self, comparison_id: str) -> PromptArenaResult | None:
        async with self._connect() as db:
            async with db.execute(
                "SELECT raw_json FROM prompt_comparisons WHERE comparison_id = ?", (comparison_id,)
            ) as cursor:
                row = await cursor.fetchone()
        return PromptArenaResult.model_validate_json(row[0]) if row else None

    async def list_prompt_comparisons(
        self, limit: int = 20, offset: int = 0
    ) -> list[PromptArenaSummary]:
        async with self._connect() as db:
            async with db.execute(
                "SELECT comparison_id, suite_name, model, created_at, pass_rate_a, pass_rate_b "
                "FROM prompt_comparisons ORDER BY created_at DESC LIMIT ? OFFSET ?", (limit, offset)
            ) as cursor:
                rows = await cursor.fetchall()
        return [
            PromptArenaSummary(
                comparison_id=r[0], suite_name=r[1], model=r[2], created_at=r[3],
                pass_rate_a=r[4], pass_rate_b=r[5],
            ) for r in rows
        ]
