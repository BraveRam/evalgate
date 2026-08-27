"""
Model Pricing Matrix and Cost/Token Estimation for EvalGate.
"""

from __future__ import annotations

from typing import Dict, NamedTuple, Optional


class ModelPricing(NamedTuple):
    """Pricing rates per 1,000,000 tokens in USD."""

    input_per_million: float
    output_per_million: float


# Current standard pricing database (USD per 1M tokens)
MODEL_PRICING_TABLE: Dict[str, ModelPricing] = {
    # OpenAI
    "openai/gpt-4o": ModelPricing(2.50, 10.00),
    "openai/gpt-4o-mini": ModelPricing(0.15, 0.60),
    "openai/gpt-4-turbo": ModelPricing(10.00, 30.00),
    "openai/gpt-3.5-turbo": ModelPricing(0.50, 1.50),
    "openai/o1": ModelPricing(15.00, 60.00),
    "openai/o1-mini": ModelPricing(3.00, 12.00),
    "openai/o3-mini": ModelPricing(1.10, 4.40),
    # Anthropic
    "anthropic/claude-3-5-sonnet": ModelPricing(3.00, 15.00),
    "anthropic/claude-3-5-haiku": ModelPricing(0.80, 4.00),
    "anthropic/claude-3-opus": ModelPricing(15.00, 75.00),
    # Google Gemini
    "google/gemini-2.0-flash": ModelPricing(0.10, 0.40),
    "google/gemini-2.0-flash-lite": ModelPricing(0.075, 0.30),
    "google/gemini-1.5-flash": ModelPricing(0.075, 0.30),
    "google/gemini-1.5-pro": ModelPricing(1.25, 5.00),
    # DeepSeek
    "deepseek/deepseek-chat": ModelPricing(0.14, 0.28),
    "deepseek/deepseek-v3": ModelPricing(0.14, 0.28),
    "deepseek/deepseek-reasoner": ModelPricing(0.55, 2.19),
    "deepseek/deepseek-r1": ModelPricing(0.55, 2.19),
    # Meta Llama (via Groq / OpenRouter / Fireworks)
    "meta-llama/llama-3.3-70b-instruct": ModelPricing(0.59, 0.79),
    "meta-llama/llama-3.1-8b-instruct": ModelPricing(0.055, 0.055),
    "groq/llama-3.3-70b-versatile": ModelPricing(0.59, 0.79),
    "groq/llama-3.1-8b-instant": ModelPricing(0.05, 0.08),
    # Local / Mock / Zero-cost
    "mock": ModelPricing(0.00, 0.00),
    "mock/simulator": ModelPricing(0.00, 0.00),
    "ollama": ModelPricing(0.00, 0.00),
}

DEFAULT_FALLBACK_PRICING = ModelPricing(1.00, 3.00)


def normalize_model_name(model_name: str) -> str:
    """Normalize model string to lowercase stripped format."""
    return model_name.strip().lower()


def get_model_pricing(model_name: str) -> ModelPricing:
    """
    Look up pricing for a model name. Supports full provider IDs or shorthand names.
    Returns zero-cost for local/ollama/mock models.
    """
    normalized = normalize_model_name(model_name)

    # Check local/mock patterns
    if (
        normalized.startswith("ollama/")
        or normalized.startswith("local/")
        or normalized == "ollama"
    ):
        return ModelPricing(0.00, 0.00)
    if normalized.startswith("mock") or normalized == "mock":
        return ModelPricing(0.00, 0.00)

    # Exact match in table
    if normalized in MODEL_PRICING_TABLE:
        return MODEL_PRICING_TABLE[normalized]

    # Partial match without provider prefix (e.g. "gpt-4o" matches "openai/gpt-4o")
    for key, pricing in MODEL_PRICING_TABLE.items():
        if "/" in key:
            bare_name = key.split("/", 1)[1]
            if normalized == bare_name:
                return pricing

    # Fallback to default
    return DEFAULT_FALLBACK_PRICING


def calculate_cost(model_name: str, input_tokens: int, output_tokens: int) -> float:
    """
    Calculate estimated cost in USD for given token counts.
    """
    pricing = get_model_pricing(model_name)
    input_cost = (input_tokens / 1_000_000.0) * pricing.input_per_million
    output_cost = (output_tokens / 1_000_000.0) * pricing.output_per_million
    return round(input_cost + output_cost, 7)


def estimate_tokens(text: Optional[str]) -> int:
    """
    Estimate token count for a text string using standard ~4 chars per token rule.
    Safe for fast estimation without heavy tiktoken dependencies.
    """
    if not text:
        return 0
    # Average ~3.8 - 4.0 characters per token for English text & code
    return max(1, len(text) // 4)
