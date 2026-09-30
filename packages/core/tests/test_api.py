"""
Comprehensive Unit and Integration Tests for EvalGate FastAPI Studio Backend.
"""

from pathlib import Path
from urllib.parse import quote

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


@pytest.mark.parametrize(
    "key_name",
    ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GOOGLE_API_KEY", "GEMINI_API_KEY", "DEEPSEEK_API_KEY"],
)
def test_health_recognizes_direct_provider_keys(monkeypatch, key_name):
    for name in (
        "VERCEL_AI_GATEWAY_KEY",
        "AI_GATEWAY_KEY",
        "OPENAI_API_KEY",
        "ANTHROPIC_API_KEY",
        "GOOGLE_API_KEY",
        "GEMINI_API_KEY",
        "DEEPSEEK_API_KEY",
    ):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv(key_name, "test-only-key")
    health = client.get("/health").json()
    assert health["provider_configured"] is True
    assert health["provider_mode"] == "Direct Provider Active"


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


@pytest.mark.parametrize("name", ["customer support", "Finance QA – 中文"])
def test_display_names_support_suite_crud_and_runs(tmp_path: Path, monkeypatch, name):
    monkeypatch.chdir(tmp_path)
    suite = {
        "name": name,
        "target": {"model": "mock/simulator", "template": "Hello"},
        "tests": [{"id": "one"}],
    }
    response = client.post("/api/v1/suites?filename=display_name.yaml", json=suite)
    assert response.status_code == 201
    assert client.get("/api/v1/suites").json()[0]["name"] == name
    url = "/api/v1/suites/" + quote(name, safe="")
    assert client.get(url).json()["name"] == name
    run = client.post(url + "/run", json={})
    assert run.status_code == 200
    assert run.json()["passed"] is True
    suite["description"] = "Updated display name suite"
    assert client.put(url, json=suite).status_code == 200
    assert client.get(url).json()["description"] == suite["description"]
    assert client.delete(url).status_code == 200
    assert not (tmp_path / "evals" / "display_name.yaml").exists()


def test_display_names_preserve_path_confinement(tmp_path: Path, monkeypatch):
    workspace = tmp_path / "workspace"
    (workspace / "evals").mkdir(parents=True)
    outside = tmp_path / "outside.yaml"
    outside.write_text("name: outside suite\ntests: []\n")
    (workspace / "evals" / "outside.yaml").symlink_to(outside)
    monkeypatch.chdir(workspace)
    assert client.get("/api/v1/suites/outside%20suite").status_code == 404
    for name in ("../outside", "a/b", "a\\b"):
        response = client.post(
            "/api/v1/suites?filename=safe.yaml", json={"name": name, "tests": []}
        )
        assert response.status_code == 400
    assert not (workspace / "evals" / "safe.yaml").exists()
    assert outside.exists()


def test_playground_enforces_schema_strings():
    schema = {
        "type": "object",
        "required": ["priority"],
        "properties": {"priority": {"type": "string"}},
    }
    payload = {
        "target": {"model": "mock/simulator", "template": "Return JSON"},
        "test_case": {"id": "schema", "vars": {}},
        "judge_model": "mock/simulator",
        "assertions": [
            {"type": "json_schema", "value": '{"type":"object","required":["priority"]}'}
        ],
    }
    invalid = client.post("/api/v1/evaluate/playground", json=payload)
    assert invalid.status_code == 200
    assert invalid.json()["passed"] is False
    payload["target"]["json_schema"] = schema
    valid = client.post("/api/v1/evaluate/playground", json=payload)
    assert valid.status_code == 200
    assert valid.json()["passed"] is True


def test_playground_faithfulness_uses_template_context():
    response = client.post(
        "/api/v1/evaluate/playground",
        json={
            "target": {"model": "mock/simulator", "template": "Context: {{context}}"},
            "test_case": {"id": "rag", "vars": {"context": "ACME revenue was $45.2M."}},
            "judge_model": "mock/simulator",
            "assertions": [{"type": "faithfulness", "threshold": 0.85}],
        },
    )
    assert response.status_code == 200
    result = response.json()
    assert result["passed"] is True
    assert result["assertion_results"][0]["score"] == 0.95


def test_run_rejects_empty_suite_and_invalid_overrides(tmp_path: Path, monkeypatch):
    empty_suite = tmp_path / "empty.yaml"
    empty_suite.write_text("name: empty\ntarget:\n  model: mock/simulator\ntests: []\n")
    monkeypatch.setattr("evalgate.api.routes.suites._find_suite_path", lambda name: empty_suite)
    monkeypatch.setattr("evalgate.api.routes.ws._find_suite_path", lambda name: empty_suite)

    response = client.post("/api/v1/suites/empty/run", json={})
    assert response.status_code == 400
    assert "zero tests" in response.json()["detail"]

    with client.websocket_connect("/api/v1/ws/run") as ws:
        ws.send_json({"suite_name": "empty"})
        assert "zero tests" in ws.receive_json()["message"]

    populated_suite = tmp_path / "populated.yaml"
    populated_suite.write_text(
        "name: populated\ntarget:\n  model: mock/simulator\ntests:\n  - id: one\n"
    )
    monkeypatch.setattr("evalgate.api.routes.suites._find_suite_path", lambda name: populated_suite)
    monkeypatch.setattr("evalgate.api.routes.ws._find_suite_path", lambda name: populated_suite)
    for invalid_rate in (-0.1, 1.1):
        response = client.post(
            "/api/v1/suites/populated/run",
            json={"min_pass_rate_override": invalid_rate},
        )
        assert response.status_code == 422
        with client.websocket_connect("/api/v1/ws/run") as ws:
            ws.send_json({"suite_name": "populated", "min_pass_rate": invalid_rate})
            assert ws.receive_json()["type"] == "error"

    for invalid_concurrency in (0, 51):
        with client.websocket_connect("/api/v1/ws/run") as ws:
            ws.send_json({"suite_name": "populated", "concurrency": invalid_concurrency})
            assert ws.receive_json()["type"] == "error"
