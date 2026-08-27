# 🛡️ EvalGate

> Fast, local-first prompt engineering, regression testing, and quality evaluation platform for applied AI engineers. Built with **Python (`uv`)**, **FastAPI**, **LangChain/LangGraph**, **Next.js**, and **Model Context Protocol (MCP)**.

[![Python](https://img.shields.io/badge/Python-3.11+-blue?logo=python)](https://python.org)
[![uv](https://img.shields.io/badge/uv-Astral-purple)](https://astral.sh/uv)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![LangChain](https://img.shields.io/badge/LangChain-LangGraph-darkgreen)](https://langchain.com)
[![Next.js](https://img.shields.io/badge/Next.js-15+-black?logo=next.js)](https://nextjs.org)
[![Turborepo](https://img.shields.io/badge/Turborepo-Monorepo-ef4444?logo=turborepo)](https://turbo.build)
[![MCP](https://img.shields.io/badge/MCP-Compatible-purple)](https://modelcontextprotocol.io)

---

## 📚 Documentation & Reference

For the comprehensive guide covering all system components, targets, deterministic & LLM judge metrics, LangGraph runner, MCP server, API endpoints, and Next.js Web Studio:

👉 **[Read the Full Feature Documentation (`DOCUMENTATION.md`)](DOCUMENTATION.md)**

---

## 🎯 Key Features

- 🧪 **Deterministic & Semantic Evals**: Test JSON schemas, regex, Levenshtein distance, token budgets, and latency limits.
- ⚖️ **Comprehensive Semantic Metrics**: Faithfulness, Hallucination Detection, Answer Relevancy, Coherence, Bias/Toxicity, Intent Adherence, and Dynamic Judge Rubrics.
- 🌐 **Vercel AI Gateway & Multi-Provider**: 1 key for OpenAI, Anthropic, Gemini, DeepSeek, Groq, Mistral, plus an offline zero-cost mock simulator.
- ⚔️ **Side-by-Side Arena**: Compare Prompt A vs Prompt B or Model A vs Model B with visual completion diffs, latency percentiles (P50/P95), and token costs.
- 🤖 **Model Context Protocol (MCP)**: Python stdio MCP server for Antigravity, Cursor, Claude Desktop to run evaluations programmatically.
- 💻 **Rich Terminal CLI**: Beautiful colored tables, progress bars, and CI quality gate exit codes powered by Typer & Rich.
- 📊 **Next.js Web Studio**: Real-time prompt sandbox playground, live streaming test matrix runner, regression history charts, and 1-click CI exporter.

---

## 🚀 Quick Start

### 1. Monorepo Installation

```bash
# Install Python virtual environment & dependencies
uv sync

# Install Node & Turborepo dependencies
pnpm install
```

### 2. Run the Web Studio

```bash
# Terminal 1: Start FastAPI backend (http://127.0.0.1:8000)
pnpm dev:api

# Terminal 2: Start Next.js Studio (http://localhost:3000)
pnpm dev:client
```

### 3. Run via Terminal CLI

```bash
# Run a test suite with quality gate enforcement
uv run evalgate run evals/rag_qa.yaml

# Side-by-side A/B model arena shootout
uv run evalgate compare evals/hard_reasoning_challenge.yaml \
  --model-a openai/gpt-4o-mini \
  --model-b deepseek/deepseek-v4-pro-0813
```
