# Suites & Test Matrix

Suites & Test Matrix allows users to explore YAML evaluation suites, review individual test cases and assertions, synthesize deterministic edge cases via suite fuzzing, and stream live evaluation test runs.

## Sub-features

- `suites-list`: Browse discovered YAML evaluation suites with pass/fail health indicators and test counts.
- `suites-inspect-cases`: View detailed prompt templates, variables payload, and assertion rules for individual test cases.
- `suites-fuzz-generate`: Synthesize edge cases across categories (empty, injection, escaping, boundary, unicode) and dry-run them.
- `suites-fuzz-save`: Select candidate edge cases and save them directly into the YAML test suite on disk.

## How to get to it (user POV)

- Navigate to `http://localhost:3000/suites` directly.
- Or click the `Suites` navigation link in the studio sidebar.

## Driving it with browser-mcp

Preconditions:
- EvalGate Studio is running at `http://localhost:3000`.
- EvalGate API is healthy at `http://127.0.0.1:8000`.
- At least one test suite exists in `evals/` (e.g. `evals/classifier.yaml`).

- **Open Suites page.** Navigate to `http://localhost:3000/suites` using `browser_navigate`.
  - Result: Page title displays "Evaluation Suites & Test Matrix" and the left column lists all discovered suites.
- **Select suite.** Click on a suite (e.g. `support-ticket-classifier`).
  - Result: Right column displays the suite overview, architecture badge, test case count, and tab list (`Overview`, `Test Cases`, `History`, `YAML Source`).
- **Inspect test cases.** Click the `Test Cases` tab.
  - Result: Test matrix displays individual test cases (e.g. `#urgent-billing-case`). Clicking a case expands its variable payload and assertions.
- **Open Edge Case Generator.** Click the `Generate Edge Cases` button in the suite action bar.
  - Result: A dialog opens titled `Generate Edge Cases: support-ticket-classifier` with category buttons (`Empty / Whitespace`, `Prompt Injection`, etc.) and a count input.
- **Synthesize cases.** Click `Synthesize Cases` (or `Synthesize & Dry-Run`).
  - Result: Candidate edge cases appear with test IDs (e.g. `urgent-billing-case-fuzz-empty`), mutation descriptions, and inherited structural assertions.
- **Proof.** Capture a screenshot using `browser_screenshot` saving to `.agents/skills/verify/artifacts/suites/fuzz_modal.png`.

## Gotchas

- If no suite is selected, the right column displays a placeholder prompt to select a suite.
- Dry-running edge cases calls the model/simulator and may take a few seconds depending on concurrency and network.
- Ensure the dialog is closed before navigating away to avoid blocking overlays.
