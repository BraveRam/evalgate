"""
Tests for Template Interpolation Engine.
"""

from evalgate.core.template import extract_template_variables, render_template


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


def test_render_template_dict_and_list():
    template = "Context: {{context}}\nUser: {{query}}"
    rendered = render_template(template, {"context": ["Doc 1", "Doc 2"], "query": "What is AI?"})
    assert "Doc 1" in rendered
    assert "What is AI?" in rendered
