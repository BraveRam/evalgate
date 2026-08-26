"""
Tests for Template Interpolation Engine.
"""

import pytest

from evalgate.core.template import (
    TemplateSecurityError,
    TemplateVariableMissingError,
    extract_template_variables,
    render_template,
)


def test_extract_template_variables():
    template = "Analyze the customer query: {{query}} for tier {{tier}} with order {{order_id}}."
    vars_found = extract_template_variables(template)
    assert vars_found == ["query", "tier", "order_id"]


def test_extract_template_variables_empty_or_no_vars():
    assert extract_template_variables("") == []
    assert extract_template_variables("Just plain text with no placeholders.") == []


def test_render_template_standard():
    template = "Hello {{name}}, your account balance is ${{balance}}."
    rendered = render_template(template, {"name": "Charlie", "balance": 150})
    assert rendered == "Hello Charlie, your account balance is $150."


def test_render_template_missing_variable_raises_error():
    template = "Hello {{name}}, your order is {{order_id}}."
    with pytest.raises(TemplateVariableMissingError) as exc_info:
        render_template(template, {"name": "Alice"})
    assert "order_id" in str(exc_info.value)


def test_render_template_sandbox_blocks_arbitrary_code():
    # Attempting to access unsafe Python internals must fail
    malicious_template = "{{ ''.__class__.__mro__[1].__subclasses__() }}"
    with pytest.raises((TemplateSecurityError, TemplateVariableMissingError)):
        render_template(malicious_template, {})


def test_render_template_dict_and_list():
    template = "Context: {{context}}\nUser: {{query}}"
    rendered = render_template(
        template,
        {"context": ["Doc 1", "Doc 2"], "query": "What is AI?"}
    )
    assert "Doc 1" in rendered
    assert "What is AI?" in rendered


def test_render_template_syntax_error_fallback():
    # Template with invalid Jinja syntax like unmatched tags falls back to regex
    bad_syntax_template = "{% if unclosed %} {{var1}} and {{data}}"
    rendered = render_template(
        bad_syntax_template,
        {"var1": "Alpha", "data": {"key": "value"}}
    )
    assert "Alpha" in rendered
    assert '"key": "value"' in rendered

    # Missing variable in syntax fallback raises TemplateVariableMissingError
    with pytest.raises(TemplateVariableMissingError):
        render_template(bad_syntax_template, {"var1": "Alpha"})
