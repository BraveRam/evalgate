"""
Tests for Target Executors (Prompt, ToolCall, RAG, Webhook).
"""

from unittest.mock import AsyncMock, patch

import httpx
import pytest

from evalgate.core.types import TargetConfig, TargetType, TestCase
from evalgate.targets.factory import get_target_executor


@pytest.mark.asyncio
async def test_prompt_target_execution():
    config = TargetConfig(
        type=TargetType.PROMPT,
        model="mock/simulator",
        template="Hello {{name}}, welcome to {{city}}!",
    )
    executor = get_target_executor(config)
    test_case = TestCase(id="t1", vars={"name": "Alice", "city": "Berlin"})

    output = await executor.execute(test_case)
    assert output.error is None
    assert "Mock completion" in output.completion
    assert output.input_tokens > 0


@pytest.mark.asyncio
async def test_tool_call_target_execution():
    config = TargetConfig(
        type=TargetType.TOOL_CALL,
        model="mock/simulator",
        template="Search for {{query}}",
        tools=[{"name": "web_search", "description": "Search web"}],
    )
    executor = get_target_executor(config)
    test_case = TestCase(id="t1", vars={"query": "quantum computing"})

    output = await executor.execute(test_case)
    assert output.error is None
    assert "web_search" in output.completion


@pytest.mark.asyncio
async def test_rag_target_execution():
    config = TargetConfig(
        type=TargetType.RAG,
        model="mock/simulator",
    )
    executor = get_target_executor(config)
    test_case = TestCase(
        id="t1",
        context=["Document paragraph 1", "Document paragraph 2"],
        vars={"query": "Summary"},
    )

    output = await executor.execute(test_case)
    assert output.error is None
    assert output.completion != ""


@pytest.mark.asyncio
async def test_webhook_target_missing_url():
    config = TargetConfig(
        type=TargetType.WEBHOOK,
        webhook_url=None,
    )
    executor = get_target_executor(config)
    test_case = TestCase(id="t1")

    output = await executor.execute(test_case)
    assert output.error is not None
    assert "No webhook_url" in output.error


@pytest.mark.asyncio
async def test_webhook_target_successful_post():
    config = TargetConfig(
        type=TargetType.WEBHOOK,
        webhook_url="https://api.example.com/generate",
        headers={"X-Custom": "Secret"},
    )
    executor = get_target_executor(config)
    test_case = TestCase(id="t1", vars={"prompt": "Hello"})

    mock_resp = httpx.Response(
        status_code=200,
        json={"result": "Generated from API"},
        request=httpx.Request("POST", "https://api.example.com/generate"),
    )

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp
        output = await executor.execute(test_case)

        assert output.error is None
        assert "Generated from API" in output.completion
        assert output.latency_ms >= 0


@pytest.mark.asyncio
async def test_webhook_target_http_error():
    config = TargetConfig(
        type=TargetType.WEBHOOK,
        webhook_url="https://api.example.com/error",
    )
    executor = get_target_executor(config)
    test_case = TestCase(id="t1")

    mock_resp = httpx.Response(
        status_code=500,
        text="Internal Server Error",
        request=httpx.Request("POST", "https://api.example.com/error"),
    )

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp
        output = await executor.execute(test_case)

        assert output.error is not None
        assert "HTTP 500" in output.error
