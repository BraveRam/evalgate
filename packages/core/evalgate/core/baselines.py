"""Portable baseline snapshots and deterministic run comparisons."""

from __future__ import annotations

from difflib import unified_diff
from typing import Literal

from pydantic import BaseModel, ConfigDict, model_validator

from evalgate.core.types import SuiteRunResult, TestCaseResult


def validate_comparable_run(run: SuiteRunResult) -> None:
    ids = [case.test_id for case in run.results]
    if not ids or len(ids) != run.total_tests:
        raise ValueError("A baseline comparison requires a complete, non-empty run")
    if len(set(ids)) != len(ids) or any(not test_id.strip() for test_id in ids):
        raise ValueError("Baseline comparisons require unique, non-empty test IDs")


class BaselineSnapshot(BaseModel):
    """Versioned JSON artifact usable without the originating database."""

    model_config = ConfigDict(extra="forbid")
    schema_version: Literal[1] = 1
    run: SuiteRunResult

    @model_validator(mode="after")
    def validate_baseline(self) -> BaselineSnapshot:
        validate_comparable_run(self.run)
        if not self.run.passed:
            raise ValueError("Only a successful run can become a baseline")
        return self


class CaseDiff(BaseModel):
    test_id: str
    status: Literal["regressed", "improved", "changed", "unchanged", "added", "missing"]
    baseline: TestCaseResult | None
    current: TestCaseResult | None
    output_diff: str
    baseline_attempts: int = 0
    current_attempts: int = 0
    baseline_success_rate: float | None = None
    current_success_rate: float | None = None
    success_rate_delta: float | None = None
    gates_regression: bool = False


class BaselineComparison(BaseModel):
    suite_name: str
    baseline_run_id: str
    run_id: str
    passed: bool
    regressed_test_ids: list[str]
    improved_test_ids: list[str]
    missing_test_ids: list[str]
    added_test_ids: list[str]
    changed_test_ids: list[str]
    pass_rate_delta: float
    latency_p50_delta_ms: float
    cost_delta_usd: float
    cases: list[CaseDiff]
    gated_regressed_test_ids: list[str] = []
    max_success_rate_drop: float | None = None


def _output_lines(result: TestCaseResult) -> list[str]:
    if not result.attempts:
        return result.completion.splitlines()
    lines: list[str] = []
    for index, attempt in enumerate(result.attempts, 1):
        lines.append(f"--- Attempt {index} ---")
        lines.extend(attempt.completion.splitlines())
    return lines


def compare_to_baseline(run: SuiteRunResult, baseline: BaselineSnapshot) -> BaselineComparison:
    validate_comparable_run(run)
    if run.suite_name != baseline.run.suite_name:
        raise ValueError("Baseline and candidate must belong to the same suite")
    before = {case.test_id: case for case in baseline.run.results}
    after = {case.test_id: case for case in run.results}
    regressed = sorted(
        key
        for key in before.keys() & after.keys()
        if after[key].success_rate < before[key].success_rate
    )
    improved = sorted(
        key
        for key in before.keys() & after.keys()
        if after[key].success_rate > before[key].success_rate
    )
    missing = sorted(before.keys() - after.keys())
    added = sorted(after.keys() - before.keys())
    changed = sorted(
        key
        for key in before.keys() & after.keys()
        if _output_lines(before[key]) != _output_lines(after[key])
    )
    drop = run.metadata.get("max_success_rate_drop")
    if drop is not None:
        if isinstance(drop, bool) or not isinstance(drop, (int, float)) or not 0 <= drop <= 1:
            raise ValueError("max_success_rate_drop must be between 0 and 1")
    gated = [
        key
        for key in regressed
        if (
            (before[key].attempt_count == after[key].attempt_count == 1)
            or (
                drop is not None
                and before[key].success_rate - after[key].success_rate > drop + 1e-12
            )
        )
    ]
    cases: list[CaseDiff] = []
    for key in sorted(before.keys() | after.keys()):
        old, new = before.get(key), after.get(key)
        status: Literal["regressed", "improved", "changed", "unchanged", "added", "missing"]
        if old is None:
            status = "added"
        elif new is None:
            status = "missing"
        elif key in regressed:
            status = "regressed"
        elif key in improved:
            status = "improved"
        else:
            status = "changed" if key in changed else "unchanged"
        diff = "\n".join(
            unified_diff(
                _output_lines(old) if old else [],
                _output_lines(new) if new else [],
                fromfile="baseline",
                tofile="current",
                lineterm="",
            )
        )
        cases.append(
            CaseDiff(
                test_id=key,
                status=status,
                baseline=old,
                current=new,
                output_diff=diff,
                baseline_attempts=old.attempt_count if old else 0,
                current_attempts=new.attempt_count if new else 0,
                baseline_success_rate=old.success_rate if old else None,
                current_success_rate=new.success_rate if new else None,
                success_rate_delta=(new.success_rate - old.success_rate) if old and new else None,
                gates_regression=key in gated or key in missing,
            )
        )
    return BaselineComparison(
        suite_name=run.suite_name,
        baseline_run_id=baseline.run.run_id,
        run_id=run.run_id,
        passed=run.passed and not gated and not missing,
        gated_regressed_test_ids=gated,
        max_success_rate_drop=drop,
        regressed_test_ids=regressed,
        improved_test_ids=improved,
        missing_test_ids=missing,
        added_test_ids=added,
        changed_test_ids=changed,
        pass_rate_delta=round(run.pass_rate - baseline.run.pass_rate, 4),
        latency_p50_delta_ms=round(run.p50_latency_ms - baseline.run.p50_latency_ms, 2),
        cost_delta_usd=round(run.total_cost_usd - baseline.run.total_cost_usd, 7),
        cases=cases,
    )
