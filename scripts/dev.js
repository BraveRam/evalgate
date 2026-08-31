#!/usr/bin/env node

const { spawn } = require("child_process");

console.log("\x1b[36m%s\x1b[0m", "🚀 Starting EvalGate Monorepo (FastAPI Backend + Next.js Web Studio)...");

const api = spawn(
  "uv",
  ["run", "uvicorn", "evalgate.api.app:app", "--host", "127.0.0.1", "--port", "8000", "--reload"],
  {
    stdio: "inherit",
    shell: true,
  }
);

const client = spawn(
  "pnpm",
  ["--filter", "@evalgate/client", "dev"],
  {
    stdio: "inherit",
    shell: true,
  }
);

function cleanup() {
  console.log("\n\x1b[33m%s\x1b[0m", "🛑 Shutting down EvalGate services...");
  try {
    api.kill("SIGTERM");
  } catch {}
  try {
    client.kill("SIGTERM");
  } catch {}
  setTimeout(() => process.exit(0), 500);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
