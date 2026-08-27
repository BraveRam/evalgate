"""
Comprehensive Unit and Integration Tests for EvalGate FastAPI Studio Backend.
"""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from evalgate import __version__
from evalgate.api.app import app

client = TestClient(app)


@pytest.fixture
def sample_suite(tmp_path: Path):
    suite_dir = Path("evals")
    suite_dir.mkdir(parents=True, exist_ok=True)
    suite_file = suite_dir / "api_test_suite.yaml"
    suite_file.write_text(
        """name: "api-test-suite"
description: "Suite for testing REST API"
min_pass_rate: 1.0

target:
  type: "prompt"
  model: "mock/simulator"
  template: "Prompt {{msg}}"

tests:
  - id: "t1"
    vars:
      msg: "hello"
    assertions:
      - type: "contains"
        value: "Prompt hello"
        strict: true
""",
        encoding="utf-8",
    )
    yield suite_file
    suite_file.unlink(missing_ok=True)


def test_system_endpoints():
    # 1. Health check
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"
    assert res.json()["version"] == __version__

    # 2. Version check
    res_ver = client.get("/version")
    assert res_ver.status_code == 200
    assert res_ver.json()["version"] == __version__


def test_models_endpoint():
    res = client.get("/api/v1/models")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 10
    model_ids = [m["id"] for m in data]
    assert "openai/gpt-4o" in model_ids
    assert "openai/gpt-4o-mini" in model_ids


def test_suites_crud_and_run(sample_suite: Path):
    # 1. List suites
    res_list = client.get("/api/v1/suites")
    assert res_list.status_code == 200
    suites = res_list.json()
    assert any(s["name"] == "api-test-suite" for s in suites)

    # 2. Get specific suite
    res_get = client.get("/api/v1/suites/api-test-suite")
    assert res_get.status_code == 200
    assert res_get.json()["name"] == "api-test-suite"

    # 3. Estimate cost
    res_cost = client.post("/api/v1/suites/api-test-suite/estimate-cost")
    assert res_cost.status_code == 200
    assert res_cost.json()["total_tests"] == 1
    assert "estimated_cost_usd" in res_cost.json()

    # 4. Run suite
    res_run = client.post(
        "/api/v1/suites/api-test-suite/run",
        json={"model_override": "mock/simulator", "concurrency": 5},
    )
    assert res_run.status_code == 200
    run_data = res_run.json()
    assert run_data["passed"] is True
    assert run_data["total_tests"] == 1
    assert "run_id" in run_data
    run_id = run_data["run_id"]

    # 5. Get runs history
    res_runs = client.get("/api/v1/runs?suite=api-test-suite")
    assert res_runs.status_code == 200
    assert len(res_runs.json()) >= 1

    # 6. Get run details
    res_run_detail = client.get(f"/api/v1/runs/{run_id}")
    assert res_run_detail.status_code == 200
    assert res_run_detail.json()["run_id"] == run_id

    # 7. Get run trends
    res_trends = client.get(f"/api/v1/runs/{run_id}/trends")
    assert res_trends.status_code == 200
    assert res_trends.json()["suite_name"] == "api-test-suite"

    # 8. Update suite
    res_update = client.put(
        "/api/v1/suites/api-test-suite",
        json={
            "name": "api-test-suite",
            "description": "Updated description",
            "target": {"type": "prompt", "model": "mock/simulator"},
            "tests": [{"id": "t1", "vars": {"msg": "updated"}}],
        },
    )
    assert res_update.status_code == 200

    # 9. Create a new suite
    created_path = Path("evals/new_created_suite.yaml")
    created_path.unlink(missing_ok=True)
    res_create = client.post(
        "/api/v1/suites?filename=new_created_suite.yaml",
        json={
            "name": "new-created-suite",
            "target": {"type": "prompt", "model": "mock/simulator"},
            "tests": [],
        },
    )
    assert res_create.status_code == 201

    # 10. Delete created suite
    res_del = client.delete("/api/v1/suites/new-created-suite")
    assert res_del.status_code == 200
    created_path.unlink(missing_ok=True)

    # 11. Delete run
    res_del_run = client.delete(f"/api/v1/runs/{run_id}")
    assert res_del_run.status_code == 200


