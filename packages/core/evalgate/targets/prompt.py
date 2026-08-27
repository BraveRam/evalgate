"""
Prompt Template Target Executor.
"""

from __future__ import annotations

from evalgate.core.template import render_template
from evalgate.core.types import TargetConfig, TestCase
from evalgate.providers.factory import get_provider
from evalgate.targets.base import BaseTarget, TargetOutput


class PromptTarget(BaseTarget):
    """Executes prompt templates with variable interpolation against an LLM provider."""

    def __init__(self, config: TargetConfig):
        super().__init__(config)
        self.provider = get_provider(target=config)

    async def execute(self, test_case: TestCase) -> TargetOutput:
        try:
            rendered_prompt = render_template(self.config.template or "{{query}}", test_case.vars)
            rendered_system = (
                render_template(self.config.system_prompt, test_case.vars)
                if self.config.system_prompt
                else None
            )

            res = await self.provider.complete(
                prompt=rendered_prompt,
                system_prompt=rendered_system,
                json_schema=self.config.json_schema,
            )

            return TargetOutput(
                completion=res.text,
                raw_output=res.raw_output,
                latency_ms=res.latency_ms,
                input_tokens=res.input_tokens,
                output_tokens=res.output_tokens,
                total_tokens=res.total_tokens,
                cost_usd=res.cost_usd,
            )
        except Exception as exc:
            return TargetOutput(
                completion="",
                error=f"Prompt target execution failed: {exc}",
            )
