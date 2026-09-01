import React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Award,
  BarChart3,
  BookOpen,
  Boxes,
  CheckCircle2,
  ChevronRight,
  Code2,
  Cpu,
  Database,
  Download,
  ExternalLink,
  FileCode,
  Flame,
  GitBranch,
  Layers,
  Play,
  Rocket,
  Search,
  Server,
  ShieldCheck,
  Sparkles,
  Swords,
  Terminal,
  Workflow,
  Zap,
} from "lucide-react";
import {
  Accordion,
  Accordions,
  Callout,
  Card,
  Cards,
  CodeBlock,
  CodeTabs,
  Step,
  Steps,
  TypeTable,
} from "@/components/docs/DocsComponents";

export interface DocPageContent {
  slug: string;
  title: string;
  description: string;
  category: string;
  toc: Array<{ title: string; url: string; depth: number }>;
  content: React.ReactNode;
}

export const DOCS_PAGES: Record<string, DocPageContent> = {
  index: {
    slug: "",
    title: "EvalGate Studio Documentation",
    description:
      "Comprehensive developer guide for local-first prompt evaluation, LLM-as-a-judge quality gates, benchmark shootouts, and CI/CD regression testing.",
    category: "Getting Started",
    toc: [
      { title: "What is EvalGate?", url: "#what-is-evalgate", depth: 2 },
      { title: "Core Architectural Workflow", url: "#core-workflow", depth: 2 },
      { title: "3-Minute Quickstart", url: "#quickstart", depth: 2 },
      { title: "Explore Studio Capabilities", url: "#capabilities", depth: 2 },
    ],
    content: (
      <div className="space-y-8 text-sm leading-relaxed">
        <section id="what-is-evalgate" className="space-y-4">
          <h2 className="text-xl font-bold text-white tracking-tight border-b border-border/60 pb-2">
            What is EvalGate?
          </h2>
          <p className="text-zinc-300">
            <strong>EvalGate</strong> is an applied evaluation engine and developer studio designed
            to bring software engineering rigor to prompt engineering and LLM application development.
            It provides local-first test suite execution, multi-dimensional model shootouts, deterministic
            and semantic quality gates, and automated CI/CD pull request validation.
          </p>
          <Callout type="info" title="Zero-Config Local First Engine">
            EvalGate runs locally on your machine with SQLite storage (WAL mode) and local FastAPI backend.
            Your prompts, evaluation results, and API keys remain strictly under your control.
          </Callout>
        </section>

        <section id="core-workflow" className="space-y-4">
          <h2 className="text-xl font-bold text-white tracking-tight border-b border-border/60 pb-2">
            Core Architectural Workflow
          </h2>
          <p className="text-zinc-300">
            EvalGate bridges prompt prototyping in the UI directly into deterministic, automated CI/CD gates:
          </p>

          <Steps>
            <Step number={1} title="Experiment in the Workbench">
              Draft system prompts, configure Mustache/Jinja variable interpolation (e.g.{" "}
              <code>{"{{context}}"}</code>), attach deterministic assertions, and evaluate test outputs in real time.
            </Step>
            <Step number={2} title="Version-Control YAML Test Suites">
              Save test configurations directly to human-readable <code>evals/*.yaml</code> files in your repository.
              Keep prompts and test matrices versioned alongside your code.
            </Step>
            <Step number={3} title="Compare in the Model Arena">
              Run head-to-head model shootouts between candidate models (e.g., GPT-4o vs DeepSeek vs Gemini Flash)
              to assess quality delta, speed improvement, and cost reduction.
            </Step>
            <Step number={4} title="Enforce PR Quality Gates">
              Export GitHub Actions workflows to automatically execute your test suites on every pull request,
              blocking merges whenever a prompt or model change introduces regressions.
            </Step>
          </Steps>
        </section>

        <section id="quickstart" className="space-y-4">
          <h2 className="text-xl font-bold text-white tracking-tight border-b border-border/60 pb-2">
            3-Minute Quickstart
          </h2>
          <p className="text-zinc-300">
            Get started by launching the studio and executing your first evaluation suite:
          </p>

          <CodeTabs
            tabs={[
              {
                label: "CLI Launch",
                language: "bash",
                filename: "Terminal",
                code: `# 1. Start the EvalGate Studio UI & Backend Server
uv run evalgate studio --port 8000

# 2. Run an evaluation suite directly from the terminal
uv run evalgate run evals/support-ticket-classifier.yaml

# 3. Estimate execution cost and token footprint
uv run evalgate estimate evals/support-ticket-classifier.yaml`,
              },
              {
                label: "Python SDK",
                language: "python",
                filename: "quickstart.py",
                code: `import asyncio
from evalgate.core.engine import EvaluationEngine

async def main():
    engine = EvaluationEngine()
    result = await engine.run_suite("evals/support-ticket-classifier.yaml")
    
    print(f"Gate Passed: {result.passed}")
    print(f"Pass Rate: {result.pass_rate * 100:.1f}%")
    print(f"Total Cost: \${result.total_cost:.4f}")

asyncio.run(main())`,
              },
              {
                label: "YAML Suite",
                language: "yaml",
                filename: "evals/support-ticket-classifier.yaml",
                code: `name: support-ticket-classifier
description: Evaluates multi-class customer support intent classification
min_pass_rate: 1.0

target:
  type: prompt
  model: openai/gpt-4o-mini
  temperature: 0.0
  template: |
    Classify the urgency of the following customer message into [LOW, MEDIUM, HIGH, CRITICAL]:
    Message: {{message}}
    Classification:

tests:
  - id: urgent-outage
    variables:
      message: "Our entire production database is unreachable since 5 minutes ago!"
    assertions:
      - type: exact
        value: "CRITICAL"
      - type: max_latency_ms
        value: 1200`,
              },
            ]}
          />
        </section>

        <section id="capabilities" className="space-y-4">
          <h2 className="text-xl font-bold text-white tracking-tight border-b border-border/60 pb-2">
            Explore Studio Capabilities
          </h2>
          <Cards>
            <Card
              href="/docs/suites"
              title="Suites & Test Matrix"
              icon={<Boxes className="h-4 w-4 text-white" />}
              description="Learn how to structure YAML test suites, configure targets, and manage variable matrices."
            />
            <Card
              href="/docs/assertions"
              title="Assertions & Gates"
              icon={<ShieldCheck className="h-4 w-4 text-white" />}
              description="Explore deterministic string matching, regex, JSON schema, and LLM-as-a-judge rubrics."
            />
            <Card
              href="/docs/arena"
              title="Model Arena Shootout"
              icon={<Swords className="h-4 w-4 text-white" />}
              description="Multi-dimensional winner verdicts, side-by-side diff viewers, and speed/cost Pareto curves."
            />
            <Card
              href="/docs/analytics"
              title="Historical Analytics"
              icon={<BarChart3 className="h-4 w-4 text-white" />}
              description="Timestamped quality trends, p95 latency distributions, and automatic regression detection."
            />
            <Card
              href="/docs/ci-cd"
              title="CI/CD & GitHub Actions"
              icon={<Workflow className="h-4 w-4 text-white" />}
              description="Automate prompt regression testing in pull requests with 1-click ZIP package exports."
            />
            <Card
              href="/docs/api"
              title="REST & WebSocket API"
              icon={<Server className="h-4 w-4 text-white" />}
              description="OpenAPI specification, real-time WebSocket test streams, and SQLite engine storage."
            />
          </Cards>
        </section>
      </div>
    ),
  },

  suites: {
    slug: "suites",
    title: "Test Suites & YAML Specification",
    description: "Complete reference for authoring, configuring, and organizing YAML test suites in EvalGate.",
    category: "Core Concepts",
    toc: [
      { title: "Suite File Structure", url: "#structure", depth: 2 },
      { title: "Target Types & Configurations", url: "#targets", depth: 2 },
      { title: "Variable Interpolation", url: "#variables", depth: 2 },
    ],
    content: (
      <div className="space-y-8 text-sm leading-relaxed">
        <section id="structure" className="space-y-4">
          <h2 className="text-xl font-bold text-white tracking-tight border-b border-border/60 pb-2">
            Suite File Structure
          </h2>
          <p className="text-zinc-300">
            EvalGate suites are defined as pure YAML files located inside your project repository (default: <code>evals/*.yaml</code>).
            Each suite contains metadata, execution target configuration, a minimum pass rate threshold, and an array of test cases.
          </p>

          <CodeBlock
            language="yaml"
            filename="evals/rag-financial-qa.yaml"
            code={`name: rag-financial-qa
description: Evaluates accuracy and citation fidelity for financial queries
min_pass_rate: 0.95

target:
  type: prompt
  model: anthropic/claude-3-5-sonnet
  temperature: 0.0
  template: |
    Context:
    {{context}}

    Question:
    {{question}}

    Provide a concise answer with citation.`}
          />

          <TypeTable
            type={{
              name: { type: "string", description: "Unique slug identifier for the suite (e.g. support-ticket-classifier)" },
              description: { type: "string", description: "Human-readable summary of the evaluation purpose" },
              min_pass_rate: { type: "number", default: "1.0", description: "Quality gate threshold between 0.0 and 1.0 (e.g. 0.95 requires 95% tests to pass)" },
              target: { type: "TargetConfig", description: "Model, prompt template, temperature, and target type" },
              tests: { type: "TestCaseConfig[]", description: "List of test cases, input variables, and assertion assertions" },
            }}
          />
        </section>

        <section id="targets" className="space-y-4">
          <h2 className="text-xl font-bold text-white tracking-tight border-b border-border/60 pb-2">
            Target Types & Configurations
          </h2>
          <p className="text-zinc-300">
            EvalGate supports multiple target modalities depending on your testing pipeline:
          </p>

          <Accordions>
            <Accordion title="1. Prompt Template (type: prompt)" defaultOpen={true}>
              <p className="text-zinc-400 mb-2">
                Evaluates a structured prompt template by interpolating test case variables into placeholders like <code>{"{{variable_name}}"}</code>.
              </p>
              <CodeBlock
                language="yaml"
                code={`target:
  type: prompt
  model: openai/gpt-4o-mini
  temperature: 0.2
  template: "Translate to French: {{input_text}}"`}
              />
            </Accordion>
            <Accordion title="2. Direct Completion (type: completion)">
              <p className="text-zinc-400 mb-2">
                Sends raw inputs directly to the model without additional wrapper formatting.
              </p>
              <CodeBlock
                language="yaml"
                code={`target:
  type: completion
  model: google/gemini-2.0-flash`}
              />
            </Accordion>
            <Accordion title="3. Mock Simulator (type: mock)">
              <p className="text-zinc-400 mb-2">
                Fast, deterministic local simulator with zero API costs ($0.00) and zero latency. Ideal for CI unit tests and schema preflight validation.
              </p>
              <CodeBlock
                language="yaml"
                code={`target:
  type: mock
  model: mock/simulator`}
              />
            </Accordion>
          </Accordions>
        </section>

        <section id="variables" className="space-y-4">
          <h2 className="text-xl font-bold text-white tracking-tight border-b border-border/60 pb-2">
            Variable Interpolation
          </h2>
          <p className="text-zinc-300">
            Variables are defined as key-value pairs per test case and are substituted into templates using double curly braces (<code>{"{{key}}"}</code>).
          </p>
          <Callout type="idea" title="Multi-line Support">
            YAML block scalar syntax (<code>|</code> or <code>&gt;</code>) can be used to pass complex multi-line text, retrieved markdown documents, or JSON payloads into variables.
          </Callout>
        </section>
      </div>
    ),
  },

  assertions: {
    slug: "assertions",
    title: "Assertions & Quality Gates",
    description: "In-depth guide to deterministic string matchers, code validators, and semantic LLM-as-a-judge assertions.",
    category: "Core Concepts",
    toc: [
      { title: "Deterministic Assertions", url: "#deterministic", depth: 2 },
      { title: "Code & Syntax Assertions", url: "#code-syntax", depth: 2 },
      { title: "Latency & Budget Gates", url: "#budget-gates", depth: 2 },
      { title: "LLM-as-a-Judge Rubrics", url: "#llm-judge", depth: 2 },
    ],
    content: (
      <div className="space-y-8 text-sm leading-relaxed">
        <section id="deterministic" className="space-y-4">
          <h2 className="text-xl font-bold text-white tracking-tight border-b border-border/60 pb-2">
            Deterministic Assertions
          </h2>
          <p className="text-zinc-300">
            Deterministic assertions run locally in microseconds without incurring LLM inference costs:
          </p>

          <TypeTable
            type={{
              contains: { type: "string", description: "Verifies the output contains the given substring" },
              not_contains: { type: "string", description: "Verifies the output does NOT contain a forbidden term (e.g. confidential, error)" },
              exact: { type: "string", description: "Verifies exact string match after whitespace normalization" },
              starts_with: { type: "string", description: "Ensures completion begins with a specific prefix (e.g. SELECT, {)" },
              ends_with: { type: "string", description: "Ensures completion terminates with an expected suffix (e.g. ;)" },
              regex: { type: "regex pattern", description: "Validates model response against regular expressions (e.g. ^[A-Z]{3}-\\d{4}$)" },
            }}
          />
        </section>

        <section id="code-syntax" className="space-y-4">
          <h2 className="text-xl font-bold text-white tracking-tight border-b border-border/60 pb-2">
            Code & Syntax Assertions
          </h2>
          <p className="text-zinc-300">
            For code generation, function calling, and structured outputs, EvalGate provides native AST and schema parsers:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2">
              <h4 className="font-semibold text-white font-mono text-xs">json_schema</h4>
              <p className="text-zinc-400 text-xs">
                Validates JSON output against standard JSON Schema definitions using strict draft-7 validation.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2">
              <h4 className="font-semibold text-white font-mono text-xs">python_ast</h4>
              <p className="text-zinc-400 text-xs">
                Extracts markdown code blocks and verifies that the Python snippet parses into a valid Python AST without syntax errors.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2">
              <h4 className="font-semibold text-white font-mono text-xs">sql_syntax</h4>
              <p className="text-zinc-400 text-xs">
                Parses generated SQL statements through a SQL tokenizer to ensure valid dialect syntax and statement termination.
              </p>
            </div>
          </div>
        </section>

        <section id="budget-gates" className="space-y-4">
          <h2 className="text-xl font-bold text-white tracking-tight border-b border-border/60 pb-2">
            Latency & Budget Gates
          </h2>
          <p className="text-zinc-300">
            Ensure response times and unit economic costs remain within SLA limits:
          </p>
          <CodeBlock
            language="yaml"
            code={`- type: max_latency_ms
  value: 1500           # Fails test if response takes longer than 1.5s
- type: max_tokens
  value: 400            # Prevents runaway output token inflation
- type: max_cost_usd
  value: 0.0025         # Keeps cost per inference under $0.0025`}
          />
        </section>

        <section id="llm-judge" className="space-y-4">
          <h2 className="text-xl font-bold text-white tracking-tight border-b border-border/60 pb-2">
            LLM-as-a-Judge Rubrics
          </h2>
          <p className="text-zinc-300">
            When evaluation requires semantic reasoning, tone analysis, or factual fidelity, EvalGate employs secondary judge models:
          </p>
          <CodeBlock
            language="yaml"
            code={`- type: llm_rubric
  rubric: "The response must clearly explain how to handle authentication errors without suggesting insecure bypasses."
  judge_model: openai/gpt-4o-mini
  min_score: 4.0        # Normalized 1-5 evaluation scale`}
          />
        </section>
      </div>
    ),
  },

  playground: {
    slug: "playground",
    title: "Evaluation Workbench",
    description: "Interactive playground for rapid prompt engineering, assertions feedback, and 1-click YAML serialization.",
    category: "Studio Features",
    toc: [
      { title: "Workbench Overview", url: "#overview", depth: 2 },
      { title: "Interactive Assertion Tuning", url: "#assertion-tuning", depth: 2 },
      { title: "1-Click YAML Suite Generation", url: "#yaml-export", depth: 2 },
    ],
    content: (
      <div className="space-y-8 text-sm leading-relaxed">
        <section id="overview" className="space-y-4">
          <h2 className="text-xl font-bold text-white tracking-tight border-b border-border/60 pb-2">
            Workbench Overview
          </h2>
          <p className="text-zinc-300">
            The <strong>Evaluation Workbench</strong> (accessible at <code>/playground</code>) provides an IDE-like interface
            for engineering prompts, testing variables, and observing pass/fail assertion outcomes with live latency and cost instrumentation.
          </p>
          <Callout type="info" title="Built-in Model Catalog">
            EvalGate includes preset pricing and configuration for OpenAI GPT-4o / GPT-4o-mini, Anthropic Claude 3.5 Sonnet,
            Google Gemini 2.0 Flash, DeepSeek v4 Pro, and the local Mock Simulator.
          </Callout>
        </section>

        <section id="assertion-tuning" className="space-y-4">
          <h2 className="text-xl font-bold text-white tracking-tight border-b border-border/60 pb-2">
            Interactive Assertion Tuning
          </h2>
          <p className="text-zinc-300">
            You can chain multiple assertions onto a single test run to verify both deterministic structure and semantic correctness:
          </p>
          <Steps>
            <Step number={1} title="Select Target Model">
              Configure model provider, temperature, and system prompt instructions.
            </Step>
            <Step number={2} title="Add Dynamic Variables">
              Define key-value inputs that interpolate into the prompt template.
            </Step>
            <Step number={3} title="Configure Assertions">
              Add contains, regex, JSON schema, or LLM judge rubrics.
            </Step>
            <Step number={4} title="Execute & Inspect Trace">
              View token usage, inference latency in milliseconds, dollar cost, and individual assertion diagnostic results.
            </Step>
          </Steps>
        </section>

        <section id="yaml-export" className="space-y-4">
          <h2 className="text-xl font-bold text-white tracking-tight border-b border-border/60 pb-2">
            1-Click YAML Suite Generation
          </h2>
          <p className="text-zinc-300">
            Once a prompt template and test case are validated in the workbench, click <strong>Save as Suite</strong> to serialize the test configuration
            into a clean, standard YAML file in <code>evals/</code> without Python object tags.
          </p>
        </section>
      </div>
    ),
  },

  arena: {
    slug: "arena",
    title: "Model Arena Shootout",
    description: "Benchmark candidate models side-by-side on quality, latency, and cost with multi-dimensional winner verdicts.",
    category: "Studio Features",
    toc: [
      { title: "Fair Multi-Dimensional Verdicts", url: "#verdicts", depth: 2 },
      { title: "Side-by-Side Diff Inspection", url: "#diffs", depth: 2 },
    ],
    content: (
      <div className="space-y-8 text-sm leading-relaxed">
        <section id="verdicts" className="space-y-4">
          <h2 className="text-xl font-bold text-white tracking-tight border-b border-border/60 pb-2">
            Fair Multi-Dimensional Verdicts
          </h2>
          <p className="text-zinc-300">
            Unlike simplistic benchmarks that declare winners based on speed alone, EvalGate implements strict <strong>Quality-First Winner Logic</strong>:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2">
              <div className="flex items-center gap-2 text-white font-semibold text-xs">
                <ShieldCheck className="h-4 w-4 text-white" />
                <span>Quality Gate Winner</span>
              </div>
              <p className="text-zinc-400 text-xs">
                Higher assertion pass rate always wins. A model that achieves 100% pass rate beats a model with 80% pass rate, regardless of latency.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2">
              <div className="flex items-center gap-2 text-white font-semibold text-xs">
                <AlertTriangle className="h-4 w-4 text-zinc-400" />
                <span>Inconclusive / No Winner</span>
              </div>
              <p className="text-zinc-400 text-xs">
                If both models fail the quality gate (e.g. 0% pass rate), the overall result is declared <strong>No Winner / Inconclusive</strong> to avoid endorsing failing models.
              </p>
            </div>
          </div>
        </section>

        <section id="diffs" className="space-y-4">
          <h2 className="text-xl font-bold text-white tracking-tight border-b border-border/60 pb-2">
            Side-by-Side Diff Inspection
          </h2>
          <p className="text-zinc-300">
            The Arena Shootout provides multiple output inspection modes:
          </p>
          <ul className="list-disc list-inside space-y-1.5 text-zinc-300">
            <li><strong>Side-by-Side View</strong>: Compare completions with assertion tags and latency badges.</li>
            <li><strong>Unified Line Diff</strong>: Visual token and line diffing highlighting output divergences.</li>
            <li><strong>Discrepancy Filter</strong>: Isolate only test cases where one model passed and the other failed.</li>
          </ul>
        </section>
      </div>
    ),
  },

  analytics: {
    slug: "analytics",
    title: "Historical Analytics & Regression Trends",
    description: "Track model accuracy, tail latencies, cost burn, and regression anomalies over time.",
    category: "Studio Features",
    toc: [
      { title: "Timestamped Regression Curves", url: "#regression-curves", depth: 2 },
      { title: "Anomaly Detection", url: "#anomaly-detection", depth: 2 },
      { title: "Multi-Dimensional Filtering", url: "#filters", depth: 2 },
    ],
    content: (
      <div className="space-y-8 text-sm leading-relaxed">
        <section id="regression-curves" className="space-y-4">
          <h2 className="text-xl font-bold text-white tracking-tight border-b border-border/60 pb-2">
            Timestamped Regression Curves
          </h2>
          <p className="text-zinc-300">
            The Analytics dashboard charts historical evaluation runs using precise timestamps on the X-axis:
          </p>
          <ul className="list-disc list-inside space-y-1.5 text-zinc-300">
            <li><strong>Pass Rate Trend</strong>: Tracks quality score percentage over time against the 100% threshold line.</li>
            <li><strong>Latency Curve</strong>: Displays average and p95 latency curves with optional &gt;10s outlier capping.</li>
            <li><strong>Cumulative Token & Cost Curve</strong>: Tracks aggregate spend across evaluation cycles.</li>
          </ul>
        </section>

        <section id="anomaly-detection" className="space-y-4">
          <h2 className="text-xl font-bold text-white tracking-tight border-b border-border/60 pb-2">
            Automatic Anomaly Detection
          </h2>
          <p className="text-zinc-300">
            EvalGate automatically flags actionable anomalies:
          </p>
          <div className="space-y-2">
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs">
              <span className="font-semibold text-white">Quality Regressions:</span> Triggered when a suite pass rate drops by &gt;15% compared to the prior run.
            </div>
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs">
              <span className="font-semibold text-white">Tail Latency Spikes:</span> Triggered when any individual run experiences latency exceeding 5.0 seconds.
            </div>
          </div>
        </section>

        <section id="filters" className="space-y-4">
          <h2 className="text-xl font-bold text-white tracking-tight border-b border-border/60 pb-2">
            Multi-Dimensional Filtering & Export
          </h2>
          <p className="text-zinc-300">
            Filter historical traces by <strong>Suite</strong>, <strong>Model</strong>, <strong>Timeframe</strong> (24h, 7d, 30d, All),
            and <strong>Pass/Fail Status</strong>. Export all filtered traces to standard CSV with one click.
          </p>
        </section>
      </div>
    ),
  },

  "ci-cd": {
    slug: "ci-cd",
    title: "CI/CD & GitHub Actions Integration",
    description: "Automate prompt regression testing and quality gates directly inside GitHub Actions pull request pipelines.",
    category: "DevOps & Reference",
    toc: [
      { title: "GitHub Actions Workflow", url: "#github-actions", depth: 2 },
      { title: "Pytest Test Suite Integration", url: "#pytest", depth: 2 },
      { title: "1-Click ZIP Package Export", url: "#zip-export", depth: 2 },
    ],
    content: (
      <div className="space-y-8 text-sm leading-relaxed">
        <section id="github-actions" className="space-y-4">
          <h2 className="text-xl font-bold text-white tracking-tight border-b border-border/60 pb-2">
            GitHub Actions Workflow
          </h2>
          <p className="text-zinc-300">
            EvalGate integrates seamlessly into GitHub Actions to execute your test suites on pull requests:
          </p>

          <CodeBlock
            language="yaml"
            filename=".github/workflows/evals.yml"
            code={`name: EvalGate Prompt Quality Gates

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  evalgate:
    name: Run Prompt Quality Gates
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - name: Install Dependencies
        run: |
          python -m pip install --upgrade pip
          pip install evalgate pytest pytest-asyncio

      - name: Execute EvalGate Quality Gates
        env:
          OPENAI_API_KEY: \${{ secrets.OPENAI_API_KEY }}
          ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          pytest tests/evals/ -v`}
          />
        </section>

        <section id="pytest" className="space-y-4">
          <h2 className="text-xl font-bold text-white tracking-tight border-b border-border/60 pb-2">
            Pytest Test Suite Integration
          </h2>
          <p className="text-zinc-300">
            Each YAML suite maps to a standard async pytest test file (e.g. <code>tests/evals/test_support_ticket_classifier.py</code>):
          </p>

          <CodeBlock
            language="python"
            filename="tests/evals/test_support_ticket_classifier.py"
            code={`import pytest
from evalgate.core.engine import EvaluationEngine

@pytest.mark.asyncio
async def test_suite_support_ticket_classifier():
    engine = EvaluationEngine()
    result = await engine.run_suite("evals/support-ticket-classifier.yaml")
    
    assert result.passed, (
        f"Quality gate failed: pass rate {result.pass_rate*100:.1f}% "
        f"is below min_pass_rate {result.min_pass_rate*100:.1f}%"
    )`}
          />
        </section>

        <section id="zip-export" className="space-y-4">
          <h2 className="text-xl font-bold text-white tracking-tight border-b border-border/60 pb-2">
            1-Click ZIP Package Export
          </h2>
          <p className="text-zinc-300">
            From the <strong>CI/CD & Export</strong> tab (<code>/export</code>), you can click <strong>Download CI/CD Package (.zip)</strong> to download a ready-to-commit bundle containing:
          </p>
          <ul className="list-disc list-inside space-y-1 text-zinc-300">
            <li><code>.github/workflows/evals.yml</code>: Configured GitHub Actions workflow</li>
            <li><code>evals/&lt;suite&gt;.yaml</code>: The selected test suite YAML definition</li>
            <li><code>tests/evals/test_&lt;suite&gt;.py</code>: Complete pytest integration test</li>
            <li><code>README.md</code>: Step-by-step setup and secret configuration guide</li>
          </ul>
        </section>
      </div>
    ),
  },

  api: {
    slug: "api",
    title: "REST & WebSocket API Reference",
    description: "Complete API specification for programmatic evaluation, live WebSocket streaming, and SQLite storage.",
    category: "DevOps & Reference",
    toc: [
      { title: "REST Endpoints", url: "#rest-endpoints", depth: 2 },
      { title: "WebSocket Live Streaming", url: "#websocket", depth: 2 },
      { title: "CLI Commands", url: "#cli-commands", depth: 2 },
    ],
    content: (
      <div className="space-y-8 text-sm leading-relaxed">
        <section id="rest-endpoints" className="space-y-4">
          <h2 className="text-xl font-bold text-white tracking-tight border-b border-border/60 pb-2">
            REST Endpoints
          </h2>
          <p className="text-zinc-300">
            The FastAPI backend exposes the following REST routes at <code>http://localhost:8000/api/v1</code>:
          </p>

          <TypeTable
            type={{
              "GET /api/v1/suites": { type: "SuiteSummary[]", description: "List all discovered YAML suites in the repository" },
              "POST /api/v1/suites": { type: "SuiteConfig", description: "Create and persist a new YAML test suite" },
              "GET /api/v1/suites/{name}": { type: "SuiteConfig", description: "Retrieve full YAML suite specification by name" },
              "POST /api/v1/suites/{name}/estimate": { type: "CostEstimateResponse", description: "Estimate token count and dollar cost for a suite" },
              "POST /api/v1/evaluate/run": { type: "SuiteRunResult", description: "Execute a full evaluation suite synchronously" },
              "POST /api/v1/evaluate/playground": { type: "TestCaseResult", description: "Execute a single test case from the workbench" },
              "GET /api/v1/runs": { type: "SuiteRunResult[]", description: "Query historical run traces with limit filter (up to 1000)" },
              "DELETE /api/v1/runs/{id}": { type: "message", description: "Permanently delete an evaluation run trace and test results" },
            }}
          />
        </section>

        <section id="websocket" className="space-y-4">
          <h2 className="text-xl font-bold text-white tracking-tight border-b border-border/60 pb-2">
            WebSocket Live Streaming
          </h2>
          <p className="text-zinc-300">
            Stream test case execution events in real time via WebSocket:
          </p>
          <CodeBlock
            language="javascript"
            filename="websocket-client.js"
            code={`// Connect to live evaluation stream
const ws = new WebSocket("ws://localhost:8000/api/v1/ws/run/support-ticket-classifier");

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  // Types: "START", "PROGRESS", "TEST_RESULT", "SUITE_COMPLETE", "ERROR"
  console.log(msg.type, msg.data);
};`}
          />
        </section>

        <section id="cli-commands" className="space-y-4">
          <h2 className="text-xl font-bold text-white tracking-tight border-b border-border/60 pb-2">
            CLI Commands
          </h2>
          <div className="space-y-2">
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-xs text-zinc-300">
              <span className="text-white font-bold">evalgate studio</span> --port 8000 : Starts backend API and Next.js frontend
            </div>
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-xs text-zinc-300">
              <span className="text-white font-bold">evalgate run</span> &lt;path.yaml&gt; : Runs evaluation suite in terminal
            </div>
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-xs text-zinc-300">
              <span className="text-white font-bold">evalgate estimate</span> &lt;path.yaml&gt; : Estimates token burn and dollar cost
            </div>
          </div>
        </section>
      </div>
    ),
  },
};
