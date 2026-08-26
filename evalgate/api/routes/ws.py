"""
WebSocket Live Evaluation Streaming Endpoint with Async Queue Serialization.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

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
    Uses an asyncio.Queue to serialize outgoing frames safely across concurrent executions.
    """
    await websocket.accept()
    send_queue: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue()

    async def _ws_sender_loop() -> None:
        """Sequential writer loop that pulls from send_queue and sends over WebSocket."""
        try:
            while True:
                msg = await send_queue.get()
                if msg is None:  # Sentinel value to terminate loop cleanly
                    send_queue.task_done()
                    break
                await websocket.send_json(msg)
                send_queue.task_done()
        except WebSocketDisconnect:
            pass
        except Exception as e:
            logger.warning(f"WebSocket writer loop error: {e}")

    sender_task = asyncio.create_task(_ws_sender_loop())

    try:
        data = await websocket.receive_text()
        params = json.loads(data)

        suite_name = params.get("suite_name")
        if not suite_name:
            await send_queue.put({"type": "error", "message": "Missing 'suite_name'"})
            await send_queue.put(None)
            await sender_task
            await websocket.close()
            return

        try:
            p = _find_suite_path(suite_name)
            suite = load_suite_from_yaml(p)
        except Exception as err:
            await send_queue.put({"type": "error", "message": f"Suite error: {err}"})
            await send_queue.put(None)
            await sender_task
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
        await send_queue.put(
            {
                "type": "run_started",
                "suite_name": suite.name,
                "target_model": target.model,
                "total_tests": len(suite.tests),
            }
        )

        def _on_test_complete(tc_res: TestCaseResult) -> None:
            # Safely push result onto queue synchronously without cross-thread issues
            send_queue.put_nowait(
                {
                    "type": "test_complete",
                    "data": tc_res.model_dump(mode="json"),
                }
            )

        runner = SuiteRunner()
        run_res = await runner.run_suite(
            suite=suite,
            target_override=target,
            judge_provider=judge_provider,
            concurrency=concurrency,
            save_to_storage=True,
            on_test_complete=_on_test_complete,
        )

        # Send final summary
        await send_queue.put(
            {
                "type": "run_finished",
                "data": run_res.model_dump(mode="json"),
            }
        )

        # Sentinel to signal sender task completion
        await send_queue.put(None)
        await sender_task

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected during test run")
    except Exception as err:
        logger.exception("WebSocket streaming error")
        try:
            await send_queue.put({"type": "error", "message": str(err)})
            await send_queue.put(None)
            await sender_task
        except Exception:
            pass
    finally:
        if not sender_task.done():
            sender_task.cancel()
        try:
            await websocket.close()
        except Exception:
            pass
