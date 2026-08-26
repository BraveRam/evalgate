"""
LangGraph Evaluation Pipeline State Machine.
"""

from __future__ import annotations

import asyncio
from typing import Any, TypedDict

from langgraph.graph import END, START, StateGraph

from evalgate.core.types import (
    AssertionConfig,
    AssertionResult,
    TargetConfig,
    TestCase,
    TestCaseResult,
)
from evalgate.metrics.registry import evaluate_assertion
from evalgate.providers.base import BaseProvider
from evalgate.targets.base import TargetOutput
from evalgate.targets.factory import get_target_executor


class EvalState(TypedDict, total=False):
    """LangGraph state representation for a single test case evaluation."""

    target_config: TargetConfig
    test_case: TestCase
    default_assertions: list[AssertionConfig]
    judge_provider: BaseProvider | None
    target_output: TargetOutput | None
    assertion_results: list[AssertionResult]
    passed: bool
    result: TestCaseResult | None


async def execute_target_node(state: EvalState) -> dict[str, Any]:
    """Node 1: Execute target (Prompt, Tool Call, RAG, Webhook)."""
    target_config = state["target_config"]
    test_case = state["test_case"]

    executor = get_target_executor(target_config)
    output = await executor.execute(test_case)

    return {"target_output": output}


async def evaluate_assertions_node(state: EvalState) -> dict[str, Any]:
    """Node 2: Evaluate both deterministic assertions and semantic LLM judges."""
    test_case = state["test_case"]
    default_assertions = state.get("default_assertions", [])
    judge_provider = state.get("judge_provider")
    output = state.get("target_output") or TargetOutput()

    # Combine default suite assertions + specific test case assertions
    all_assertions = list(default_assertions) + list(test_case.assertions)

    # If target execution crashed, fail all assertions immediately without wasting judge LLM tokens
    if output.error is not None:
        return {
            "assertion_results": [
                AssertionResult(
                    assertion_type=a.type,
                    passed=False,
                    score=0.0,
                    reason=f"Target execution failed: {output.error}",
                    details={"target_error": output.error},
                )
                for a in all_assertions
            ],
            "passed": False,
        }

    if not all_assertions:
        # If no assertions defined, pass as long as there was no execution crash
        return {
            "assertion_results": [],
            "passed": output.error is None,
        }

    # Evaluate all assertions concurrently
    tasks = [
        evaluate_assertion(
            assertion=assertion,
            completion=output.completion,
            test_case=test_case,
            default_judge_provider=judge_provider,
            latency_ms=output.latency_ms,
            total_tokens=output.total_tokens,
            cost_usd=output.cost_usd,
        )
        for assertion in all_assertions
    ]

    results: list[AssertionResult] = await asyncio.gather(*tasks)

    # Determine pass/fail based on strict assertions
    passed = output.error is None
    for assertion, res in zip(all_assertions, results):
        if assertion.strict and not res.passed:
            passed = False
            break

    return {
        "assertion_results": results,
        "passed": passed,
    }


async def finalize_result_node(state: EvalState) -> dict[str, Any]:
    """Node 3: Aggregate metrics and build final TestCaseResult."""
    test_case = state["test_case"]
    output = state.get("target_output") or TargetOutput()
    assertion_results = state.get("assertion_results", [])
    passed = state.get("passed", False)

    result = TestCaseResult(
        test_id=test_case.id,
        passed=passed,
        completion=output.completion,
        raw_output=output.raw_output,
        latency_ms=output.latency_ms,
        input_tokens=output.input_tokens,
        output_tokens=output.output_tokens,
        total_tokens=output.total_tokens,
        cost_usd=output.cost_usd,
        assertion_results=assertion_results,
        error=output.error,
    )

    return {"result": result}


def build_eval_graph() -> StateGraph:
    """Build and compile the LangGraph evaluation state machine."""
    workflow = StateGraph(EvalState)

    workflow.add_node("execute_target", execute_target_node)
    workflow.add_node("evaluate_assertions", evaluate_assertions_node)
    workflow.add_node("finalize_result", finalize_result_node)

    workflow.add_edge(START, "execute_target")
    workflow.add_edge("execute_target", "evaluate_assertions")
    workflow.add_edge("evaluate_assertions", "finalize_result")
    workflow.add_edge("finalize_result", END)

    return workflow


# Compiled singleton graph
_EVAL_GRAPH = build_eval_graph().compile()


async def run_test_case(
    test_case: TestCase,
    target_config: TargetConfig,
    default_assertions: list[AssertionConfig] | None = None,
    judge_provider: BaseProvider | None = None,
) -> TestCaseResult:
    """
    Run an individual test case through the LangGraph evaluation pipeline.
    """
    initial_state: EvalState = {
        "target_config": target_config,
        "test_case": test_case,
        "default_assertions": default_assertions or [],
        "judge_provider": judge_provider,
    }

    final_state = await _EVAL_GRAPH.ainvoke(initial_state)
    result = final_state.get("result")
    if result is None:
        raise RuntimeError("LangGraph eval pipeline did not produce a TestCaseResult.")

    return result
