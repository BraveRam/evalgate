"""Prompt Arena keeps experimental conditions and guards suite edits."""

import copy
from pathlib import Path

import pytest
import yaml
from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage
from langchain_openai import ChatOpenAI

from evalgate.api.app import create_app
from evalgate.cli.loader import load_suite_from_yaml
from evalgate.core.prompt_arena import compare_prompts, estimate_prompt_comparison, prompt_target
from evalgate.core.storage import StorageEngine
from evalgate.core.types import PromptVariant, SuiteConfig
from evalgate.providers.factory import get_provider
from evalgate.providers.mock import MockProvider
from evalgate.providers.vercel import VercelGatewayProvider
from evalgate.runner.runner import SuiteRunner


def source_suite():
    return SuiteConfig.model_validate({
        "name": "prompt-demo",
        "target": {
            "model": "mock/source",
            "template": "correct {{question}}",
            "system_prompt": "original instructions",
            "temperature": 0.3,
            "top_p": 0.7,
        },
        "repeat": 2,
        "tests": [
            {"id": "one", "vars": {"question": "First"}, "context": ["reference"]},
            {"id": "two", "repeat": 3, "vars": {"question": "Second"}},
        ],
        "default_assertions": [{"type": "contains", "value": "correct"}],
    })


A = PromptVariant(template="wrong {{question}}", system_prompt="")
B = PromptVariant(template="correct {{question}}", system_prompt="new instructions")


async def test_comparison_is_persistent_reproducible_and_ignores_saved_baselines(tmp_path):
    suite = source_suite()
    original = suite.model_dump()
    storage = StorageEngine(tmp_path / "runs.db")
    baseline = await SuiteRunner(storage).run_suite(suite, judge_provider=MockProvider())
    await storage.set_baseline(baseline.run_id)
    result = await compare_prompts(
        suite, "mock/simulator", A, B, repeat=4, concurrency=2,
        storage=storage, judge_provider=MockProvider(),
    )
    assert suite.model_dump() == original
    assert result.suite_snapshot.model_dump() == original
    assert result.comparison.run_a.total_attempts == result.comparison.run_b.total_attempts == 7
    assert result.comparison.run_a.pass_rate == 0 and result.comparison.run_b.pass_rate == 1
    assert result.comparison.mismatched_test_ids == ["one", "two"]
    for variant, run in zip(("A", "B"), (result.comparison.run_a, result.comparison.run_b)):
        assert run.target_model == "mock/simulator"
        assert "baseline_comparison" not in run.metadata
        target = run.metadata["prompt_arena"]["target"]
        assert target["temperature"] == 0.3 and target["top_p"] == 0.7
        assert run.metadata["prompt_arena"]["variant"] == variant
        assert run.metadata["prompt_arena"]["comparison_id"] == result.comparison_id
        assert (await storage.get_run(run.run_id)).metadata == run.metadata
    fresh = StorageEngine(storage.db_path)
    restored = await fresh.get_prompt_comparison(result.comparison_id)
    assert restored.model_dump() == result.model_dump()
    summaries = await fresh.list_prompt_comparisons()
    assert len(summaries) == 1 and summaries[0].pass_rate_b == 1
    assert await fresh.list_prompt_comparisons(offset=1) == []
    assert await fresh.get_prompt_comparison("missing") is None


def test_estimate_accounts_for_both_variants_and_per_test_overrides():
    suite = source_suite()
    estimate = estimate_prompt_comparison(suite, "openai/gpt-4o-mini", A, B, repeat=4)
    assert estimate["estimate_a"]["total_attempts"] == 7
    assert estimate["estimate_b"]["total_attempts"] == 7
    assert estimate["total_attempts"] == 14
    assert estimate["estimated_cost_usd"] == (
        estimate["estimate_a"]["estimated_cost_usd"] + estimate["estimate_b"]["estimated_cost_usd"]
    )
    assert estimate["estimated_cost_usd"] > 0


@pytest.mark.parametrize("change", [{"tests": []}, {"target": {"type": "webhook"}}])
async def test_invalid_suite_never_saves_comparison(change, tmp_path):
    data = source_suite().model_dump(mode="json")
    data.update(change)
    db = tmp_path / "never-created.db"
    with pytest.raises(ValueError):
        await compare_prompts(
            SuiteConfig.model_validate(data), "mock/simulator", A, B,
            storage=StorageEngine(db), judge_provider=MockProvider(),
        )
    assert not db.exists()


