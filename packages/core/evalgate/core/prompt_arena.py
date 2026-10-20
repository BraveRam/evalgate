"""Prompt comparisons with reproducible source snapshots and isolated quality gates."""

from __future__ import annotations

import hashlib
import json
import uuid
from typing import Any

from evalgate.core.cost import estimate_suite_cost
from evalgate.core.repetition import attempt_counts
from evalgate.core.storage import StorageEngine
from evalgate.core.types import (
    ArenaComparisonResult,
    PromptArenaResult,
    PromptVariant,
    SuiteConfig,
    TargetConfig,
    TargetType,
)
from evalgate.providers.base import BaseProvider
from evalgate.runner.runner import SuiteRunner, validate_run_inputs


def fingerprint_suite(suite: SuiteConfig) -> str:
    canonical = json.dumps(suite.model_dump(mode="json"), sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode()).hexdigest()


def prompt_target(suite: SuiteConfig, model: str, prompt: PromptVariant) -> TargetConfig:
    if not isinstance(model, str) or not model.strip():
        raise ValueError("Prompt Arena requires a non-empty model")
    if suite.target.type == TargetType.WEBHOOK:
        raise ValueError("Prompt Arena requires a model-backed suite, not a webhook")
    # The selected model owns routing; an inherited override can silently run a
    # different provider (for example mock) while recording the selected model.
    return suite.target.model_copy(
        deep=True,
        update={
            "model": model, "provider": None,
            "template": prompt.template, "system_prompt": prompt.system_prompt,
        }
    )


def estimate_prompt_comparison(
    suite: SuiteConfig,
    model: str,
    prompt_a: PromptVariant,
    prompt_b: PromptVariant,
    repeat: int | None = None,
) -> dict[str, Any]:
    validate_run_inputs(suite, 1)
    estimates = []
    for prompt in (prompt_a, prompt_b):
        variant_suite = suite.model_copy(update={"target": prompt_target(suite, model, prompt)})
        estimates.append(estimate_suite_cost(variant_suite, repeat=repeat))
    return {
        "suite_fingerprint": fingerprint_suite(suite),
        "estimate_a": estimates[0],
        "estimate_b": estimates[1],
        "estimated_cost_usd": sum(e["estimated_cost_usd"] for e in estimates),
        "total_attempts": sum(e["total_attempts"] for e in estimates),
    }


async def compare_prompts(
    suite: SuiteConfig,
    model: str,
    prompt_a: PromptVariant,
    prompt_b: PromptVariant,
    *,
    repeat: int | None = None,
    concurrency: int = 10,
    storage: StorageEngine | None = None,
    judge_provider: BaseProvider | None = None,
) -> PromptArenaResult:
    validate_run_inputs(suite, concurrency)
    attempt_counts(suite, repeat)
    target_a = prompt_target(suite, model, prompt_a)
    target_b = prompt_target(suite, model, prompt_b)
    source = suite.model_copy(deep=True)
    store = storage or StorageEngine()
    runner = SuiteRunner(storage=store)
    comparison_id = f"prompt_{uuid.uuid4().hex[:12]}"

    # Run sequentially with the same settings and resource budget for each variant.
    # Saved suite baselines must not change an experiment's own quality gate.
    runs = []
    for label, target in (("A", target_a), ("B", target_b)):
        run = await runner.run_suite(
            source,
            target_override=target,
            judge_provider=judge_provider,
            concurrency=concurrency,
            repeat=repeat,
            save_to_storage=False,
        )
        run.metadata["prompt_arena"] = {
            "comparison_id": comparison_id,
            "variant": label,
            "target": target.model_dump(mode="json"),
        }
        runs.append(run)
    run_a, run_b = runs
    rates_a = {r.test_id: r.success_rate for r in run_a.results}
    comparison = ArenaComparisonResult(
        suite_name=source.name,
        model_a=model,
        model_b=model,
        run_a=run_a,
        run_b=run_b,
        pass_rate_delta=round(run_b.pass_rate - run_a.pass_rate, 4),
        latency_p50_delta_ms=round(run_b.p50_latency_ms - run_a.p50_latency_ms, 2),
        cost_delta_usd=round(run_b.total_cost_usd - run_a.total_cost_usd, 6),
        mismatched_test_ids=[
            r.test_id for r in run_b.results if rates_a[r.test_id] != r.success_rate
        ],
    )
    result = PromptArenaResult(
        comparison_id=comparison_id,
        suite_snapshot=source,
        model=model,
        prompt_a=prompt_a,
        prompt_b=prompt_b,
        repeat=repeat,
        concurrency=concurrency,
        comparison=comparison,
    )
    await store.save_run(run_a)
    await store.save_run(run_b)
    await store.save_prompt_comparison(result)
    return result
