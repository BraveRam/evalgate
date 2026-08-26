"""
Evaluation Suites API Endpoints with Strict Path Confinement.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import yaml
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from evalgate.cli.loader import SuiteLoadError, load_suite_from_yaml
from evalgate.core.pricing import calculate_cost, estimate_tokens
from evalgate.core.template import render_template
from evalgate.core.types import SuiteConfig, SuiteRunResult
from evalgate.providers.factory import get_provider
from evalgate.runner.runner import SuiteRunner

router = APIRouter(prefix="/suites", tags=["Suites"])

DEFAULT_EVALS_DIR = Path("evals")


def _sanitize_name_or_filename(name: str) -> str:
    """Validate that a filename or suite name contains no path traversal sequences."""
    if not name or ".." in name or "/" in name or "\\" in name or "\x00" in name:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid name or path traversal attempt: '{name}'",
        )
    # Check for valid characters
    if not re.match(r"^[a-zA-Z0-9_\-\.]+$", name):
        raise HTTPException(
            status_code=400,
            detail=(
                f"Invalid characters in name: '{name}'. "
                "Only alphanumeric, '-', '_', and '.' allowed."
            ),
        )
    return name


def _find_suite_path(suite_name: str, base_dir: Path = DEFAULT_EVALS_DIR) -> Path:
    """
    Find a suite YAML file matching suite_name or filename strictly within base_dir.
    Guarantees that path traversal outside base_dir is blocked.
    """
    _sanitize_name_or_filename(suite_name)
    base_dir_resolved = base_dir.resolve()

    # 1. Direct filename checks
    candidates = [
        base_dir / suite_name,
        base_dir / f"{suite_name}.yaml",
        base_dir / f"{suite_name}.yml",
        base_dir / f"{suite_name.replace('-', '_')}.yaml",
        base_dir / f"{suite_name.replace('_', '-')}.yaml",
    ]
    for c in candidates:
        try:
            resolved_c = c.resolve()
            if resolved_c.is_relative_to(base_dir_resolved) and resolved_c.is_file():
                return resolved_c
        except (ValueError, OSError):
            continue

    # 2. Search inside all YAML files in base_dir
    if base_dir.exists():
        try:
            for p in sorted(base_dir.rglob("*")):
                try:
                    if p.is_file() and p.suffix.lower() in (".yaml", ".yml"):
                        resolved_p = p.resolve()
                        if not resolved_p.is_relative_to(base_dir_resolved):
                            continue
                        suite = load_suite_from_yaml(resolved_p)
                        if suite.name == suite_name or resolved_p.stem == suite_name:
                            return resolved_p
                except (PermissionError, OSError, SuiteLoadError):
                    continue
        except (PermissionError, OSError):
            pass

    raise HTTPException(status_code=404, detail=f"Suite '{suite_name}' not found in {base_dir}")


class RunSuiteRequest(BaseModel):
    model_override: str | None = None
    judge_override: str | None = None
    min_pass_rate_override: float | None = None
    concurrency: int = Field(default=10, ge=1, le=50)


class CostEstimateRequest(BaseModel):
    model_override: str | None = None
    estimated_output_tokens_per_test: int = Field(default=150, ge=1)


@router.get("")
async def list_suites(dir_path: str = "evals") -> list[dict[str, Any]]:
    """
    List all evaluation suites in the workspace directory.
    Confines search to workspace to prevent arbitrary filesystem enumeration.
    """
    # Reject path traversal in directory path
    if ".." in dir_path or dir_path.startswith("/"):
        raise HTTPException(
            status_code=400,
            detail="Access outside workspace directory is prohibited",
        )

    base_dir = Path(dir_path)
    try:
        resolved_base = base_dir.resolve()
        cwd = Path.cwd().resolve()
        if not resolved_base.is_relative_to(cwd):
            raise HTTPException(
                status_code=400,
                detail="Directory must be within the project workspace",
            )
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid directory path")

    suites: list[dict[str, Any]] = []
    if not base_dir.exists():
        return suites

    try:
        for p in sorted(base_dir.rglob("*")):
            try:
                if not (p.is_file() and p.suffix.lower() in (".yaml", ".yml")):
                    continue
                resolved_p = p.resolve()
                if not resolved_p.is_relative_to(cwd):
                    continue
                suite = load_suite_from_yaml(resolved_p)
                suites.append(
                    {
                        "path": str(resolved_p.relative_to(cwd)),
                        "filename": p.name,
                        "name": suite.name,
                        "description": suite.description,
                        "target_type": suite.target.type.value,
                        "target_model": suite.target.model,
                        "min_pass_rate": suite.min_pass_rate,
                        "test_count": len(suite.tests),
                    }
                )
            except (PermissionError, OSError, SuiteLoadError) as err:
                suites.append(
                    {
                        "path": str(p),
                        "filename": p.name,
                        "error": str(err),
                    }
                )
    except (PermissionError, OSError) as err:
        raise HTTPException(status_code=403, detail=f"Permission denied accessing directory: {err}")

    return suites


@router.get("/{suite_name}")
async def get_suite(suite_name: str) -> SuiteConfig:
    """
    Get the full specification of an evaluation suite.
    """
    p = _find_suite_path(suite_name)
    try:
        return load_suite_from_yaml(p)
    except SuiteLoadError as err:
        raise HTTPException(status_code=400, detail=str(err))


@router.post("", status_code=201)
async def create_suite(
    suite: SuiteConfig,
    filename: str | None = Query(
        default=None,
        description="Custom filename (e.g. support_qa.yaml)",
    ),
) -> dict[str, Any]:
    """
    Create a new evaluation suite YAML file strictly within the evals directory.
    """
    DEFAULT_EVALS_DIR.mkdir(parents=True, exist_ok=True)
    base_dir_resolved = DEFAULT_EVALS_DIR.resolve()

    raw_filename = filename or f"{suite.name.replace(' ', '_').lower()}.yaml"
    safe_filename = _sanitize_name_or_filename(raw_filename)
    if not (safe_filename.endswith(".yaml") or safe_filename.endswith(".yml")):
        safe_filename += ".yaml"

    target_path = (DEFAULT_EVALS_DIR / safe_filename).resolve()
    if not target_path.is_relative_to(base_dir_resolved):
        raise HTTPException(status_code=400, detail="Path traversal attempt detected")

    if target_path.exists():
        raise HTTPException(status_code=409, detail=f"File '{safe_filename}' already exists")

    content = yaml.dump(suite.model_dump(exclude_none=True), sort_keys=False)
    target_path.write_text(content, encoding="utf-8")

    return {
        "message": f"Suite '{suite.name}' created successfully",
        "path": str(target_path.relative_to(Path.cwd().resolve())),
        "suite": suite,
    }


@router.put("/{suite_name}")
async def update_suite(suite_name: str, suite: SuiteConfig) -> dict[str, Any]:
    """
    Update an existing evaluation suite YAML file.
    """
    p = _find_suite_path(suite_name)
    content = yaml.dump(suite.model_dump(exclude_none=True), sort_keys=False)
    p.write_text(content, encoding="utf-8")

    return {
        "message": f"Suite '{suite.name}' updated successfully",
        "path": str(p.relative_to(Path.cwd().resolve())),
        "suite": suite,
    }


@router.delete("/{suite_name}")
async def delete_suite(suite_name: str) -> dict[str, str]:
    """
    Delete an evaluation suite YAML file.
    """
    p = _find_suite_path(suite_name)
    p.unlink(missing_ok=True)
    return {
        "message": f"Suite '{suite_name}' deleted successfully",
        "path": str(p.relative_to(Path.cwd().resolve())),
    }


@router.post("/{suite_name}/run")
async def run_suite_endpoint(
    suite_name: str,
    req: RunSuiteRequest | None = None,
) -> SuiteRunResult:
    """
    Execute an evaluation suite and enforce quality gates.
    """
    p = _find_suite_path(suite_name)
    suite = load_suite_from_yaml(p)

    target = suite.target
    if req and req.model_override:
        target = target.model_copy(update={"model": req.model_override})

    if req and req.min_pass_rate_override is not None:
        suite = suite.model_copy(update={"min_pass_rate": req.min_pass_rate_override})

    judge_provider = get_provider(model=req.judge_override) if req and req.judge_override else None
    concurrency = req.concurrency if req else 10

    runner = SuiteRunner()
    result = await runner.run_suite(
        suite=suite,
        target_override=target,
        judge_provider=judge_provider,
        concurrency=concurrency,
        save_to_storage=True,
    )
    return result


@router.post("/{suite_name}/estimate-cost")
async def estimate_suite_cost_endpoint(
    suite_name: str,
    req: CostEstimateRequest | None = None,
) -> dict[str, Any]:
    """
    Calculate pre-flight estimated token usage and inference cost for an evaluation suite.
    """
    p = _find_suite_path(suite_name)
    suite = load_suite_from_yaml(p)

    target_model = (
        req.model_override if req and req.model_override else None
    ) or suite.target.model
    output_tokens_per_test = req.estimated_output_tokens_per_test if req else 150
    template_str = suite.target.template or ""

    total_input_tokens = 0
    total_tests = len(suite.tests)

    for tc in suite.tests:
        if template_str:
            rendered = render_template(template_str, tc.vars)
        else:
            rendered = json.dumps(tc.vars)

        context_str = ""
        if tc.context:
            context_str = (
                "\n".join(tc.context) if isinstance(tc.context, list) else str(tc.context)
            )

        full_prompt = f"{suite.target.system_prompt or ''}\n{context_str}\n{rendered}"
        total_input_tokens += estimate_tokens(full_prompt)

    total_output_tokens = total_tests * output_tokens_per_test
    total_cost_usd = calculate_cost(target_model, total_input_tokens, total_output_tokens)
    cost_per_test = (total_cost_usd / total_tests) if total_tests > 0 else 0.0

    return {
        "suite_name": suite.name,
        "target_model": target_model,
        "total_tests": total_tests,
        "estimated_input_tokens": total_input_tokens,
        "estimated_output_tokens": total_output_tokens,
        "total_estimated_tokens": total_input_tokens + total_output_tokens,
        "estimated_cost_usd": round(total_cost_usd, 6),
        "cost_per_test_usd": round(cost_per_test, 6),
    }
