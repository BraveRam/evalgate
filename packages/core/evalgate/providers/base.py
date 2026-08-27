"""
Base Provider Interface and Execution Contracts for EvalGate.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ProviderCompletion(BaseModel):
    """Normalized response payload returned by any LLM provider."""

    model_config = ConfigDict(extra="allow")

    text: str = Field(default="", description="Generated completion text")
    raw_output: Any | None = Field(default=None, description="Raw provider response object")
    tool_calls: list[dict[str, Any]] = Field(
        default_factory=list, description="Extracted tool calls"
    )
    input_tokens: int = Field(default=0, ge=0)
    output_tokens: int = Field(default=0, ge=0)
    total_tokens: int = Field(default=0, ge=0)
    latency_ms: float = Field(default=0.0, ge=0.0)
    model: str = Field(default="")
    cost_usd: float = Field(default=0.0, ge=0.0)


class BaseProvider(ABC):
    """Abstract base class for LLM providers."""

    def __init__(self, model: str, temperature: float = 0.0, top_p: float | None = None):
        self.model = model
        self.temperature = temperature
        self.top_p = top_p

    @abstractmethod
    async def complete(
        self,
        prompt: str,
        system_prompt: str | None = None,
        tools: list[dict[str, Any]] | None = None,
        json_schema: dict[str, Any] | None = None,
    ) -> ProviderCompletion:
        """Generate a completion for the given prompt."""
        pass
