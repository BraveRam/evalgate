"""Serve mock evaluation fixtures from a disposable workspace for browser tests."""

import os
import tempfile
from pathlib import Path

import uvicorn
import yaml
from evalgate.api.app import create_app


def main() -> None:
    suite = {
        "name": "ci-repeated-evaluation",
        "repeat": 3,
        "min_pass_rate": 0.5,
        "target": {"model": "mock/simulator", "template": "Hello"},
        "tests": [
            {"id": "passing", "assertions": [{"type": "contains", "value": "Hello"}]},
            {
                "id": "failing",
                "repeat": 2,
                "assertions": [{"type": "contains", "value": "NOT_PRESENT"}],
            },
        ],
    }
    # Do not inherit local credentials when running the same test outside CI.
    for name in (
        "VERCEL_AI_GATEWAY_KEY", "AI_GATEWAY_KEY", "OPENAI_API_KEY",
        "ANTHROPIC_API_KEY", "GOOGLE_API_KEY", "GEMINI_API_KEY", "DEEPSEEK_API_KEY",
        "VERCEL_AI_GATEWAY_URL", "AI_GATEWAY_URL",
    ):
        os.environ.pop(name, None)
    original_directory = Path.cwd()
    with tempfile.TemporaryDirectory(prefix="evalgate-e2e-") as directory:
        try:
            os.chdir(directory)
            Path("evals").mkdir()
            Path("evals/repeated.yaml").write_text(yaml.safe_dump(suite), encoding="utf-8")
            uvicorn.run(create_app(), host="127.0.0.1", port=8100)
        finally:
            os.chdir(original_directory)


if __name__ == "__main__":
    main()
