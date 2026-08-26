"""
Base Semantic Metric and LLM-as-a-Judge Protocol.
"""

from __future__ import annotations

import json
import re
from abc import ABC, abstractmethod
from typing import Any

from evalgate.core.types import AssertionConfig, AssertionResult, TestCase
from evalgate.providers.base import BaseProvider


class BaseSemanticMetric(ABC):
    """Abstract base class for LLM-as-a-Judge semantic evaluators."""

    def __init__(self, judge_provider: BaseProvider):
        self.judge = judge_provider

    @abstractmethod
    async def evaluate(
        self,
        assertion: AssertionConfig,
        completion: str,
        test_case: TestCase,
    ) -> AssertionResult:
        """Run judge evaluation on the completion."""
        pass

    async def _invoke_structured_judge(
        self,
        judge_prompt: str,
        system_prompt: str = (
            "You are a rigorous, unbiased AI evaluation judge. Always output valid JSON."
        ),
    ) -> dict[str, Any]:
        """
        Execute judge model with strict temperature=0 and parse structured JSON.
        """
        res = await self.judge.complete(
            prompt=judge_prompt,
            system_prompt=system_prompt,
        )

        cleaned = res.text.strip()
        # Clean markdown wrappers if present
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        elif cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            # Fallback: extract first JSON object via regex
            match = re.search(r"\{.*\}", cleaned, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group(0))
                except json.JSONDecodeError:
                    pass

            return {
                "score": 0.0,
                "passed": False,
                "reasoning": f"Judge model returned unparseable response: {cleaned[:100]}",
            }
