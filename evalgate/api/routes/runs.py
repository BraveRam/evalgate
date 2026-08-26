"""
Historical Evaluation Runs API Endpoints.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query

from evalgate.core.storage import StorageEngine
from evalgate.core.types import SuiteRunResult

router = APIRouter(prefix="/runs", tags=["Runs"])


@router.get("")
async def list_runs(
    suite: str | None = Query(default=None, description="Filter by suite name"),
    limit: int = Query(default=30, ge=1, le=100, description="Max runs to return"),
    offset: int = Query(default=0, ge=0, description="Pagination offset"),
) -> list[SuiteRunResult]:
    """
    List past evaluation runs from the local SQLite database.
    """
    storage = StorageEngine()
    runs = await storage.list_runs(suite_name=suite, limit=limit, offset=offset)
    return runs


@router.get("/{run_id}")
async def get_run(run_id: str) -> SuiteRunResult:
    """
    Get full execution details, test case outcomes, and assertion traces for a run.
    """
    storage = StorageEngine()
    run = await storage.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail=f"Run '{run_id}' not found")
    return run


@router.get("/{run_id}/trends")
async def get_run_trends(
    run_id: str,
    limit: int = Query(default=30, ge=1, le=100),
) -> dict[str, Any]:
    """
    Get historical regression trend metrics for the suite corresponding to this run.
    """
    storage = StorageEngine()
    run = await storage.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail=f"Run '{run_id}' not found")

    metrics = await storage.get_historical_metrics(suite_name=run.suite_name, limit=limit)
    return {
        "suite_name": run.suite_name,
        "current_run_id": run_id,
        "data_points": len(metrics),
        "trends": metrics,
    }


@router.delete("/{run_id}")
async def delete_run(run_id: str) -> dict[str, str]:
    """
    Delete an evaluation run and its test results from the local database.
    """
    storage = StorageEngine()
    deleted = await storage.delete_run(run_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Run '{run_id}' not found")
    return {"message": f"Run '{run_id}' deleted successfully", "run_id": run_id}
