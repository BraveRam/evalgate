"""
Evaluation Suites API Endpoints with Strict Path Confinement.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import yaml
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from evalgate.cli.loader import (
    SuiteLoadError,
    append_test_case_to_jsonl,
    load_suite_from_yaml,
    strip_trace_metadata,
)
from evalgate.core.cost import estimate_suite_cost
from evalgate.core.fuzzer import FuzzCategory, FuzzGeneratedCase, generate_fuzz_cases
from evalgate.core.types import AssertionConfig, SuiteConfig, SuiteRunResult, TestCase
from evalgate.providers.factory import get_provider
from evalgate.runner.runner import SuiteRunner, validate_min_pass_rate, validate_run_inputs

router = APIRouter(prefix="/suites", tags=["Suites"])

DEFAULT_EVALS_DIR = Path("evals")


def _sanitize_name_or_filename(name: str, *, filename: bool = True) -> str:
    """Validate that a filename or suite name contains no path traversal sequences."""
    if not name or ".." in name or "/" in name or "\\" in name or "\x00" in name:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid name or path traversal attempt: '{name}'",
        )
    # Display names may contain spaces or Unicode; filenames remain restricted.
    if filename and not re.match(r"^[a-zA-Z0-9_\-\.]+$", name):
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
    _sanitize_name_or_filename(suite_name, filename=False)
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
    min_pass_rate_override: float | None = Field(default=None, ge=0.0, le=1.0)
    concurrency: int = Field(default=10, ge=1, le=50)
    repeat: int | None = Field(default=None, ge=1, le=100, strict=True)
    max_success_rate_drop: float | None = Field(default=None, ge=0.0, le=1.0)


class CostEstimateRequest(BaseModel):
    model_override: str | None = None
    estimated_output_tokens_per_test: int = Field(default=150, ge=1)
    repeat: int | None = Field(default=None, ge=1, le=100, strict=True)


class FuzzSuiteRequest(BaseModel):
    categories: list[FuzzCategory] | None = None
    max_cases: int = Field(default=5, ge=1, le=50, strict=True)
    run_immediately: bool = False
    save_to_suite: bool = False
    model_override: str | None = None


class FuzzSuiteResponse(BaseModel):
    suite_name: str
    generated_cases: list[FuzzGeneratedCase]
    dry_run_result: SuiteRunResult | None = None
    saved_count: int = 0
    suite: SuiteConfig | None = None


class SaveTraceRequest(BaseModel):
    id: str = Field(min_length=1, description="Unique test case ID for the saved regression case")
    name: str | None = None
    description: str | None = None
    vars: dict[str, Any] = Field(default_factory=dict)
    context: str | list[str] | None = None
    ground_truth: str | dict[str, Any] | list[Any] | None = None
    assertions: list[AssertionConfig] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
    target_dataset: str | None = Field(
        default=None,
        description=(
            "Optional relative .jsonl path; defaults to linked .jsonl or <suite>.regressions.jsonl"
        ),
    )


class SaveTraceResponse(BaseModel):
    message: str
    suite_name: str
    test_id: str
    dataset_path: str
    test_case: TestCase


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
                        "dataset": suite.dataset,
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
    _sanitize_name_or_filename(suite.name, filename=False)
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

    content = yaml.safe_dump(suite.model_dump(mode="json", exclude_none=True), sort_keys=False)
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
    _sanitize_name_or_filename(suite.name, filename=False)
    p = _find_suite_path(suite_name)
    content = yaml.safe_dump(suite.model_dump(mode="json", exclude_none=True), sort_keys=False)
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
        suite = suite.model_copy(
            update={"min_pass_rate": validate_min_pass_rate(req.min_pass_rate_override)}
        )

    judge_provider = get_provider(model=req.judge_override) if req and req.judge_override else None
    concurrency = req.concurrency if req else 10
    try:
        validate_run_inputs(suite, concurrency)
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err)) from err

    runner = SuiteRunner()
    result = await runner.run_suite(
        suite=suite,
        target_override=target,
        judge_provider=judge_provider,
        concurrency=concurrency,
        save_to_storage=True,
        repeat=req.repeat if req else None,
        max_success_rate_drop=req.max_success_rate_drop if req else None,
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

    try:
        return estimate_suite_cost(
            suite,
            model=req.model_override if req else None,
            estimated_output_tokens_per_test=req.estimated_output_tokens_per_test if req else 150,
            repeat=req.repeat if req else None,
        )
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err)) from err


@router.post("/{suite_name}/fuzz")
async def fuzz_suite_endpoint(
    suite_name: str,
    req: FuzzSuiteRequest | None = None,
) -> FuzzSuiteResponse:
    """
    Deterministically synthesize edge-case and adversarial test cases for a suite.
    Optionally dry-runs the generated cases and/or appends them to the suite YAML.
    """
    p = _find_suite_path(suite_name)
    try:
        suite = load_suite_from_yaml(p)
    except SuiteLoadError as err:
        raise HTTPException(status_code=400, detail=str(err)) from err

    categories = req.categories if req else None
    max_cases = req.max_cases if req else 5

    try:
        generated = generate_fuzz_cases(
            suite=suite,
            categories=categories,
            max_cases=max_cases,
        )
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err)) from err

    dry_run_result: SuiteRunResult | None = None
    if req and req.run_immediately and generated:
        target = suite.target
        if req.model_override:
            target = target.model_copy(update={"model": req.model_override})
        fuzz_only_suite = suite.model_copy(
            update={"tests": [item.test_case for item in generated], "repeat": 1}
        )
        runner = SuiteRunner()
        dry_run_result = await runner.run_suite(
            suite=fuzz_only_suite,
            target_override=target,
            concurrency=min(10, len(generated)),
            save_to_storage=False,
        )

    saved_count = 0
    updated_suite: SuiteConfig | None = None
    if req and req.save_to_suite and generated:
        updated_tests = [*suite.tests, *(item.test_case for item in generated)]
        updated_suite = suite.model_copy(update={"tests": updated_tests})
        content = yaml.safe_dump(
            updated_suite.model_dump(mode="json", exclude_none=True),
            sort_keys=False,
        )
        p.write_text(content, encoding="utf-8")
        saved_count = len(generated)

    return FuzzSuiteResponse(
        suite_name=suite.name,
        generated_cases=generated,
        dry_run_result=dry_run_result,
        saved_count=saved_count,
        suite=updated_suite,
    )


@router.post("/{suite_name}/save-trace", status_code=201)
async def save_trace_endpoint(
    suite_name: str,
    req: SaveTraceRequest,
) -> SaveTraceResponse:
    """
    Save an execution trace as a regression TestCase by appending to a `.jsonl` dataset
    within the evals root (never mutating hand-written suite YAML).
    """
    p = _find_suite_path(suite_name)
    cleaned_id = req.id.strip()
    if not cleaned_id:
        raise HTTPException(status_code=400, detail="Test case ID must not be empty")

    test_case = TestCase(
        id=cleaned_id,
        name=req.name,
        description=req.description,
        vars=req.vars,
        context=req.context,
        ground_truth=req.ground_truth,
        assertions=req.assertions,
        metadata=strip_trace_metadata(req.metadata),
    )

    try:
        target_path = append_test_case_to_jsonl(
            p,
            test_case,
            target_dataset=req.target_dataset,
            allowed_root=DEFAULT_EVALS_DIR.resolve(),
        )
    except SuiteLoadError as err:
        raise HTTPException(status_code=400, detail=str(err)) from err
    except ValueError as err:
        msg = str(err)
        status = 409 if "already exists" in msg else 400
        raise HTTPException(status_code=status, detail=msg) from err

    cwd = Path.cwd().resolve()
    rel_path = (
        str(target_path.relative_to(cwd))
        if target_path.is_relative_to(cwd)
        else str(target_path)
    )
    return SaveTraceResponse(
        message=f"Saved test case '{test_case.id}' to {rel_path}",
        suite_name=suite_name,
        test_id=test_case.id,
        dataset_path=rel_path,
        test_case=test_case,
    )

