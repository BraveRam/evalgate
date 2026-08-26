# 🛡️ EvalGate

> Fast, local-first prompt engineering, regression testing, and quality evaluation platform for applied AI engineers. Built with **Python (`uv`)**, **FastAPI**, **LangChain/LangGraph**, **Next.js**, and **Model Context Protocol (MCP)**.

[![Python](https://img.shields.io/badge/Python-3.11+-blue?logo=python)](https://python.org)
[![uv](https://img.shields.io/badge/uv-Astral-purple)](https://astral.sh/uv)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![LangChain](https://img.shields.io/badge/LangChain-LangGraph-darkgreen)](https://langchain.com)
[![Next.js](https://img.shields.io/badge/Next.js-15+-black?logo=next.js)](https://nextjs.org)
[![MCP](https://img.shields.io/badge/MCP-Compatible-purple)](https://modelcontextprotocol.io)

---

## 🎯 Key Features

- 🧪 **Deterministic & Semantic Evals**: Test JSON schemas, Python/SQL AST, regex, Levenshtein distance, token budgets, and latency limits.
- ⚖️ **Comprehensive Semantic Metrics**: Faithfulness / Groundedness, Hallucination Detection, Answer Relevancy, Coherence, Bias/Toxicity, Intent Adherence, and Dynamic Rubrics.
- 🌐 **Vercel AI Gateway & Multi-Provider**: 1 key for OpenAI, Anthropic, Gemini, Groq, Mistral, plus local Ollama and offline mock simulator.
- ⚔️ **Side-by-Side Arena**: Compare Prompt A vs Prompt B or Model A vs Model B with visual completion diffs, latency percentiles (P50/P95), and token costs.
- 🤖 **Model Context Protocol (MCP)**: Official Python FastMCP server for Antigravity, Cursor, Claude to run evaluations programmatically.
- 💻 **Rich Terminal CLI**: Beautiful colored tables, progress bars, and CI exit codes powered by Typer & Rich.
- 📊 **Next.js Web Studio**: Real-time playground, live test matrix runner, regression history charts, and 1-click export to Python (`pytest`), YAML, and CI.

---

## 📖 Architecture & Plan

See [PLAN.md](PLAN.md) for full architecture specifications and phased execution roadmap.
