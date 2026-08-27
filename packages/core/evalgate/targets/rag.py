"""
RAG (Retrieval-Augmented Generation) Target Executor.
"""

from __future__ import annotations

from evalgate.core.template import render_template
from evalgate.core.types import TargetConfig, TestCase
from evalgate.providers.factory import get_provider
from evalgate.targets.base import BaseTarget, TargetOutput


class RAGTarget(BaseTarget):
    """Executes RAG pipeline evaluations by injecting retrieved context chunks."""

    def __init__(self, config: TargetConfig):
        super().__init__(config)
        self.provider = get_provider(target=config)

    async def execute(self, test_case: TestCase) -> TargetOutput:
        try:
            context_str = (
                "\n---\n".join(test_case.context)
                if isinstance(test_case.context, list)
                else str(test_case.context or "")
            )

            vars_with_context = dict(test_case.vars)
            vars_with_context["context"] = context_str

            template_str = self.config.template or (
                "Answer the user query based ONLY on the following context:\n\n"
                "Context:\n{{context}}\n\n"
                "Query: {{query}}"
            )

            rendered_prompt = render_template(template_str, vars_with_context)
            rendered_system = (
                render_template(self.config.system_prompt, vars_with_context)
                if self.config.system_prompt
                else "You are a faithful assistant. Answer strictly from the provided context."
            )

            res = await self.provider.complete(
                prompt=rendered_prompt,
                system_prompt=rendered_system,
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
                error=f"RAG target execution failed: {exc}",
            )
