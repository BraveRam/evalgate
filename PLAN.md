# 🛡️ EvalGate — Architecture & Execution Plan

EvalGate is a fast, local-first prompt engineering, regression testing, and quality evaluation platform for applied AI engineers. It combines a **Python + FastAPI + LangChain/LangGraph** backend with a **Next.js** Web Studio, rich terminal CLI, and **Model Context Protocol (MCP)** server.

---

## 1. Monorepo Architecture

```
evalgate/ (repo root)
├── pyproject.toml                  # Python project & dependencies managed with `uv`
├── uv.lock                         # Locked Python dependencies
├── .python-version                 # Python 3.11+
├── PLAN.md
├── README.md
├── .gitignore
├── .agents/
│   └── skills/
│       └── evalgate/
│           └── SKILL.md            # Antigravity / Agent Skill definition
├── mcp_config.json                 # MCP registration config for agents
├── examples/                       # Starter YAML/JSON eval suites
│   ├── rag_qa.yaml
│   ├── sql_generator.yaml
│   ├── classifier.yaml
│   └── tool_calling.yaml
├── evalgate/                       # Python Backend & Engine Package
│   ├── __init__.py
│   ├── core/                       # Core engine abstractions
│   │   ├── types.py                # Pydantic v2 schemas (TestCase, Assertion, RunResult, Target)
│   │   ├── template.py             # {{variable}} interpolation & parsing
│   │   ├── pricing.py              # Cost & token calculation matrix (15+ models)
│   │   ├── storage.py              # aiosqlite run persistence & historical analytics
│   │   └── graph.py                # LangGraph evaluation pipeline state machine
│   ├── providers/                  # LangChain multi-provider adapters
│   │   ├── factory.py              # Provider dispatcher & Vercel AI Gateway configuration
│   │   ├── vercel.py               # Vercel AI Gateway (OpenAI-compatible) adapter
│   │   ├── ollama.py               # Local Ollama adapter
│   │   └── mock.py                 # Offline mock simulator
│   ├── metrics/                    # Semantic & Deterministic Metrics Suite
│   │   ├── base.py                 # BaseMetric abstract class
│   │   ├── faithfulness.py         # RAG claim extraction & context verification
│   │   ├── hallucination.py        # Hallucination & contradiction detection
│   │   ├── relevancy.py            # Answer relevancy & embedding similarity
│   │   ├── coherence.py            # Logical flow, grammar & structure
│   │   ├── bias.py                 # Toxicity & bias detection
│   │   ├── intent.py               # Intent classification & action fulfillment
│   │   ├── dynamic.py              # Custom user-defined grading rubrics
│   │   └── deterministic.py        # JSON Schema, Python AST, SQL syntax, Regex, Levenshtein
│   ├── targets/                    # Evaluation Targets
│   │   ├── prompt.py               # Prompt templates & LLM completions
│   │   ├── tool_call.py            # Function/tool calling validation
│   │   ├── rag.py                  # End-to-end RAG pipeline
│   │   └── webhook.py              # Live HTTP API / webhook endpoint target
│   ├── runner/                     # Test suite execution engine
│   │   └── runner.py               # Concurrent async runner & statistics aggregator
│   ├── mcp/                        # Model Context Protocol (MCP) Server
│   │   └── server.py               # Official Python FastMCP / stdio server
│   ├── cli/                        # Terminal CLI (Typer + Rich)
│   │   ├── main.py                 # evalgate CLI entry point
│   │   └── commands/               # init, run, compare, studio, mcp
│   └── api/                        # FastAPI Web Studio Backend
│       ├── main.py                 # FastAPI application
│       └── routes/                 # REST & WebSocket endpoints (suites, runs, arena, metrics)
│
└── frontend/                       # Next.js Web Studio (App Router)
    ├── package.json
    ├── tsconfig.json
    ├── next.config.ts
    ├── tailwind.config.ts
    └── src/
        ├── app/                    # Next.js App Router pages
        │   ├── page.tsx            # Dashboard & overview
        │   ├── playground/         # Prompt sandbox & live matrix runner
        │   ├── arena/              # Side-by-Side Prompt & Model Shootout
        │   ├── suites/             # Test suite manager & dataset editor
        │   ├── judges/             # Metric & LLM judge rubric builder
        │   ├── history/            # Regression charts & historical run inspector
        │   └── layout.tsx
        ├── components/             # UI components, tables, charts, diff viewers
        └── lib/                    # API client & types
```

---

## 2. Tech Stack

