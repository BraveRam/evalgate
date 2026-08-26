"""
Live HTTP API / Webhook Target Executor.
"""

from __future__ import annotations

import json
import time

import httpx

from evalgate.core.pricing import estimate_tokens
from evalgate.core.types import TestCase
from evalgate.targets.base import BaseTarget, TargetOutput


class WebhookTarget(BaseTarget):
    """
    Executes live HTTP API / Webhook evaluation targets.
    Posts the test case variables as JSON payload to an endpoint and captures response metrics.
    """

    async def execute(self, test_case: TestCase) -> TargetOutput:
        url = self.config.webhook_url
        if not url:
            return TargetOutput(
                completion="",
                error="Webhook target error: No webhook_url provided in TargetConfig",
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
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(url, json=payload, headers=headers)
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
