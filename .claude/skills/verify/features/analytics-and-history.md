# Analytics & History

Analytics & History provides a time-series telemetry dashboard of past evaluation runs, pass-rate trends, P50/P95 latency percentiles, and baseline regression comparisons.

## Sub-features

- `analytics-summary`: View high-level metrics across all suites (total runs, average pass rate, cumulative token spend).
- `analytics-trends`: Inspect interactive time-series charts for pass rates, latencies, and token costs over time.
- `analytics-run-history`: Browse table of all historical runs with filtering by suite name.
- `analytics-baseline-diff`: Inspect detailed baseline regression diffs showing newly failing test cases and token/cost deltas.

## How to get to it (user POV)

- Navigate to `http://localhost:3000/analytics` directly.
- Or click the `Analytics` navigation link in the studio sidebar.

## Driving it with browser-mcp

Preconditions:
- EvalGate Studio is running at `http://localhost:3000`.
- EvalGate API is healthy at `http://127.0.0.1:8000`.
- At least one run has been saved to SQLite (`.evalgate/runs.db`).

- **Open Analytics.** Navigate to `http://localhost:3000/analytics` via `browser_navigate`.
  - Result: Telemetry summary cards (Pass Rate, Latency, Runs) and historical chart views render.
- **Inspect Runs Table.** Scroll down to the recent evaluation runs list.
  - Result: Table displays run IDs, suite names, model targets, timestamps, and pass/fail badges.
- **Inspect Run Detail.** Click a specific run row.
  - Result: Detailed trace drawer or view opens showing per-test results, assertion failure reasons, and raw model completions.
- **Proof.** Capture a screenshot using `browser_screenshot` saving to `.agents/skills/verify/artifacts/analytics/overview.png`.

## Gotchas

- If the local SQLite database (`.evalgate/runs.db`) is empty, placeholder cards state "No evaluation runs recorded yet". Run a suite in CLI or Studio first to populate records.
