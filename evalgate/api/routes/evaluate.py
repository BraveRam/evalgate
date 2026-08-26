"""
Interactive Prompt Playground & Ad-Hoc Evaluation API Endpoints.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from evalgate.core.graph import run_test_case
from evalgate.core.types import AssertionConfig, TargetConfig, TestCase, TestCaseResult
from evalgate.providers.factory import get_provider

router = APIRouter(prefix="/evaluate", tags=["Playground Evaluation"])


class PlaygroundEvaluationRequest(BaseModel):
    target: TargetConfig
    test_case: TestCase
    assertions: list[AssertionConfig] = Field(default_factory=list)
    judge_model: str = Field(default="openai/gpt-4o-mini")


@router.post("/playground")
async def evaluate_playground_prompt(req: PlaygroundEvaluationRequest) -> TestCaseResult:
    """
    Execute a prompt or target with variables and immediately evaluate assertions in real-time.
    Powers the interactive web playground.
    """
    try:
        judge_provider = get_provider(model=req.judge_model)
        result = await run_test_case(
            test_case=req.test_case,
            target_config=req.target,
            default_assertions=req.assertions,
            judge_provider=judge_provider,
        )
        return result
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Playground execution failed: {err}")
