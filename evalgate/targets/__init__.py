"""
EvalGate Targets Package.
"""

from evalgate.targets.base import BaseTarget, TargetOutput
from evalgate.targets.factory import get_target_executor
from evalgate.targets.prompt import PromptTarget
from evalgate.targets.rag import RAGTarget
from evalgate.targets.tool_call import ToolCallTarget
from evalgate.targets.webhook import WebhookTarget

__all__ = [
    "BaseTarget",
    "TargetOutput",
    "PromptTarget",
    "ToolCallTarget",
    "RAGTarget",
    "WebhookTarget",
    "get_target_executor",
]
