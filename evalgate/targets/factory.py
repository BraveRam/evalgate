"""
Target Executor Factory.
"""

from __future__ import annotations

from evalgate.core.types import TargetConfig, TargetType
from evalgate.targets.base import BaseTarget
from evalgate.targets.prompt import PromptTarget
from evalgate.targets.rag import RAGTarget
from evalgate.targets.tool_call import ToolCallTarget
from evalgate.targets.webhook import WebhookTarget


def get_target_executor(config: TargetConfig) -> BaseTarget:
    """
    Resolve and instantiate the appropriate target executor based on TargetType.
    """
    target_type = config.type

    if target_type == TargetType.TOOL_CALL:
        return ToolCallTarget(config)
    if target_type == TargetType.RAG:
        return RAGTarget(config)
    if target_type == TargetType.WEBHOOK:
        return WebhookTarget(config)

    # Default: PROMPT or STRUCTURED_OUTPUT
    return PromptTarget(config)
