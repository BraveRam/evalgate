# PromptForge & EvalKit — Project Architecture & Execution Plan

PromptForge is a fast, local-first prompt engineering, regression testing, and evaluation toolkit built natively on **Bun**. It equips applied AI engineers to iterate rapidly on prompts, run deterministic and LLM-as-a-judge evaluations, benchmark models side-by-side, analyze token/cost regressions, and expose evaluation tools directly to AI agents via **Model Context Protocol (MCP)**.

---

## 1. Core Value Proposition for Applied AI Engineers

1. **Deterministic + Semantic Evals**: Validate outputs with schema assertions (`json_schema`, `python_ast`, `sql_syntax`, `contains`, `regex`, `levenshtein`) and LLM judges (`faithfulness`, `conciseness`, `hallucination_check`, `instruction_following`).
2. **Unified Model Gateway Support**: First-class support for **Vercel AI Gateway** (`VERCEL_AI_GATEWAY_KEY`), direct providers (OpenAI, Anthropic, Gemini, Groq, DeepSeek), local models (**Ollama**, **LM Studio**), and a zero-key **Mock Simulator** for offline development.
3. **Side-by-Side Arena**: Direct comparison of Prompt A vs Prompt B (or Model A vs Model B) with visual completion diffs, latency percentiles (P50/P95), and token cost comparisons.
4. **Agent-Native MCP Integration**: Exposes MCP tools so agents (Antigravity, Cursor, Claude) can evaluate and benchmark prompts programmatically.
5. **Local Bun Performance**: Powered by Bun's native TypeScript runtime, `bun:sqlite` database for fast historical run tracking, and native HTTP server for the Web Studio.

---

## 2. High-Level Architecture

```
 ┌──────────────────────────────────────────────────────────────┐
 │                      PromptForge Studio                      │
 │    (React + Tailwind Web UI: Arena, Matrix, History, Judges) │
 └──────────────────────────────┬───────────────────────────────┘
                                │ HTTP / WebSocket
 ┌──────────────────────────────┴───────────────────────────────┐
 │                   PromptForge Bun Runtime                    │
 │                                                              │
 │  ┌─────────────────┐   ┌────────────────┐   ┌─────────────┐  │
 │  │   CLI Runner    │   │   MCP Server   │   │ API / Studio│  │
 │  │ (Terminal TUI)  │   │  (stdio/JSON)  │   │   Server    │  │
 │  └────────┬────────┘   └───────┬────────┘   └──────┬──────┘  │
 │           └────────────────────┼───────────────────┘         │
 │                                ▼                             │
 │                    ┌──────────────────────┐                  │
 │                    │   Evaluation Core    │                  │
 │                    │  - Template Engine   │                  │
 │                    │  - Assertion Library │                  │
 │                    │  - LLM-as-a-Judge    │                  │
 │                    │  - Cost & Token Calc │                  │
 │                    └──────────┬───────────┘                  │
 │                               ▼                              │
 │         ┌──────────────────────────────────────────┐         │
 │         │          bun:sqlite Runs DB              │         │
 │         │  (Suites, Cases, Histories, Benchmarks)  │         │
 │         └──────────────────────────────────────────┘         │
 └──────────────────────────────┬───────────────────────────────┘
                                ▼
  ┌────────────────────────────────────────────────────────────┐
  │                     Model Providers                        │
  │   Vercel AI Gateway / OpenAI / Anthropic / Gemini / Ollama │
  └────────────────────────────────────────────────────────────┘
```

---

## 3. Directory Structure

