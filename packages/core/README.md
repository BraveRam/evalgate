# EvalGate Core Engine

Fast, local-first prompt regression testing, LLM-as-a-judge evaluation gates, and model benchmark shootout platform for applied AI engineers.

## Installation

```bash
pip install evalgate
```

## CLI Usage

```bash
evalgate init
evalgate run evals/rag_qa.yaml
evalgate compare evals/hard_reasoning_challenge.yaml --model-a openai/gpt-4o-mini --model-b deepseek/deepseek-v4-pro-0813
evalgate studio
```


## Prompt Arena

The Studio and REST API can compare two prompt templates/system instructions on one
shared model. The selected model uses automatic provider routing, including a configured
AI gateway; comparisons ignore the source suite's provider override.
Studio allows 30 minutes of inactivity through its API proxy; additional deployment
proxies need timeouts that cover the expected comparison duration. The engine keeps
the source cases, assertions, context, temperature, top-p, tools, schema, and quality threshold identical. Runs execute A then B using
the same concurrency limit; per-test repeat settings take precedence over the run
override. Saved suite baselines do not gate these experiments.

- `POST /api/v1/arena/prompts/estimate`: target-cost estimates for both variants;
  returns a source-suite fingerprint.
- `POST /api/v1/arena/prompts/compare`: accepts suite_name, model, prompt_a/prompt_b
  (template and system_prompt), optional repeat (1–100), and concurrency (1–50).
  Include the estimated suite_fingerprint to reject a changed suite before inference.
- `GET /api/v1/arena/prompts`: saved summaries with limit (1–100, default 20) and offset.
- `GET /api/v1/arena/prompts/{id}`: full original suite, prompts, settings, and results.
- `POST /api/v1/arena/prompts/{id}/apply`: accepts variant A or B and updates only the
  stored prompt fields. Returns 409 if the source suite changed, or 404 if it is absent.

Comparisons persist in SQLite, and both underlying runs remain visible in run history
with variant and target metadata. Applying a prompt preserves tests, model, settings,
and any saved baseline. Webhook suites are excluded. Target estimates omit semantic
judge calls; observed rate differences do not establish statistical significance.

See Studio `/docs/prompt-arena` for the full workflow and JSON request examples.
