"""
YAML Evaluation Suite Loader, External Dataset Loaders (JSONL / CSV), and Schema Validator.
"""

from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Any

import yaml
from pydantic import ValidationError

from evalgate.core.types import SuiteConfig, TestCase


class SuiteLoadError(Exception):
    """Raised when an evaluation suite YAML or dataset cannot be found, parsed, or validated."""

    pass


def _parse_csv_context(raw_context: str | None) -> str | list[str] | None:
    """Parse a CSV context cell as JSON list[str] when it looks like a JSON array, else str."""
    if raw_context is None or raw_context == "":
        return None
    stripped = raw_context.lstrip()
    if stripped.startswith("["):
        try:
            parsed = json.loads(raw_context)
            if isinstance(parsed, list):
                return [str(item) for item in parsed]
        except json.JSONDecodeError:
            pass
    return raw_context


def _load_jsonl_dataset(dataset_path: Path) -> list[TestCase]:
    """Load test cases from a UTF-8 JSONL file, auto-assigning missing IDs."""
    try:
        content = dataset_path.read_text(encoding="utf-8")
    except Exception as err:
        raise SuiteLoadError(f"Error reading dataset file {dataset_path.name}: {err}") from err

    cases: list[TestCase] = []
    for row_idx, raw_line in enumerate(content.splitlines(), start=1):
        line = raw_line.strip()
        if not line:
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError as err:
            raise SuiteLoadError(
                f"Invalid JSON in {dataset_path.name}:{row_idx}: {err}"
            ) from err

        if not isinstance(row, dict):
            raise SuiteLoadError(
                f"Invalid test case in {dataset_path.name}:{row_idx}: expected JSON object"
            )

        row_id = row.get("id")
        if row_id is None or (isinstance(row_id, str) and not row_id.strip()):
            row = {**row, "id": f"{dataset_path.name}:{row_idx}"}

        try:
            cases.append(TestCase.model_validate(row))
        except ValidationError as err:
            raise SuiteLoadError(
                f"Invalid test case in {dataset_path.name}:{row_idx}: {err}"
            ) from err

    return cases


def _load_csv_dataset(dataset_path: Path) -> list[TestCase]:
    """Load test cases from a UTF-8 (with optional BOM) CSV file."""
    reserved = {"id", "ground_truth", "context"}
    cases: list[TestCase] = []
    try:
        with dataset_path.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            if reader.fieldnames is None:
                return cases
            for row_idx, row in enumerate(reader, start=1):
                if None in row:
                    raise SuiteLoadError(
                        f"Malformed CSV row in {dataset_path.name}:{row_idx}: "
                        "extra columns without header"
                    )
                raw_id = (row.get("id") or "").strip()
                case_id = raw_id if raw_id else f"{dataset_path.name}:{row_idx}"
                raw_gt = row.get("ground_truth")
                ground_truth = raw_gt if (raw_gt is not None and raw_gt != "") else None
                context = _parse_csv_context(row.get("context"))
                vars_dict = {
                    col: val for col, val in row.items() if col is not None and col not in reserved
                }
                cases.append(
                    TestCase(
                        id=case_id,
                        vars=vars_dict,
                        ground_truth=ground_truth,
                        context=context,
                    )
                )
    except SuiteLoadError:
        raise
    except Exception as err:
        raise SuiteLoadError(f"Error reading CSV dataset {dataset_path.name}: {err}") from err

    return cases


def _load_dataset_file(dataset_path: Path) -> list[TestCase]:
    """Dispatch dataset loading by file extension (.jsonl or .csv)."""
    suffix = dataset_path.suffix.lower()
    if suffix == ".jsonl":
        return _load_jsonl_dataset(dataset_path)
    if suffix == ".csv":
        return _load_csv_dataset(dataset_path)
    raise SuiteLoadError(
        f"Unsupported dataset format '{dataset_path.suffix}' for {dataset_path.name}. "
        "Expected .jsonl or .csv."
    )


def resolve_suite_dataset_paths(
    suite_path: Path,
    dataset: str | list[str] | None,
) -> list[Path]:
    """
    Resolve explicit dataset paths relative to the suite YAML directory (confined to
    the suite's directory to block path traversal and escaping symlinks) and append
    the sibling `<suite>.regressions.jsonl` file when present (deduped).
    """
    base_dir = suite_path.parent.resolve()
    raw_entries: list[str] = []
    if isinstance(dataset, str):
        raw_entries = [dataset]
    elif isinstance(dataset, list):
        raw_entries = list(dataset)

    resolved_paths: list[Path] = []
    seen: set[Path] = set()

    for entry in raw_entries:
        if "\x00" in entry or Path(entry).is_absolute():
            raise SuiteLoadError(
                f"Dataset path '{entry}' must be a relative path within {base_dir}"
            )
        candidate = (base_dir / entry).resolve()
        if not candidate.is_relative_to(base_dir):
            raise SuiteLoadError(
                f"Dataset path '{entry}' escapes suite directory {base_dir}"
            )
        if not candidate.is_file():
            raise SuiteLoadError(f"Dataset file not found: {candidate}")
        if candidate not in seen:
            seen.add(candidate)
            resolved_paths.append(candidate)

    regressions_path = suite_path.with_suffix(".regressions.jsonl").resolve()
    if (
        regressions_path.is_relative_to(base_dir)
        and regressions_path.is_file()
        and regressions_path not in seen
    ):
        seen.add(regressions_path)
        resolved_paths.append(regressions_path)

    return resolved_paths


