"""
Provider Factory for resolving and instantiating LLM providers.
"""

from __future__ import annotations

import os

from evalgate.core.types import TargetConfig
from evalgate.providers.base import BaseProvider
from evalgate.providers.mock import MockProvider
from evalgate.providers.vercel import VercelGatewayProvider


def get_provider(
    target: TargetConfig | None = None,
    model: str | None = None,
    provider_override: str | None = None,
    temperature: float = 0.0,
    top_p: float | None = None,
) -> BaseProvider:
    """
    Resolve and instantiate the appropriate LLM provider.

    Resolution order:
    1. If model or provider is 'mock', returns MockProvider.
    2. If provider_override is specified ('vercel', 'openai', 'mock'), uses that.
    3. If VERCEL_AI_GATEWAY_KEY or AI_GATEWAY_KEY is present, routes through VercelGatewayProvider.
    4. Defaults to VercelGatewayProvider (which also handles direct OpenAI/compatible endpoints).
    """
    resolved_model = (target.model if target else model) or "openai/gpt-4o-mini"
    resolved_temp = target.temperature if target else temperature
    resolved_top_p = target.top_p if target else top_p
    resolved_provider = (target.provider if target else provider_override) or ""

    normalized_model = resolved_model.lower().strip()
    normalized_provider = resolved_provider.lower().strip()

    # 1. Mock Provider
    if (
        normalized_provider == "mock"
        or normalized_model.startswith("mock")
        or normalized_model == "mock"
    ):
        return MockProvider(
            model=resolved_model,
            temperature=resolved_temp,
            top_p=resolved_top_p,
        )

    # 2. Local Ollama Provider check
    if normalized_provider == "ollama" or normalized_model.startswith("ollama/"):
        bare_model = resolved_model.split("/", 1)[1] if "/" in resolved_model else resolved_model
        ollama_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1")
        return VercelGatewayProvider(
            model=bare_model,
            temperature=resolved_temp,
            top_p=resolved_top_p,
            base_url=ollama_url,
            api_key="ollama",
        )

    # 3. Default: Unified Vercel AI Gateway / OpenAI-compatible provider
    return VercelGatewayProvider(
        model=resolved_model,
        temperature=resolved_temp,
        top_p=resolved_top_p,
    )
