import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const root = path.resolve(__dirname, "../..");
const apiURL = "http://127.0.0.1:8100";
const studioURL = "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: studioURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      name: "Mock evaluation API",
      command: "uv run --locked python scripts/e2e_api.py",
      cwd: root,
      url: `${apiURL}/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
    },
    {
      name: "Production Studio",
      command: "pnpm --filter @evalgate/client build && pnpm --filter @evalgate/client exec next start --hostname 127.0.0.1 --port 3100",
      cwd: root,
      env: {
        EVALGATE_API_URL: apiURL,
        NEXT_PUBLIC_API_URL: "",
        NEXT_PUBLIC_WS_URL: "ws://127.0.0.1:8100/api/v1/ws/run",
        NEXT_TELEMETRY_DISABLED: "1",
      },
      url: studioURL,
      reuseExistingServer: false,
      timeout: 120_000,
      gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
    },
  ],
});
