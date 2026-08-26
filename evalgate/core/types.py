"""
Core Data Contracts & Pydantic v2 Schemas for EvalGate.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class TargetType(str, Enum):
    """Supported target evaluation architectures."""

    PROMPT = "prompt"
    TOOL_CALL = "tool_call"
    RAG = "rag"
    STRUCTURED_OUTPUT = "structured_output"
    WEBHOOK = "webhook"


class AssertionType(str, Enum):
    """Assertion & evaluation metric types."""

    # Deterministic / Mathematical
    JSON_SCHEMA = "json_schema"
    PYTHON_AST = "python_ast"
    SQL_SYNTAX = "sql_syntax"
    CONTAINS = "contains"
    NOT_CONTAINS = "not_contains"
    REGEX = "regex"
    STARTS_WITH = "starts_with"
    ENDS_WITH = "ends_with"
    LEVENSHTEIN = "levenshtein"
    MAX_LATENCY_MS = "max_latency_ms"
    MAX_TOKENS = "max_tokens"
    MAX_COST_USD = "max_cost_usd"

    # Semantic / LLM-as-a-Judge
    FAITHFULNESS = "faithfulness"
    HALLUCINATION = "hallucination"
    RELEVANCY = "relevancy"
    COHERENCE = "coherence"
    BIAS = "bias"
    INTENT = "intent"
    DYNAMIC_RUBRIC = "dynamic_rubric"


class TargetConfig(BaseModel):
    """Configuration for the entity being evaluated."""

    model_config = ConfigDict(extra="forbid")

    type: TargetType = Field(
        default=TargetType.PROMPT,
        description="Type of target (prompt, tool_call, rag, structured_output, webhook)",
    )
    model: str = Field(
        default="openai/gpt-4o-mini",
        description="Model identifier (e.g. openai/gpt-4o, google/gemini-2.0-flash)",
    )
    provider: str | None = Field(
        default=None,
        description="Provider override (e.g. vercel, openai, ollama, mock). Inferred if None.",
    )
    template: str | None = Field(
        default=None,
        description="Prompt template string supporting {{variables}} for prompt targets",
    )
    system_prompt: str | None = Field(
        default=None,
        description="Optional system prompt instructions",
    )
    temperature: float = Field(
        default=0.0,
        ge=0.0,
        le=2.0,
        description="Sampling temperature (0.0 for deterministic evals)",
    )
    top_p: float | None = Field(default=None, ge=0.0, le=1.0)
    tools: list[dict[str, Any]] | None = Field(
        default=None,
        description="Tool schemas / function definitions for tool calling targets",
    )
    json_schema: dict[str, Any] | None = Field(
        default=None,
        description="JSON Schema for structured output validation",
    )
    webhook_url: str | None = Field(
        default=None,
        description="Target URL for live HTTP API / webhook evaluations",
    )
    headers: dict[str, str] | None = Field(
        default=None,
        description="HTTP headers for webhook targets",
    )
    allow_private_endpoints: bool = Field(
        default=False,
        description="Allow webhook requests to loopback or private IP subnets",
    )


class AssertionConfig(BaseModel):
    """Definition of an individual evaluation gate / assertion."""

    model_config = ConfigDict(extra="forbid")

    type: AssertionType = Field(
        ...,
        description="The metric or rule type to evaluate",
    )
    value: Any | None = Field(
        default=None,
        description="Expected value, regex pattern, keyword, or JSON schema object",
    )
    rubric: str | None = Field(
        default=None,
        description="Grading instructions/rubric for dynamic semantic metrics",
    )
    threshold: float | None = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Minimum score to pass (for semantic metrics 0.0 - 1.0, default 0.85)",
    )
    strict: bool = Field(
        default=True,
        description="If True, test case fails when this assertion fails",
    )
    judge_model: str | None = Field(
        default=None,
        description="Custom model to use for judging (defaults to default evaluator model)",
    )


class TestCase(BaseModel):
    """An individual test case with input variables and assertions."""

    __test__ = False
    model_config = ConfigDict(extra="forbid")

    id: str = Field(
        ...,
        description="Unique identifier for the test case (e.g. test_refund_request)",
    )
    name: str | None = Field(
        default=None,
        description="Human-readable title for the test case",
    )
    description: str | None = Field(
        default=None,
        description="Context or scenario description",
    )
    vars: dict[str, Any] = Field(
        default_factory=dict,
        description="Variable key-value pairs injected into templates and payloads",
    )
    ground_truth: str | dict[str, Any] | list[Any] | None = Field(
        default=None,
        description="Expected gold-standard output or reference response",
    )
    context: str | list[str] | None = Field(
        default=None,
        description="Retrieved context chunks / reference documents for RAG evaluations",
    )
    assertions: list[AssertionConfig] = Field(
        default_factory=list,
        description="Assertions and metrics applied specifically to this test case",
    )
    metadata: dict[str, Any] = Field(
        default_factory=dict,
        description="Arbitrary tags, categories, or tier annotations",
    )


class SuiteConfig(BaseModel):
    """Complete evaluation suite specification (e.g. loaded from YAML or created in Studio)."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(
        ...,
        description="Name of the test suite (e.g. customer-support-regression)",
    )
    description: str | None = Field(
        default=None,
        description="Detailed description of what this suite tests",
    )
    target: TargetConfig = Field(
        default_factory=TargetConfig,
        description="Default target configuration for the suite",
    )
    default_assertions: list[AssertionConfig] = Field(
        default_factory=list,
        description="Assertions applied globally to all test cases in the suite",
    )
    tests: list[TestCase] = Field(
        default_factory=list,
        description="List of test cases to execute",
    )
    min_pass_rate: float = Field(
        default=1.0,
        ge=0.0,
        le=1.0,
        description="Required pass rate for the suite to pass (0.0 to 1.0, default 1.0 = 100%)",
    )


