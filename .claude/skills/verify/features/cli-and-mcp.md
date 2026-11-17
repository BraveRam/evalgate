# CLI & MCP Surfaces

EvalGate provides a full-featured terminal CLI (`evalgate`) and a Model Context Protocol (MCP) server for headless automation, CI/CD regression gates, and agent IDE integration alongside the Studio.

## Sub-features

- `cli-run`: Execute YAML test suites with pass/fail exit codes (`0` on pass, `1` on regression/gate failure).
- `cli-compare`: Benchmark two LLMs head-to-head in terminal tables.
- `cli-cost`: Generate pre-flight token volume and USD cost projections (`--json` supported).
- `cli-fuzz`: Synthesize deterministic edge-case and adversarial test cases directly into YAML suites.
- `cli-baseline`: Snapshot and export baseline regression JSON files for CI.
- `mcp-tools`: Model Context Protocol server exposing suite running, cost estimation, and telemetry tools over stdio/sse.

## How to get to it (user POV)

- Terminal CLI: `uv run evalgate <command>` or `.venv/bin/python -m evalgate.cli.main <command>`.
- MCP Server: `uv run evalgate mcp --transport stdio` or `.venv/bin/python -m evalgate.cli.main mcp`.

## Driving it with control-evalgate

Preconditions:
- Python virtual environment is available with dependencies (`uv sync` or `.venv`).
- Test suite YAML exists (e.g. `evals/classifier.yaml`).

- **Pre-flight Cost Projection.** Run `uv run evalgate cost evals/classifier.yaml --json`.
  - Result: Exit code `0`; stdout contains JSON with `estimated_input_tokens`, `estimated_output_tokens`, and `estimated_cost_usd`.
- **Suite Fuzzing.** Run `uv run evalgate fuzz evals/classifier.yaml --max-cases 2 --json`.
  - Result: Exit code `0`; stdout contains synthesized edge cases across categories.
- **Run Suite Execution.** Run `uv run evalgate run evals/classifier.yaml --repeat 1`.
  - Result: Formatted Rich table displays test case statuses; process exits with `0` when `min_pass_rate` is met, or `1` on failure.
- **MCP Server Stdio Handshake.** Run `uv run evalgate mcp` in stdio mode and send an MCP initialize JSON-RPC payload.
  - Result: Returns registered tools (`evalgate_run_suite`, `evalgate_estimate_cost`, `evalgate_fuzz_suite`, etc.).
- **Proof.** Save CLI execution outputs and JSON payloads to `.agents/skills/verify/artifacts/cli/`.

## Gotchas

- CLI regression failures intentionally exit with code `1` to fail CI/CD pull request gates.
- When dry-running or executing suites with real frontier models from the CLI, ensure provider environment variables (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc.) are set or use `mock/simulator`.
