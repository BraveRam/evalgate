# 🛡️ EvalGate — Monorepo Architecture & Execution Plan

EvalGate is a fast, local-first prompt engineering, regression testing, and quality evaluation toolkit. Built as a **pnpm monorepo**, it equips applied AI engineers to iterate rapidly on prompts, run deterministic and LLM-as-a-judge evaluations, benchmark models side-by-side, analyze token/cost regressions, and expose evaluation tools directly to AI agents via **Model Context Protocol (MCP)**.

---

## 1. Monorepo Architecture & Package Layout

We use **pnpm workspaces** (`pnpm-workspace.yaml`) to cleanly separate concerns into modular, reusable packages:

```
evalgate/ (monorepo root)
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.base.json
├── PLAN.md
├── README.md
├── .agents/
│   └── skills/
│       └── evalgate/
│           └── SKILL.md            # Antigravity / Agent Skill definition
├── mcp_config.json                 # MCP registration config for agents
├── examples/                       # Starter YAML/JSON eval suites
│   ├── rag_qa.yaml
│   ├── sql_generator.yaml
│   └── classifier.yaml
└── packages/
    ├── shared/                     # @evalgate/shared
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── types.ts            # Core data contracts (TestCase, Assertion, Judge, RunResult)
    │       ├── schemas.ts          # Zod validation schemas
    │       └── constants.ts        # Model pricing tables & default configs
    │
    ├── core/                       # @evalgate/core (Engine & Evaluator SDK)
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── providers/          # Vercel AI Gateway, OpenAI, Ollama, Mock Simulator
    │       ├── template/           # {{variable}} interpolation engine
    │       ├── evaluators/         # Deterministic assertions & LLM-as-a-judge
    │       ├── storage/            # SQLite run storage & historical metrics
    │       ├── runner/             # Parallel test execution & statistics aggregator
    │       └── index.ts
    │
    ├── mcp/                        # @evalgate/mcp (Model Context Protocol Server)
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── tools.ts            # MCP Tool definitions (run_suite, evaluate, compare)
    │       └── index.ts            # stdio JSON-RPC MCP server
    │
    ├── cli/                        # @evalgate/cli (Terminal Interface)
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── commands/           # init, run, compare, studio, mcp
    │       └── index.ts            # Main CLI entrypoint (evalgate binary)
    │
    └── web/                        # @evalgate/web (React + Tailwind Web Studio)
        ├── package.json
        ├── tsconfig.json
        ├── vite.config.ts
        ├── index.html
        └── src/
            ├── components/         # Playground, Arena, Matrix, Judges, History, Export
            ├── App.tsx
            └── main.tsx
```

---

## 2. Package Responsibilities

| Package | Name | Purpose |
| :--- | :--- | :--- |
| `packages/shared` | `@evalgate/shared` | Shared TypeScript types, Zod schemas, assertion definitions, and model pricing tables. |
| `packages/core` | `@evalgate/core` | Headless execution engine: Vercel AI Gateway client, Mock simulator, assertions, LLM judges, SQLite storage, and test runner. |
| `packages/mcp` | `@evalgate/mcp` | Standard MCP server exposing eval & judge tools to AI agents (Antigravity, Cursor, Claude Desktop). |
| `packages/cli` | `@evalgate/cli` | Developer CLI binary (`evalgate run`, `evalgate init`, `evalgate compare`, `evalgate studio`). |
| `packages/web` | `@evalgate/web` | Interactive Web Studio (Prompt sandbox, Side-by-Side Arena, Judge rubric editor, regression graphs). |

---

## 3. Phased Implementation Roadmap (Step-by-Step)

We will proceed strictly **phase by phase**, pausing for alignment and approval before each phase begins:

### **Phase 1: Monorepo Foundation & Shared Data Contracts**
- Configure `pnpm-workspace.yaml`, root `package.json`, and shared `tsconfig.base.json`.
- Set up `packages/shared` with:
  - TypeScript types (`PromptTemplate`, `TestCase`, `Assertion`, `JudgeConfig`, `SuiteRunResult`, `MetricSummary`).
  - Zod validation schemas for test suites and assertions.
  - Model pricing matrix (GPT-4o, Claude 3.5 Sonnet, Gemini Flash/Pro, DeepSeek V3/R1, Llama 3.3).

### **Phase 2: Core Engine & Providers**
- In `packages/core`:
  - Variable interpolation templating engine (`{{variable}}` with fallback defaults).
  - Provider adapters: **Vercel AI Gateway** (`VERCEL_AI_GATEWAY_KEY`), direct OpenAI/Groq/Ollama, and offline Mock Simulator.
  - Deterministic assertions: `contains`, `regex`, `json_schema`, `python_ast`, `sql_syntax`, `levenshtein`, `token_budget`, `latency_budget`.
  - LLM-as-a-judge rubric evaluator with reasoning breakdown.
  - SQLite database persistence for test suites, cases, and historical runs.
  - Concurrent test suite runner with statistical aggregation (P50/P95 latency, pass rate, cost).

### **Phase 3: Model Context Protocol (MCP) Server**
- In `packages/mcp`:
  - Implement JSON-RPC 2.0 stdio MCP server using `@modelcontextprotocol/sdk`.
  - Expose tools: `evalgate_run_suite`, `evalgate_evaluate`, `evalgate_compare`, `evalgate_estimate_cost`.
  - Create `.agents/skills/evalgate/SKILL.md` and `mcp_config.json` for seamless agent integration.

### **Phase 4: Terminal CLI**
- In `packages/cli`:
  - Build `evalgate` CLI binary with commands:
    - `evalgate init` (scaffold starter YAML eval suites)
    - `evalgate run <suite.yaml>` (pretty terminal output with colored matrices)
    - `evalgate compare` (side-by-side prompt/model CLI benchmark)
    - `evalgate studio` (launch Web Studio)
    - `evalgate mcp` (launch MCP server)

### **Phase 5: Interactive Web Studio**
- In `packages/web`:
  - Build React + Vite + Tailwind UI:
    - **Playground & Matrix Runner**: Live editing, variable binding, real-time runs.
    - **Side-by-Side Arena**: Diff completions, compare token counts, latency, and assertions.
    - **Judge Rubric Builder**: Visual judge editor with prebuilt templates (Faithfulness, Coherence, Safety).
    - **Regression & History Dashboard**: Historical runs timeline with trend charts.
    - **1-Click Exporter**: Export suites to Python (`pytest`), YAML, and GitHub Actions CI.
  - Embedded local HTTP server to connect Web Studio with `@evalgate/core`.

### **Phase 6: Example Benchmark Suites & End-to-End Verification**
- Create ready-to-run benchmark suites (`rag_qa.yaml`, `sql_generator.yaml`, `classifier.yaml`).
- Verify CLI, MCP server, and Web Studio end-to-end.
- Push clean state to GitHub.
