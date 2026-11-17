# EvalGate Studio verification map

This directory is the maintained source for verifying the user-facing behavior of the EvalGate Developer Studio. Read this index before driving the app, then use the matching feature file as the recipe.

## Baseline preconditions

- Launch EvalGate using `.agents/skills/verify/bin/control-evalgate launch`.
- Next.js Studio is accessible at `http://localhost:3000`.
- FastAPI REST/WebSocket backend is accessible at `http://127.0.0.1:8000`.
- Run `.agents/skills/verify/bin/control-evalgate doctor` and require HTTP 200 on both services.
- Never drive an instance that was not started or verified by this run.

## Driving conventions

- Drive the user-facing web app using the native **browser-mcp** tools (`browser_navigate`, `browser_screenshot`, `browser_click`, `browser_fill`, `browser_get_page_content`, `browser_wait`).
- Start every recipe by navigating to the desired route (`http://localhost:3000/<route>`).
- Prefer visible text, accessible roles (headings, buttons, inputs, tabs), and ARIA labels over brittle CSS class selectors.
- Capture proof artifacts into `.agents/skills/verify/artifacts/<feature-slug>/`.
- Retain all proof artifacts during and after cleanup; never delete evidence files during `cleanup`.

## Proof standards

- **Visual proof**: Save full/viewport screenshots using `browser_screenshot` with `path: ".agents/skills/verify/artifacts/<feature-slug>/<step>.png"`.
- **DOM proof**: Inspect text content or modal state with `browser_get_page_content`.
- **Side effect proof**: Validate disk state (e.g. YAML suite mutations, SQLite run entries) alongside what is visually rendered on screen.
- Report any unreachable path with the exact interaction attempted and the unmet precondition.

## Features

- [Suites & Test Matrix](./suites-and-fuzzing.md) covers viewing test suites, inspecting test cases, generating edge cases via deterministic fuzzing, and live execution.
- [Prompt Arena](./prompt-arena.md) covers A/B prompt comparisons on a selected model, pre-flight cost estimation, diff inspection, and guarded apply.
- [Playground](./playground.md) covers ad-hoc prompt testing with template variables, assertion validation, and instant completion inspection.
- [Analytics & History](./analytics-and-history.md) covers historical evaluation runs, pass rate/latency telemetry trends, and baseline regression comparisons.
- [External Datasets & Trace Promotion](./datasets-and-trace-promotion.md) covers external CSV/JSON/JSONL dataset support and 1-click promotion of failed traces into regression test cases.
- [CLI & MCP Surfaces](./cli-and-mcp.md) covers headless test execution, cost estimation, baseline exports, suite fuzzing, and MCP server tools for IDE/agent integration.

