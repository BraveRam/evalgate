"""
Async SQLite Storage Engine for EvalGate Suites and Historical Run Records.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

import aiosqlite

from evalgate.core.types import SuiteConfig, SuiteRunResult

DEFAULT_DB_DIR = Path(".evalgate")
DEFAULT_DB_PATH = DEFAULT_DB_DIR / "runs.db"


class StorageEngine:
    """Manages SQLite persistence for evaluation suites and historical run records."""

    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = db_path or DEFAULT_DB_PATH

    async def init_db(self) -> None:
        """Initialize database schema and performance indexes."""
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("PRAGMA journal_mode=WAL;")
            await db.execute("PRAGMA foreign_keys=ON;")

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
                    timestamp TEXT NOT NULL,
                    target_model TEXT NOT NULL,
                    target_provider TEXT NOT NULL,
                    passed INTEGER NOT NULL,
                    pass_rate REAL NOT NULL,
                    total_tests INTEGER NOT NULL,
                    passed_tests INTEGER NOT NULL,
                    failed_tests INTEGER NOT NULL,
                    avg_latency_ms REAL NOT NULL,
                    p50_latency_ms REAL NOT NULL,
                    p95_latency_ms REAL NOT NULL,
                    total_tokens INTEGER NOT NULL,
                    total_cost_usd REAL NOT NULL,
                    raw_json TEXT NOT NULL
                );
            """)

            # Table for Individual Test Results
            await db.execute("""
                CREATE TABLE IF NOT EXISTS test_results (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    run_id TEXT NOT NULL,
                    test_id TEXT NOT NULL,
                    passed INTEGER NOT NULL,
                    latency_ms REAL NOT NULL,
                    total_tokens INTEGER NOT NULL,
                    cost_usd REAL NOT NULL,
                    completion TEXT,
                    error TEXT,
                    raw_json TEXT NOT NULL,
                    FOREIGN KEY (run_id) REFERENCES runs (run_id) ON DELETE CASCADE
                );
            """)

            # Indexes for fast historical lookups
            await db.execute(
                "CREATE INDEX IF NOT EXISTS idx_runs_suite ON runs (suite_name, timestamp DESC);"
            )
            await db.execute(
                "CREATE INDEX IF NOT EXISTS idx_test_results_run ON test_results (run_id);"
            )
            await db.execute(
                "CREATE INDEX IF NOT EXISTS idx_test_results_test ON test_results (test_id);"
            )

            await db.commit()

    async def save_suite(self, suite: SuiteConfig) -> None:
        """Upsert a suite configuration."""
        await self.init_db()
        config_json = suite.model_dump_json()

        async with aiosqlite.connect(self.db_path) as db:
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

    async def get_suite(self, name: str) -> Optional[SuiteConfig]:
        """Fetch a suite configuration by name."""
        await self.init_db()
        async with aiosqlite.connect(self.db_path) as db:
            query = "SELECT config_json FROM suites WHERE name = ?;"
            async with db.execute(query, (name,)) as cursor:
                row = await cursor.fetchone()
                if not row:
                    return None
                data = json.loads(row[0])
                return SuiteConfig.model_validate(data)

    async def list_suites(self) -> List[SuiteConfig]:
        """List all saved test suites."""
        await self.init_db()
        async with aiosqlite.connect(self.db_path) as db:
            async with db.execute("SELECT config_json FROM suites ORDER BY name ASC;") as cursor:
                rows = await cursor.fetchall()
                return [SuiteConfig.model_validate(json.loads(r[0])) for r in rows]

    async def save_run(self, run: SuiteRunResult) -> None:
        """Persist a complete evaluation run and its test case results."""
        await self.init_db()
        raw_json = run.model_dump_json()

        insert_run_sql = """
            INSERT OR REPLACE INTO runs (
                run_id, suite_name, timestamp, target_model, target_provider,
                passed, pass_rate, total_tests, passed_tests, failed_tests,
                avg_latency_ms, p50_latency_ms, p95_latency_ms,
                total_tokens, total_cost_usd, raw_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """

        async with aiosqlite.connect(self.db_path) as db:
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

    async def get_run(self, run_id: str) -> Optional[SuiteRunResult]:
        """Fetch a run result by ID."""
        await self.init_db()
        async with aiosqlite.connect(self.db_path) as db:
            query = "SELECT raw_json FROM runs WHERE run_id = ?;"
            async with db.execute(query, (run_id,)) as cursor:
                row = await cursor.fetchone()
                if not row:
                    return None
                return SuiteRunResult.model_validate(json.loads(row[0]))

    async def list_runs(
        self,
        suite_name: Optional[str] = None,
        limit: int = 50,
    ) -> List[SuiteRunResult]:
        """List historical run results, optionally filtered by suite."""
        await self.init_db()
        async with aiosqlite.connect(self.db_path) as db:
            if suite_name:
                query = (
                    "SELECT raw_json FROM runs WHERE suite_name = ? "
                    "ORDER BY timestamp DESC LIMIT ?;"
                )
                params = (suite_name, limit)
            else:
                query = "SELECT raw_json FROM runs ORDER BY timestamp DESC LIMIT ?;"
                params = (limit,)

            async with db.execute(query, params) as cursor:
                rows = await cursor.fetchall()
                return [SuiteRunResult.model_validate(json.loads(r[0])) for r in rows]

    async def get_historical_metrics(
        self,
        suite_name: str,
        limit: int = 30,
    ) -> List[Dict[str, Any]]:
        """Fetch high-level historical metric points for trend charting."""
        await self.init_db()
        async with aiosqlite.connect(self.db_path) as db:
            query = """
                SELECT run_id, timestamp, target_model, passed, pass_rate,
                       avg_latency_ms, p50_latency_ms, p95_latency_ms, total_tokens, total_cost_usd
                FROM runs
                WHERE suite_name = ?
                ORDER BY timestamp ASC
                LIMIT ?;
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