```
night-cookin/
├── .agents/
│   └── skills/
│       └── promptforge/
│           └── SKILL.md            # Antigravity agent skill definition
├── examples/
│   ├── rag_qa.yaml                 # RAG Q&A benchmark suite
│   ├── sql_generator.yaml          # Text-to-SQL evaluation suite
│   └── classifier.yaml             # Intent classification suite
├── src/
│   ├── core/                       # Core engine
│   │   ├── types.ts                # TypeScript interfaces (Suite, TestCase, Assertion, Judge, RunResult)
│   │   ├── template.ts             # Template parser & variable injector ({{var}})
│   │   ├── pricing.ts              # Pricing & token calculation matrix (15+ models)
│   │   ├── storage.ts              # bun:sqlite persistence for suites, cases, and run history
│   │   ├── providers/              # LLM provider clients
│   │   │   ├── types.ts
│   │   │   ├── vercel-gateway.ts   # Vercel AI Gateway client
│   │   │   ├── openai.ts           # OpenAI & compatible endpoints (Ollama, LM Studio, Groq, DeepSeek)
│   │   │   ├── anthropic.ts        # Anthropic Claude client
│   │   │   ├── gemini.ts           # Google Gemini client
│   │   │   ├── mock.ts             # Offline mock simulator
│   │   │   └── index.ts            # Provider factory & dispatcher
│   │   ├── evaluators/             # Assertion and judging logic
│   │   │   ├── deterministic.ts    # contains, regex, json_schema, python_syntax, sql_syntax, levenshtein
│   │   │   ├── judge.ts            # LLM-as-a-judge execution & rubric scoring
│   │   │   └── index.ts
│   │   └── runner.ts               # Concurrent test suite execution & stats collector
│   ├── mcp/
│   │   ├── tools.ts                # MCP tool definitions
│   │   └── server.ts               # MCP stdio JSON-RPC server
│   ├── cli/
│   │   ├── commands/
│   │   │   ├── init.ts             # Scaffold starter suites
│   │   │   ├── run.ts              # Run suite with pretty terminal output
│   │   │   ├── compare.ts          # Side-by-side prompt/model CLI benchmark
│   │   │   ├── studio.ts           # Launch local Web Studio
│   │   │   └── mcp.ts              # Launch MCP server
│   │   └── index.ts                # Main CLI entry point
│   ├── server/
│   │   ├── api.ts                  # Bun HTTP REST routes for Studio
│   │   └── index.ts                # Studio server entrypoint (serves API + static Web UI)
│   └── web/                        # React + Tailwind SPA
│       ├── src/
│       │   ├── components/
│       │   │   ├── Header.tsx
│       │   │   ├── Playground.tsx  # Interactive prompt editor & live test runner
│       │   │   ├── Arena.tsx       # Prompt A vs B / Model A vs B comparison
│       │   │   ├── SuiteEditor.tsx # Test suite & dataset manager
│       │   │   ├── JudgeConfig.tsx # Visual LLM-as-a-Judge builder
│       │   │   ├── RunHistory.tsx  # Historical regression & latency charts
│       │   │   └── ExportModal.tsx # Export to Python pytest, YAML, GitHub Actions
│       │   ├── App.tsx
│       │   ├── main.tsx
│       │   └── index.css
│       ├── index.html
│       └── vite.config.ts
├── mcp_config.json                 # MCP registration config
├── package.json
├── tsconfig.json
├── PLAN.md
└── README.md
```

---

## 4. Phased Step-by-Step Implementation Roadmap

### **Phase 1: Project Setup & Core Types**
- Initialize `package.json` with Bun scripts and dependencies (`@modelcontextprotocol/sdk`, `zod`, `yaml`, `picocolors`, `cli-table3`, etc.).
- Setup `tsconfig.json`.
- Implement `src/core/types.ts` defining data models: `PromptTemplate`, `TestCase`, `Assertion`, `JudgeConfig`, `SuiteRunResult`, `MetricSummary`.

### **Phase 2: Providers, Templating & Pricing**
- Implement `template.ts`: Variable interpolation `{{var}}`, default fallbacks, extracted variable names.
- Implement `pricing.ts`: Token counter approximation and exact pricing table for GPT-4o, GPT-4o-mini, Claude 3.5 Sonnet, Gemini 1.5/2.0 Flash/Pro, DeepSeek-V3/R1, Llama 3.3.
- Implement unified providers in `src/core/providers/`:
  - `vercel-gateway.ts` (Vercel AI Gateway unified routing)
  - `openai.ts` (Direct OpenAI, Groq, Ollama, LM Studio)
  - `mock.ts` (Zero-key offline simulator for instant smoke tests)
  - `index.ts` provider registry.

### **Phase 3: Assertion Library, LLM-as-a-Judge & SQLite Storage**
- Implement deterministic assertions (`contains`, `not_contains`, `regex`, `json_schema`, `python_ast`, `sql_syntax`, `levenshtein`, `max_latency`, `max_tokens`, `max_cost`).
- Implement LLM-as-a-judge evaluator with structured JSON grading output and rubric scoring.
- Implement `storage.ts` using native `bun:sqlite` to store test suites, test cases, and historical run results.
- Implement `runner.ts` for concurrent evaluation and statistical aggregation (pass rate, P50/P95 latency, total cost).

### **Phase 4: MCP Server & Antigravity Skill Integration**
- Implement `src/mcp/server.ts` with tools:
  - `promptforge_run_suite`
  - `promptforge_evaluate`
  - `promptforge_compare`
  - `promptforge_estimate_cost`
- Create `mcp_config.json` and `.agents/skills/promptforge/SKILL.md`.

### **Phase 5: Bun CLI Experience**
- Implement terminal CLI with colored output, tables, and progress indicators:
  - `bun run cli init`
  - `bun run cli run <suite.yaml>`
  - `bun run cli compare`
  - `bun run cli studio`
  - `bun run cli mcp`

### **Phase 6: Interactive Web Studio**
- Build React + Tailwind UI:
  - **Playground & Matrix Runner**: Live editing, variable binding, real-time runs.
  - **Side-by-Side Arena**: Diff completions, compare token counts, latency, and assertions.
  - **Judge Builder & Inspector**: Rubric configuration and reasoning breakdown.
  - **History Dashboard**: Regression metrics over time.
  - **Export Center**: Export suites to Python `pytest`, TypeScript, YAML, and CI workflows.
- Connect Studio to Bun HTTP backend.

### **Phase 7: Testing, Examples & Verification**
- Create example test suites (`rag_qa.yaml`, `sql_generator.yaml`, `classifier.yaml`).
- Verify CLI, MCP, and Web Studio end-to-end.
- Push to GitHub and verify clean status.
