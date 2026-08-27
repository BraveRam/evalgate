"""
Phase 5 security re-probe (reviewer verification, deleted after run).
Empirically confirms the two CRITICAL fixes + validates no regression:
  1. CORS strict allowlist (no wildcard reflection)
  2. Path-traversal confinement on suite create + list
"""
from __future__ import annotations

import sys
from pathlib import Path

from fastapi.testclient import TestClient

from evalgate.api.app import create_app

ROOT = Path.cwd().resolve()
EVILS = "https://evil.example.com"
GOOD = "http://localhost:3000"
TRAVERSAL_ARTIFACT = ROOT / "PROBE_DELETEME_traversal.yaml"

results: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    results.append((name, ok, detail))


VALID_SUITE = {
    "name": "probe_suite",
    "target": {"type": "prompt", "model": "mock/simulator"},
    "tests": [{"id": "t1", "vars": {}, "assertions": [{"type": "contains", "value": "x"}]}],
    "min_pass_rate": 1.0,
}

app = create_app()
with TestClient(app) as client:
    # --- CORS: disallowed origin must NOT be reflected ---
    r = client.get("/health", headers={"Origin": EVILS})
    acao = r.headers.get("access-control-allow-origin")
    check("CORS rejects evil origin (no reflection)", acao != EVILS, f"ACAO={acao!r}")

    # --- CORS: allowed origin IS reflected ---
    r = client.get("/health", headers={"Origin": GOOD})
    acao = r.headers.get("access-control-allow-origin")
    check("CORS allows localhost:3000", acao == GOOD, f"ACAO={acao!r}")

    # --- create suite: ../ traversal in filename must be blocked (400), no file written ---
    r = client.post(
        "/api/v1/suites",
        params={"filename": "../PROBE_DELETEME_traversal.yaml"},
        json=VALID_SUITE,
    )
    check("create ../ filename -> 400", r.status_code == 400, f"status={r.status_code} body={r.text[:120]}")
    check("no traversal artifact written outside evals/", not TRAVERSAL_ARTIFACT.exists(),
          f"exists={TRAVERSAL_ARTIFACT.exists()} at {TRAVERSAL_ARTIFACT}")

    # --- create suite: absolute-path filename must be blocked ---
    r = client.post(
        "/api/v1/suites",
        params={"filename": "/etc/PROBE_DELETEME_abs.yaml"},
        json=VALID_SUITE,
    )
    check("create /abs filename -> 400", r.status_code == 400, f"status={r.status_code}")
    check("no /tmp-ish abs artifact", not Path("/etc/PROBE_DELETEME_abs.yaml").exists(), "")

    # --- list suites: traversal via dir_path must be blocked ---
    r = client.get("/api/v1/suites", params={"dir_path": "/etc"})
    check("list dir_path=/etc -> 400", r.status_code == 400, f"status={r.status_code}")

    r = client.get("/api/v1/suites", params={"dir_path": "../.."})
    check("list dir_path=../.. -> 400", r.status_code == 400, f"status={r.status_code}")

    # --- sanity: normal list still works (no over-blocking regression) ---
    r = client.get("/api/v1/suites")
    check("list default (evals) still 200", r.status_code == 200, f"status={r.status_code}")

# Final cleanup safety
for stray in (TRAVERSAL_ARTIFACT, Path("/etc/PROBE_DELETEME_abs.yaml")):
    try:
        if stray.exists():
            stray.unlink()
    except Exception:
        pass

print("\n=== PHASE 5 SECURITY RE-PROBE ===")
all_ok = True
for name, ok, detail in results:
    mark = "PASS" if ok else "FAIL"
    if not ok:
        all_ok = False
    line = f"[{mark}] {name}"
    if detail:
        line += f"  ({detail})"
    print(line)
print(f"\nRESULT: {'ALL PASS' if all_ok else 'FAILURES PRESENT'}")
sys.exit(0 if all_ok else 1)
