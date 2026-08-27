"""
Tests for Providers and Provider Factory.
"""

import json

import pytest

from evalgate.core.types import TargetConfig
from evalgate.providers.base import ProviderCompletion
from evalgate.providers.factory import get_provider
from evalgate.providers.mock import MockProvider
from evalgate.providers.vercel import VercelGatewayProvider


@pytest.mark.asyncio
async def test_mock_provider_json_schema_synthesis():
    schema = {
        "type": "object",
        "properties": {
            "title": {"type": "string"},
            "count": {"type": "integer"},
            "active": {"type": "boolean"},
            "tags": {"type": "array"},
        },
    }
    mock = MockProvider()
    res = await mock.complete("generate data", json_schema=schema)

    assert isinstance(res, ProviderCompletion)
    data = json.loads(res.text)
    assert data["title"] == "mock_value"
    assert data["count"] == 42
    assert data["active"] is True
    assert data["tags"] == ["item1"]


@pytest.mark.asyncio
async def test_mock_provider_tool_call_synthesis():
    mock = MockProvider()
    tools = [{"name": "get_weather", "description": "Weather tool"}]
    res = await mock.complete("Check weather", tools=tools)

    assert len(res.tool_calls) == 1
    assert res.tool_calls[0]["name"] == "get_weather"


def test_provider_factory_resolution():
    # Mock resolution
    p_mock1 = get_provider(model="mock/simulator")
    assert isinstance(p_mock1, MockProvider)

    p_mock2 = get_provider(provider_override="mock")
    assert isinstance(p_mock2, MockProvider)

    # Ollama resolution
    p_ollama = get_provider(model="ollama/llama3")
    assert isinstance(p_ollama, VercelGatewayProvider)
    assert p_ollama.model == "llama3"

    # Default Vercel Gateway resolution
    target = TargetConfig(model="anthropic/claude-3-5-sonnet", temperature=0.7)
    p_vercel = get_provider(target=target)
    assert isinstance(p_vercel, VercelGatewayProvider)
    assert p_vercel.model == "anthropic/claude-3-5-sonnet"
    assert p_vercel.temperature == 0.7