@pytest.fixture
def api(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    Path("evals").mkdir()
    path = Path("evals/prompt-demo.yaml")
    path.write_text(yaml.safe_dump(source_suite().model_dump(mode="json")))
    with TestClient(create_app()) as client:
        yield client, path


def request_data():
    return {
        "suite_name": "prompt-demo", "model": "mock/simulator",
        "prompt_a": A.model_dump(), "prompt_b": B.model_dump(), "repeat": 4, "concurrency": 2,
    }


def test_api_estimate_compare_history_apply_and_stale_guard(api):
    client, path = api
    original = load_suite_from_yaml(path)
    body = request_data()
    estimate = client.post("/api/v1/arena/prompts/estimate", json=body)
    assert estimate.status_code == 200
    assert client.get("/api/v1/runs").json() == []
    body["suite_fingerprint"] = estimate.json()["suite_fingerprint"]
    response = client.post("/api/v1/arena/prompts/compare", json=body)
    assert response.status_code == 200, response.text
    result = response.json()
    comparison_id = result["comparison_id"]
    assert result["comparison"]["run_b"]["passed"]
    summaries = client.get("/api/v1/arena/prompts").json()
    assert summaries[0]["comparison_id"] == comparison_id
    assert "suite_snapshot" not in summaries[0]
    assert client.get(f"/api/v1/arena/prompts/{comparison_id}").json() == result

    applied = client.post(f"/api/v1/arena/prompts/{comparison_id}/apply", json={"variant": "B"})
    assert applied.status_code == 200
    updated = load_suite_from_yaml(path)
    expected = original.model_dump()
    expected["target"].update(B.model_dump())
    assert updated.model_dump() == expected
    assert updated.target.model == "mock/source"
    assert client.get(f"/api/v1/arena/prompts/{comparison_id}").json() == result
    assert client.post(
        f"/api/v1/arena/prompts/{comparison_id}/apply", json={"variant": "A"}
    ).status_code == 409


def test_suite_changed_after_estimate_rejects_before_execution(api):
    client, path = api
    body = request_data()
    body["suite_fingerprint"] = client.post(
        "/api/v1/arena/prompts/estimate", json=body
    ).json()["suite_fingerprint"]
    data = yaml.safe_load(path.read_text())
    data["description"] = "edited elsewhere"
    path.write_text(yaml.safe_dump(data))
    response = client.post("/api/v1/arena/prompts/compare", json=body)
    assert response.status_code == 409
    assert client.get("/api/v1/runs").json() == []
    assert client.get("/api/v1/arena/prompts").json() == []


def test_suite_changed_after_run_is_not_overwritten(api):
    client, path = api
    result = client.post("/api/v1/arena/prompts/compare", json=request_data()).json()
    changed = yaml.safe_load(path.read_text())
    changed["tests"][0]["vars"]["question"] = "new question"
    path.write_text(yaml.safe_dump(changed))
    before = path.read_bytes()
    response = client.post(
        f"/api/v1/arena/prompts/{result['comparison_id']}/apply", json={"variant": "B"}
    )
    assert response.status_code == 409 and path.read_bytes() == before


@pytest.mark.parametrize("update", [
    {"repeat": 0}, {"repeat": 101}, {"repeat": True},
    {"concurrency": 0}, {"concurrency": 51}, {"concurrency": True},
    {"model": " "}, {"prompt_a": {"template": " "}},
])
def test_api_invalid_input(api, update):
    client, _ = api
    body = copy.deepcopy(request_data())
    body.update(update)
    assert client.post("/api/v1/arena/prompts/compare", json=body).status_code == 422
    assert client.get("/api/v1/runs").json() == []


def test_api_unknown_comparison_and_invalid_variant(api):
    client, _ = api
    assert client.get("/api/v1/arena/prompts/missing").status_code == 404
    assert client.post(
        "/api/v1/arena/prompts/missing/apply", json={"variant": "B"}
    ).status_code == 404
    assert client.post(
        "/api/v1/arena/prompts/missing/apply", json={"variant": "C"}
    ).status_code == 422


@pytest.mark.parametrize(("original_provider", "model", "client_model"), [
    ("mock", "openai/gpt-4o-mini", "gpt-4o-mini"),
    ("ollama", "openai/gpt-4o-mini", "gpt-4o-mini"),
    ("anthropic", "openai/gpt-4o-mini", "gpt-4o-mini"),
    ("openai", "mock/simulator", None),
    ("mock", "ollama/llama3", "llama3"),
])
def test_selected_model_controls_provider(monkeypatch, original_provider, model, client_model):
    for key in ("VERCEL_AI_GATEWAY_KEY", "AI_GATEWAY_KEY"):
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv("OPENAI_API_KEY", "test-only-key")
    suite = source_suite()
    suite.target.provider = original_provider
    target = prompt_target(suite, model, A)
    assert target.provider is None
    assert suite.target.provider == original_provider
    provider = get_provider(target=target)
    if client_model is None:
        assert isinstance(provider, MockProvider)
    else:
        assert isinstance(provider, VercelGatewayProvider)
        assert isinstance(provider.client, ChatOpenAI)
        assert provider.client.model_name == client_model
        assert provider.model == ("llama3" if model.startswith("ollama/") else model)


def test_api_mock_suite_selected_openai_uses_openai_and_persists_evidence(api, monkeypatch):
    client, path = api
    suite = yaml.safe_load(path.read_text())
    suite["target"]["provider"] = "mock"
    path.write_text(yaml.safe_dump(suite))
    for key in ("VERCEL_AI_GATEWAY_KEY", "AI_GATEWAY_KEY"):
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv("OPENAI_API_KEY", "test-only-key")
    calls = []

    async def fake_invoke(self, messages, **kwargs):
        calls.append(self.model_name)
        return AIMessage(content="correct from selected OpenAI client", usage_metadata={
            "input_tokens": 10, "output_tokens": 6, "total_tokens": 16,
        })

    # Stub only the SDK network boundary; execute the real provider factory and adapter.
    monkeypatch.setattr(ChatOpenAI, "ainvoke", fake_invoke)
    body = request_data()
    body["model"] = "openai/gpt-4o-mini"
    estimate = client.post("/api/v1/arena/prompts/estimate", json=body)
    assert estimate.status_code == 200
    assert estimate.json()["estimated_cost_usd"] > 0
    assert calls == []
    response = client.post("/api/v1/arena/prompts/compare", json=body)
    assert response.status_code == 200, response.text
    result = response.json()
    assert calls == ["gpt-4o-mini"] * 14
    for name in ("run_a", "run_b"):
        run = result["comparison"][name]
        assert run["target_model"] == body["model"]
        assert run["target_provider"] == "auto"
        assert run["metadata"]["prompt_arena"]["target"]["provider"] is None
        assert run["passed"]
        assert run["total_cost_usd"] > 0
    assert result["suite_snapshot"]["target"]["provider"] == "mock"
    assert client.get(f"/api/v1/arena/prompts/{result['comparison_id']}").json() == result
    assert yaml.safe_load(path.read_text()) == suite
