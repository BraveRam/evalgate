# EvalGate: Comprehensive Feature Documentation & Architecture Reference

EvalGate is a fast, local-first prompt engineering, regression testing, and quality evaluation platform designed for applied AI engineers and autonomous agent developers.

---

## Table of Contents

1. [System Architecture & Monorepo Overview](#1-system-architecture--monorepo-overview)
2. [Evaluation Targets Subsystem](#2-evaluation-targets-subsystem)
3. [Metrics & Quality Gate Assertions](#3-metrics--quality-gate-assertions)
   - [Deterministic Metrics](#deterministic-metrics)
   - [LLM-as-a-Judge Semantic Metrics](#llm-as-a-judge-semantic-metrics)
4. [Execution Engine & LangGraph State Machine](#4-execution-engine--langgraph-state-machine)
5. [Providers & Inference Routing](#5-providers--inference-routing)
6. [Pricing & Token Cost Engine](#6-pricing--token-cost-engine)
7. [Local-First Storage (SQLite WAL)](#7-local-first-storage-sqlite-wal)
8. [CLI Tooling & Terminal Workflows](#8-cli-tooling--terminal-workflows)
9. [Model Context Protocol (MCP) Server](#9-model-context-protocol-mcp-server)
10. [FastAPI Studio Backend (REST & WebSockets)](#10-fastapi-studio-backend-rest--websockets)
11. [Next.js Web Studio Client](#11-nextjs-web-studio-client)
12. [CI/CD Integration & Automation](#12-cicd-integration--automation)

---

## 1. System Architecture & Monorepo Overview

EvalGate is structured as a **Turborepo + `uv` Workspaces Monorepo** separating the Python evaluation engine and the Next.js Web Studio:

```
evalgate/
├── apps/
│   └── client/                  # Next.js 15 Web Studio (@evalgate/client)
│       ├── src/app/             # App Router pages & loading skeletons
│       ├── src/components/      # shadcn/ui monochrome components & layout
│       └── src/lib/             # Axios API client, ws streamer, utils
│
├── packages/
│   └── core/                    # Core Python Package (evalgate)
│       ├── evalgate/api/        # FastAPI REST & WebSocket server
│       ├── evalgate/cli/        # Typer & Rich CLI
│       ├── evalgate/core/       # LangGraph graph, SQLite storage, Jinja2 template, Pricing
│       ├── evalgate/mcp/        # Model Context Protocol stdio server
│       ├── evalgate/metrics/    # Deterministic & LLM-as-a-judge metrics
│       ├── evalgate/providers/  # Vercel AI Gateway & Mock providers
│       ├── evalgate/runner/     # Async SuiteRunner
│       ├── evalgate/targets/    # Prompt, RAG, Webhook, ToolCall targets
│       └── tests/               # 92 unit and integration tests (91%+ coverage)
│
├── evals/                       # YAML benchmark suites (rag_qa.yaml, sql_generator.yaml, etc.)
├── turbo.json                   # Turborepo task pipeline configuration
├── pnpm-workspace.yaml          # pnpm workspace definition
├── package.json                 # Monorepo root package.json (turbo scripts)
└── pyproject.toml               # uv workspace root configuration
```

### Core Design Principles
- **Local-First**: Evaluation traces and metrics are persisted in a local SQLite database (`.evalgate/evalgate.db`) with Write-Ahead Logging (WAL).
- **Zero Lock-In**: Test suites are declared in portable, human-readable YAML specifications.
- **Deterministic + Semantic**: Combines millisecond regex/JSON schema checks with deep LLM-as-a-judge rubrics.
- **Air-Gapped Simulation**: Includes a built-in zero-cost `mock/simulator` provider for offline test execution and CI without API keys.

---

## 2. Evaluation Targets Subsystem

EvalGate abstracts LLM application architectures through pluggable target handlers implemented under `packages/core/evalgate/targets/`.

### 1. `PromptTarget` (`target_type: "prompt"`)
- **How it works**: Renders a prompt template with test case input variables using Jinja2, invokes the target LLM provider, and captures output text, token counts, and execution latency.
- **Use cases**: Direct prompt engineering, system message optimization, zero-shot/few-shot task validation.

```yaml
target:
  type: prompt
  model: openai/gpt-4o-mini
  temperature: 0.1
  max_tokens: 500
  system_prompt: "You are a senior SQL engineer. Output only executable SQL queries."
```

### 2. `RAGTarget` (`target_type: "rag"`)
- **How it works**: Injects retrieved context chunks or reference documents into the prompt template alongside the user question.
- **Use cases**: Retrieval-Augmented Generation evaluation (assessing whether answers stay faithful to retrieved context without hallucinating).

```yaml
target:
  type: rag
  model: openai/gpt-4o-mini
  system_prompt: "Answer questions strictly based on the provided Context."
```

### 3. `ToolCallTarget` (`target_type: "tool_call"`)
- **How it works**: Tests model function-calling abilities. Supplies tool definitions and schemas to the LLM and validates whether the model correctly selects the tool name and formats argument parameters.
- **Use cases**: Autonomous agents, function routing, API parameter synthesis.

```yaml
target:
  type: tool_call
  model: openai/gpt-4o-mini
  tools:
    - name: search_customer_database
      description: Look up customer records by email or ID
      parameters:
        type: object
        properties:
          customer_id: { type: string }
        required: [customer_id]
```

### 4. `WebhookTarget` (`target_type: "webhook"`)
- **How it works**: Dispatches an HTTP `POST` or `GET` request to external agent endpoints, microservices, or serverless webhooks. Supports template interpolation in request bodies, custom authentication headers, configurable timeouts, and response extraction paths.
- **Use cases**: Evaluating multi-turn deployed agents, LangChain/LangGraph microservices, or remote FastAPI endpoints.

```yaml
target:
  type: webhook
  endpoint: "http://127.0.0.1:8080/v1/agent"
  headers:
    Authorization: "Bearer ${AGENT_API_KEY}"
  payload_template: '{"query": "{{ input }}"}'
  response_path: "data.response"
```

---

## 3. Metrics & Quality Gate Assertions

Every test case contains assertions evaluated against target outputs. Assertions return a structured score between `0.0` and `1.0`, a boolean `passed` flag, and explanatory diagnostic text.

### Deterministic Metrics

| Metric | Configuration | How It Works |
|---|---|---|
| **`exact_match`** | `expected: "string"` | Compares target output to expected string with configurable whitespace trimming and case insensitivity. |
| **`contains`** | `expected: "substring"` | Checks whether expected substring or keyword is present within the output. |
| **`regex_match`** | `expected: "pattern"` | Validates target output against a regular expression (e.g. `^SELECT\s+.+\s+FROM\s+`). |
| **`json_schema`** | `expected: { ... }` | Validates target response as valid JSON conforming strictly to a specified JSON Schema (draft-07 compatible). |
| **`latency_max_ms`** | `threshold: 1500` | Fails the assertion if model inference latency exceeds the SLA threshold in milliseconds. |
| **`cost_max_usd`** | `threshold: 0.005` | Fails the assertion if total token cost for the run exceeds the budget cap in USD. |
| **`levenshtein_similarity`** | `expected: "str", threshold: 0.85` | Computes Normalized Levenshtein edit distance between output and reference. |
| **`tool_call_match`** | `tool_name: "func", arguments: {...}` | Deep-matches selected tool names and compares JSON parameter dictionaries. |

---

### LLM-as-a-Judge Semantic Metrics

Semantic metrics use an independent LLM judge (e.g., `openai/gpt-4o` or `deepseek/deepseek-v4-pro-0813`) to grade subjective, nuanced properties:

```
┌─────────────────┐       ┌─────────────────┐       ┌──────────────────────┐
│  Target Output  │ + ──> │   Judge Prompt  │ ──> │ Structured JSON Score │
│ & Test Context  │       │ & Evaluation    │       │ (score: 0.0 - 1.0,   │
└─────────────────┘       │ Scoring Rubric  │       │  reasoning: "...")   │
                          └─────────────────┘       └──────────────────────┘
```

#### 1. `semantic_faithfulness`
- **Purpose**: Evaluates whether the generated response is strictly derived from and grounded in the retrieved context chunks.
- **Score**: `1.0` if all factual claims are supported by context; decreases if ungrounded claims are introduced.

#### 2. `semantic_hallucination`
- **Purpose**: Evaluates whether the model produced fabricated statements, non-existent facts, or contradictory assertions.
- **Score**: `1.0` indicates zero hallucination.

#### 3. `semantic_answer_relevancy`
- **Purpose**: Checks if the model directly answered the user's prompt without dodging questions or outputting tangential fluff.
- **Score**: Based on completeness and directness.

#### 4. `semantic_intent`
- **Purpose**: Assesses whether the model fulfilled the underlying goal and task intent requested by the user.

#### 5. `semantic_coherence`
- **Purpose**: Evaluates readability, grammar, structural coherence, and logical flow of the generated text.

#### 6. `semantic_bias`
- **Purpose**: Scans for demographic, cultural, political, or unfair bias in generated responses.

#### 7. `dynamic_judge`
- **Purpose**: Allows developers to write **arbitrary, custom judge prompt templates** directly in YAML with tailored grading rubrics and scoring instructions.

```yaml
- type: dynamic_judge
  threshold: 0.8
  prompt_template: |
    You are evaluating an AI Code Reviewer.
    Assess if the following code review identifies the security vulnerability:
    Code Reviewed: {{ input }}
    Review Generated: {{ output }}
    Rate from 0.0 to 1.0 based on precision and actionable advice.
```

---

## 4. Execution Engine & LangGraph State Machine

EvalGraph utilizes **LangGraph** under the hood to coordinate the evaluation pipeline as an asynchronous Directed Acyclic Graph (DAG):

```
             ┌─────────────────────────┐
             │ 1. render_template      │
             │ (Jinja2 variable matrix)│
             └────────────┬────────────┘
                          │
                          ▼
             ┌─────────────────────────┐
             │ 2. invoke_target        │
             │ (HTTP / Provider SDK)   │
             └────────────┬────────────┘
                          │
                          ▼
             ┌─────────────────────────┐
             │ 3. evaluate_assertions  │
             │ (Deterministic + Judge) │
             └────────────┬────────────┘
                          │
                          ▼
             ┌─────────────────────────┐
             │ 4. aggregate_metrics    │
             │ (Tokens, Cost, Pass/Fail)│
             └─────────────────────────┘
```

### Suite Execution Features
- **Async Concurrency Limiting**: Uses `asyncio.Semaphore(concurrency)` to execute test cases in parallel without overwhelming model rate limits.
- **Quality Gate Enforcement**: Compares overall pass rate against `min_pass_rate` (e.g. `0.95`). If the pass rate is below threshold, the suite fails and exits with status code `1`.
- **Pre-Flight Dry-Run Estimation**: Calculates projected token usage and USD spend before launching large test suites.

---

## 5. Providers & Inference Routing

EvalGate features a provider registry configured in `packages/core/evalgate/providers/`:

### 1. `VercelAIGatewayProvider`
- Routes inference through the **Vercel AI Gateway** (`https://ai-gateway.vercel.sh/v1`).
- Provides 1 unified API key interface across **25+ major model families**:
  - `openai/gpt-4o`, `openai/gpt-4o-mini`, `openai/o1`, `openai/o3-mini`
  - `anthropic/claude-3-5-sonnet`, `anthropic/claude-3-5-haiku`, `anthropic/claude-3-opus`
  - `google/gemini-2.0-flash`, `google/gemini-1.5-pro`
  - `deepseek/deepseek-v4-pro-0813`, `deepseek/deepseek-chat`
  - `meta/llama-3.3-70b-instruct`, `mistral/mistral-large-2407`

### 2. `MockProvider` (`mock/simulator`)
- A deterministic, offline provider that synthesizes realistic responses and token counters.
- Enables complete test suite execution and continuous integration in air-gapped environments with 0 network calls and $0.00 spend.

---

## 6. Pricing & Token Cost Engine

Implemented in `packages/core/evalgate/core/pricing.py`:
- Contains live token pricing catalogs ($/1M prompt tokens, $/1M completion tokens).
- Dynamically computes total inference spend per test case, per suite, and per model shootout.

```python
# Example Pricing Rates ($ per 1M tokens)
"openai/gpt-4o-mini": {"prompt": 0.15, "completion": 0.60}
"openai/gpt-4o":      {"prompt": 2.50, "completion": 10.00}
"anthropic/claude-3-5-sonnet": {"prompt": 3.00, "completion": 15.00}
"deepseek/deepseek-v4-pro-0813": {"prompt": 0.27, "completion": 1.10}
```

---

## 7. Local-First Storage (SQLite WAL)

Implemented in `packages/core/evalgate/core/storage.py`:
- Database stored at `.evalgate/evalgate.db`.
- Configured with `PRAGMA journal_mode=WAL;` and `PRAGMA synchronous=NORMAL;` for high-throughput concurrent reads and writes.
- Tables:
  - `runs`: Run metadata, target model, pass rate, latency stats (P50, P95, Avg), total cost USD, timestamp.
  - `test_results`: Individual test case outputs, latency, tokens, status (PASS/FAIL).
  - `assertions`: Granular assertion outcomes, scores, and judge reasoning.

---

## 8. CLI Tooling & Terminal Workflows

The `evalgate` CLI is built with **Typer** and **Rich** to deliver terminal tables, syntax highlighting, and progress bars.

```bash
# Display version and banner
uv run evalgate version

# Scaffold starter evals directory and database
uv run evalgate init

# Run an evaluation suite
uv run evalgate run evals/rag_qa.yaml

# Run with custom model override and concurrency
uv run evalgate run evals/rag_qa.yaml --model openai/gpt-4o-mini --concurrency 15

# Compare two models head-to-head in the Arena shootout
uv run evalgate compare evals/hard_reasoning_challenge.yaml \
  --model-a openai/gpt-4o-mini \
  --model-b deepseek/deepseek-v4-pro-0813

# List historical runs
uv run evalgate list --limit 20

# View granular test case trace of a past run
uv run evalgate view <run_id>

# Launch the FastAPI Web Studio server
uv run evalgate studio --host 127.0.0.1 --port 8000

# Launch the Model Context Protocol (MCP) server
uv run evalgate mcp
```

---

## 9. Model Context Protocol (MCP) Server

Implemented in `packages/core/evalgate/mcp/server.py`:
Exposes EvalGate tools and resources over standard I/O to AI assistants (Antigravity, Cursor, Claude Desktop, Windsurf):

### MCP Tools
1. **`evalgate_list_suites`**: Scans the workspace and returns all discovered YAML test suites with test case counts.
2. **`evalgate_run_suite`**: Executes an evaluation suite by name with optional model override and concurrency.
3. **`evalgate_compare_models`**: Triggers a side-by-side shootout between Model A and Model B.
4. **`evalgate_evaluate_single`**: Runs an ephemeral, instant single-prompt test case with assertions from chat prompts.
5. **`evalgate_list_runs`**: Queries historical evaluation runs.
6. **`evalgate_get_run`**: Retrieves complete test case traces for a specific run ID.

### MCP Resources
- `evalgate://suites`: Discovered suite configurations.
- `evalgate://runs/{run_id}`: Full JSON execution records.

---

## 10. FastAPI Studio Backend (REST & WebSockets)

Implemented in `packages/core/evalgate/api/`:
- **REST Endpoints**:
  - `GET /api/v1/suites`: List all discovered YAML suites.
  - `GET /api/v1/suites/{name}`: Get suite details & test case matrix.
  - `GET /api/v1/suites/{name}/dry-run`: Pre-flight cost estimation.
  - `POST /api/v1/evaluate/single`: Run live playground evaluation.
  - `POST /api/v1/arena/compare`: Run side-by-side model arena shootout.
  - `GET /api/v1/runs`: List historical runs with limit filtering.
  - `GET /api/v1/runs/{id}`: Inspect run trace.
  - `DELETE /api/v1/runs/{id}`: Delete run record.
  - `GET /api/v1/models`: List available LLM models & pricing.
- **WebSocket Streaming**:
  - `WS /api/v1/ws/run`: Streams test case execution events in real time (`test_started`, `test_completed`, `run_summary`).
- **Security & Network Binding**:
  - Bound to `127.0.0.1` with strict CORS origins to prevent cross-origin reflection attacks.

---

## 11. Next.js Web Studio Client

Located in `apps/client/`:
Built with **Next.js 15 App Router**, **shadcn/ui**, **Tailwind CSS**, and **TanStack Query v5** using a strict monochrome Zinc design system:

| Studio Route | Purpose | Key Features |
|---|---|---|
| **`/` (Overview)** | Operational Dashboard | Pass rate KPI, latency metrics, inference spend, recent runs table, instant loading skeletons. |
| **`/playground`** | Prompt Sandbox | Live template editor, variable builder, assertion inspector, real-time single-shot evaluation. |
| **`/suites`** | Test Matrix & Runner | YAML suite selector, test matrix view, dry-run cost dialog, live WebSocket streaming execution drawer. |
| **`/arena`** | Model Shootout | Side-by-side A/B model benchmark, pass rate deltas, latency curves, winner trophy badge. |
| **`/analytics`** | Regression Trends | Recharts pass rate area charts, P50/P95 latency curves, run deletion mutation. |
| **`/export`** | CI/CD Generator | 1-click exporter to GitHub Actions CI workflow YAML, Pytest code, and MCP config. |

---

## 12. CI/CD Integration & Automation

EvalGate integrates seamlessly into continuous integration pipelines to prevent prompt regressions before deployment.

### GitHub Actions Workflow Example (`.github/workflows/evals.yml`)

```yaml
name: Evaluation Quality Gate

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  evaluate-prompts:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install uv
        uses: astral-sh/setup-uv@v3
        with:
          version: "latest"

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.11"

      - name: Install dependencies
        run: uv sync

      - name: Run Quality Gate Suites
        env:
          VERCEL_AI_GATEWAY_KEY: ${{ secrets.VERCEL_AI_GATEWAY_KEY }}
        run: |
          uv run evalgate run evals/rag_qa.yaml --min-pass-rate 1.0
          uv run evalgate run evals/sql_generator.yaml --min-pass-rate 0.95
```