def test_arena_compare_endpoint(sample_suite: Path):
    res = client.post(
        "/api/v1/arena/compare",
        json={
            "suite_name": "api-test-suite",
            "model_a": "mock/a",
            "model_b": "mock/b",
            "concurrency": 5,
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["suite_name"] == "api-test-suite"
    assert data["model_a"] == "mock/a"
    assert data["model_b"] == "mock/b"
    assert "pass_rate_delta" in data


def test_playground_evaluate_endpoint():
    res = client.post(
        "/api/v1/evaluate/playground",
        json={
            "target": {
                "type": "prompt",
                "model": "mock/simulator",
                "template": "Hello {{name}}",
            },
            "test_case": {
                "id": "play-1",
                "vars": {"name": "Alice"},
            },
            "assertions": [
                {"type": "contains", "value": "Alice", "strict": True},
            ],
            "judge_model": "mock/simulator",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["test_id"] == "play-1"
    assert data["passed"] is True


def test_websocket_run_streaming(sample_suite: Path):
    with client.websocket_connect("/api/v1/ws/run") as ws:
        ws.send_json(
            {
                "suite_name": "api-test-suite",
                "model_override": "mock/simulator",
                "concurrency": 2,
            }
        )

        # 1. First message: run_started
        started_msg = ws.receive_json()
        assert started_msg["type"] == "run_started"
        assert started_msg["total_tests"] == 1

        # 2. Test completion events or final summary
        received_types = [started_msg["type"]]
        while True:
            try:
                msg = ws.receive_json()
                received_types.append(msg["type"])
                if msg["type"] == "run_finished":
                    assert msg["data"]["passed"] is True
                    break
            except Exception:
                break

        assert "run_finished" in received_types


def test_cors_security():
    # 1. Valid origin allowed
    res_valid = client.get("/health", headers={"Origin": "http://localhost:3000"})
    assert res_valid.headers.get("access-control-allow-origin") == "http://localhost:3000"

    # 2. Malicious / unlisted origin rejected (no allow-origin header reflected)
    res_evil = client.get("/health", headers={"Origin": "https://evil.example.com"})
    assert res_evil.headers.get("access-control-allow-origin") is None


def test_path_traversal_protections():
    # 1. Attempt path traversal in create_suite
    res_create_traversal = client.post(
        "/api/v1/suites?filename=../evil_suite.yaml",
        json={"name": "evil", "target": {"type": "prompt"}, "tests": []},
    )
    assert res_create_traversal.status_code == 400
    assert "traversal" in res_create_traversal.text.lower()

    # 2. Attempt path traversal in get_suite
    res_get_traversal = client.get("/api/v1/suites/..evil")
    assert res_get_traversal.status_code == 400
    assert "traversal" in res_get_traversal.text.lower()

    # 3. Attempt path traversal in delete_suite
    res_del_traversal = client.delete("/api/v1/suites/..evil")
    assert res_del_traversal.status_code == 400
    assert "traversal" in res_del_traversal.text.lower()

    # 4. Attempt filesystem enumeration in list_suites
    res_list_traversal = client.get("/api/v1/suites?dir_path=/etc")
    assert res_list_traversal.status_code == 400

    res_list_relative_traversal = client.get("/api/v1/suites?dir_path=../")
    assert res_list_relative_traversal.status_code == 400


def test_websocket_error_handling():
    # Missing suite_name
    with client.websocket_connect("/api/v1/ws/run") as ws:
        ws.send_json({})
        msg = ws.receive_json()
        assert msg["type"] == "error"
        assert "Missing" in msg["message"]

    # Nonexistent suite
    with client.websocket_connect("/api/v1/ws/run") as ws:
        ws.send_json({"suite_name": "nonexistent_suite_xyz"})
        msg = ws.receive_json()
        assert msg["type"] == "error"
