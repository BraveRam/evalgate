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
uv run evalgate cost evals/support-ticket-classifier.yaml`,
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
            <Card href="/docs/prompt-arena" title="Prompt Arena"
              icon={<Swords className="h-4 w-4 text-white" />}
              description="Compare two prompt versions on one model, inspect repeated outcomes, and apply a chosen prompt." />
            <Card
              href="/docs/arena"
              title="Model Arena Shootout"
              icon={<Swords className="h-4 w-4 text-white" />}
              description="Multi-dimensional winner verdicts, side-by-side diff viewers, and speed/cost Pareto curves."
            />
            <Card
              href="/docs/analytics"
              title="Baselines & Historical Analytics"
              icon={<BarChart3 className="h-4 w-4 text-white" />}
              description="Save accepted baselines, inspect per-test output diffs, and track quality and latency trends."
            />
            <Card
              href="/docs/ci-cd"
              title="CI/CD & GitHub Actions"
              icon={<Workflow className="h-4 w-4 text-white" />}
              description="Automate prompt regression testing in pull requests with 1-click ZIP package exports."
            />
            <Card
              href="/docs/mcp"
              title="Model Context Protocol (MCP)"
              icon={<Cpu className="h-4 w-4 text-white" />}
              description="Connect AI coding assistants (Claude Desktop, Cursor, Antigravity) directly to test suites and quality gates."
            />
            <Card
              href="/docs/api"
              title="REST & WebSocket API"
              icon={<Server className="h-4 w-4 text-white" />}
              description="FastAPI OpenAPI specs, WebSocket streaming endpoints, and CLI commands."
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
  temperature: 0.0
  system_prompt: "You are a customer support classification assistant."
  template: "Classify the sentiment of: {{customer_message}}"`}
              />
            </Accordion>

            <Accordion title="2. Tool & Function Calling (type: tool_call)">
              <p className="text-zinc-400 mb-2">
                Tests whether an LLM invokes the correct tool definitions with valid parameter arguments.
              </p>
              <CodeBlock
                language="yaml"
                code={`target:
  type: tool_call
  model: openai/gpt-4o
  tools:
    - name: check_inventory
      description: "Query stock levels for a product"
      parameters:
        type: object
        properties:
          sku: { type: string }
        required: ["sku"]`}
              />
            </Accordion>

            <Accordion title="3. RAG & Retrieval Grounding (type: rag)">
              <p className="text-zinc-400 mb-2">
                Supplies retrieved context passages to evaluate hallucination, faithfulness, and answer citation grounding.
              </p>
              <CodeBlock
                language="yaml"
                code={`target:
  type: rag
  model: anthropic/claude-3-5-sonnet
  template: |
    Context Documents:
    {{context}}

    User Question:
    {{question}}`}
              />
            </Accordion>

            <Accordion title="4. Structured JSON Output (type: structured_output)">
              <p className="text-zinc-400 mb-2">
                Enforces strict JSON schema validation on the LLM completion using Pydantic / JSON Schema definitions.
              </p>
              <CodeBlock
                language="yaml"
                code={`target:
  type: structured_output
  model: openai/gpt-4o-mini
  json_schema:
    type: object
    properties:
      decision: { type: string, enum: ["APPROVE", "REJECT"] }
      confidence: { type: number }
    required: ["decision", "confidence"]`}
              />
            </Accordion>

            <Accordion title="5. Live HTTP Webhook / API Endpoint (type: webhook)">
              <p className="text-zinc-400 mb-2">
                Evaluates an external backend service, LangChain agent, or microservice over live HTTP POST requests.
              </p>
              <CodeBlock
                language="yaml"
                code={`target:
  type: webhook
  webhook_url: "https://api.myapp.com/v1/chat/agent"
  headers:
    Authorization: "Bearer \${APP_SECRET_TOKEN}"
    Content-Type: "application/json"`}
              />
            </Accordion>

            <Accordion title="6. Offline Mock Simulator (provider: mock)">
              <p className="text-zinc-400 mb-2">
                Fast, deterministic local simulator with zero API costs ($0.00) and zero latency. Ideal for CI unit tests and schema preflight validation.
              </p>
              <CodeBlock
                language="yaml"
                code={`target:
  type: prompt
  model: mock/simulator
  provider: mock`}
              />
            </Accordion>
          </Accordions>
        </section>

        <section id="variables" className="space-y-4">
          <h2 className="text-xl font-bold text-white tracking-tight border-b border-border/60 pb-2">
            Variable Interpolation & Context
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
              exact: { type: "string", description: "Verifies exact string match after whitespace normalization" },
              contains: { type: "string", description: "Verifies the output contains the given substring" },
              not_contains: { type: "string", description: "Verifies the output does NOT contain a forbidden term (e.g. confidential, error)" },
              starts_with: { type: "string", description: "Ensures completion begins with a specific prefix (e.g. SELECT, {)" },
              ends_with: { type: "string", description: "Ensures completion terminates with an expected suffix (e.g. ;)" },
              regex: { type: "regex pattern", description: "Validates model response against regular expressions (e.g. ^[A-Z]{3}-\\d{4}$)" },
              levenshtein: { type: "number (0.0 - 1.0)", description: "Computes fuzzy string similarity ratio against ground truth" },
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
            Semantic LLM-as-a-Judge Rubrics
          </h2>
          <p className="text-zinc-300">
            When evaluation requires semantic reasoning, tone analysis, or factual fidelity, EvalGate employs secondary judge models:
          </p>

          <TypeTable
            type={{
              faithfulness: { type: "Semantic Metric", description: "Verifies that claims made in the completion are strictly grounded in the provided context documents." },
              hallucination: { type: "Semantic Metric", description: "Extracts individual factual claims and flags statements unsupported by context." },
              relevancy: { type: "Semantic Metric", description: "Measures whether the model's answer directly addresses the user's inquiry." },
              coherence: { type: "Semantic Metric", description: "Evaluates logical consistency, narrative flow, and syntactic cohesion." },
              bias: { type: "Semantic Metric", description: "Detects demographic, political, or unfair bias in generated completions." },
              intent: { type: "Semantic Metric", description: "Verifies whether the agent fulfilled the primary user intention." },
              dynamic_rubric: { type: "Custom Rubric", description: "Evaluates the output against a custom grading rubric on a normalized score threshold." },
            }}
          />

          <CodeBlock
            language="yaml"
            filename="evals/rag-judge.yaml"
            code={`assertions:
  - type: faithfulness
    threshold: 0.85
    judge_model: openai/gpt-4o-mini
  - type: dynamic_rubric
    rubric: "The response must clearly explain how to handle authentication errors without suggesting insecure bypasses."
    judge_model: anthropic/claude-3-5-sonnet
    threshold: 0.80`}
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

  "prompt-arena": {
    slug: "prompt-arena",
    title: "Prompt Arena",
    description: "Compare two prompt versions on one model, inspect repeated outcomes, and apply a chosen prompt safely.",
    category: "Studio Features",
    toc: [
      { title: "Compare prompt versions", url: "#compare-prompts", depth: 2 },
      { title: "Read results and save a prompt", url: "#prompt-results", depth: 2 },
      { title: "Prompt Arena API", url: "#prompt-api", depth: 2 },
    ],
    content: (
      <div className="space-y-8 text-sm leading-relaxed">
        <section id="compare-prompts" className="space-y-4">
          <h2 className="text-xl font-bold">Compare prompt versions</h2>
          <p>Open <Link href="/prompt-arena" className="underline">Prompt Arena</Link> from the Studio sidebar.
            Select a model-backed suite and one shared model. Both editors start with the suite&apos;s
            template and system instructions. Edit A or B, set attempts per test and concurrency,
            then choose Compare prompts and review the combined cost estimate before starting.</p>
          <p>Per-test YAML repeat overrides take precedence over the attempts control.
            Both variants use identical cases, variables, context, assertions, temperature, top-p,
            tools, and JSON schema. A runs before B with the same concurrency limit (1–50).
            Attempts must be 1–100. Templates must contain non-whitespace text; empty system
            instructions are allowed. Webhook suites are excluded because their endpoints own the prompt.</p>
          <Callout type="info" title="Try it without inference fees">
            Choose mock/simulator with deterministic assertions to test without inference fees. Semantic
            assertions may still call a live judge even with a mock target. Echoed mock completions can exercise string
            assertions, but do not measure real model quality. Live models require configured provider
            credentials. Cost estimates include both variants&apos; target calls and exclude semantic judges.
          </Callout>
          <p>The confirmation keeps the prompts, model, repeat count, and concurrency captured for
            the estimate. Editing the form while it loads does not change that run. If the source
            suite changes after estimating, execution returns 409 and requires a new estimate.</p>
        </section>
        <section id="prompt-results" className="space-y-4">
          <h2 className="text-xl font-bold">Read results and save a prompt</h2>
          <p>Compare observed pass rates, per-test success rates, gate outcomes, P50/P95 latency,
            tokens, cost, and side-by-side outputs. Expand a case and Inspect attempts to see every
            completion, assertion, and error. The higher observed pass rate is descriptive;
            repeated samples do not establish statistical significance.</p>
          <p>Suite pass rate is passed attempts / total attempts. Per-case passed still requires
            every attempt to pass. The suite&apos;s minimum pass rate applies; its saved regression
            baseline does not gate the experiment. Normal suite runs retain their baseline behavior.</p>
          <p>Saved comparisons live in SQLite and survive browser refreshes. They retain both prompts,
            the original suite snapshot, shared model, repeat override, concurrency, and both run results.
            Each underlying run also appears in Analytics with its comparison ID, variant, and target snapshot.
            Use Newer/Older to page through saved comparisons, and select a record to reopen it.</p>
          <p>Choose Apply prompt A to suite or Apply prompt B to suite. This changes only the template
            and system instructions; the suite&apos;s model, tests, sampling settings, and other configuration
            stay as they were. You can choose either variant; applying is an explicit decision, not an
            automatic quality judgment. If any suite configuration changed since the comparison, applying
            returns 409 rather than overwriting the newer work. Compare again to apply a fresh result.
            Applying does not replace the saved suite baseline. Deleting a source suite makes applying return 404; saved comparison evidence remains readable.</p>
        </section>
        <section id="prompt-api" className="space-y-4">
          <h2 className="text-xl font-bold">Prompt Arena API</h2>
          <p>Send this shape to POST /api/v1/arena/prompts/estimate and
            POST /api/v1/arena/prompts/compare. Replace my-suite and template variables with your suite&apos;s values.</p>
          <CodeBlock language="json" code={`{
  "suite_name": "my-suite",
  "model": "mock/simulator",
  "prompt_a": {"template": "Answer {{question}}", "system_prompt": ""},
  "prompt_b": {"template": "Answer carefully: {{question}}", "system_prompt": "Use the supplied context."},
  "repeat": 5,
  "concurrency": 10
}`} />
          <p>The estimate returns estimate_a, estimate_b, total_attempts, estimated_cost_usd, and
            suite_fingerprint. Include that fingerprint in the compare request to reject stale estimates.
            Direct API callers may omit it. Compare returns comparison_id, created_at, suite_snapshot,
            model, prompt_a, prompt_b, repeat, concurrency, and comparison containing both complete runs.</p>
          <TypeTable type={{
            "POST /api/v1/arena/prompts/estimate": { type: "PromptEstimate", description: "Estimate both variants without inference or persistence" },
            "POST /api/v1/arena/prompts/compare": { type: "PromptArenaResult", description: "Execute and save the comparison and both runs" },
            "GET /api/v1/arena/prompts": { type: "PromptArenaSummary[]", description: "Paginated saved history: limit 1–100, default 20; offset >= 0" },
            "GET /api/v1/arena/prompts/{id}": { type: "PromptArenaResult", description: "Reopen complete saved evidence; 404 when absent" },
            "POST /api/v1/arena/prompts/{id}/apply": { type: "SuiteConfig", description: 'Apply the stored variant using {"variant":"A"} or {"variant":"B"}; 409 if the suite changed' },
          }} />
          <p>Invalid request fields return 422; empty suites or unsupported webhook comparisons return 400.
            These endpoints extend the Studio and REST API. Existing model Arena, CLI, and MCP interfaces are unchanged.</p>
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
    description: "Save baselines, inspect per-test regressions and output diffs, and track quality, latency, and cost over time.",
    category: "Studio Features",
    toc: [
      { title: "Saved Baselines", url: "#saved-baselines", depth: 2 },
      { title: "Regression Gate Rules", url: "#regression-gate", depth: 2 },
      { title: "Timestamped Regression Curves", url: "#regression-curves", depth: 2 },
      { title: "Anomaly Detection", url: "#anomaly-detection", depth: 2 },
      { title: "Multi-Dimensional Filtering", url: "#filters", depth: 2 },
    ],
    content: (
      <div className="space-y-8 text-sm leading-relaxed">
        <section id="saved-baselines" className="space-y-4">
          <h2 className="text-xl font-bold text-white tracking-tight border-b border-border/60 pb-2">
            Saved Baselines
          </h2>
          <p>
            A baseline is an accepted run used to check later runs of the same suite.
            It catches individual test failures even when the overall pass rate stays the same.
            Each suite has one saved baseline.
          </p>
          <Steps>
            <Step number={1} title="Choose an accepted run">
              Open <Link href="/analytics" className="text-white underline">Analytics &amp; Trends</Link>,
              find a successful run, and select <strong>Inspect Run Trace</strong>.
            </Step>
            <Step number={2} title="Save the baseline">
              In <strong>Regression baseline</strong>, select <strong>Use this run as baseline</strong>.
              Subsequent saved runs of the suite automatically compare against this snapshot.
            </Step>
            <Step number={3} title="Inspect the next run">
              Inspect a candidate run to see the gate result, new failures, missing tests,
              improvements, and pass-rate, P50 latency, and cost deltas. Expand a test to
              review assertion details, before/after outputs, and its unified output diff.
            </Step>
          </Steps>
          <p>
            Select <strong>Export baseline JSON</strong> to download a portable snapshot
            for <Link href="/docs/ci-cd#baseline-ci" className="text-white underline">CI regression checks</Link>.
            Select another successful run to replace it, or <strong>Remove baseline</strong>
            {" "}to stop automatic comparisons. Deleting the original run leaves the snapshot intact.
          </p>
        </section>

        <section id="regression-gate" className="space-y-4">
          <h2 className="text-xl font-bold text-white tracking-tight border-b border-border/60 pb-2">
            Regression Gate Rules
          </h2>
          <ul className="list-disc list-inside space-y-2">
            <li>A previously passing test now failing causes the gate to fail.</li>
            <li>A missing baseline test causes the gate to fail.</li>
            <li>The candidate must also pass its existing suite quality gate.</li>
            <li>Output changes, improvements, added tests, and cost or latency deltas alone do not fail the baseline gate.</li>
          </ul>
          <p>
            Tests are matched by ID, independent of order. Keep IDs unique, non-empty,
            and stable: renaming an ID counts as a missing test plus an added test.
            Added tests still affect the suite quality gate. Deltas are candidate minus baseline.
          </p>
          <Callout type="info" title="Which runs qualify?">
            A baseline must be a complete, non-empty run that passed its configured
            quality gate. It may contain failed tests if its min_pass_rate permits them.
          </Callout>
        </section>

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
      { title: "EvalGate Project Checks", url: "#project-checks", depth: 2 },
      { title: "Baseline Checks in CI", url: "#baseline-ci", depth: 2 },
      { title: "GitHub Actions Workflow", url: "#github-actions", depth: 2 },
      { title: "Pytest Test Suite Integration", url: "#pytest", depth: 2 },
      { title: "1-Click ZIP Package Export", url: "#zip-export", depth: 2 },
    ],
    content: (
      <div className="space-y-8 text-sm leading-relaxed">
        <section id="project-checks" className="space-y-4">
          <h2 className="text-xl font-bold text-white tracking-tight border-b border-border/60 pb-2">
            EvalGate Project Checks
          </h2>
          <p>
            This repository runs GitHub Actions checks on every pull request and push to main.
            Python 3.11 and 3.14 run the full pytest suite, Ruff, and mypy.
            Studio checks include ESLint, TypeScript, a production build, and Chromium browser tests.
            The combined CI result must pass before merging.
          </p>
          <p>
            Run <code>pnpm --filter @evalgate/client exec playwright install chromium</code> once,
            then <code>pnpm test:e2e</code> from the project root.
            The command builds Studio and starts a mock API in a temporary workspace on ports
            3100 and 8100. Provider credentials and your saved suites are not used.
          </p>
          <p>
            Browser regressions cover repeat validation, cost confirmation with settings changed
            during estimation, WebSocket progress, attempt inspection, summary counts, and estimate
            failures. Failed tests retain screenshots and traces; GitHub Actions stores browser
            reports as downloadable artifacts for seven days.
          </p>
        </section>

        <section id="baseline-ci" className="space-y-4">
          <h2 className="text-xl font-bold text-white tracking-tight border-b border-border/60 pb-2">
            Baseline Checks in CI
          </h2>
          <p>
            Run a suite and copy its successful run ID. Save it as the local baseline
            and export a JSON snapshot, replacing the placeholder below with the actual ID:
          </p>
          <CodeBlock language="bash" filename="Terminal" code={`uv run evalgate run evals/rag_qa.yaml
mkdir -p baselines
uv run evalgate baseline run_YOUR_RUN_ID --output baselines/rag_qa.json`} />
          <p>
            Commit the exported JSON alongside the suite. After installing this project
            and configuring your provider credentials in CI, use:
          </p>
          <CodeBlock language="bash" filename="CI command" code={`uv run evalgate run evals/rag_qa.yaml --baseline baselines/rag_qa.json --no-save --json`} />
          <p>
            This works in a fresh checkout without the original database. Exit status
            is <code>0</code> when the gate passes and <code>1</code> when it fails.
            JSON results include <code>metadata.baseline_comparison</code> with per-test
            diffs and metric deltas.
          </p>
          <p>
            An explicit <code>--baseline</code> file takes precedence over the local baseline.
            <code> --no-save</code> skips run persistence and automatic local baseline lookup;
            supply the file to keep regression checks enabled. The artifact uses
            <code> schema_version: 1</code> and contains the full run, including model
            outputs and assertion results. Review its contents before committing it.
            Unsupported versions, invalid snapshots, and mismatched suite names are rejected.
          </p>
          <p>
            See <Link href="/docs/analytics#regression-gate" className="text-white underline">regression gate rules</Link>
            {" "}for what fails a run. Export a baseline separately from the CI/CD ZIP package.
          </p>
        </section>

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
              "POST /api/v1/arena/prompts/estimate": { type: "PromptEstimate", description: "Estimate both prompt variants; returns a fingerprint to guard execution" },
              "POST /api/v1/arena/prompts/compare": { type: "PromptArenaResult", description: "Compare two prompts on one model and persist original suite/settings/results" },
              "GET /api/v1/arena/prompts": { type: "PromptArenaSummary[]", description: "Saved prompt comparisons, limit 1–100 and offset" },
              "GET /api/v1/arena/prompts/{id}": { type: "PromptArenaResult", description: "Fetch full saved comparison evidence" },
              "POST /api/v1/arena/prompts/{id}/apply": { type: "SuiteConfig", description: 'Apply {"variant":"A"} or {"variant":"B"}; 409 for changed suites' },
              "GET /api/v1/suites": { type: "SuiteSummary[]", description: "List all discovered YAML suites in the repository" },
              "POST /api/v1/suites": { type: "SuiteConfig", description: "Create and persist a new YAML test suite" },
              "GET /api/v1/suites/{name}": { type: "SuiteConfig", description: "Retrieve full YAML suite specification by name" },
              "POST /api/v1/suites/{name}/estimate": { type: "CostEstimateResponse", description: "Estimate token count and dollar cost for a suite" },
              "POST /api/v1/evaluate/run": { type: "SuiteRunResult", description: "Execute a full evaluation suite synchronously" },
              "POST /api/v1/evaluate/playground": { type: "TestCaseResult", description: "Execute a single test case from the workbench" },
              "GET /api/v1/runs": { type: "SuiteRunResult[]", description: "Query historical run traces with limit filter (up to 1000)" },
              "DELETE /api/v1/runs/{id}": { type: "message", description: "Permanently delete an evaluation run trace and test results" },
              "GET /api/v1/runs/{id}/baseline-comparison": { type: "BaselineComparison", description: "Compare a run with its suite's current saved baseline; 404 if run or baseline is absent, 400 for an invalid comparison" },
              "GET /api/v1/baselines/{suite_name}": { type: "BaselineSnapshot | null", description: "Get the saved baseline snapshot; returns null when unset" },
              "PUT /api/v1/baselines/{suite_name}": { type: "BaselineSnapshot", description: 'Set or replace using {"run_id":"run_..."}; 404 for a missing run, 400 for an invalid baseline or suite mismatch' },
              "DELETE /api/v1/baselines/{suite_name}": { type: "message", description: "Remove the saved baseline; 404 when unset" },
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
          <p>
            Saved runs automatically use their suite&apos;s local baseline when set.
            Results include <code>metadata.baseline_comparison</code>. The comparison
            endpoint above uses the current baseline; stored run metadata preserves
            the comparison from execution time.
          </p>
          <div className="space-y-2">
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-xs text-zinc-300">
              <span className="text-white font-bold">evalgate studio</span> --port 8000 : Starts backend API and Next.js frontend
            </div>
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-xs text-zinc-300">
              <span className="text-white font-bold">evalgate run</span> &lt;path.yaml&gt; : Runs evaluation suite in terminal
            </div>
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-xs text-zinc-300">
              <span className="text-white font-bold">evalgate cost</span> &lt;path.yaml&gt; : Estimates token burn and dollar cost
            </div>
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-xs text-zinc-300">
              <span className="text-white font-bold">evalgate baseline</span> &lt;run_id&gt; --output baseline.json : Saves a successful run as the suite baseline and optionally exports JSON
            </div>
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-xs text-zinc-300">
              <span className="text-white font-bold">evalgate run</span> &lt;path.yaml&gt; --baseline baseline.json --no-save --json : Checks a portable baseline without saving results
            </div>
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-xs text-zinc-300">
              <span className="text-white font-bold">evalgate mcp</span> --transport stdio : Launches the Model Context Protocol server
            </div>
          </div>
        </section>
      </div>
    ),
  },

  mcp: {
    slug: "mcp",
    title: "Model Context Protocol (MCP)",
    description: "Equip AI coding agents (Claude Desktop, Cursor, Antigravity, Windsurf) with native prompt evaluation, cost estimation, and quality gate tools.",
    category: "DevOps & Reference",
    toc: [
      { title: "Overview & Architecture", url: "#overview", depth: 2 },
      { title: "Registered MCP Tools", url: "#tools", depth: 2 },
      { title: "Tool Specifications & Schemas", url: "#tool-schemas", depth: 2 },
      { title: "Client Configuration", url: "#client-config", depth: 2 },
      { title: "Running the Server", url: "#running-server", depth: 2 },
    ],
    content: (
      <div className="space-y-8 text-sm leading-relaxed">
        <section id="overview" className="space-y-4">
          <h2 className="text-xl font-bold text-white tracking-tight border-b border-border/60 pb-2">
            Overview & Architecture
          </h2>
          <p className="text-zinc-300">
            EvalGate includes a native <strong>Model Context Protocol (MCP) Server</strong> (<code>evalgate.mcp.server</code>) that exposes your test suites, preflight cost estimators, model arena shootouts, and historical regression metrics directly to AI coding assistants.
          </p>

          <Callout type="info" title="Zero-Context Prompt Iteration">
            When connected via MCP, an AI coding agent can autonomously run regression tests whenever it edits a prompt template, verify whether pass rates exceed the gate threshold, and inspect failed assertion reasons without leaving the chat window.
          </Callout>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            <div className="p-3.5 rounded-lg border border-border bg-card space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <Cpu className="h-4 w-4 text-sky-400" />
                <span>Local & Stdio Safe</span>
              </div>
              <p className="text-xs text-zinc-400">
                Runs as a standard subprocess over <code>stdio</code> with zero network exposure required.
              </p>
            </div>
            <div className="p-3.5 rounded-lg border border-border bg-card space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <Zap className="h-4 w-4 text-emerald-400" />
                <span>Pre-flight Cost Guard</span>
              </div>
              <p className="text-xs text-zinc-400">
                AI agents can estimate token burn and \$USD cost before executing large test suites.
              </p>
            </div>
            <div className="p-3.5 rounded-lg border border-border bg-card space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <ShieldCheck className="h-4 w-4 text-amber-400" />
                <span>Quality Gate Enforcer</span>
              </div>
              <p className="text-xs text-zinc-400">
                Returns explicit pass/fail verdicts, failure reasons, and latency distribution deltas.
              </p>
            </div>
          </div>
        </section>

        <section id="tools" className="space-y-4">
          <h2 className="text-xl font-bold text-white tracking-tight border-b border-border/60 pb-2">
            Registered MCP Tools
          </h2>
          <p className="text-zinc-300">
            The EvalGate MCP server registers <strong>7 high-level tools</strong>:
          </p>

          <TypeTable
            type={{
              "evalgate_run_suite": {
                type: "Function",
                description: "Execute a suite, enforce quality and saved baseline gates, and return failure diagnostics plus baseline_comparison when a baseline exists.",
              },
              "evalgate_estimate_cost": {
                type: "Function",
                description: "Calculate pre-flight token footprint and USD cost for a test suite without making external inference calls.",
              },
              "evalgate_compare_models": {
                type: "Function",
                description: "Run an A/B benchmark shootout comparing two LLMs side-by-side on the same evaluation suite.",
              },
              "evalgate_evaluate_completion": {
                type: "Function",
                description: "Evaluate raw completion text on-the-fly against assertion configs without creating a suite file.",
              },
              "evalgate_list_runs": {
                type: "Function",
                description: "List recent historical evaluation runs from the local SQLite storage engine.",
              },
              "evalgate_get_historical_trends": {
                type: "Function",
                description: "Fetch historical pass rate, P50/P95 latency, and token cost time-series regression trends.",
              },
              "evalgate_list_suites": {
                type: "Function",
                description: "Scan the repository workspace and list all available evaluation suite YAML files.",
              },
            }}
          />
        </section>

        <section id="tool-schemas" className="space-y-4">
          <h2 className="text-xl font-bold text-white tracking-tight border-b border-border/60 pb-2">
            Tool Specifications & Schemas
          </h2>

          <Accordions>
            <Accordion title="1. evalgate_run_suite">
              <div className="space-y-3">
                <p className="text-xs text-zinc-300">
                  Executes a full test suite YAML specification, records telemetry to SQLite, and returns pass/fail status.
                </p>
                <TypeTable
                  type={{
                    "suite_path": { type: "string (required)", description: "Path to suite YAML file (e.g. 'evals/rag_qa.yaml')" },
                    "model_override": { type: "string (optional)", description: "Model override (e.g. 'openai/gpt-4o-mini', 'mock/simulator')" },
                    "concurrency": { type: "integer (default: 10)", description: "Number of parallel test case executions" },
                  }}
                />
              </div>
            </Accordion>

            <Accordion title="2. evalgate_estimate_cost">
              <div className="space-y-3">
                <p className="text-xs text-zinc-300">
                  Calculates estimated token counts and dollar cost using prompt template variables and target model pricing.
                </p>
                <TypeTable
                  type={{
                    "suite_path": { type: "string (required)", description: "Path to the evaluation suite YAML file" },
                    "model": { type: "string (optional)", description: "Target model identifier to price against" },
                    "estimated_output_tokens_per_test": { type: "integer (default: 150)", description: "Anticipated completion tokens per test" },
                  }}
                />
              </div>
            </Accordion>

            <Accordion title="3. evalgate_compare_models">
              <div className="space-y-3">
                <p className="text-xs text-zinc-300">
                  Executes an A/B benchmark shootout between Model A and Model B, reporting pass rate deltas and speed/cost trade-offs.
                </p>
                <TypeTable
                  type={{
                    "suite_path": { type: "string (required)", description: "Path to suite YAML file" },
                    "model_a": { type: "string (required)", description: "First candidate model (e.g. 'openai/gpt-4o-mini')" },
                    "model_b": { type: "string (required)", description: "Second candidate model (e.g. 'anthropic/claude-3-5-sonnet')" },
                    "concurrency": { type: "integer (default: 10)", description: "Concurrent test executions" },
                  }}
                />
              </div>
            </Accordion>

            <Accordion title="4. evalgate_evaluate_completion">
              <div className="space-y-3">
                <p className="text-xs text-zinc-300">
                  Allows an AI assistant to evaluate an ad-hoc text output against deterministic or semantic assertion lists.
                </p>
                <TypeTable
                  type={{
                    "completion": { type: "string (required)", description: "Raw LLM output string to validate" },
                    "assertions": { type: "AssertionConfig[] (required)", description: "List of assertion objects (e.g. [{'type': 'contains', 'value': 'OK'}])" },
                    "context": { type: "string[] (optional)", description: "Retrieved context passages for RAG grounding metrics" },
                    "ground_truth": { type: "string (optional)", description: "Reference ground truth string" },
                    "judge_model": { type: "string (default: 'openai/gpt-4o-mini')", description: "LLM-as-a-judge model for semantic metrics" },
                  }}
                />
              </div>
            </Accordion>

            <Accordion title="5. evalgate_list_suites & evalgate_list_runs">
              <div className="space-y-3">
                <p className="text-xs text-zinc-300">
                  Discovery tools for finding existing test suites in the repository and inspecting historical execution runs.
                </p>
                <TypeTable
                  type={{
                    "evalgate_list_suites.search_dir": { type: "string (default: 'evals')", description: "Directory to scan for YAML suites" },
                    "evalgate_list_runs.suite_name": { type: "string (optional)", description: "Filter run traces by specific suite name" },
                    "evalgate_list_runs.limit": { type: "integer (default: 20)", description: "Maximum number of runs to return" },
                  }}
                />
              </div>
            </Accordion>
          </Accordions>
        </section>

        <section id="client-config" className="space-y-4">
          <h2 className="text-xl font-bold text-white tracking-tight border-b border-border/60 pb-2">
            Client Configuration
          </h2>
          <p className="text-zinc-300">
            Configure your AI coding assistant or desktop app to connect to EvalGate:
          </p>

          <CodeTabs
            tabs={[
              {
                label: "Claude Desktop",
                language: "json",
                filename: "claude_desktop_config.json",
                code: `{
  "mcpServers": {
    "evalgate": {
      "command": "uv",
      "args": [
        "run",
        "--directory",
        "/absolute/path/to/evalgate",
        "evalgate",
        "mcp",
        "--transport",
        "stdio"
      ],
      "env": {
        "OPENAI_API_KEY": "sk-...",
        "ANTHROPIC_API_KEY": "sk-ant-..."
      }
    }
  }
}`,
              },
              {
                label: "Cursor / Windsurf",
                language: "json",
                filename: ".cursor/mcp.json",
                code: `{
  "mcpServers": {
    "evalgate": {
      "command": "evalgate",
      "args": ["mcp", "--transport", "stdio"],
      "env": {
        "OPENAI_API_KEY": "\${env:OPENAI_API_KEY}"
      }
    }
  }
}`,
              },
              {
                label: "Antigravity Sidecar",
                language: "json",
                filename: "~/.gemini/antigravity/mcp/evalgate.json",
                code: `{
  "name": "evalgate",
  "command": "uv",
  "args": ["run", "evalgate", "mcp", "--transport", "stdio"]
}`,
              },
            ]}
          />
        </section>

        <section id="running-server" className="space-y-4">
          <h2 className="text-xl font-bold text-white tracking-tight border-b border-border/60 pb-2">
            Running the Server
          </h2>
          <p className="text-zinc-300">
            You can also launch the MCP server manually from the terminal with <code>stdio</code> or <code>sse</code> transport:
          </p>

          <Steps>
            <Step number={1} title="Run over Standard I/O (Default for Desktop & CLI Agents)">
              <CodeBlock
                language="bash"
                code="uv run evalgate mcp --transport stdio"
              />
            </Step>
            <Step number={2} title="Run over Server-Sent Events (SSE for Web & Remote Services)">
              <CodeBlock
                language="bash"
                code="uv run evalgate mcp --transport sse"
              />
            </Step>
          </Steps>
        </section>
      </div>
    ),
  },

  license: {
    slug: "license",
    title: "Open Source License",
    description: "EvalGate is open-source software released under the permissive MIT License.",
    category: "DevOps & Reference",
    toc: [
      { title: "MIT License", url: "#mit-license", depth: 2 },
      { title: "Commercial Use & Permissions", url: "#permissions", depth: 2 },
      { title: "Third-Party Acknowledgments", url: "#third-party", depth: 2 },
    ],
    content: (
      <div className="space-y-8 text-sm leading-relaxed">
        <section id="mit-license" className="space-y-4">
          <h2 className="text-xl font-bold text-white tracking-tight border-b border-border/60 pb-2">
            MIT License
          </h2>
          <p className="text-zinc-300">
            Copyright (c) 2026 EvalGate Contributors
          </p>

          <CodeBlock
            language="text"
            filename="LICENSE"
            code={`MIT License

Copyright (c) 2026 EvalGate Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`}
          />
        </section>

        <section id="permissions" className="space-y-4">
          <h2 className="text-xl font-bold text-white tracking-tight border-b border-border/60 pb-2">
            Commercial Use & Permissions
          </h2>
          <p className="text-zinc-300">
            The MIT License is a permissive license that is short and to the point. It lets people do anything they want with your code as long as they provide attribution back to you and don’t hold you liable.
          </p>

          <TypeTable
            type={{
              Commercial_Use: { type: "Allowed", description: "You can use EvalGate commercially in proprietary enterprise software and SaaS applications." },
              Modification: { type: "Allowed", description: "You can modify, fork, and adapt the source code to fit your team's workflows." },
              Distribution: { type: "Allowed", description: "You can distribute original or modified copies of the software." },
              Private_Use: { type: "Allowed", description: "You can run EvalGate internally across private VPCs, air-gapped clusters, or local machines." },
              Liability_Warranty: { type: "None", description: "The software is provided as-is without warranty of any kind." },
            }}
          />
        </section>

        <section id="third-party" className="space-y-4">
          <h2 className="text-xl font-bold text-white tracking-tight border-b border-border/60 pb-2">
            Third-Party Acknowledgments
          </h2>
          <p className="text-zinc-300">
            EvalGate is built upon outstanding open-source libraries and foundations:
          </p>

          <Cards>
            <Card
              title="FastAPI & Starlette"
              href="https://fastapi.tiangolo.com"
              description="High-performance async Python backend framework."
            />
            <Card
              title="LangChain & LangGraph"
              href="https://langchain.com"
              description="Graph-based asynchronous execution engine."
            />
            <Card
              title="Next.js & React 19"
              href="https://nextjs.org"
              description="React framework with App Router and Turbopack compiler."
            />
            <Card
              title="Models.dev (SST)"
              href="https://models.dev"
              description="Open-source catalog and pricing index of frontier AI models."
            />
          </Cards>
        </section>
      </div>
    ),
  },
};
