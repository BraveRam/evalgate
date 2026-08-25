# 🛡️ EvalGate — Monorepo Architecture & Execution Plan

EvalGate is a fast, local-first prompt engineering, regression testing, and quality evaluation toolkit. Built as a **pnpm monorepo**, it equips applied AI engineers to iterate rapidly on prompts, run deterministic and semantic LLM-as-a-judge evaluations, benchmark models side-by-side, analyze token/cost regressions, and expose evaluation tools directly to AI agents via **Model Context Protocol (MCP)**.

---

## 1. Core Evaluation Engine & Metrics Suite

EvalGate combines deterministic rule-based assertions with the comprehensive metric architecture inspired by **EvalKit** (`evalkit/evalkit`), enhanced for multi-provider pipelines and MCP:

### **A. Semantic & LLM-as-a-Judge Metrics (EvalKit-Inspired)**
Each metric returns a normalized score (`0.0 - 1.0` or `1 - 5`), a configurable threshold (`passThreshold`), pass/fail boolean, and structured reasoning.

1. **Faithfulness / Groundedness**: Evaluates whether the generated response is strictly grounded in the provided context/reference documents (critical for RAG).
2. **Hallucination Detection**: Detects fabricated claims, false assertions, or unsubstantiated extrapolations.
3. **Answer Relevancy**: Measures how directly and concisely the response answers the input prompt without irrelevant deviations.
4. **Coherence & Structure**: Assesses logical flow, grammatical correctness, and readability.
5. **Bias & Toxicity Detection**: Flags harmful bias, discriminatory language, or unsafe outputs.
6. **Intent Adherence**: Verifies whether the model accurately identified and fulfilled the user's intent or expected action.
7. **Semantic Similarity**: Calculates semantic distance to ground-truth reference outputs.
8. **Dynamic Custom Metric**: Create arbitrary domain-specific evaluation rubrics on the fly with custom grading criteria.

### **B. Deterministic & Hard Gate Assertions**
1. **JSON Schema / Structured Output**: Validates output against strict JSON schemas (Zod / Pydantic).
2. **Syntax Validation**: Checks if code output is valid Python syntax (`python_ast`) or valid SQL syntax (`sql_syntax`).
3. **String / Pattern Matchers**: `exact_match`, `contains`, `not_contains`, `regex`, `starts_with`, `ends_with`, `levenshtein`.
4. **Performance & SLO Budgets**: `max_latency_ms`, `max_tokens`, `cost_budget_usd`.

---

## 2. Evaluation Targets (Beyond Prompts)

EvalGate evaluates 5 distinct AI engineering target types:

| Target Type | Description & What is Tested |
| :--- | :--- |
| **Prompt Template** | `{{variable}}` interpolation, phrasing variants, few-shot permutations |
| **Tool / Function Calling** | Tool selection accuracy, JSON arguments schema validation |
| **RAG Pipeline** | Context relevance, answer faithfulness, groundedness |
| **Structured Output** | JSON Schema / Zod validation, entity extraction accuracy |
| **Live API / Webhook** | End-to-end latency, status codes, payload assertions on live backend services |

---

## 3. Monorepo Architecture & Package Layout

```
evalgate/ (pnpm monorepo)
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
│   ├── classifier.yaml
│   └── tool_calling.yaml
└── packages/
    ├── shared/                     # @evalgate/shared
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── types/              # Target, TestCase, Assertion, Metric, RunResult types
    │       ├── schemas/            # Zod validation schemas
    │       └── constants/          # Pricing matrix & default metrics config
    │
    ├── core/                       # @evalgate/core (Engine & Evaluator SDK)
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── providers/          # Vercel AI Gateway, OpenAI, Ollama, Mock Simulator
    │       ├── template/           # {{variable}} interpolation engine
    │       ├── metrics/            # Faithfulness, Hallucination, Relevancy, Coherence, Bias, Dynamic
    │       ├── evaluators/         # Deterministic assertions (JSON schema, syntax, regex)
    │       ├── targets/            # Target handlers (Prompt, ToolCall, RAG, Webhook API)
    │       ├── storage/            # SQLite run storage & historical metrics
    │       ├── runner/             # Parallel test execution & statistics aggregator
    │       └── index.ts
    │
    ├── mcp/                        # @evalgate/mcp (Model Context Protocol Server)
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── tools.ts            # MCP Tool definitions (run_suite, evaluate, compare, estimate_cost)
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

## 4. Phased Implementation Roadmap

We will proceed strictly **phase by phase**, pausing for alignment and approval before each phase begins:

### **Phase 1: Monorepo Foundation & Shared Data Contracts**
- Setup `pnpm-workspace.yaml`, root `package.json`, and shared `tsconfig.base.json`.
- In `packages/shared`:
  - Data contracts: `EvalTarget`, `TestCase`, `Assertion`, `SemanticMetricConfig` (Faithfulness, Relevancy, Hallucination, Coherence, Bias, Dynamic), `SuiteRunResult`.
  - Zod validation schemas for test suites, metrics, and assertion rules.
  - Model pricing matrix (GPT-4o, Claude 3.5 Sonnet, Gemini Flash/Pro, DeepSeek V3/R1, Llama 3.3).

### **Phase 2: Core Engine, Providers & Metric Suite**
- In `packages/core`:
  - Variable templating engine (`{{variable}}` with default fallbacks).
  - Provider adapters: **Vercel AI Gateway** (`VERCEL_AI_GATEWAY_KEY`), direct OpenAI/Groq/Ollama, and offline Mock Simulator.
  - Deterministic assertions (`json_schema`, `python_ast`, `sql_syntax`, `contains`, `regex`, `levenshtein`, `token_budget`, `latency_budget`).
  - Semantic Metric Suite: Faithfulness, Hallucination, Answer Relevancy, Coherence, Bias, Intent, Semantic Similarity, Dynamic Rubrics.
  - Target runners (Prompt, Tool Call, RAG context, Custom Webhook API).
  - SQLite run storage (`.evalgate/runs.db`) and concurrent test runner.

### **Phase 3: Model Context Protocol (MCP) Server**
- In `packages/mcp`:
  - Implement JSON-RPC 2.0 stdio MCP server using `@modelcontextprotocol/sdk`.
  - Expose tools: `evalgate_run_suite`, `evalgate_evaluate`, `evalgate_compare`, `evalgate_estimate_cost`.
  - Create `.agents/skills/evalgate/SKILL.md` and `mcp_config.json`.

### **Phase 4: Terminal CLI**
- In `packages/cli`:
  - Build `evalgate` CLI with `init`, `run <suite.yaml>`, `compare`, `studio`, `mcp`.

### **Phase 5: Interactive Web Studio**
- In `packages/web`:
  - Build React + Vite + Tailwind UI:
    - **Playground & Matrix Runner**: Live editing, variable binding, real-time runs.
    - **Side-by-Side Arena**: Diff completions, compare token counts, latency, and assertions.
    - **Metrics & Judge Builder**: Visual editor for EvalKit-style metrics & custom rubrics.
    - **Regression & History Dashboard**: Historical runs timeline with trend charts.
    - **1-Click Exporter**: Export suites to Python (`pytest`), YAML, and GitHub Actions CI.
  - Embedded local HTTP server to connect Web Studio with `@evalgate/core`.

### **Phase 6: Example Benchmark Suites & End-to-End Verification**
- Create ready-to-run benchmark suites (`rag_qa.yaml`, `sql_generator.yaml`, `classifier.yaml`, `tool_calling.yaml`).
- Verify CLI, MCP server, and Web Studio end-to-end.
- Push clean state to GitHub.
