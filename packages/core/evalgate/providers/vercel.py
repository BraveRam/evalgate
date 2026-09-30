"""
Vercel AI Gateway and native provider clients with normalized completions.
"""

from __future__ import annotations

import json
import logging
import os
import time
from typing import Any

from langchain_anthropic import ChatAnthropic
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_core.runnables import Runnable
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI
from pydantic import SecretStr

from evalgate.core.pricing import calculate_cost, estimate_tokens
from evalgate.providers.base import BaseProvider, ProviderCompletion

logger = logging.getLogger(__name__)


class VercelGatewayProvider(BaseProvider):
    """
    Unified completion adapter for Vercel Gateway and direct provider clients.
    """

    def __init__(
        self,
        model: str = "openai/gpt-4o-mini",
        temperature: float = 0.0,
        top_p: float | None = None,
        api_key: str | None = None,
        base_url: str | None = None,
        provider_override: str | None = None,
    ):
        super().__init__(model=model, temperature=temperature, top_p=top_p)
        gateway_key = os.getenv("VERCEL_AI_GATEWAY_KEY") or os.getenv("AI_GATEWAY_KEY")
        prefix, separator, bare_model = self.model.partition("/")
        if provider_override:
            route = provider_override
        elif base_url:
            route = "openai"
        elif (api_key and api_key.startswith("vck_")) or (gateway_key and api_key is None):
            route = "vercel"
        else:
            route = prefix.lower() if separator else "openai"

        provider_keys = {
            "vercel": gateway_key,
            "anthropic": os.getenv("ANTHROPIC_API_KEY"),
            "google": os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY"),
            "gemini": os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY"),
            "deepseek": os.getenv("DEEPSEEK_API_KEY"),
        }
        self.api_key = (
            api_key or provider_keys.get(route, os.getenv("OPENAI_API_KEY")) or "dummy-key"
        )
        if self.api_key == "dummy-key":
            logger.warning(
                "No API key configured for provider '%s'; live requests will fail", route
            )

        # Gateway IDs are namespaced; direct APIs expect their own bare model IDs.
        direct_prefixes = {"openai", "anthropic", "google", "gemini", "deepseek"}
        client_model = (
            bare_model
            if route != "vercel" and separator and prefix.lower() in direct_prefixes
            else self.model
        )
        self.base_url = base_url
        client_kwargs: dict[str, Any] = {
            "model": client_model,
            "temperature": self.temperature,
        }
        if self.top_p is not None:
            client_kwargs["top_p"] = self.top_p

        self.client: BaseChatModel
        if route == "anthropic":
            if self.base_url:
                client_kwargs["base_url"] = self.base_url
            self.client = ChatAnthropic(api_key=SecretStr(self.api_key), **client_kwargs)
        elif route in ("google", "gemini"):
            self.client = ChatGoogleGenerativeAI(google_api_key=self.api_key, **client_kwargs)
        else:
            if route == "vercel":
                self.base_url = (
                    self.base_url
                    or os.getenv("VERCEL_AI_GATEWAY_URL")
                    or os.getenv("AI_GATEWAY_URL")
                    or "https://ai-gateway.vercel.sh/v1"
                )
            elif route == "deepseek":
                self.base_url = self.base_url or "https://api.deepseek.com/v1"
            else:
                self.base_url = (
                    self.base_url
                    or os.getenv("VERCEL_AI_GATEWAY_URL")
                    or os.getenv("AI_GATEWAY_URL")
                )
            if self.base_url:
                client_kwargs["base_url"] = self.base_url
            self.client = ChatOpenAI(api_key=SecretStr(self.api_key), **client_kwargs)

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

        llm: Runnable[Any, Any] = self.client
        if tools:
            llm = self.client.bind_tools(tools)
        elif json_schema:
            try:
                llm = self.client.with_structured_output(json_schema)
            except Exception as exc:
                logger.warning("Failed to bind structured output schema: %s", exc)

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