class AssertionResult(BaseModel):
    """The evaluated outcome of a single assertion on a test case."""

    model_config = ConfigDict(extra="allow")

    assertion_type: AssertionType
    passed: bool
    score: float | None = Field(
        default=None,
        description="Normalized metric score (0.0 to 1.0) when applicable",
    )
    threshold: float | None = Field(
        default=None,
        description="Target threshold evaluated against",
    )
    reason: str | None = Field(
        default=None,
        description="Detailed reasoning or explanation for the pass/fail determination",
    )
    details: dict[str, Any] = Field(
        default_factory=dict,
        description="Structured debug metadata (e.g. extracted claims, AST errors)",
    )


class TestCaseResult(BaseModel):
    """Result of running a single test case through target execution and assertion gates."""

    __test__ = False
    model_config = ConfigDict(extra="allow")

    test_id: str
    passed: bool
    completion: str = Field(
        default="",
        description="Text or stringified output produced by the target",
    )
    raw_output: Any | None = Field(
        default=None,
        description="Raw structured completion payload from model or webhook",
    )
    latency_ms: float = Field(
        default=0.0,
        ge=0.0,
        description="Execution latency in milliseconds",
    )
    input_tokens: int = Field(default=0, ge=0)
    output_tokens: int = Field(default=0, ge=0)
    total_tokens: int = Field(default=0, ge=0)
    cost_usd: float = Field(default=0.0, ge=0.0)
    assertion_results: list[AssertionResult] = Field(default_factory=list)
    error: str | None = Field(
        default=None,
        description="Error message if target execution crashed or timed out",
    )


class SuiteRunResult(BaseModel):
    """Complete summary of an evaluation suite run."""

    model_config = ConfigDict(extra="allow")

    run_id: str
    suite_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    target_model: str
    target_provider: str
    passed: bool
    pass_rate: float = Field(ge=0.0, le=1.0)
    total_tests: int = Field(ge=0)
    passed_tests: int = Field(ge=0)
    failed_tests: int = Field(ge=0)
    avg_latency_ms: float = Field(ge=0.0)
    p50_latency_ms: float = Field(ge=0.0)
    p95_latency_ms: float = Field(ge=0.0)
    total_tokens: int = Field(ge=0)
    total_cost_usd: float = Field(ge=0.0)
    results: list[TestCaseResult] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class ArenaComparisonResult(BaseModel):
    """Side-by-side benchmark comparison between two models or prompts."""

    model_config = ConfigDict(extra="allow")

    suite_name: str
    model_a: str
    model_b: str
    run_a: SuiteRunResult
    run_b: SuiteRunResult
    pass_rate_delta: float
    latency_p50_delta_ms: float
    cost_delta_usd: float
    mismatched_test_ids: list[str] = Field(
        default_factory=list,
        description="Test case IDs where Model A and Model B had differing pass/fail outcomes",
    )
