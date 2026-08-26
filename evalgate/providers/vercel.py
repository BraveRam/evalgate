"""
Vercel AI Gateway Provider using LangChain OpenAI-compatible client.
"""

from __future__ import annotations

import json
import os
import time
from typing import Any

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from evalgate.core.pricing import calculate_cost, estimate_tokens
from evalgate.providers.base import BaseProvider, ProviderCompletion


class VercelGatewayProvider(BaseProvider):
    """
    Unified Vercel AI Gateway provider routing to multiple models
    (OpenAI, Anthropic, Google, Groq, DeepSeek) through a single API key.
    """

    def __init__(
        self,
        model: str = "openai/gpt-4o-mini",
        temperature: float = 0.0,
        top_p: float | None = None,
        api_key: str | None = None,
        base_url: str | None = None,
    ):
        super().__init__(model=model, temperature=temperature, top_p=top_p)
        self.api_key = (
            api_key
            or os.getenv("VERCEL_AI_GATEWAY_KEY")
            or os.getenv("AI_GATEWAY_KEY")
            or os.getenv("OPENAI_API_KEY")
            or "dummy-key"
        )
        self.base_url = (
            base_url or os.getenv("VERCEL_AI_GATEWAY_URL") or os.getenv("AI_GATEWAY_URL") or None
        )

        client_kwargs: dict[str, Any] = {
            "model_name": self.model,
            "api_key": self.api_key,
            "temperature": self.temperature,
        }
        if self.top_p is not None:
            client_kwargs["model_kwargs"] = {"top_p": self.top_p}
        if self.base_url:
            client_kwargs["base_url"] = self.base_url

        self.client = ChatOpenAI(**client_kwargs)

    async def complete(
        self,
        prompt: str,
        system_prompt: str | None = None,
        tools: list[dict[str, Any]] | None = None,
        json_schema: dict[str, Any] | None = None,
    ) -> ProviderCompletion:
        start_time = time.perf_counter()

        messages: list[SystemMessage | HumanMessage] = []
        if system_prompt:
            messages.append(SystemMessage(content=system_prompt))
        messages.append(HumanMessage(content=prompt))

        llm = self.client
        if tools:
            llm = llm.bind_tools(tools)
        elif json_schema:
            try:
                llm = llm.with_structured_output(json_schema)
            except Exception:
                pass

        response = await llm.ainvoke(messages)
        latency_ms = (time.perf_counter() - start_time) * 1000.0

        # Extract text and tool calls
        tool_calls: list[dict[str, Any]] = []
        if isinstance(response, AIMessage):
            text = (
                str(response.content)
                if isinstance(response.content, str)
                else json.dumps(response.content)
            )
            if hasattr(response, "tool_calls") and response.tool_calls:
                for tc in response.tool_calls:
                    tool_calls.append(
                        {
                            "name": tc.get("name"),
                            "arguments": tc.get("args", {}),
                        }
                    )
        elif isinstance(response, (dict, list)):
            text = json.dumps(response, indent=2)
        else:
            text = str(response)

        # Token counting from usage_metadata or estimation
        input_tokens = 0
        output_tokens = 0
        if hasattr(response, "usage_metadata") and response.usage_metadata:
            input_tokens = response.usage_metadata.get("input_tokens", 0)
            output_tokens = response.usage_metadata.get("output_tokens", 0)

        if input_tokens == 0 and output_tokens == 0:
            full_input = f"{system_prompt or ''}\n{prompt}"
            input_tokens = estimate_tokens(full_input)
            output_tokens = estimate_tokens(text)

        total_tokens = input_tokens + output_tokens
        cost_usd = calculate_cost(self.model, input_tokens, output_tokens)

        return ProviderCompletion(
            text=text,
            raw_output=response if not isinstance(response, AIMessage) else response.model_dump(),
            tool_calls=tool_calls,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
            latency_ms=round(latency_ms, 2),
            model=self.model,
            cost_usd=cost_usd,
        )
