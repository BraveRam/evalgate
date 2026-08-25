# 🛡️ EvalGate

> Fast, local-first prompt engineering, regression testing, and quality evaluation toolkit built as a **pnpm monorepo** with **Vercel AI Gateway**, **MCP Server**, and **Interactive Web Studio**.

[![pnpm](https://img.shields.io/badge/pnpm-Workspaces-orange?logo=pnpm)](https://pnpm.io)
[![MCP](https://img.shields.io/badge/MCP-Compatible-purple)](https://modelcontextprotocol.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript)](https://www.typescriptlang.org/)

---

## 📦 Monorepo Packages

| Package | Path | Description |
| :--- | :--- | :--- |
| **`@evalgate/shared`** | `packages/shared` | Core types, Zod schemas, assertion definitions & pricing matrix |
| **`@evalgate/core`** | `packages/core` | Evaluator engine, Vercel AI Gateway client, SQLite runner & storage |
| **`@evalgate/mcp`** | `packages/mcp` | Model Context Protocol (MCP) server for AI agents |
| **`@evalgate/cli`** | `packages/cli` | Terminal CLI tool (`evalgate init`, `evalgate run`, `evalgate studio`) |
| **`@evalgate/web`** | `packages/web` | React + Tailwind Web Studio (Playground, Arena, History, Judges) |

---

## 🎯 Key Features

- 🧪 **Deterministic & Semantic Evals**: Test JSON schemas, Python/SQL syntax, regex, Levenshtein distance, token budgets, and latency limits.
- ⚖️ **LLM-as-a-Judge**: Custom grading rubrics (Faithfulness, Coherence, Conciseness, Hallucination, Safety) with reasoning inspection.
- 🌐 **Vercel AI Gateway & Multi-Provider**: 1 key for OpenAI, Anthropic, Gemini, Groq, Mistral, plus local Ollama and offline mock simulator.
- ⚔️ **Side-by-Side Arena**: Compare Prompt A vs Prompt B or Model A vs Model B with visual completion diffs, latency percentiles (P50/P95), and token costs.
- 🤖 **Model Context Protocol (MCP)**: Native stdio MCP server for Antigravity, Cursor, Claude to run evaluations programmatically.
- 📊 **Local Web Studio**: Real-time playground, live test matrix runner, regression history charts, and 1-click export to Python (`pytest`), YAML, and CI.

---

## 📖 Architecture & Plan

See [PLAN.md](PLAN.md) for full architecture specifications and phased execution roadmap.
