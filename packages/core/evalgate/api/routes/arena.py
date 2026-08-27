"""
Arena Benchmark Shootout API Endpoints.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from evalgate.api.routes.suites import _find_suite_path
from evalgate.cli.loader import load_suite_from_yaml
from evalgate.core.types import ArenaComparisonResult
from evalgate.runner.runner import compare_arena

router = APIRouter(prefix="/arena", tags=["Arena Shootout"])


class ArenaCompareRequest(BaseModel):
    suite_name: str
    model_a: str = Field(default="openai/gpt-4o-mini")
    model_b: str = Field(default="anthropic/claude-3-5-sonnet")
    concurrency: int = Field(default=10, ge=1, le=50)


@router.post("/compare")
async def run_arena_shootout(req: ArenaCompareRequest) -> ArenaComparisonResult:
    """
    Execute a side-by-side benchmark shootout comparing Model A vs Model B on an evaluation suite.
    """
    p = _find_suite_path(req.suite_name)
    try:
        suite = load_suite_from_yaml(p)
    except Exception as err:
        raise HTTPException(status_code=400, detail=f"Failed to load suite: {err}")

    comparison = await compare_arena(
        suite=suite,
        model_a=req.model_a,
        model_b=req.model_b,
        concurrency=req.concurrency,
    )
    return comparison
