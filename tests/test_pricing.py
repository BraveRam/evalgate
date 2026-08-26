"""
Tests for Pricing Database and Token Cost Calculations.
"""

from evalgate.core.pricing import (
    DEFAULT_FALLBACK_PRICING,
    calculate_cost,
    estimate_tokens,
    get_model_pricing,
    normalize_model_name,
)


def test_normalize_model_name():
    assert normalize_model_name("  OpenAI/GPT-4o  ") == "openai/gpt-4o"


def test_get_model_pricing_known_models():
    gpt4o = get_model_pricing("openai/gpt-4o")
    assert gpt4o.input_per_million == 2.50
    assert gpt4o.output_per_million == 10.00

    gemini = get_model_pricing("google/gemini-2.0-flash")
    assert gemini.input_per_million == 0.10
    assert gemini.output_per_million == 0.40

    claude = get_model_pricing("anthropic/claude-3-5-sonnet")
    assert claude.input_per_million == 3.00
    assert claude.output_per_million == 15.00


def test_get_model_pricing_bare_names():
    # Looking up without provider prefix
    gpt4o = get_model_pricing("gpt-4o")
    assert gpt4o.input_per_million == 2.50

    claude = get_model_pricing("claude-3-5-sonnet")
    assert claude.input_per_million == 3.00


def test_get_model_pricing_fallback_for_unknown():
    unknown = get_model_pricing("custom-internal-llm-v1")
    assert unknown == DEFAULT_FALLBACK_PRICING


def test_get_model_pricing_local_and_mock():
    mock = get_model_pricing("mock")
    assert mock.input_per_million == 0.0
    assert mock.output_per_million == 0.0

    ollama = get_model_pricing("ollama/llama3")
    assert ollama.input_per_million == 0.0
    assert ollama.output_per_million == 0.0

    local = get_model_pricing("local/my-finetune")
    assert local.input_per_million == 0.0


def test_calculate_cost():
    # 1,000 input tokens and 500 output tokens on GPT-4o-mini ($0.15 / $0.60 per 1M)
    cost = calculate_cost("openai/gpt-4o-mini", input_tokens=1000, output_tokens=500)
    assert abs(cost - 0.00045) < 1e-6


def test_estimate_tokens():
    assert estimate_tokens("") == 0
    assert estimate_tokens("Hello world") == 2
    assert estimate_tokens("A" * 400) == 100
