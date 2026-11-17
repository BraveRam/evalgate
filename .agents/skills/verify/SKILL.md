---
name: verify
description: "Drive and verify EvalGate Developer Studio and core evaluation engine locally using browser-mcp. Launch instances, run doctor diagnostics, exercise user journeys across Suites, Prompt Arena, Playground, and Analytics, and capture visual/DOM proof."
---

# Verify EvalGate

Use this skill to launch, diagnose, drive, and verify all user-facing surfaces of **EvalGate**:
1. **Developer Studio** (Next.js web UI at `http://localhost:3000` backed by FastAPI at `http://127.0.0.1:8000`) driven via **browser-mcp**.
2. **Terminal CLI** (`evalgate run`, `cost`, `fuzz`, `compare`, `baseline`) for local automation and CI/CD quality gates.
3. **MCP Server** (`evalgate mcp`) exposing evaluation tools to coding agents.

---

## 1. Launch

Start isolated local backend and frontend instances in the background.

```bash
.agents/skills/verify/bin/control-evalgate launch
```

### Readiness Check
`control-evalgate launch` automatically polls and verifies that both services answer with HTTP 200:
- FastAPI API: `http://127.0.0.1:8000/health` -> `{"status": "ok", ...}`
- Next.js Studio: `http://localhost:3000` -> HTTP 200

Process PIDs and ports are tracked in `.evalgate-verify/running.json`. Logs are written to `.evalgate-verify/logs/`.

---

## 2. Doctor

Run a single, read-only diagnostic check before driving:

```bash
.agents/skills/verify/bin/control-evalgate doctor
```

- Returns **exit code 0** ("Doctor PASS") if both the backend API and Next.js Studio are answering HTTP 200 and ports are healthy.
- Returns **exit code 1** ("Doctor FAIL") with actionable error logs if any service is down or unreachable.

Always run `doctor` first before executing any browser steps.

---

## 3. Drive with browser-mcp

Drive the web app through **browser-mcp** tools rather than raw scripts:

1. **Navigate to route**:
   Call `call_mcp_tool` with `ServerName: "browser-mcp"`, `ToolName: "browser_navigate"`, `Arguments: {"url": "http://localhost:3000/<route>"}`.
   - Primary routes:
     - `/suites`: Evaluation Suites, test matrix, edge-case fuzzer modal, and live run streaming.
     - `/prompt-arena`: Head-to-head prompt A/B comparisons on a single model.
     - `/playground`: Ad-hoc prompt scratchpad, variables, and assertion validation.
     - `/analytics`: Time-series pass rate/latency telemetry and regression history.

2. **Interact with UI**:
   - Inspect page structure: `browser_get_page_content`.
   - Click accessible buttons/tabs: `browser_click` with text/selector (e.g. `button:has-text("Generate Edge Cases")`).
   - Fill inputs: `browser_fill` with target selector and value.
   - Wait for animations or network requests: `browser_wait` or `browser_wait_for_network`.

3. **Feature Map Recipes**:
   Consult `.agents/skills/verify/features/README.md` and feature-specific files for step-by-step driving recipes:
   - `features/suites-and-fuzzing.md`
   - `features/prompt-arena.md`
   - `features/playground.md`
   - `features/analytics-and-history.md`

---

## 4. Evidence & Proof Standards

Every verification run must produce concrete proof:

1. **Visual proof**: Save screenshots to `.agents/skills/verify/artifacts/<feature-name>/<step-name>.png` via `browser_screenshot`:
   ```json
   {
     "path": ".agents/skills/verify/artifacts/suites/fuzz_modal.png"
   }
   ```
2. **DOM/State proof**: Confirm expected text or DOM elements are present (e.g. `CANDIDATE EDGE CASES`, pass rate badges, or completion outputs).
3. **Storage proof**: For state mutations (e.g. saving synthesized edge cases), verify that the YAML file (`evals/<suite>.yaml`) or database record reflects the update.
4. **Artifact persistence**: Proof artifacts stored under `.agents/skills/verify/artifacts/` **must survive cleanup**. Never delete proof artifacts during teardown.

---

## 5. Cleanup

Tear down the running instances started for verification:

```bash
.agents/skills/verify/bin/control-evalgate cleanup
```

- Gracefully terminates the process group for the API and frontend servers.
- Removes `.evalgate-verify/running.json`.
- Preserves all captured screenshots and evidence in `.agents/skills/verify/artifacts/`.

---

## 6. Helpers

Lifecycle helper script:
```bash
.agents/skills/verify/bin/control-evalgate [launch|doctor|cleanup] [--api-port 8000] [--client-port 3000]
```
