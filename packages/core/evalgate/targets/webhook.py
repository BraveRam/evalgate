"""
Live HTTP API / Webhook Target Executor.
"""

from __future__ import annotations

import asyncio
import ipaddress
import json
import socket
import time
from urllib.parse import urlparse

import httpx

from evalgate.core.pricing import estimate_tokens
from evalgate.core.types import TestCase
from evalgate.targets.base import BaseTarget, TargetOutput


class WebhookTarget(BaseTarget):
    """
    Executes live HTTP API / Webhook evaluation targets.
    Posts the test case variables as JSON payload to an endpoint and captures response metrics.
    """

    def _validate_url(self, url: str | None) -> str | None:
        """Validate URL format and prevent unauthorized SSRF egress."""
        if not url:
            return "No webhook_url provided in TargetConfig"
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return f"Invalid webhook URL scheme: '{parsed.scheme}'. Must be http or https."
        if not parsed.netloc:
            return f"Invalid webhook URL: missing hostname in '{url}'"

        hostname = (parsed.hostname or "").lower().rstrip(".")
        if not hostname:
            return "Invalid webhook URL: missing hostname"
        if hostname in ("169.254.169.254", "metadata.google.internal", "instance-data"):
            return f"SSRF Protection: Blocked access to cloud metadata endpoint '{hostname}'"

        if hostname == "localhost" and not self.config.allow_private_endpoints:
            return f"SSRF Protection: Loopback host '{hostname}' is not permitted"
        try:
            address = ipaddress.ip_address(hostname)
        except ValueError:
            pass  # DNS names are checked after resolution, before connecting.
        else:
            return self._validate_address(address)

        return None

    def _validate_address(
        self, address: ipaddress.IPv4Address | ipaddress.IPv6Address
    ) -> str | None:
        """Reject metadata and, unless opted in, every non-public address."""
        mapped = address.ipv4_mapped if isinstance(address, ipaddress.IPv6Address) else None
        effective_address = mapped or address
        if effective_address.is_link_local or effective_address == ipaddress.ip_address(
            "169.254.169.254"
        ):
            return f"SSRF Protection: Link-local address '{address}' is not permitted"
        if not self.config.allow_private_endpoints and not effective_address.is_global:
            return f"SSRF Protection: Non-public address '{address}' is not permitted"
        return None

    async def _resolve_address(self, hostname: str, port: int) -> str:
        """Resolve once and return an address that can be pinned for the request."""
        try:
            address = ipaddress.ip_address(hostname)
            addresses = [address]
        except ValueError:
            records = await asyncio.get_running_loop().getaddrinfo(
                hostname, port, type=socket.SOCK_STREAM, proto=socket.IPPROTO_TCP
            )
            addresses = [ipaddress.ip_address(record[4][0]) for record in records]

        if not addresses:
            raise ValueError(f"No addresses found for webhook host '{hostname}'")
        for address in addresses:
            error = self._validate_address(address)
            if error:
                raise ValueError(error)
        return str(addresses[0])

    async def execute(self, test_case: TestCase) -> TargetOutput:
        url = self.config.webhook_url
        validation_error = self._validate_url(url)
        if validation_error or not url:
            return TargetOutput(
                completion="",
                error=f"Webhook target error: {validation_error}",
            )

        headers = {"Content-Type": "application/json"}
        if self.config.headers:
            headers.update(self.config.headers)

        payload = {
            "id": test_case.id,
            "vars": test_case.vars,
            "context": test_case.context,
        }

        start_time = time.perf_counter()
        try:
            parsed = urlparse(url)
            hostname = (parsed.hostname or "").lower().rstrip(".")
            port = parsed.port or (443 if parsed.scheme == "https" else 80)
            pinned_address = await self._resolve_address(hostname, port)
            pinned_url = httpx.URL(url).copy_with(host=pinned_address)
            async with httpx.AsyncClient(
                timeout=30.0, trust_env=False, follow_redirects=False
            ) as client:
                request = client.build_request("POST", pinned_url, json=payload, headers=headers)
                request.headers["Host"] = parsed.netloc.rsplit("@", 1)[-1]
                request.extensions["sni_hostname"] = hostname
                resp = await client.send(request)
                latency_ms = (time.perf_counter() - start_time) * 1000.0

                try:
                    resp_data = resp.json()
                    completion = (
                        json.dumps(resp_data, indent=2)
                        if isinstance(resp_data, (dict, list))
                        else str(resp_data)
                    )
                except Exception:
                    completion = resp.text

                input_tokens = estimate_tokens(json.dumps(payload))
                output_tokens = estimate_tokens(completion)
                total_tokens = input_tokens + output_tokens

                if resp.status_code >= 400:
                    return TargetOutput(
                        completion=completion,
                        raw_output={"status_code": resp.status_code, "body": completion},
                        latency_ms=round(latency_ms, 2),
                        input_tokens=input_tokens,
                        output_tokens=output_tokens,
                        total_tokens=total_tokens,
                        error=f"Webhook HTTP {resp.status_code}: {completion[:200]}",
                    )

                return TargetOutput(
                    completion=completion,
                    raw_output=completion,
                    latency_ms=round(latency_ms, 2),
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    total_tokens=total_tokens,
                )
        except Exception as exc:
            latency_ms = (time.perf_counter() - start_time) * 1000.0
            return TargetOutput(
                completion="",
                latency_ms=round(latency_ms, 2),
                error=f"Webhook connection error to {url}: {exc}",
            )
