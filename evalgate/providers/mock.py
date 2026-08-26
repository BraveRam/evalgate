"""
Offline Mock Simulator Provider for zero-cost testing and development.
"""

from __future__ import annotations

import asyncio
import json
import time
from typing import Any

from evalgate.core.pricing import calculate_cost, estimate_tokens
from evalgate.providers.base import BaseProvider, ProviderCompletion


class MockProvider(BaseProvider):
    """
    Mock LLM provider simulating model responses, latency, and token generation.
    Supports predefined responses, echo mode, or JSON schema synthesis.
    """

    def __init__(
        self,
        model: str = "mock/simulator",
        temperature: float = 0.0,
        top_p: float | None = None,
        mock_response: str | None = None,
        mock_tool_calls: list[dict[str, Any]] | None = None,
        mock_latency_ms: float = 10.0,
    ):
        super().__init__(model=model, temperature=temperature, top_p=top_p)
        self.mock_response = mock_response
        self.mock_tool_calls = mock_tool_calls or []
        self.mock_latency_ms = mock_latency_ms

    async def complete(
        self,
        prompt: str,
        system_prompt: str | None = None,
        tools: list[dict[str, Any]] | None = None,
        json_schema: dict[str, Any] | None = None,
    ) -> ProviderCompletion:
        start_time = time.perf_counter()

        if self.mock_latency_ms > 0:
            await asyncio.sleep(self.mock_latency_ms / 1000.0)

        # 1. Determine generated text
        if self.mock_response is not None:
            text = self.mock_response
        elif json_schema is not None:
            # Generate minimal valid mock JSON matching schema properties
            mock_obj: dict[str, Any] = {}
            properties = json_schema.get("properties", {})
            for prop, spec in properties.items():
                p_type = spec.get("type", "string")
                if p_type == "string":
                    mock_obj[prop] = "mock_value"
                elif p_type in ("number", "integer"):
                    mock_obj[prop] = 42
                elif p_type == "boolean":
                    mock_obj[prop] = True
                elif p_type == "array":
                    mock_obj[prop] = ["item1"]
                else:
                    mock_obj[prop] = {}
            text = json.dumps(mock_obj)
        elif (
            "score" in prompt.lower()
            or "json" in prompt.lower()
            or (system_prompt and "json" in system_prompt.lower())
        ):
            # Return valid judge JSON evaluation structure
            text = json.dumps(
                {
                    "score": 0.95,
                    "reasoning": "Mock judge evaluation passed successfully",
                    "claims": [{"claim": "mock claim", "supported": True}],
                    "hallucinations": [],
                }
            )
        else:
            text = f"Mock completion for: {prompt[:60]}"

        # 2. Tool calls
        tool_calls = list(self.mock_tool_calls)
        if tools and not tool_calls:
            # Synthesize mock tool call to first tool if provided
            first_tool = tools[0]
            tool_name = first_tool.get("name", "mock_tool")
            tool_calls = [{"name": tool_name, "arguments": {"query": prompt[:30]}}]

        latency_ms = (time.perf_counter() - start_time) * 1000.0
        full_input = f"{system_prompt or ''}\n{prompt}"
        input_tokens = estimate_tokens(full_input)
        output_tokens = estimate_tokens(text)
        total_tokens = input_tokens + output_tokens
        cost_usd = calculate_cost(self.model, input_tokens, output_tokens)

        return ProviderCompletion(
            text=text,
            raw_output={"mock": True, "prompt_length": len(prompt)},
            tool_calls=tool_calls,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
            latency_ms=round(latency_ms, 2),
            model=self.model,
            cost_usd=cost_usd,
        )
