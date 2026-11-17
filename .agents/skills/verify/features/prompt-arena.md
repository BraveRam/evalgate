# Prompt Arena

Prompt Arena enables side-by-side comparative benchmarking of two prompt variations (Prompt A vs. Prompt B) against the exact same test suite cases on a chosen model.

## Sub-features

- `arena-select-suite`: Choose an existing model-backed evaluation suite as the baseline benchmark.
- `arena-edit-prompts`: Modify templates and system instructions for Variant A and Variant B.
- `arena-estimate`: Perform pre-flight token volume and cost projection across both prompt candidates.
- `arena-compare`: Execute Prompt Arena run and view side-by-side win/loss metrics, latency deltas, and output completions.
- `arena-apply`: Atomically apply the winning prompt variant back to the suite YAML on disk.

## How to get to it (user POV)

- Navigate to `http://localhost:3000/prompt-arena` directly.
- Or click the `Prompt Arena` navigation link in the studio sidebar.

## Driving it with browser-mcp

Preconditions:
- EvalGate Studio is running at `http://localhost:3000`.
- EvalGate API is healthy at `http://127.0.0.1:8000`.
- A suite with `type: prompt` or `type: structured_output` exists in `evals/`.

- **Open Prompt Arena.** Navigate to `http://localhost:3000/prompt-arena` via `browser_navigate`.
  - Result: The Prompt Arena view loads with Suite Selection, Model Selection, Prompt A editor, and Prompt B editor.
- **Select Suite.** Select a suite from the suite selector dropdown (e.g. `support-ticket-classifier`).
  - Result: Prompt A is populated with the suite's existing template and system prompt.
- **Configure Variant B.** Edit the Prompt B template (e.g. append instructions or few-shot formatting).
- **Run comparison.** Click `Start Comparison` (or `Estimate Cost` first).
  - Result: Side-by-side comparison metrics appear: pass rate delta, P50 latency delta, token diffs, and completion diff viewer.
- **Proof.** Capture a screenshot using `browser_screenshot` saving to `.agents/skills/verify/artifacts/prompt-arena/comparison.png`.

## Gotchas

- Webhook suites (`type: webhook`) cannot be compared in Prompt Arena.
- If the suite file changes on disk during an arena experiment, applying the prompt returns HTTP 409 to prevent overwriting conflicting changes.
