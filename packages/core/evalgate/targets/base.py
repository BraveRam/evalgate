"""
Base Target Executor Interface.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from evalgate.core.types import TargetConfig, TestCase


class TargetOutput(BaseModel):
    """Normalized output from executing any evaluation target."""

    model_config = ConfigDict(extra="allow")

    completion: str = Field(default="")
    raw_output: Any | None = Field(default=None)
    latency_ms: float = Field(default=0.0, ge=0.0)
    input_tokens: int = Field(default=0, ge=0)
    output_tokens: int = Field(default=0, ge=0)
    total_tokens: int = Field(default=0, ge=0)
    cost_usd: float = Field(default=0.0, ge=0.0)
    error: str | None = Field(default=None)


class BaseTarget(ABC):
    """Abstract base class for target execution handlers."""

    def __init__(self, config: TargetConfig):
        self.config = config

    @abstractmethod
    async def execute(self, test_case: TestCase) -> TargetOutput:
        """Execute the target for a given test case."""
        pass
