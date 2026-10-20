"""Prompt Arena estimates, saved experiments, and guarded prompt application."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path
from typing import Any, Literal

import yaml
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field

from evalgate.api.routes.suites import _find_suite_path
from evalgate.cli.loader import SuiteLoadError, load_suite_from_yaml
from evalgate.core.prompt_arena import (
    compare_prompts,
    estimate_prompt_comparison,
    fingerprint_suite,
)
from evalgate.core.storage import StorageEngine
from evalgate.core.types import (
    PromptArenaResult,
    PromptArenaSummary,
    PromptVariant,
    SuiteConfig,
)

router = APIRouter(prefix="/arena/prompts", tags=["Prompt Arena"])


class PromptComparisonRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    suite_name: str
    model: str = Field(min_length=1, pattern=r"\S")
    prompt_a: PromptVariant
    prompt_b: PromptVariant
    repeat: int | None = Field(default=None, ge=1, le=100, strict=True)
    concurrency: int = Field(default=10, ge=1, le=50, strict=True)
    suite_fingerprint: str | None = Field(default=None, pattern=r"^[0-9a-f]{64}$")


def load_source(req: PromptComparisonRequest) -> SuiteConfig:
    try:
        suite = load_suite_from_yaml(_find_suite_path(req.suite_name))
    except SuiteLoadError as err:
        raise HTTPException(status_code=400, detail=str(err)) from err
    if req.suite_fingerprint and req.suite_fingerprint != fingerprint_suite(suite):
        raise HTTPException(status_code=409, detail="Suite changed; request a new cost estimate")
    return suite


@router.post("/estimate")
async def estimate(req: PromptComparisonRequest) -> dict[str, Any]:
    try:
        return estimate_prompt_comparison(
            load_source(req), req.model, req.prompt_a, req.prompt_b, req.repeat
        )
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err)) from err


@router.post("/compare")
async def compare(req: PromptComparisonRequest) -> PromptArenaResult:
    try:
        return await compare_prompts(
            load_source(req),
            req.model,
            req.prompt_a,
            req.prompt_b,
            repeat=req.repeat,
            concurrency=req.concurrency,
        )
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err)) from err


@router.get("")
async def history(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> list[PromptArenaSummary]:
    return await StorageEngine().list_prompt_comparisons(limit=limit, offset=offset)


@router.get("/{comparison_id}")
async def get_comparison(comparison_id: str) -> PromptArenaResult:
    result = await StorageEngine().get_prompt_comparison(comparison_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Prompt comparison not found")
    return result


class ApplyPromptRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    variant: Literal["A", "B"]


@router.post("/{comparison_id}/apply")
async def apply_prompt(comparison_id: str, req: ApplyPromptRequest) -> SuiteConfig:
    result = await get_comparison(comparison_id)
    path = _find_suite_path(result.suite_snapshot.name)
    try:
        current = load_suite_from_yaml(path)
    except SuiteLoadError as err:
        raise HTTPException(status_code=400, detail=str(err)) from err
    if fingerprint_suite(current) != fingerprint_suite(result.suite_snapshot):
        raise HTTPException(
            status_code=409,
            detail="Suite changed since this comparison; compare again before applying a prompt",
        )
    prompt = result.prompt_a if req.variant == "A" else result.prompt_b
    updated = current.model_copy(
        update={"target": current.target.model_copy(update=prompt.model_dump())}
    )
    content = yaml.safe_dump(updated.model_dump(mode="json", exclude_none=True), sort_keys=False)
    # Replace the file atomically so readers cannot observe partially written YAML.
    with tempfile.NamedTemporaryFile(
        mode="w", dir=path.parent, delete=False, encoding="utf-8"
    ) as f:
        temp_path = Path(f.name)
        f.write(content)
    try:
        os.chmod(temp_path, path.stat().st_mode)
        os.replace(temp_path, path)
    finally:
        temp_path.unlink(missing_ok=True)
    return updated
