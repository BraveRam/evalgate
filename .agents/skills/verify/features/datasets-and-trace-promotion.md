# External Datasets & Trace Promotion

External Datasets & Trace Promotion allows suites to reference external CSV/JSON/JSONL test files and enables 1-click promotion of failed evaluation traces directly into standalone regression test cases without editing YAML suites by hand.

## Sub-features

- `dataset-linking`: Load test cases dynamically from `dataset: cases.csv` or `dataset: cases.jsonl` files alongside embedded YAML tests.
- `trace-save-ui`: Click `Save as Test Case` on any failing or interesting attempt in Suite Execution or Analytics to open the scrubber modal.
- `trace-scrub-sanitize`: Scrub confidential inputs, edit variables/assertions/expected answers, and strip transient execution metadata before saving.
- `trace-persistence`: Persist the scrubbed test case into an external `.jsonl` regression dataset (e.g. `evals/<suite>.regressions.jsonl`) that the suite automatically tracks.
- `mcp-save-trace`: Programmatically promote traces into dataset files via the `evalgate_save_trace_to_dataset` MCP tool.

## How to get to it (user POV)

- In **Suites & Test Matrix**: Run a suite, expand the completed run results, and click `Save as Test Case` on an attempt.
- In **Analytics & Trends**: Open any historical run inspection modal and click `Save as Test Case` next to a test result.
- In **Suite Overview**: Check the `Dataset:` badge under the suite title.

## Driving it with browser-mcp

Preconditions:
- EvalGate Studio is running at `http://localhost:3000`.
- EvalGate API is healthy at `http://127.0.0.1:8000`.
- An evaluation run exists for a suite (e.g. `support-ticket-classifier`).

- **Open Analytics & Inspect Run.** Navigate to `http://localhost:3000/analytics` via `browser_navigate` and click a run row.
  - Result: Inspection dialog opens displaying test results with tokens, latency, cost, and a `Save as Test Case` button.
- **Open Save as Test Case Modal.** Click `Save as Test Case` on a test item.
  - Result: The `Save as Test Case` dialog opens displaying Test ID, Description, Target Dataset filename (e.g. `evals/<suite>.regressions.jsonl`), editable Variables JSON, Ground Truth, and Assertion chips.
- **Scrub & Save.** Edit the Test ID (e.g. `reg-case-1`) and click `Save to Dataset`.
  - Result: Modal closes; the case is appended to `evals/<suite>.regressions.jsonl`, and the suite YAML now automatically includes this test without mutating the YAML file.
- **Proof.** Capture a screenshot of the Save as Test Case modal using `browser_screenshot` saving to `.agents/skills/verify/artifacts/datasets/save_as_test_modal.png`.

## Gotchas

- Target dataset files must be JSONL (`.jsonl`), not CSV or arbitrary extensions, to allow atomic appending.
- Attempting to save a test ID that already exists in the suite or dataset returns HTTP 409 to prevent accidental overwrites.
- Path traversal sequences (`..`) in dataset filenames are strictly blocked by the backend API.
