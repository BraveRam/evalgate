# ⚡ PromptForge & EvalKit

> Fast, local-first prompt engineering, regression testing, and evaluation toolkit built natively on **Bun** with **Vercel AI Gateway**, **MCP Server**, and **Interactive Web Studio**.

[![Bun](https://img.shields.io/badge/Bun-1.3+-black?logo=bun)](https://bun.sh)
[![MCP](https://img.shields.io/badge/MCP-Compatible-purple)](https://modelcontextprotocol.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript)](https://www.typescriptlang.org/)

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
