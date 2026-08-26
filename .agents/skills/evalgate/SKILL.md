---
name: evalgate
description: "Prompt regression testing, LLM-as-a-judge evaluation gates, and model benchmark shootout tools for Antigravity."
---

# EvalGate Skill for Antigravity & Agentic Pair Programmers

Use this skill whenever you or the user are:
1. Modifying prompt templates, system instructions, or few-shot examples.
2. Implementing or refactoring RAG pipelines, LLM tools, or structured output schemas.
3. Comparing multiple models (e.g. GPT-4o-mini vs Claude 3.5 Sonnet vs DeepSeek).
4. Verifying quality gates and preventing prompt regressions before committing code.

---

## Available MCP Tools

### 1. `evalgate_run_suite`
Executes an evaluation suite YAML file and enforces pass/fail quality gates.
- **Parameters**:
  - `suite_path` (str, required): Path to YAML suite (e.g. `evals/rag_qa.yaml`).
  - `model_override` (str, optional): Target model override (e.g. `openai/gpt-4o-mini`).
  - `concurrency` (int, default 10): Parallel test count.
- **When to use**: After editing prompt templates or system instructions, call this to verify that all test assertions pass (100% gate).

### 2. `evalgate_estimate_cost`
Calculates pre-flight estimated token usage and inference cost for an evaluation suite without running it.
- **Parameters**:
  - `suite_path` (str, required): Path to YAML suite (e.g. `evals/rag_qa.yaml`).
  - `model` (str, optional): Target model override to calculate costs against.
  - `estimated_output_tokens_per_test` (int, default 150): Estimated completion tokens per test.
- **When to use**: Before launching large or expensive evaluation benchmarks to project token usage and USD cost.

### 3. `evalgate_compare_models`
Runs an A/B benchmark shootout between two LLMs on the same evaluation suite.
- **Parameters**:
  - `suite_path` (str, required): Path to YAML suite.
  - `model_a` (str, required): Model A (e.g. `openai/gpt-4o-mini`).
  - `model_b` (str, required): Model B (e.g. `deepseek/deepseek-v4-pro-0813`).
- **When to use**: To help the user choose the best model for their workload based on pass rate, latency, and cost deltas.

### 4. `evalgate_evaluate_completion`
Evaluates any raw LLM text completion on-the-fly against assertion configs without needing a saved YAML file.
- **Parameters**:
  - `completion` (str, required): The LLM output string to evaluate.
  - `assertions` (list[dict], required): Assertions to evaluate (e.g. `[{"type": "contains", "value": "active = 1"}, {"type": "faithfulness", "threshold": 0.85}]`).
  - `context` (list[str], optional): Retrieved document chunks (for RAG faithfulness/hallucination).
  - `ground_truth` (str, optional): Reference answer.
- **When to use**: To quickly sanity-check intermediate prompt responses during development.

### 4. `evalgate_list_suites`
Discovers all evaluation suites available in the project repository.
- **Parameters**: `search_dir` (str, default: `evals`).

### 5. `evalgate_list_runs` & `evalgate_get_historical_trends`
Queries the local SQLite database to inspect historical test execution runs and time-series regression trends.

---

## Best Practices for Agents
1. **Always verify prompt changes**: When editing prompts in the codebase, locate the corresponding evaluation suite in `evals/` and run `evalgate_run_suite`.
2. **Flag regressions early**: If an assertion fails, report the failing test case ID and reasons to the user with actionable suggestions.