| Component | Technology | Rationale |
| :--- | :--- | :--- |
| **Python Tooling** | `uv` (Rust) | Ultra-fast package management, instant venv creation, fast builds |
| **Backend Framework** | `FastAPI` + `Uvicorn` | Async REST APIs & WebSockets for live eval progress streaming |
| **LLM & Agent Framework** | `LangChain` + `LangGraph` | Industry-standard model abstractions & graph-based state pipeline |
| **Data Contracts** | `Pydantic v2` | High-performance schema validation & JSON serialization |
| **MCP Protocol** | Anthropic Python `mcp` SDK | Native stdio JSON-RPC server for Antigravity, Cursor, Claude |
| **Terminal CLI** | `Typer` + `Rich` | Beautiful colored tables, spinners, live matrices, syntax highlighting |
| **Database** | `aiosqlite` / SQLite | Zero-config, single-file local persistence for runs and metrics |
| **Frontend Framework** | `Next.js` (App Router) + React | Modern, reactive dashboard with server & client components |
| **Styling & UI** | `Tailwind CSS` + `Lucide Icons` | Modern dark-mode developer aesthetic |

---

## 3. Phased Step-by-Step Implementation Roadmap

### **Phase 1: Python Project Foundation & Core Data Contracts (`uv`)**
- Initialize `pyproject.toml` with `uv` containing dependencies:
  - `fastapi`, `uvicorn`, `langchain`, `langgraph`, `langchain-openai`, `langchain-anthropic`, `langchain-google-genai`, `langchain-community`, `pydantic>=2.0`, `typer`, `rich`, `mcp`, `aiosqlite`, `pyyaml`, `httpx`, `pytest`, `pytest-asyncio`.
- Implement `evalgate/core/types.py` defining Pydantic v2 schemas:
  - `EvalTarget`, `TestCase`, `Assertion`, `SemanticMetricConfig`, `SuiteConfig`, `TestCaseResult`, `SuiteRunResult`, `MetricSummary`.
- Implement `evalgate/core/pricing.py` (cost & token calculation database for 15+ models).
- Set up SQLite schema in `evalgate/core/storage.py`.

### **Phase 2: LangChain Providers, Evaluator Metrics & LangGraph Engine**
- Implement `evalgate/providers/`:
  - `vercel.py` (Vercel AI Gateway OpenAI-compatible adapter with `VERCEL_AI_GATEWAY_KEY`).
  - `ollama.py` (Local models).
  - `mock.py` (Zero-cost offline simulator).
- Implement `evalgate/metrics/`:
  - Deterministic assertions: JSON schema, Python AST, SQL syntax, Regex, Levenshtein, Latency SLO, Token budget.
  - Semantic Metrics: Faithfulness, Hallucination, Answer Relevancy, Coherence, Bias, Intent, Dynamic Rubrics.
- Implement `evalgate/core/graph.py`: LangGraph state graph orchestrating test case execution.
- Implement `evalgate/runner/runner.py`: Concurrent async test runner.

### **Phase 3: Typer + Rich Terminal CLI**
- Implement `evalgate/cli/main.py`:
  - `evalgate init`: Scaffolds example test suites.
  - `evalgate run <suite.yaml>`: Runs test suite with live Rich progress table, colored pass/fail pills, latency, and cost summaries.
  - `evalgate compare`: Side-by-side prompt/model shootout in the terminal.
  - `evalgate studio`: Launches the FastAPI server & Next.js Web Studio.
  - `evalgate mcp`: Runs the MCP server.

### **Phase 4: Model Context Protocol (MCP) Server**
- Implement `evalgate/mcp/server.py` using official `mcp` Python SDK:
  - Tool `evalgate_run_suite`
  - Tool `evalgate_evaluate`
  - Tool `evalgate_compare`
  - Tool `evalgate_estimate_cost`
- Create `.agents/skills/evalgate/SKILL.md` and `mcp_config.json`.

### **Phase 5: FastAPI Studio Backend**
- Implement `evalgate/api/`:
  - REST endpoints for managing test suites, test cases, running tests, and fetching historical analytics.
  - WebSocket endpoint for streaming real-time test execution progress to the frontend.

### **Phase 6: Next.js Web Studio**
- Initialize Next.js app in `frontend/` (Tailwind, Lucide).
- Build screens:
  - **Playground & Matrix Runner**: Live editing with variable binding and animated status badges.
  - **Side-by-Side Arena**: Visual diffs between Prompt A vs B and Model A vs B, latency charts, cost graphs.
  - **Judges & Metrics Configurator**: Visual builder for Faithfulness, Hallucination, and custom rubrics.
  - **Run History & Regression Analytics**: SQLite-backed pass rate and latency trend graphs over time.
  - **1-Click Export**: Export suites to Python `pytest`, YAML, and GitHub Actions CI.

### **Phase 7: Example Suites & End-to-End Verification**
- Create example test suites (`rag_qa.yaml`, `sql_generator.yaml`, `classifier.yaml`, `tool_calling.yaml`).
- Test CLI, FastAPI, MCP, and Next.js end-to-end.
- Push clean state to GitHub.
