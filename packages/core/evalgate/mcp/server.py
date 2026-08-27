"""
Model Context Protocol (MCP) Server for EvalGate.
Exposes evaluation suites, arena benchmarking, pre-flight cost estimation,
historical regression metrics, and prompt evaluation tools to AI coding assistants.
"""

from __future__ import annotations

import glob
import json
import logging
from pathlib import Path
from typing import Any

from mcp.server.mcpserver import MCPServer

from evalgate.cli.loader import SuiteLoadError, load_suite_from_yaml
from evalgate.core.pricing import calculate_cost, estimate_tokens
from evalgate.core.storage import StorageEngine
from evalgate.core.template import render_template
from evalgate.core.types import AssertionConfig, TestCase
from evalgate.metrics.registry import evaluate_assertion
from evalgate.providers.factory import get_provider
from evalgate.runner.runner import SuiteRunner, compare_arena

logger = logging.getLogger(__name__)


def create_mcp_server() -> MCPServer:
    """
    Instantiate and configure the EvalGate MCPServer with all tools registered.
    """
    server = MCPServer("EvalGate")

    @server.tool()
    async def evalgate_run_suite(
        suite_path: str,
        model_override: str | None = None,
        concurrency: int = 10,
    ) -> dict[str, Any]:
        """
        Execute an evaluation suite YAML file and enforce quality gates.

        Args:
            suite_path: Path to the evaluation suite YAML file (e.g. 'evals/rag_qa.yaml').
            model_override: Optional model override (e.g. 'openai/gpt-4o-mini').
            concurrency: Number of parallel test case executions (default: 10).

        Returns:
            Structured summary of pass rate, latency, token costs, and failed assertions.
        """
        try:
            suite = load_suite_from_yaml(Path(suite_path))
        except (SuiteLoadError, FileNotFoundError) as err:
            return {"error": f"Failed to load evaluation suite: {err}", "passed": False}

        target = suite.target
        if model_override:
            target = target.model_copy(update={"model": model_override})

        runner = SuiteRunner()
        res = await runner.run_suite(
            suite=suite,
            target_override=target,
            concurrency=concurrency,
            save_to_storage=True,
        )

        failed_cases: list[dict[str, Any]] = []
        for tc in res.results:
            if not tc.passed:
                reasons = [a.reason for a in tc.assertion_results if not a.passed]
                if tc.error:
                    reasons.append(f"Error: {tc.error}")
                failed_cases.append(
                    {
                        "test_id": tc.test_id,
                        "reasons": reasons,
                        "completion": tc.completion[:300] if tc.completion else None,
                    }
                )

        return {
            "passed": res.passed,
            "suite_name": res.suite_name,
            "target_model": target.model,
            "pass_rate": res.pass_rate,
            "min_pass_rate_required": suite.min_pass_rate,
            "total_tests": res.total_tests,
            "passed_tests": res.passed_tests,
            "failed_tests": res.failed_tests,
            "avg_latency_ms": res.avg_latency_ms,
            "p50_latency_ms": res.p50_latency_ms,
            "p95_latency_ms": res.p95_latency_ms,
            "total_tokens": res.total_tokens,
            "total_cost_usd": res.total_cost_usd,
            "run_id": res.run_id,
            "failed_cases": failed_cases,
        }

    @server.tool()
    async def evalgate_estimate_cost(
        suite_path: str,
        model: str | None = None,
        estimated_output_tokens_per_test: int = 150,
    ) -> dict[str, Any]:
        """
        Calculate pre-flight estimated token usage and inference cost for an evaluation suite.

        Args:
            suite_path: Path to the evaluation suite YAML file.
            model: Optional model override to calculate costs against.
            estimated_output_tokens_per_test: Estimated completion tokens per test (default: 150).

        Returns:
            Dictionary with input tokens, output tokens, total estimated USD cost, and cost/test.
        """
        try:
            suite = load_suite_from_yaml(Path(suite_path))
        except (SuiteLoadError, FileNotFoundError) as err:
            return {"error": f"Failed to load evaluation suite: {err}"}

        target_model = model or suite.target.model
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

        total_output_tokens = total_tests * estimated_output_tokens_per_test
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

    @server.tool()
    async def evalgate_compare_models(
        suite_path: str,
        model_a: str,
        model_b: str,
        concurrency: int = 10,
    ) -> dict[str, Any]:
        """
        Run an A/B benchmark shootout comparing two LLMs on the same evaluation suite.

        Args:
            suite_path: Path to the evaluation suite YAML file.
            model_a: First model identifier (e.g. 'openai/gpt-4o-mini').
            model_b: Second model identifier (e.g. 'anthropic/claude-3-5-sonnet').
            concurrency: Number of concurrent tests (default: 10).

        Returns:
            Comparison delta table with pass rate differences, latency, and costs.
        """
        try:
            suite = load_suite_from_yaml(Path(suite_path))
        except (SuiteLoadError, FileNotFoundError) as err:
            return {"error": f"Failed to load evaluation suite: {err}"}

        comparison = await compare_arena(
            suite=suite,
            model_a=model_a,
            model_b=model_b,
            concurrency=concurrency,
        )

        return {
            "suite_name": comparison.suite_name,
            "model_a": comparison.model_a,
            "model_b": comparison.model_b,
            "model_a_pass_rate": comparison.run_a.pass_rate,
            "model_b_pass_rate": comparison.run_b.pass_rate,
            "pass_rate_delta": comparison.pass_rate_delta,
            "model_a_p50_latency_ms": comparison.run_a.p50_latency_ms,
            "model_b_p50_latency_ms": comparison.run_b.p50_latency_ms,
            "latency_p50_delta_ms": comparison.latency_p50_delta_ms,
            "model_a_cost_usd": comparison.run_a.total_cost_usd,
            "model_b_cost_usd": comparison.run_b.total_cost_usd,
            "cost_delta_usd": comparison.cost_delta_usd,
            "mismatched_test_ids": comparison.mismatched_test_ids,
        }

    @server.tool()
    async def evalgate_evaluate_completion(
        completion: str,
        assertions: list[dict[str, Any]],
        context: list[str] | str | None = None,
        ground_truth: str | None = None,
        judge_model: str = "openai/gpt-4o-mini",
    ) -> dict[str, Any]:
        """
        Evaluate any raw text completion on-the-fly against assertion configs.
        Useful for checking prompt outputs immediately without writing a suite file.

        Args:
            completion: The LLM output string to evaluate.
            assertions: List of assertion dicts (e.g. [{'type': 'contains', 'value': 'foo'}]).
            context: Optional list of retrieved context strings for RAG metrics.
            ground_truth: Optional ground truth reference answer.
            judge_model: Model for semantic judge evaluations (default: 'openai/gpt-4o-mini').

        Returns:
            Dictionary of passed/failed assertion results and scores.
        """
        ctx_list = [context] if isinstance(context, str) else (context or [])
        test_case = TestCase(
            id="ad-hoc-eval",
            vars={},
            context=ctx_list,
            ground_truth=ground_truth,
        )

        judge_provider = get_provider(model=judge_model)

        parsed_assertions: list[AssertionConfig] = []
        for raw_a in assertions:
            try:
                parsed_assertions.append(AssertionConfig(**raw_a))
            except Exception as err:
                return {"error": f"Invalid assertion config {raw_a}: {err}", "all_passed": False}

        results = []
        all_passed = True

        for a in parsed_assertions:
            ar = await evaluate_assertion(
                assertion=a,
                completion=completion,
                test_case=test_case,
                default_judge_provider=judge_provider,
            )
            if not ar.passed and a.strict:
                all_passed = False
            results.append(
                {
                    "assertion_type": ar.assertion_type.value,
                    "passed": ar.passed,
                    "score": ar.score,
                    "reason": ar.reason,
                    "strict": a.strict,
                }
            )

        return {
            "all_passed": all_passed,
            "total_assertions": len(results),
            "passed_assertions": sum(1 for r in results if r["passed"]),
            "failed_assertions": sum(1 for r in results if not r["passed"]),
            "results": results,
        }

    @server.tool()
    async def evalgate_list_runs(
        suite_name: str | None = None,
        limit: int = 20,
    ) -> list[dict[str, Any]]:
        """
        List past evaluation runs from the local SQLite storage.

        Args:
            suite_name: Optional filter by suite name.
            limit: Maximum number of runs to return (default: 20).

        Returns:
            List of run summaries with timestamp, model, pass rate, latency, and cost.
        """
        storage = StorageEngine()
        runs = await storage.list_runs(suite_name=suite_name, limit=limit)
        return [
            {
                "run_id": r.run_id,
                "suite_name": r.suite_name,
                "model": r.target_model,
                "timestamp": r.timestamp.isoformat(),
                "passed": r.passed,
                "pass_rate": r.pass_rate,
                "total_tests": r.total_tests,
                "passed_tests": r.passed_tests,
                "failed_tests": r.failed_tests,
                "p50_latency_ms": r.p50_latency_ms,
                "total_cost_usd": r.total_cost_usd,
            }
            for r in runs
        ]

    @server.tool()
    async def evalgate_get_historical_trends(
        suite_name: str,
        limit: int = 30,
    ) -> dict[str, Any]:
        """
        Fetch historical performance and regression trends for a given evaluation suite.

        Args:
            suite_name: The name of the evaluation suite.
            limit: Number of recent runs to analyze (default: 30).

        Returns:
            Dictionary containing time-series arrays for pass rate, P50 latency, and costs.
        """
        storage = StorageEngine()
        metrics = await storage.get_historical_metrics(suite_name=suite_name, limit=limit)
        return {
            "suite_name": suite_name,
            "data_points": len(metrics),
            "trends": [
                {
                    "run_id": m["run_id"],
                    "timestamp": m["timestamp"],
                    "pass_rate": m["pass_rate"],
                    "p50_latency_ms": m["p50_latency_ms"],
                    "p95_latency_ms": m["p95_latency_ms"],
                    "total_cost_usd": m["total_cost_usd"],
                    "total_tokens": m["total_tokens"],
                }
                for m in metrics
            ],
        }

    @server.tool()
    async def evalgate_list_suites(
        search_dir: str = "evals",
    ) -> list[dict[str, Any]]:
        """
        Discover and list all evaluation suite YAML files in the workspace.

        Args:
            search_dir: Directory to scan for evaluation suites (default: 'evals').

        Returns:
            List of suite metadata objects including path, name, description, and test count.
        """
        pattern = f"{search_dir}/**/*.y*ml"
        files = glob.glob(pattern, recursive=True)
        suites: list[dict[str, Any]] = []

        for fpath_str in sorted(files):
            p = Path(fpath_str)
            try:
                suite = load_suite_from_yaml(p)
                suites.append(
                    {
                        "path": str(p),
                        "name": suite.name,
                        "description": suite.description,
                        "target_type": suite.target.type,
                        "target_model": suite.target.model,
                        "min_pass_rate": suite.min_pass_rate,
                        "test_count": len(suite.tests),
                    }
                )
            except Exception as err:
                suites.append(
                    {
                        "path": str(p),
                        "error": str(err),
                    }
                )

        return suites

    return server


def run_mcp_server(transport: str = "stdio") -> None:
    """
    Run the MCPServer with the specified transport.
    """
    server = create_mcp_server()
    if transport == "sse":
        server.run(transport="sse")
    else:
        server.run(transport="stdio")
