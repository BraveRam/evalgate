# EvalGate

Fast, local-first evaluation engine, prompt regression testing framework, and developer studio for applied AI engineering. Built with **Python (`uv`)**, **FastAPI**, **LangChain/LangGraph**, **Next.js**, and the **Model Context Protocol (MCP)**.

[![Python](https://img.shields.io/badge/Python-3.11+-blue?logo=python)](https://python.org)
[![uv](https://img.shields.io/badge/uv-Astral-purple)](https://astral.sh/uv)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![LangChain](https://img.shields.io/badge/LangChain-LangGraph-darkgreen)](https://langchain.com)
[![Next.js](https://img.shields.io/badge/Next.js-16+-black?logo=next.js)](https://nextjs.org)
[![MCP](https://img.shields.io/badge/MCP-Compatible-purple)](https://modelcontextprotocol.io)

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Quick Start](#quick-start)
- [Declarative YAML Test Suite Specification](#declarative-yaml-test-suite-specification)
  - [Target Architectures](#target-architectures)
  - [Assertion Engine](#assertion-engine)
- [CLI Reference](#cli-reference)
- [Prompt Arena](#prompt-arena)
- [Repeated Evaluations](#repeated-evaluations)
- [Saved Baselines and Regression Diffs](#saved-baselines-and-regression-diffs)
- [Model Context Protocol (MCP) Server](#model-context-protocol-mcp-server)
- [CI/CD & Pull Request Quality Gates](#cicd--pull-request-quality-gates)
- [REST & WebSocket API Reference](#rest--websocket-api-reference)
- [Testing & Quality Assurance](#testing--quality-assurance)
- [License](#license)

---

## Overview

EvalGate bridges the gap between ad-hoc prompt experimentation and production software engineering standards. It brings deterministic testing, code AST validation, latency/cost budgets, and multi-point LLM-as-a-judge rubrics into a unified, local-first workflow.

Use EvalGate to:
- Define declarative YAML test suites covering prompt templates, tool calls, RAG pipelines, structured JSON schemas, and live webhooks.
- Run deterministic checks (JSON Schema, Python AST, SQL syntax, Regex, Levenshtein distance) alongside semantic judge evaluations.
- Benchmark competing models side-by-side in an automated Model Arena with win/loss verdicts, Pareto curves, and completion diffs.
- Enforce pull request quality gates in CI/CD pipelines to block prompt regressions before deployment.
- Integrate directly with AI coding agents (Claude Desktop, Cursor, Antigravity, Windsurf) over Model Context Protocol (MCP).

---

## Key Features

### Two-Tier Assertion Framework
- **Deterministic Assertions**: Validate exact strings, substrings, prefixes, suffixes, regex patterns, Levenshtein similarity, Python AST syntax, basic SQL structure, and JSON Schema without incurring inference costs.
- **Semantic LLM-as-a-Judge Rubrics**: Evaluate qualitative dimensions including context faithfulness, hallucination detection, answer relevancy, logical coherence, toxicity/bias, intent fulfillment, and custom plain-English rubrics on normalized score thresholds.

### Multi-Target Evaluation Modalities
Support for 5 distinct execution modalities:
1. `prompt`: String prompt template with variable interpolation (`{{var}}`), system instructions, and sampling parameters.
2. `tool_call`: Validates function calling arguments and tool invocation schemas.
3. `rag`: Evaluates responses grounded in supplied context using faithfulness and hallucination metrics.
4. `structured_output`: Requests schema-constrained model output; add a `json_schema` assertion to validate the response.
5. `webhook`: Live HTTP POST endpoint integration for black-box testing of deployed microservices.

`mock/simulator` is a zero-cost, offline model provider usable with these target types, rather than a separate target type.

### Model Arena Shootout
- Automated A/B head-to-head benchmarking between any two models.
- Multi-dimensional ranking system prioritizing quality gate adherence, higher pass rates, lower P50 latency, and reduced inference spend.
- Visual token-by-token unified diff viewer for comparing completions side by side.

### Model Context Protocol (MCP)
- Native stdio and SSE MCP server exposing 7 evaluation tools directly to AI coding environments.
- Allows Claude Desktop, Cursor, Antigravity, and Windsurf to list suites, run evaluations, estimate costs, compare models, and inspect historical trends programmatically.

### Historical Analytics & Telemetry
- Automatic SQLite telemetry tracking across every test run.
- Time-series charts for pass rate trends, P50/P95 latency percentiles, and cumulative inference cost.
- Comprehensive trace inspector for inspecting raw prompts, variable inputs, and assertion failure reasons.

---

## Quick Start

### Prerequisites
- Python 3.11+ and `uv` package manager installed (`curl -LsSf https://astral.sh/uv/install.sh | sh`)
- Node.js 20+ and `pnpm` installed (`corepack enable pnpm`)

### 1. Install Dependencies

```bash
# Clone repository
git clone https://github.com/BraveRam/evalgate.git
cd evalgate

# Install Python virtual environment and dependencies
uv sync

# Install Node.js dependencies
pnpm install
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory:

```bash
# Optional: Vercel AI Gateway key (or direct provider API keys)
VERCEL_AI_GATEWAY_KEY="your-gateway-key-here"

# Direct provider keys (fallback)
OPENAI_API_KEY="sk-..."
ANTHROPIC_API_KEY="sk-ant-..."
GEMINI_API_KEY="..."
DEEPSEEK_API_KEY="..."

# Run history is stored in .evalgate/runs.db relative to the working directory.
```

### 3. Launch Development Studio

```bash
# Terminal 1: Start FastAPI REST & WebSocket Backend (http://127.0.0.1:8000)
pnpm dev:api

# Terminal 2: Start Next.js Web Studio (http://localhost:3000)
pnpm dev:client
```

---

## Declarative YAML Test Suite Specification

Suites are declarative YAML documents stored in `evals/` or custom workspace directories.

### Target Architectures

#### 1. Prompt Template Target (`prompt`)
```yaml
name: customer-support-classifier
description: Classifies support tickets into technical, billing, and general categories.
min_pass_rate: 1.0

target:
  type: prompt
  model: openai/gpt-4o-mini
  system_prompt: "You are a tier-1 customer support triage agent. Always return valid JSON."
  template: |
    Classify the following customer ticket:
    Customer: {{customer_name}}
    Tier: {{plan_tier}}
    Message: {{ticket_body}}

tests:
  - id: billing-refund-inquiry
    vars:
      customer_name: "Acme Corp"
      plan_tier: "Enterprise"
      ticket_body: "We were double-billed for invoice #4928 last week."
    assertions:
      - type: json_schema
        value:
          type: object
          properties:
            category: { type: string, enum: ["billing", "technical", "general"] }
            priority: { type: string, enum: ["low", "medium", "high", "urgent"] }
          required: ["category", "priority"]
      - type: contains
        value: '"category": "billing"'
      - type: max_latency_ms
        value: 1200
```

#### 2. RAG Context & Faithfulness Target (`rag`)
```yaml
name: legal-compliance-qa
description: Verifies RAG retrieval grounding and prevents factual hallucinations.
min_pass_rate: 0.9

target:
  type: rag
  model: anthropic/claude-3-5-sonnet
  template: |
    Context:
    {{context}}

    Question: {{query}}

tests:
  - id: gdpr-retention-rule
    vars:
      query: "What is the maximum data retention period for inactive accounts?"
    context:
      - "Article 14.2: Personal records of inactive users must be purged within 90 calendar days."
      - "Article 14.3: Financial transaction logs must be retained for 7 years under statutory audit rules."
    assertions:
      - type: faithfulness
        threshold: 0.85
        judge_model: openai/gpt-4o-mini
      - type: hallucination
        threshold: 0.90
        judge_model: openai/gpt-4o-mini
      - type: contains
        value: "90"
```

#### 3. Live Webhook Target (`webhook`)
```yaml
name: production-microservice-gate
description: Black-box testing of deployed production inference endpoints.
min_pass_rate: 1.0

target:
  type: webhook
  webhook_url: "https://api.example.com/v1/assistants/chat"
  headers:
    Content-Type: "application/json"

tests:
  - id: status-check
    vars:
      prompt: "Summarize the quarterly earnings report."
    assertions:
      - type: max_latency_ms
        value: 2000
      - type: max_cost_usd
        value: 0.01
```

---

Webhook requests send a JSON object containing `id`, `vars`, and `context`.
Headers are sent literally; `${ENV_VAR}` substitution is not supported.
The RAG target uses supplied context passages; it does not run a retriever.

## Assertion Engine

### Deterministic & Code Assertions

| Assertion Type | Expected Value | Description |
| :--- | :--- | :--- |
| `exact` | `string` | Strict string match after trimming leading and trailing whitespace. |
| `contains` | `string` | Verifies substring inclusion. |
| `not_contains` | `string` | Negative substring guard for confidential terms or error codes. |
| `starts_with` | `string` | Prefix matcher (e.g. ensuring SQL starts with `SELECT`). |
| `ends_with` | `string` | Suffix matcher (e.g. statement termination with `;`). |
| `regex` | `string (pattern)` | Regular expression pattern validation. |
| `levenshtein` | `float (0.0 - 1.0)` | Fuzzy string similarity ratio against ground truth. |
| `json_schema` | `object` | JSON Schema validation using the schema's declared dialect or the jsonschema library default. |
| `python_ast` | None required | Verifies that extracted Python code compiles into a valid AST. |
| `sql_syntax` | None required | Checks the leading SQL keyword and balanced parentheses; does not parse SQL grammar. |
| `max_latency_ms` | `integer` | SLA response time threshold in milliseconds. |
| `max_tokens` | `integer` | Maximum total input + output tokens per target response. |
| `max_cost_usd` | `float` | Maximum inference cost budget per test case. |

### Semantic LLM-as-a-Judge Rubrics

| Assertion Type | Evaluation Scope | Description |
| :--- | :--- | :--- |
| `faithfulness` | Context Grounding | Verifies that claims in completion are strictly derived from provided context passages. |
| `hallucination` | Factuality Guard | Extracts factual claims and flags statements unsupported by reference documents. |
| `relevancy` | Query Alignment | Measures whether the answer directly addresses the user query without fluff. |
| `coherence` | Structural Reasoning | Evaluates logical progression, sentence transitions, and clarity. |
| `bias` | Toxicity & Fairness | Detects demographic, gender, political, or toxic bias in completions. |
| `intent` | Goal Adherence | Verifies whether the agent fulfilled the primary user intention. |
| `dynamic_rubric` | Custom Evaluation | Evaluates output against plain-English grading rules on a normalized threshold. |

---

## CLI Reference

EvalGate includes a terminal CLI powered by Typer and Rich:

```bash
# Run a specific test suite
uv run evalgate run evals/rag_qa.yaml

# Override target model and adjust concurrency
uv run evalgate run evals/classifier.yaml --model anthropic/claude-3-5-sonnet --concurrency 8

# Compare two models in head-to-head arena shootout
uv run evalgate compare evals/hard_reasoning_challenge.yaml \
  --model-a openai/gpt-4o-mini \
  --model-b deepseek/deepseek-v4-pro-0813

# Preflight cost and token estimation
uv run evalgate cost evals/rag_qa.yaml

# Override pricing model and output-token estimate; emit JSON for scripts
uv run evalgate cost evals/rag_qa.yaml --model openai/gpt-4o-mini --output-tokens 250 --json

# List historical evaluation runs
uv run evalgate list

# Launch Model Context Protocol (MCP) server
uv run evalgate mcp --transport stdio

# Launch FastAPI backend service
uv run evalgate studio --host 127.0.0.1 --port 8000
```

Cost estimates use built-in pricing and assume 150 output tokens per test unless overridden.
They are approximate target inference costs and exclude semantic judge calls.

---

## Prompt Arena

Open **Prompt Arena** in Studio to compare two versions of a prompt using one model.
Choose a model-backed suite, edit A and B (template and system instructions), set
attempts and concurrency, review the combined target-cost estimate, and start.
Both variants use the same cases, assertions, context, sampling settings, tools,
and schema. Per-test YAML repeat overrides remain authoritative. A runs before B
with the same concurrency limit. Saved suite baselines do not gate experiments;
the suite's minimum pass rate still applies.

Inspect observed success rates, gate outcomes, P50/P95 latency, tokens, cost,
side-by-side outputs, and every attempt. Differences describe the observed sample;
they do not establish statistical significance. Saved comparisons persist in SQLite
with the original suite, prompt versions, shared model, repeat override, concurrency,
and complete results. Select a saved record to reopen it after refreshing.

**Apply prompt A/B to suite** changes only template and system instructions.
The suite's model, tests, other settings, and saved baseline are preserved. A suite changed since
comparison returns 409; compare again before applying. The confirmation also keeps
the estimated request settings, and a suite changed after estimating requires a
fresh estimate before inference. Webhook suites are excluded. Use mock/simulator
with deterministic assertions to try the workflow without inference fees; semantic
assertions can still call a live judge. Mock output does not assess model quality.
Cost estimates exclude semantic judge calls.

The REST API accepts suite_name, model, prompt_a/prompt_b (each containing template
and system_prompt), optional repeat (1–100), and concurrency (1–50). Estimate first,
then include its suite_fingerprint in the compare request to reject stale estimates.
Comparison responses include comparison_id, suite_snapshot, settings, and comparison
with both complete runs. See Studio **Docs → Prompt Arena** for request examples,
response fields, pagination, and error handling.

---

## Repeated Evaluations

Use repeated attempts to measure consistency on selected cases and compare their
success rates across prompt or model versions. Diverse test cases still determine
coverage; repetition does not establish statistical significance.

```bash
# Repeat each test five times (unless a test has its own YAML repeat override)
uv run evalgate run evals/classifier.yaml --repeat 5

# Include the same attempt counts in the preflight target cost estimate
uv run evalgate cost evals/classifier.yaml --repeat 5 --json

# Optionally fail baseline comparisons for drops greater than 10 percentage points
uv run evalgate run evals/classifier.yaml --repeat 5 --max-success-rate-drop 0.1
```

Suites can set `repeat: 5` and individual tests can set `repeat: 10`.
Precedence is **per-test YAML → CLI/API/MCP override → suite YAML → 1**.
Counts must be integers from 1 to 100. All attempts share the run's concurrency
limit. Repeating a webhook also repeats its HTTP request.

Each test reports `passed_attempts`, `attempt_count`, `success_rate`, and
`inconsistent` (some attempts passed and some failed). Repeated results include
an ordered `attempts` array with every output, assertion, error, latency, token
count and target cost. The summary shows the first failing attempt, or the first
attempt when all pass; its latency is the mean and its token/cost counters are totals.

The suite pass rate is **passed attempts / total attempts**, so cases repeated
more often carry more weight. `min_pass_rate` applies to this rate. A test's
`passed` flag requires every attempt to pass; `passed_tests` therefore counts
fully passing tests. Suite latency percentiles use individual attempt latencies.
Legacy runs and exported baselines without attempt data count as one attempt.
Target cost estimates include all repeats and still exclude semantic judge calls.

Baseline comparisons show success-rate changes and sample counts per test.
For repeated cases, drops are informational unless `max_success_rate_drop` is
set in the suite or run request (`0.1` means 10 percentage points; `0` gates any
drop). A drop exactly equal to the tolerance is allowed. Single-attempt pairs
retain the existing passing-to-failing gate. Missing tests and failure of the
suite's own pass-rate requirement always fail the gate. Sample counts may differ;
reported rate differences are descriptive, not statistical significance claims.

REST run requests and WebSocket start messages accept `repeat` and
`max_success_rate_drop`; cost requests accept `repeat`. MCP suite-run,
model-comparison and cost tools also accept `repeat`. Streaming emits one
`test_complete` event per attempt, with `attempt_index`; `run_started` includes
both `total_tests` and `total_attempts`.

---

## Saved Baselines and Regression Diffs

Run a suite, then use its successful run ID as the suite's baseline:

```bash
uv run evalgate run evals/rag_qa.yaml
uv run evalgate baseline run_YOUR_RUN_ID --output baseline.json
```

Subsequent saved runs of that suite automatically compare against the local baseline.
The gate fails when a previously passing test fails, a baseline test is missing, or the
suite's existing quality gate fails. Test IDs must be unique and stable. Changed outputs,
improvements, added tests, and cost/P50 latency differences are reported; output changes
alone do not fail the gate. A suite that meets its `min_pass_rate` may become a baseline
even when some tests fail.

Commit the exported JSON with your evaluation suite to apply the same gate in CI:

```bash
uv run evalgate run evals/rag_qa.yaml --baseline baseline.json --no-save --json
```

This works without the original database and exits with status `1` on regression.
JSON results include `metadata.baseline_comparison`, with per-test output diffs and
metric deltas. `--no-save` uses only an explicitly supplied baseline file.
Baseline artifacts contain the full run, including model outputs.

In Studio, open **Analytics → inspect a run → Regression baseline** to select or replace
the suite's baseline, download its JSON, remove it, and inspect new failures and output
changes. The saved snapshot survives deletion of the original historical run.

The API exposes `GET/PUT/DELETE /api/v1/baselines/{suite_name}` (`PUT` accepts
`{"run_id": "run_..."}`) and `GET /api/v1/runs/{run_id}/baseline-comparison`.
Fetching an unset baseline returns `null`; comparing without one returns `404`.

## Model Context Protocol (MCP) Server

EvalGate exposes its entire evaluation engine over the Model Context Protocol (MCP), enabling AI coding assistants to run evaluations, benchmark models, and inspect regression telemetry without leaving the IDE.

### Registered MCP Tools

| MCP Tool Name | Description |
| :--- | :--- |
| `evalgate_run_suite` | Executes a complete evaluation suite with quality gate pass/fail enforcement. |
| `evalgate_estimate_cost` | Estimates token volume and dollar spend for a suite before execution. |
| `evalgate_compare_models` | Benchmarks two models head-to-head on identical test cases. |
| `evalgate_evaluate_completion` | Evaluates a raw completion against deterministic or judge assertions. |
| `evalgate_list_runs` | Retrieves recent evaluation run history and telemetry records from SQLite. |
| `evalgate_get_historical_trends` | Calculates pass rate and P50/P95 latency trends over time. |
| `evalgate_list_suites` | Lists all discovered YAML test suites in the active workspace. |

### Configuration Examples

#### Claude Desktop (`claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "evalgate": {
      "command": "uv",
      "args": ["run", "--directory", "/absolute/path/to/evalgate", "evalgate", "mcp"]
    }
  }
}
```

#### Cursor IDE (`.cursor/mcp.json`)
```json
{
  "mcpServers": {
    "evalgate": {
      "command": "uv",
      "args": ["run", "--directory", "/absolute/path/to/evalgate", "evalgate", "mcp"]
    }
  }
}
```

---

## CI/CD & Pull Request Quality Gates

Integrate EvalGate directly into GitHub Actions workflows to block prompt regressions on pull requests.

### GitHub Actions Workflow (`.github/workflows/evalgate.yml`)

```yaml
name: EvalGate Quality Gate

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  prompt-evaluations:
    name: Prompt Quality Gate
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Install uv
        uses: astral-sh/setup-uv@v3
        with:
          version: "latest"

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.11"

      - name: Install Dependencies
        run: uv sync

      - name: Run Prompt Quality Gates
        env:
          VERCEL_AI_GATEWAY_KEY: ${{ secrets.VERCEL_AI_GATEWAY_KEY }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        run: |
          uv run evalgate run evals/rag_qa.yaml
          uv run evalgate run evals/classifier.yaml
```

Runs exit with status `1` when the suite quality gate fails. Assertions are strict
by default (`strict: true`); use `--min-pass-rate 1.0` to require every test to pass.
Live suites require the relevant provider keys; no `--strict` flag is needed.

### Pytest Harness Integration

EvalGate suites can be executed directly inside standard pytest suites:

```python
import pytest
from evalgate.cli.loader import load_suite_from_yaml
from evalgate.runner.runner import SuiteRunner

@pytest.mark.asyncio
async def test_rag_compliance_regression():
    suite = load_suite_from_yaml("evals/rag_qa.yaml")
    result = await SuiteRunner().run_suite(suite, save_to_storage=False)
    
    assert result.passed is True, f"Suite failed: pass rate {result.pass_rate} < {suite.min_pass_rate}"
```

---

## REST & WebSocket API Reference

The FastAPI backend provides REST endpoints and live WebSocket channels for real-time telemetry streaming:

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/suites/{suite_name}/run` | Execute a suite and return its completed result. |
| `POST` | `/api/v1/arena/compare` | Run side-by-side A/B shootout comparison. |
| `POST` | `/api/v1/arena/prompts/estimate` | Estimate both prompt variants without running or saving. |
| `POST` | `/api/v1/arena/prompts/compare` | Run and persist a prompt comparison on one model. |
| `GET` | `/api/v1/arena/prompts` | Saved comparison summaries; limit 1–100 (default 20), offset >= 0. |
| `GET` | `/api/v1/arena/prompts/{id}` | Retrieve prompts, original suite snapshot, and complete results. |
| `POST` | `/api/v1/arena/prompts/{id}/apply` | Apply stored variant A/B; reject changed suites with 409. |
| `POST` | `/api/v1/suites/{suite_name}/estimate-cost` | Calculate preflight token volume and cost projection. |
| `GET` | `/api/v1/suites` | List all discovered YAML test suites. |
| `GET` | `/api/v1/runs` | Query historical execution telemetry. |
| `GET` | `/api/v1/runs/{run_id}/trends` | Fetch aggregated time-series pass rate and latency metrics. |
| `WS` | `/api/v1/ws/run` | Real-time WebSocket streaming of individual test case evaluations. |

For WebSocket runs, send a JSON message such as
`{"suite_name": "support-ticket-classifier", "concurrency": 5}` after connecting.
The server emits `run_started`, `test_complete`, and `run_finished` events.

---

## Testing & Quality Assurance

GitHub Actions runs Python tests, Ruff, and mypy on Python 3.11 and 3.14, plus Studio lint, TypeScript, a production build, and Chromium regressions on every pull request and push to main. The combined CI check must pass before merging. Browser tests use mock providers and a temporary workspace; no provider secrets are needed.

EvalGate maintains comprehensive test coverage across core types, runner graphs, deterministic assertions, semantic judge rubrics, pricing formulas, storage, CLI commands, and MCP tools:

```bash
# Run the backend pytest suite
uv run pytest

# Run Python lint
uv run ruff check packages/core/evalgate scripts/e2e_api.py

# Run type checks
uv run mypy packages/core/evalgate

# Install the test browser once, then run browser regressions
pnpm --filter @evalgate/client exec playwright install chromium
pnpm test:e2e

# Build Next.js Web Studio production bundle
pnpm --filter @evalgate/client build
```

The browser test command builds Studio and starts isolated servers on ports 3100 and 8100. HTML reports and failure traces are saved under `apps/client/playwright-report/` and `apps/client/test-results/`; CI uploads them as artifacts for seven days.

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
