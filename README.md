# EvalGate

Fast, local-first evaluation engine, prompt regression testing framework, and developer studio for applied AI engineering. Built with **Python (`uv`)**, **FastAPI**, **LangChain/LangGraph**, **Next.js**, and the **Model Context Protocol (MCP)**.

[![Python](https://img.shields.io/badge/Python-3.11+-blue?logo=python)](https://python.org)
[![uv](https://img.shields.io/badge/uv-Astral-purple)](https://astral.sh/uv)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![LangChain](https://img.shields.io/badge/LangChain-LangGraph-darkgreen)](https://langchain.com)
[![Next.js](https://img.shields.io/badge/Next.js-16+-black?logo=next.js)](https://nextjs.org)
[![Turborepo](https://img.shields.io/badge/Turborepo-Monorepo-ef4444?logo=turborepo)](https://turbo.build)
[![MCP](https://img.shields.io/badge/MCP-Compatible-purple)](https://modelcontextprotocol.io)

---

## Table of Contents

- [Overview](#overview)
- [Architecture & Monorepo Structure](#architecture--monorepo-structure)
- [Key Features](#key-features)
- [Quick Start](#quick-start)
- [Declarative YAML Test Suite Specification](#declarative-yaml-test-suite-specification)
  - [Target Architectures](#target-architectures)
  - [Assertion Engine](#assertion-engine)
- [CLI Reference](#cli-reference)
- [Model Context Protocol (MCP) Server](#model-context-protocol-mcp-server)
- [CI/CD & Pull Request Quality Gates](#cicd--pull-request-quality-gates)
- [REST & WebSocket API Reference](#rest--websocket-api-reference)
- [Testing & Quality Assurance](#testing--quality-assurance)
- [License](#license)

---

## Overview

EvalGate bridges the gap between ad-hoc prompt experimentation and production software engineering standards. It brings deterministic testing, code AST validation, latency/cost budgets, and multi-point LLM-as-a-judge rubrics into a unified, local-first workflow.

Applied AI teams use EvalGate to:
- Define declarative YAML test suites covering prompt templates, tool calls, RAG pipelines, structured JSON schemas, and live webhooks.
- Run microsecond deterministic checks (JSON Schema, Python AST, SQL syntax, Regex, Levenshtein distance) alongside semantic judge evaluations.
- Benchmark competing models side-by-side in an automated Model Arena with win/loss verdicts, Pareto curves, and completion diffs.
- Enforce pull request quality gates in CI/CD pipelines to block prompt regressions before deployment.
- Integrate directly with AI coding agents (Claude Desktop, Cursor, Antigravity, Windsurf) over Model Context Protocol (MCP).

---

## Architecture & Monorepo Structure

EvalGate is organized as a unified monorepo managed with Turborepo, pnpm, and uv:

```text
evalgate/
├── apps/
│   └── client/                     # Next.js 16 App Router Studio (Turbopack, Tailwind CSS, TanStack Query)
│       ├── src/app/                # Studio routes: Dashboard, Workbench, Suites, Arena, Analytics, Docs
│       ├── src/components/         # UI components, Table of Contents, CodeViewer, ModelSelector
│       └── src/lib/                # API client, WebSocket stream client, Docs data, Top 50 models
├── packages/
│   └── core/                       # Core Python evaluation engine and backend services
│       ├── evalgate/
│       │   ├── api/                # FastAPI REST router and WebSocket streaming endpoints
│       │   ├── cli/                # Typer & Rich terminal CLI runner
│       │   ├── core/               # Engine types, deterministic matchers, semantic evaluators, pricing
│       │   ├── mcp/                # FastMCP server with 7 native tools (stdio and sse transports)
│       │   ├── providers/          # Gateway client (OpenAI, Anthropic, Gemini, DeepSeek, Mock)
│       │   ├── runner/             # LangGraph asynchronous test matrix execution engine
│       │   └── storage/            # Local SQLite database, migrations, and telemetry tracking
│       └── tests/                  # Pytest test suite (92 unit and integration tests)
├── evals/                          # Declarative YAML evaluation suites and test cases
└── pyproject.toml                  # Monorepo Python configuration and dependencies
```

---

## Key Features

### Two-Tier Assertion Framework
- **Deterministic Microsecond Assertions**: Validate exact strings, substrings, prefixes, suffixes, regex patterns, Levenshtein similarity, Python AST syntax, SQL syntax, and draft-7 JSON Schema without incurring inference costs.
- **Semantic LLM-as-a-Judge Rubrics**: Evaluate qualitative dimensions including context faithfulness, hallucination detection, answer relevancy, logical coherence, toxicity/bias, intent fulfillment, and custom plain-English rubrics on normalized score thresholds.

### Multi-Target Evaluation Modalities
Support for 5 distinct execution modalities:
1. `prompt`: String prompt template with variable interpolation (`{{var}}`), system instructions, and sampling parameters.
2. `tool_call`: Validates function calling arguments and tool invocation schemas.
3. `rag`: Evaluates grounded context retrieval against faithfulness and hallucination metrics.
4. `structured_output`: Strict JSON Schema validation with Pydantic and draft-7 conformance.
5. `webhook`: Live HTTP POST endpoint integration for black-box testing of deployed microservices.
6. `mock/simulator`: Built-in zero-cost, offline simulation provider for rapid pipeline plumbing verification in CI/CD.

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

### 1. Monorepo Setup

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

# Local SQLite telemetry path (default: ~/.evalgate/evalgate.db)
EVALGATE_DB_PATH="evalgate.db"
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
        schema:
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
  template: "Question: {{query}}"

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
    Authorization: "Bearer ${PROD_API_TOKEN}"
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

## Assertion Engine

### Deterministic & Code Assertions

| Assertion Type | Expected Value | Description |
| :--- | :--- | :--- |
| `exact` | `string` | Strict string match after whitespace normalization. |
| `contains` | `string` | Verifies substring inclusion. |
| `not_contains` | `string` | Negative substring guard for confidential terms or error codes. |
| `starts_with` | `string` | Prefix matcher (e.g. ensuring SQL starts with `SELECT`). |
| `ends_with` | `string` | Suffix matcher (e.g. statement termination with `;`). |
| `regex` | `string (pattern)` | Regular expression pattern validation. |
| `levenshtein` | `float (0.0 - 1.0)` | Fuzzy string similarity ratio against ground truth. |
| `json_schema` | `object (Draft-7)` | Strict JSON Schema structural validation. |
| `python_ast` | `boolean` | Verifies that extracted Python code compiles into a valid AST. |
| `sql_syntax` | `boolean` | Tokenizes and validates SQL grammar and statement structure. |
| `max_latency_ms` | `integer` | SLA response time threshold in milliseconds. |
| `max_tokens` | `integer` | Maximum output token ceiling to prevent runaway generation. |
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
uv run evalgate run evals/support_tickets.yaml --model anthropic/claude-3-5-sonnet --concurrency 8

# Compare two models in head-to-head arena shootout
uv run evalgate compare evals/hard_reasoning_challenge.yaml \
  --model-a openai/gpt-4o-mini \
  --model-b deepseek/deepseek-v4-pro-0813

# Preflight cost and token estimation
uv run evalgate cost evals/customer_support.yaml

# List discovered test suites in workspace
uv run evalgate list-suites

# Launch Model Context Protocol (MCP) server
uv run evalgate mcp --transport stdio

# Launch FastAPI backend service
uv run evalgate server --host 127.0.0.1 --port 8000
```

---

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
          uv run evalgate run evals/rag_qa.yaml --strict
          uv run evalgate run evals/support_tickets.yaml --strict
```

### Pytest Harness Integration

EvalGate suites can be executed directly inside standard pytest suites:

```python
import pytest
from evalgate.runner.graph import run_suite_async
from evalgate.core.template import load_suite_from_yaml

@pytest.mark.asyncio
async def test_rag_compliance_regression():
    suite = load_suite_from_yaml("evals/rag_qa.yaml")
    result = await run_suite_async(suite)
    
    assert result.passed is True, f"Suite failed: pass rate {result.pass_rate} < {suite.min_pass_rate}"
```

---

## REST & WebSocket API Reference

The FastAPI backend provides REST endpoints and live WebSocket channels for real-time telemetry streaming:

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/run` | Execute an evaluation suite asynchronously. |
| `POST` | `/api/v1/arena/compare` | Run side-by-side A/B shootout comparison. |
| `POST` | `/api/v1/estimate-cost` | Calculate preflight token volume and cost projection. |
| `GET` | `/api/v1/suites` | List all discovered YAML test suites. |
| `GET` | `/api/v1/runs` | Query historical execution telemetry. |
| `GET` | `/api/v1/analytics/trends` | Fetch aggregated time-series pass rate and latency metrics. |
| `WS` | `/api/v1/ws/run/{suite_name}` | Real-time WebSocket streaming of individual test case evaluations. |

---

## Testing & Quality Assurance

EvalGate maintains comprehensive test coverage across core types, runner graphs, deterministic assertions, semantic judge rubrics, pricing formulas, storage, CLI commands, and MCP tools:

```bash
# Run backend pytest suite (92 tests)
uv run pytest

# Run type checks
uv run mypy packages/core/evalgate

# Build Next.js Web Studio production bundle
pnpm --filter @evalgate/client build
```

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
