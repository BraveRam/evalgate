# EvalGate Studio

The local web client for suites, prompt experiments, model comparisons, run history, and documentation.

## Run locally

From the repository root, install dependencies with `uv sync --locked` and
`pnpm install --frozen-lockfile`, then start the backend and client in separate terminals:

```bash
pnpm dev:api
pnpm dev:client
```

Studio runs at http://localhost:3000. The backend runs at http://127.0.0.1:8000.
See the root README for provider configuration.

## Prompt Arena

Open **Prompt Arena** in the sidebar, select a model-backed suite and shared model,
and edit prompt A and B. The selected model uses automatic provider routing, including
a configured AI gateway, instead of inheriting the suite's provider override.
Set repeated attempts, review the combined estimate, and start the comparison. Inspect pass rates, latency, target cost, side-by-side outputs,
and per-attempt evidence. Saved comparisons include the source suite and settings
and remain available after refresh.

Apply A or B to change only template and system instructions in the source suite.
Changed suites are rejected rather than overwritten. Model selection during the
experiment does not change the suite's saved model. Detailed instructions and API
examples are at http://localhost:3000/docs/prompt-arena.

The Studio documentation source is `src/lib/docs-data.tsx`; documentation navigation
is in `src/components/docs/DocsLayoutClient.tsx`.

## Check changes

From the repository root:

```bash
pnpm --filter @evalgate/client lint
pnpm --filter @evalgate/client build
pnpm --filter @evalgate/client exec tsc --noEmit
pnpm --filter @evalgate/client exec playwright install chromium
pnpm test:e2e
```

Browser tests build production Studio and start a disposable mock backend on ports
3100 and 8100. They exercise repeated suites, Prompt Arena, and documentation routes
without paid model calls. Generated reports and traces are ignored by Git and ESLint.
