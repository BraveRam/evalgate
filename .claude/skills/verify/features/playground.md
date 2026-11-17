# Playground

Playground provides an ad-hoc scratchpad for rapidly drafting prompts, testing template variable interpolation, configuring assertions, and inspecting completions in real time.

## Sub-features

- `playground-compose`: Write prompt templates with `{{variable}}` syntax and system instructions.
- `playground-vars`: Define JSON or key-value variable dictionaries injected into the template.
- `playground-assertions`: Configure deterministic assertions (contains, regex, json_schema, python_ast, sql_syntax) and semantic LLM judges.
- `playground-run`: Execute single-case evaluations and inspect execution latency, token counts, and assertion scores.

## How to get to it (user POV)

- Navigate to `http://localhost:3000/playground` directly.
- Or click the `Playground` navigation link in the studio sidebar.

## Driving it with browser-mcp

Preconditions:
- EvalGate Studio is running at `http://localhost:3000`.
- EvalGate API is healthy at `http://127.0.0.1:8000`.

- **Open Playground.** Navigate to `http://localhost:3000/playground` via `browser_navigate`.
  - Result: Editor panels appear for System Prompt, Prompt Template, Variables Payload, and Assertions.
- **Enter Prompt & Variables.** Input prompt template (e.g. `Summarize the key announcement: {{text}}`) and variable JSON (`{"text": "EvalGate 2.0 released today."}`).
- **Add Assertion.** Add an assertion (e.g. `contains` with value `EvalGate`).
- **Run Evaluation.** Click the `Run Test` / `Play` button.
  - Result: Completion output appears in the output panel alongside token usage, latency (ms), and assertion pass/fail badges.
- **Proof.** Capture a screenshot using `browser_screenshot` saving to `.agents/skills/verify/artifacts/playground/run.png`.

## Gotchas

- Missing template variables will trigger an explicit interpolation error badge.
- Semantic assertions require a configured judge model API key, while deterministic assertions run locally at zero cost.
