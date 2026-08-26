"""
WebSocket Live Evaluation Streaming Endpoint.
"""

from __future__ import annotations

import asyncio
import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from evalgate.api.routes.suites import _find_suite_path
from evalgate.cli.loader import load_suite_from_yaml
from evalgate.core.types import TestCaseResult
from evalgate.providers.factory import get_provider
from evalgate.runner.runner import SuiteRunner

logger = logging.getLogger(__name__)

router = APIRouter(tags=["WebSockets"])


@router.websocket("/ws/run")
async def websocket_run_stream(websocket: WebSocket) -> None:
    """
    Live streaming WebSocket connection for real-time test executions in the Web UI.
    """
    await websocket.accept()
    try:
        data = await websocket.receive_text()
        params = json.loads(data)

        suite_name = params.get("suite_name")
        if not suite_name:
            await websocket.send_json({"type": "error", "message": "Missing 'suite_name'"})
            await websocket.close()
            return

        try:
            p = _find_suite_path(suite_name)
            suite = load_suite_from_yaml(p)
        except Exception as err:
            await websocket.send_json({"type": "error", "message": f"Suite error: {err}"})
            await websocket.close()
            return

        model_override = params.get("model_override")
        target = suite.target
        if model_override:
            target = target.model_copy(update={"model": model_override})

        min_pass_rate = params.get("min_pass_rate")
        if min_pass_rate is not None:
            suite = suite.model_copy(update={"min_pass_rate": float(min_pass_rate)})

        judge_model = params.get("judge_model")
        judge_provider = get_provider(model=judge_model) if judge_model else None
        concurrency = int(params.get("concurrency", 10))

        # Notify client of suite start
        await websocket.send_json(
            {
                "type": "run_started",
                "suite_name": suite.name,
                "target_model": target.model,
                "total_tests": len(suite.tests),
            }
        )

        loop = asyncio.get_running_loop()

        def _on_test_complete_sync(tc_res: TestCaseResult) -> None:
            msg = {
                "type": "test_complete",
                "data": tc_res.model_dump(mode="json"),
            }
            # Schedule sending through event loop safely
            asyncio.run_coroutine_threadsafe(websocket.send_json(msg), loop)

        runner = SuiteRunner()
        run_res = await runner.run_suite(
            suite=suite,
            target_override=target,
            judge_provider=judge_provider,
            concurrency=concurrency,
            save_to_storage=True,
            on_test_complete=_on_test_complete_sync,
        )

        await websocket.send_json(
            {
                "type": "run_finished",
                "data": run_res.model_dump(mode="json"),
            }
        )

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected during test run")
    except Exception as err:
        logger.exception("WebSocket streaming error")
        try:
            await websocket.send_json({"type": "error", "message": str(err)})
        except Exception:
            pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
