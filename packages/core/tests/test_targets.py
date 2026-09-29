"""
Tests for Target Executors (Prompt, ToolCall, RAG, Webhook).
"""

import asyncio
import socket
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

    with (
        patch.object(
            executor, "_resolve_address", new_callable=AsyncMock, return_value="93.184.215.14"
        ),
        patch(
            "httpx.AsyncClient.send", new_callable=AsyncMock, return_value=mock_resp
        ) as mock_send,
    ):
        output = await executor.execute(test_case)

        assert output.error is None
        assert "Generated from API" in output.completion
        assert output.latency_ms >= 0
        request = mock_send.call_args.args[0]
        assert request.url.host == "93.184.215.14"
        assert request.headers["Host"] == "api.example.com"
        assert request.extensions["sni_hostname"] == "api.example.com"


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

    with (
        patch.object(
            executor, "_resolve_address", new_callable=AsyncMock, return_value="93.184.215.14"
        ),
        patch("httpx.AsyncClient.send", new_callable=AsyncMock, return_value=mock_resp),
    ):
        output = await executor.execute(test_case)

        assert output.error is not None
        assert "HTTP 500" in output.error


@pytest.mark.asyncio
async def test_webhook_target_ssrf_blocked():
    # 1. Cloud metadata IP
    config1 = TargetConfig(
        type=TargetType.WEBHOOK, webhook_url="http://169.254.169.254/latest/meta-data"
    )
    out1 = await get_target_executor(config1).execute(TestCase(id="t1"))
    assert out1.error is not None
    assert "SSRF Protection" in out1.error

    # 2. Localhost
    config2 = TargetConfig(type=TargetType.WEBHOOK, webhook_url="http://127.0.0.1:8080/eval")
    out2 = await get_target_executor(config2).execute(TestCase(id="t2"))
    assert out2.error is not None
    assert "SSRF Protection" in out2.error

    # 3. Private subnet
    config3 = TargetConfig(type=TargetType.WEBHOOK, webhook_url="http://192.168.1.10/agent")
    out3 = await get_target_executor(config3).execute(TestCase(id="t3"))
    assert out3.error is not None
    assert "SSRF Protection" in out3.error


@pytest.mark.asyncio
async def test_webhook_trailing_dot_loopback_is_blocked():
    config = TargetConfig(type=TargetType.WEBHOOK, webhook_url="http://localhost.:8080/eval")
    executor = get_target_executor(config)
    with patch("httpx.AsyncClient.send", new_callable=AsyncMock) as mock_send:
        output = await executor.execute(TestCase(id="t1"))
    assert "SSRF Protection" in (output.error or "")
    mock_send.assert_not_called()


@pytest.mark.asyncio
async def test_webhook_dns_private_address_is_blocked_before_send():
    config = TargetConfig(type=TargetType.WEBHOOK, webhook_url="https://example.test/eval")
    executor = get_target_executor(config)
    record = (socket.AF_INET, socket.SOCK_STREAM, socket.IPPROTO_TCP, "", ("127.0.0.1", 443))
    loop = asyncio.get_running_loop()
    with (
        patch.object(loop, "getaddrinfo", new_callable=AsyncMock, return_value=[record]),
        patch("httpx.AsyncClient.send", new_callable=AsyncMock) as mock_send,
    ):
        output = await executor.execute(TestCase(id="t1"))
    assert "SSRF Protection" in (output.error or "")
    mock_send.assert_not_called()


@pytest.mark.asyncio
async def test_webhook_opted_in_private_address_still_blocks_metadata():
    config = TargetConfig(
        type=TargetType.WEBHOOK,
        webhook_url="https://example.test/eval",
        allow_private_endpoints=True,
    )
    executor = get_target_executor(config)
    record = (
        socket.AF_INET,
        socket.SOCK_STREAM,
        socket.IPPROTO_TCP,
        "",
        ("169.254.169.254", 443),
    )
    loop = asyncio.get_running_loop()
    with patch.object(loop, "getaddrinfo", new_callable=AsyncMock, return_value=[record]):
        output = await executor.execute(TestCase(id="t1"))
    assert "SSRF Protection" in (output.error or "")


@pytest.mark.asyncio
async def test_webhook_opted_in_private_address_can_be_pinned():
    config = TargetConfig(
        type=TargetType.WEBHOOK,
        webhook_url="https://internal.example/eval",
        allow_private_endpoints=True,
    )
    executor = get_target_executor(config)
    record = (socket.AF_INET, socket.SOCK_STREAM, socket.IPPROTO_TCP, "", ("10.0.0.5", 443))
    response = httpx.Response(status_code=200, text="ok")
    loop = asyncio.get_running_loop()
    with (
        patch.object(loop, "getaddrinfo", new_callable=AsyncMock, return_value=[record]),
        patch("httpx.AsyncClient.send", new_callable=AsyncMock, return_value=response) as send,
    ):
        output = await executor.execute(TestCase(id="t1"))
    assert output.error is None
    request = send.call_args.args[0]
    assert request.url.host == "10.0.0.5"
    assert request.headers["Host"] == "internal.example"
    assert request.extensions["sni_hostname"] == "internal.example"
