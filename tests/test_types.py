"""
Tests for Core Data Types and Pydantic v2 Models.
"""

import pytest
from pydantic import ValidationError

from evalgate.core.types import (
    AssertionConfig,
    AssertionResult,
    AssertionType,
    SuiteConfig,
    SuiteRunResult,
    TargetConfig,
    TargetType,
    TestCase,
    TestCaseResult,
)


def test_target_config_defaults():
    target = TargetConfig()
    assert target.type == TargetType.PROMPT
    assert target.model == "openai/gpt-4o-mini"
    assert target.temperature == 0.0


def test_target_config_extra_forbid():
    with pytest.raises(ValidationError):
        TargetConfig(unknown_field="invalid")


def test_assertion_config_creation_and_strict_validation():
    assertion = AssertionConfig(
        type=AssertionType.JSON_SCHEMA,
        value={"type": "object", "required": ["status"]},
        strict=True,
    )
    assert assertion.type == AssertionType.JSON_SCHEMA
    assert assertion.strict is True
    assert assertion.value["required"] == ["status"]


def test_assertion_config_typo_raises_validation_error():
    # 'treshold' typo must be rejected by extra="forbid"
    with pytest.raises(ValidationError):
        AssertionConfig(
            type=AssertionType.COHERENCE,
            treshold=0.85,  # Typo
        )


def test_assertion_config_threshold_bounds():
    # Threshold must be between 0.0 and 1.0
    with pytest.raises(ValidationError):
        AssertionConfig(
            type=AssertionType.COHERENCE,
            threshold=1.5,  # Out of range
        )

    with pytest.raises(ValidationError):
        AssertionConfig(
            type=AssertionType.COHERENCE,
            threshold=-0.1,  # Out of range
        )


def test_test_case_extra_forbid():
    with pytest.raises(ValidationError):
        TestCase(id="test-1", invalid_extra_field="should fail")


def test_suite_config_serialization():
    suite = SuiteConfig(
        name="test-support-evals",
        description="Testing customer support prompt",
        target=TargetConfig(
            type=TargetType.PROMPT,
            model="anthropic/claude-3-5-sonnet",
            template="Hello {{name}}, how can I help with {{topic}}?",
        ),
        tests=[
            TestCase(
                id="test-1",
                vars={"name": "Alice", "topic": "billing"},
                assertions=[
                    AssertionConfig(type=AssertionType.CONTAINS, value="billing"),
                    AssertionConfig(type=AssertionType.COHERENCE, threshold=0.9),
                ],
            )
        ],
    )

    json_data = suite.model_dump_json()
    loaded_suite = SuiteConfig.model_validate_json(json_data)

    assert loaded_suite.name == "test-support-evals"
    assert len(loaded_suite.tests) == 1
    assert loaded_suite.tests[0].vars["name"] == "Alice"
    assert len(loaded_suite.tests[0].assertions) == 2


def test_suite_run_result_validation():
    run = SuiteRunResult(
        run_id="run-123",
        suite_name="test-support-evals",
        target_model="openai/gpt-4o-mini",
        target_provider="openai",
        passed=True,
        pass_rate=1.0,
        total_tests=1,
        passed_tests=1,
        failed_tests=0,
        avg_latency_ms=250.0,
        p50_latency_ms=250.0,
        p95_latency_ms=250.0,
        total_tokens=150,
        total_cost_usd=0.0001,
        results=[
            TestCaseResult(
                test_id="test-1",
                passed=True,
                completion='{"status": "ok"}',
                latency_ms=250.0,
                input_tokens=100,
                output_tokens=50,
                total_tokens=150,
                cost_usd=0.0001,
                assertion_results=[
                    AssertionResult(
                        assertion_type=AssertionType.JSON_SCHEMA,
                        passed=True,
                        reason="Valid JSON schema",
                    )
                ],
            )
        ],
    )

    assert run.passed is True
    assert run.pass_rate == 1.0
    assert len(run.results) == 1
    assert run.results[0].assertion_results[0].passed is True
