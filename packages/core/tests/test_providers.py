"""
Tests for Providers and Provider Factory.
"""

import json

import httpx
import pytest
from langchain_anthropic import ChatAnthropic
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI

from evalgate.core.types import TargetConfig
from evalgate.providers.base import ProviderCompletion
from evalgate.providers.factory import get_provider
from evalgate.providers.mock import MockProvider
from evalgate.providers.vercel import VercelGatewayProvider


@pytest.fixture(autouse=True)
def isolate_provider_credentials(monkeypatch):
    for name in (
        "VERCEL_AI_GATEWAY_KEY",
        "AI_GATEWAY_KEY",
        "OPENAI_API_KEY",
        "ANTHROPIC_API_KEY",
        "GOOGLE_API_KEY",
        "GEMINI_API_KEY",
        "DEEPSEEK_API_KEY",
        "VERCEL_AI_GATEWAY_URL",
        "AI_GATEWAY_URL",
    ):
        monkeypatch.delenv(name, raising=False)


@pytest.mark.parametrize(
    ("model", "key_name", "client_class", "bare_model"),
    [
        ("openai/gpt-4o-mini", "OPENAI_API_KEY", ChatOpenAI, "gpt-4o-mini"),
        ("anthropic/claude-3-5-sonnet", "ANTHROPIC_API_KEY", ChatAnthropic, "claude-3-5-sonnet"),
        ("google/gemini-2.0-flash", "GOOGLE_API_KEY", ChatGoogleGenerativeAI, "gemini-2.0-flash"),
        ("google/gemini-2.0-flash", "GEMINI_API_KEY", ChatGoogleGenerativeAI, "gemini-2.0-flash"),
        ("deepseek/deepseek-chat", "DEEPSEEK_API_KEY", ChatOpenAI, "deepseek-chat"),
    ],
)
def test_direct_provider_routing(monkeypatch, model, key_name, client_class, bare_model):
    monkeypatch.setenv(key_name, "test-only-key")
    provider = get_provider(model=model, top_p=0.8)
    assert isinstance(provider.client, client_class)
    assert provider.api_key == "test-only-key"
    assert provider.model == model  # Preserve the canonical pricing identifier.
    outbound_model = getattr(provider.client, "model_name", None) or provider.client.model
    assert outbound_model == bare_model
    assert provider.client.top_p == 0.8
    if model.startswith("deepseek/"):
        assert str(provider.client.root_client.base_url) == "https://api.deepseek.com/v1/"


def test_gateway_keeps_namespaced_models(monkeypatch):
    monkeypatch.setenv("VERCEL_AI_GATEWAY_KEY", "test-gateway-key")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-anthropic-key")
    provider = get_provider(model="anthropic/claude-3-5-sonnet")
    assert isinstance(provider.client, ChatOpenAI)
    assert provider.client.model_name == "anthropic/claude-3-5-sonnet"
    assert provider.api_key == "test-gateway-key"
    assert str(provider.client.root_client.base_url) == "https://ai-gateway.vercel.sh/v1/"


def test_explicit_native_provider_overrides_gateway(monkeypatch):
    monkeypatch.setenv("VERCEL_AI_GATEWAY_KEY", "test-gateway-key")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-anthropic-key")
    provider = get_provider(model="anthropic/claude-3-5-sonnet", provider_override="anthropic")
    assert isinstance(provider.client, ChatAnthropic)
    assert provider.api_key == "test-anthropic-key"


def test_custom_endpoint_does_not_use_gateway_credentials(monkeypatch):
    monkeypatch.setenv("VERCEL_AI_GATEWAY_KEY", "test-gateway-key")
    provider = VercelGatewayProvider(
        model="organization/model", base_url="http://localhost:11434/v1", api_key="local-test-key"
    )
    assert provider.api_key == "local-test-key"
    assert provider.client.model_name == "organization/model"
    assert str(provider.client.root_client.base_url) == "http://localhost:11434/v1/"


@pytest.mark.asyncio
@pytest.mark.parametrize("native", ["openai", "anthropic"])
async def test_direct_completion_request_and_usage(monkeypatch, native):
    model = "gpt-4o-mini" if native == "openai" else "claude-3-5-sonnet"
    monkeypatch.setenv(f"{native.upper()}_API_KEY", "test-only-key")
    requests = []

    def respond(request):
        requests.append(request)
        payload = json.loads(request.content)
        assert payload["model"] == model
        assert payload["messages"][-1]["content"] == "Hello"
        if native == "openai":
            body = {
                "id": "chatcmpl-test",
                "object": "chat.completion",
                "created": 0,
                "model": model,
                "choices": [
                    {
                        "index": 0,
                        "message": {"role": "assistant", "content": "Answer"},
                        "finish_reason": "stop",
                    }
                ],
                "usage": {"prompt_tokens": 4, "completion_tokens": 1, "total_tokens": 5},
            }
        else:
            body = {
                "id": "msg-test",
                "type": "message",
                "role": "assistant",
                "model": model,
                "content": [{"type": "text", "text": "Answer"}],
                "stop_reason": "end_turn",
                "stop_sequence": None,
                "usage": {"input_tokens": 4, "output_tokens": 1},
            }
        return httpx.Response(200, json=body)

    provider = get_provider(model=f"{native}/{model}")
    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as http_client:
        sdk_client = (
            provider.client.root_async_client
            if native == "openai"
            else provider.client._async_client
        )
        monkeypatch.setattr(sdk_client, "_client", http_client)
        result = await provider.complete("Hello")
    assert len(requests) == 1
    expected_host = "api.openai.com" if native == "openai" else "api.anthropic.com"
    assert requests[0].url.host == expected_host
    assert result.text == "Answer"
    assert result.input_tokens == 4
    assert result.output_tokens == 1
    assert result.total_tokens == 5
    assert result.model == f"{native}/{model}"


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