def resolve_trace_target_path(
    suite_path: Path,
    suite: SuiteConfig,
    *,
    target_dataset: str | None = None,
    allowed_root: Path | None = None,
) -> Path:
    """
    Resolve and validate the append-only `.jsonl` path for saving a trace as a test case.
    Confines writes strictly within `allowed_root` and rejects non-`.jsonl` targets.
    """
    root = (allowed_root or Path.cwd()).resolve()

    if target_dataset is not None:
        if "\x00" in target_dataset or Path(target_dataset).is_absolute():
            raise ValueError("Target dataset path must be a relative path inside the workspace")
        candidate = (suite_path.parent / target_dataset).resolve()
    else:
        linked_jsonl: Path | None = None
        entries = (
            [suite.dataset]
            if isinstance(suite.dataset, str)
            else list(suite.dataset or [])
        )
        for entry in entries:
            if entry.lower().endswith(".jsonl"):
                linked_jsonl = (suite_path.parent / entry).resolve()
                break
        candidate = linked_jsonl or suite_path.with_suffix(".regressions.jsonl").resolve()

    suite_dir = suite_path.parent.resolve()
    if not candidate.is_relative_to(suite_dir) or not candidate.is_relative_to(root):
        raise ValueError("Target dataset path escapes allowed suite/workspace root")
    if candidate.suffix.lower() != ".jsonl":
        raise ValueError("Trace-to-Test only supports appending to .jsonl files")

    return candidate


_TRACE_STRIP_KEYS = frozenset(
    {
        "timestamp",
        "timestamps",
        "created_at",
        "latency_ms",
        "cost",
        "cost_usd",
        "input_tokens",
        "output_tokens",
        "total_tokens",
        "raw_output",
        "raw_response",
        "provider_metadata",
    }
)


def strip_trace_metadata(metadata: dict[str, Any] | None) -> dict[str, Any]:
    """Remove transient execution telemetry and raw provider metadata from trace metadata."""
    if not metadata:
        return {}
    return {k: v for k, v in metadata.items() if k.lower() not in _TRACE_STRIP_KEYS}


def append_test_case_to_jsonl(
    suite_path: Path,
    test_case: TestCase,
    *,
    target_dataset: str | None = None,
    allowed_root: Path | None = None,
) -> Path:
    """
    Validate and append a single TestCase to a suite's `.jsonl` dataset file.
    Rejects duplicate IDs against the suite and target file without mutating YAML.
    """
    suite = load_suite_from_yaml(suite_path)
    existing_ids = {tc.id for tc in suite.tests}
    if test_case.id in existing_ids:
        raise ValueError(f"Test case ID '{test_case.id}' already exists in suite '{suite.name}'")

    target_path = resolve_trace_target_path(
        suite_path,
        suite,
        target_dataset=target_dataset,
        allowed_root=allowed_root,
    )
    if target_path.exists():
        for existing_tc in _load_jsonl_dataset(target_path):
            if existing_tc.id == test_case.id:
                raise ValueError(
                    f"Test case ID '{test_case.id}' already exists in {target_path.name}"
                )

    target_path.parent.mkdir(parents=True, exist_ok=True)
    serialized = json.dumps(
        test_case.model_dump(mode="json", exclude_none=True),
        ensure_ascii=False,
    )
    needs_leading_newline = False
    if target_path.exists() and target_path.stat().st_size > 0:
        with target_path.open("rb") as fb:
            fb.seek(-1, 2)
            needs_leading_newline = fb.read(1) != b"\n"

    with target_path.open("a", encoding="utf-8") as handle:
        if needs_leading_newline:
            handle.write("\n")
        handle.write(serialized + "\n")

    return target_path


def load_suite_from_yaml(file_path: Path | str) -> SuiteConfig:
    """
    Load, parse, and validate an evaluation suite YAML file into a SuiteConfig,
    merging any external `dataset:` files and sibling `<suite>.regressions.jsonl`.
    """
    path = Path(file_path)
    if not path.exists():
        raise SuiteLoadError(f"Evaluation suite file not found: {path.resolve()}")

    try:
        raw_content = path.read_text(encoding="utf-8")
        parsed_yaml: Any = yaml.safe_load(raw_content)
    except yaml.YAMLError as err:
        raise SuiteLoadError(f"Invalid YAML syntax in {path.name}: {err}") from err
    except Exception as err:
        raise SuiteLoadError(f"Error reading file {path.name}: {err}") from err

    if not isinstance(parsed_yaml, dict):
        raise SuiteLoadError(
            f"Suite file {path.name} must contain a valid YAML mapping at the root."
        )

    try:
        suite = SuiteConfig.model_validate(parsed_yaml)
    except ValidationError as err:
        errors = err.errors()
        messages = [f"  - {' -> '.join(str(loc) for loc in e['loc'])}: {e['msg']}" for e in errors]
        formatted_err = "\n".join(messages)
        raise SuiteLoadError(f"Schema validation failed for {path.name}:\n{formatted_err}") from err

    dataset_paths = resolve_suite_dataset_paths(path, suite.dataset)
    if not dataset_paths:
        return suite

    loaded_tests: list[TestCase] = []
    for ds_path in dataset_paths:
        loaded_tests.extend(_load_dataset_file(ds_path))

    combined_tests = [*suite.tests, *loaded_tests]
    seen_ids: set[str] = set()
    duplicates: list[str] = []
    for tc in combined_tests:
        if tc.id in seen_ids:
            duplicates.append(tc.id)
        seen_ids.add(tc.id)

    if duplicates:
        raise SuiteLoadError(
            f"Duplicate test case IDs found in {path.name}: {', '.join(sorted(set(duplicates)))}"
        )

    return suite.model_copy(update={"tests": combined_tests})
