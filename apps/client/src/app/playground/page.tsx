"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { api } from "@/lib/api";
import { formatCost, formatMs, formatPercent } from "@/lib/utils";
import { AssertionConfig, AssertionType, TestCaseResult } from "@/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Boxes,
  Check,
  CheckCircle2,
  Clock,
  Coins,
  Copy,
  Cpu,
  Eye,
  FileCode,
  HelpCircle,
  History,
  Layers,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Scale,
  Sparkles,
  Terminal,
  Trash2,
  XCircle,
  Zap,
} from "lucide-react";

const SUPPORTED_MODELS = [
  { id: "openai/gpt-4o-mini", label: "OpenAI GPT-4o-mini" },
  { id: "openai/gpt-4o", label: "OpenAI GPT-4o" },
  { id: "anthropic/claude-3-5-sonnet", label: "Anthropic Claude 3.5 Sonnet" },
  { id: "google/gemini-2.0-flash", label: "Google Gemini 2.0 Flash" },
  { id: "deepseek/deepseek-v4-pro-0813", label: "DeepSeek v4 Pro" },
  { id: "mock/simulator", label: "Mock Simulator (Offline $0.00)" },
];

const MODEL_PRICES: Record<string, { input: number; output: number }> = {
  "openai/gpt-4o-mini": { input: 0.15, output: 0.6 },
  "openai/gpt-4o": { input: 2.5, output: 10.0 },
  "anthropic/claude-3-5-sonnet": { input: 3.0, output: 15.0 },
  "google/gemini-2.0-flash": { input: 0.1, output: 0.4 },
  "deepseek/deepseek-v4-pro-0813": { input: 0.14, output: 0.28 },
  "mock/simulator": { input: 0.0, output: 0.0 },
};

const DETERMINISTIC_TYPES: { type: AssertionType; label: string; placeholder: string }[] = [
  { type: "contains", label: "Contains String", placeholder: 'e.g. "$45.2M"' },
  { type: "not_contains", label: "Not Contains", placeholder: 'e.g. "confidential"' },
  { type: "exact", label: "Exact Match", placeholder: "Exact expected response" },
  { type: "starts_with", label: "Starts With", placeholder: 'e.g. "SELECT"' },
  { type: "ends_with", label: "Ends With", placeholder: 'e.g. ";"' },
  { type: "regex", label: "Regular Expression", placeholder: "^[A-Z]{3}-\\d{4}$" },
  { type: "json_schema", label: "Valid JSON Schema", placeholder: '{"type": "object", ...}' },
  { type: "python_ast", label: "Python AST Syntax", placeholder: "" },
  { type: "sql_syntax", label: "SQL Syntax Validity", placeholder: "" },
  { type: "max_latency_ms", label: "Max Latency (ms)", placeholder: "2500" },
  { type: "max_tokens", label: "Max Tokens", placeholder: "500" },
  { type: "max_cost_usd", label: "Max Cost (USD)", placeholder: "0.005" },
];

const SEMANTIC_TYPES: { type: AssertionType; label: string; description: string }[] = [
  {
    type: "faithfulness",
    label: "Faithfulness (RAG)",
    description: "Verifies claims in completion are strictly grounded in retrieved context.",
  },
  {
    type: "hallucination",
    label: "Hallucination Detection",
    description: "Detects fabricated facts, false premises, or ungrounded statements.",
  },
  {
    type: "relevancy",
    label: "Answer Relevancy",
    description: "Ensures completion directly addresses user query without fluff.",
  },
  {
    type: "coherence",
    label: "Logical Coherence",
    description: "Evaluates sentence transitions, clarity, and structural reasoning.",
  },
  {
    type: "bias",
    label: "Fairness & Toxicity",
    description: "Flags demographic bias, toxic language, and harmful stereotypes.",
  },
  {
    type: "intent",
    label: "Intent Fulfillment",
    description: "Verifies that the requested action or task goal was carried out.",
  },
  {
    type: "dynamic_rubric",
    label: "Dynamic Rubric",
    description: "Evaluates completion against custom plain-English grading rules.",
  },
];

const STARTER_PRESETS = [
  {
    name: "RAG Financial QA",
    model: "openai/gpt-4o-mini",
    judgeModel: "openai/gpt-4o-mini",
    systemPrompt: "You are a precise financial analyst assistant. Answer user queries concisely using facts from context.",
    template: "Context: {{context}}\n\nQuestion: {{question}}\n\nAnswer:",
    variables: [
      {
        key: "context",
        value: "ACME Corp reported Q3 2024 revenue of $45.2M, up 12% YoY with net margin of 18.5%.",
      },
      { key: "question", value: "What was ACME Corp's Q3 revenue and net margin?" },
    ],
    assertions: [
      { type: "contains" as AssertionType, value: "$45.2M", strict: true },
      { type: "contains" as AssertionType, value: "18.5%", strict: true },
      { type: "faithfulness" as AssertionType, threshold: 0.85, strict: true },
      { type: "hallucination" as AssertionType, threshold: 0.85, strict: true },
    ],
  },
  {
    name: "Support Ticket Classifier",
    model: "openai/gpt-4o-mini",
    judgeModel: "openai/gpt-4o-mini",
    systemPrompt: "Classify support tickets into priority (HIGH, MEDIUM, LOW) and return structured JSON.",
    template: 'Ticket: "{{ticket}}"\n\nOutput JSON with fields: {"priority": "...", "category": "..."}',
    variables: [
      {
        key: "ticket",
        value: "My production database has been completely down for 20 minutes! We are losing revenue!",
      },
    ],
    assertions: [
      { type: "contains" as AssertionType, value: "HIGH", strict: true },
      { type: "json_schema" as AssertionType, value: '{"type": "object", "properties": {"priority": {"type": "string"}}, "required": ["priority"]}', strict: true },
      { type: "intent" as AssertionType, threshold: 0.9, strict: true },
    ],
  },
  {
    name: "Text-to-SQL Generator",
    model: "openai/gpt-4o-mini",
    judgeModel: "openai/gpt-4o-mini",
    systemPrompt: "Generate valid PostgreSQL queries based on the database schema.",
    template: "Schema: {{schema}}\n\nUser Request: {{query}}\n\nSQL:",
    variables: [
      {
        key: "schema",
        value: "users(id INT, email VARCHAR, created_at TIMESTAMP, plan VARCHAR)",
      },
      { key: "query", value: "Find all users on the 'enterprise' plan created in 2024" },
    ],
    assertions: [
      { type: "starts_with" as AssertionType, value: "SELECT", strict: true },
      { type: "sql_syntax" as AssertionType, strict: true },
      { type: "contains" as AssertionType, value: "enterprise", strict: true },
    ],
  },
];

interface HistoryItem {
  id: string;
  timestamp: Date;
  model: string;
  judgeModel: string;
  result: TestCaseResult;
  config: {
    systemPrompt: string;
    template: string;
    variables: Array<{ key: string; value: string }>;
    assertions: AssertionConfig[];
  };
}

export default function PlaygroundPage() {
  const queryClient = useQueryClient();

  // Workbench Form State
  const [model, setModel] = useState("openai/gpt-4o-mini");
  const [judgeModel, setJudgeModel] = useState("openai/gpt-4o-mini");
  const [systemPrompt, setSystemPrompt] = useState(STARTER_PRESETS[0].systemPrompt);
  const [template, setTemplate] = useState(STARTER_PRESETS[0].template);
  const [templateTab, setTemplateTab] = useState<"template" | "preview">("template");

  const [variables, setVariables] = useState<Array<{ key: string; value: string }>>(
    STARTER_PRESETS[0].variables
  );
  const [assertions, setAssertions] = useState<AssertionConfig[]>(
    STARTER_PRESETS[0].assertions
  );

  // Execution & Results
  const [result, setResult] = useState<TestCaseResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Save Suite Form
  const [suiteName, setSuiteName] = useState("");
  const [suiteDescription, setSuiteDescription] = useState("");
  const [suiteMinPassRate, setSuiteMinPassRate] = useState(1.0);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Mobile Tabs
  const [mobileTab, setMobileTab] = useState<"configure" | "results">("configure");

  // TanStack Mutation: Run Evaluation
  const evaluateMutation = useMutation({
    mutationFn: async () => {
      const varsMap: Record<string, any> = {};
      variables.forEach((v) => {
        if (v.key.trim()) varsMap[v.key.trim()] = v.value;
      });

      return api.evaluatePlayground({
        target: {
          type: "prompt",
          model,
          system_prompt: systemPrompt || undefined,
          template,
          temperature: 0.0,
        },
        test_case: {
          id: "playground-run",
          vars: varsMap,
        },
        assertions,
        judge_model: judgeModel,
      });
    },
    onSuccess: (data) => {
      setResult(data);
      setMobileTab("results");
      setHistory((prev) => [
        {
          id: `hist_${Date.now()}`,
          timestamp: new Date(),
          model,
          judgeModel,
          result: data,
          config: {
            systemPrompt,
            template,
            variables: [...variables],
            assertions: [...assertions],
          },
        },
        ...prev.slice(0, 9),
      ]);
    },
  });

  // Save as Suite Mutation
  const saveSuiteMutation = useMutation({
    mutationFn: async () => {
      const varsMap: Record<string, any> = {};
      variables.forEach((v) => {
        if (v.key.trim()) varsMap[v.key.trim()] = v.value;
      });

      const formattedName = suiteName.trim().toLowerCase().replace(/\s+/g, "-");

      return api.createSuite(
        {
          name: formattedName,
          description: suiteDescription || "Exported from Evaluation Playground",
          min_pass_rate: suiteMinPassRate,
          target: {
            type: "prompt",
            model,
            system_prompt: systemPrompt || undefined,
            template,
            temperature: 0.0,
          },
          tests: [
            {
              id: `${formattedName}-case-1`,
              description: "Playground exported test case",
              vars: varsMap,
              assertions,
            },
          ],
        },
        `${formattedName}.yaml`
      );
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["suites"] });
      setSaveSuccessMessage(`Suite saved successfully to ${data.path}`);
      setTimeout(() => {
        setIsSaveModalOpen(false);
        setSaveSuccessMessage(null);
      }, 1500);
    },
  });

  // Rendered Prompt Preview Computation
  const { renderedPrompt, detectedVariables, missingVariables } = useMemo(() => {
    const varsMap: Record<string, string> = {};
    variables.forEach((v) => {
      if (v.key.trim()) varsMap[v.key.trim()] = v.value;
    });

    const matches = template.match(/\{\{([a-zA-Z0-9_-]+)\}\}/g) || [];
    const detected = Array.from(new Set(matches.map((m) => m.replace(/[{}]/g, "").trim())));
    const missing = detected.filter((k) => varsMap[k] === undefined);

    let rendered = template;
    for (const [k, v] of Object.entries(varsMap)) {
      rendered = rendered.replaceAll(`{{${k}}}`, v);
    }

    return {
      renderedPrompt: rendered,
      detectedVariables: detected,
      missingVariables: missing,
    };
  }, [template, variables]);

  // Preflight Call Breakdown & Cost Calculation
  const { targetCalls, judgeCalls, estimatedTokens, estimatedCostUSD } = useMemo(() => {
    const isSemantic = (type: AssertionType) =>
      SEMANTIC_TYPES.some((s) => s.type === type);

    const semanticCount = assertions.filter((a) => isSemantic(a.type)).length;
    const targetPrice = MODEL_PRICES[model] || { input: 0.15, output: 0.6 };
    const judgePrice = MODEL_PRICES[judgeModel] || { input: 0.15, output: 0.6 };

    // Estimate input tokens from systemPrompt + renderedPrompt (~4 chars/token)
    const promptLen = (systemPrompt?.length || 0) + renderedPrompt.length;
    const estInputTokens = Math.max(20, Math.round(promptLen / 3.8));
    const estOutputTokens = 150; // average completion estimate

    const targetCost =
      (estInputTokens / 1_000_000) * targetPrice.input +
      (estOutputTokens / 1_000_000) * targetPrice.output;

    const judgePromptTokens = estInputTokens + estOutputTokens + 200; // judge prompt wraps completion
    const judgeOutputTokens = 80;
    const singleJudgeCost =
      (judgePromptTokens / 1_000_000) * judgePrice.input +
      (judgeOutputTokens / 1_000_000) * judgePrice.output;

    const totalJudgeCost = singleJudgeCost * semanticCount;
    const totalCost = targetCost + totalJudgeCost;

    return {
      targetCalls: 1,
      judgeCalls: semanticCount,
      estimatedTokens: estInputTokens + estOutputTokens + (judgePromptTokens + judgeOutputTokens) * semanticCount,
      estimatedCostUSD: totalCost,
    };
  }, [assertions, model, judgeModel, systemPrompt, renderedPrompt]);

  // Assertions Grouping
  const deterministicAssertions = assertions.filter(
    (a) => !SEMANTIC_TYPES.some((s) => s.type === a.type)
  );
  const semanticAssertions = assertions.filter((a) =>
    SEMANTIC_TYPES.some((s) => s.type === a.type)
  );

  // Handlers
  const addVariable = () => {
    setVariables([...variables, { key: `var_${variables.length + 1}`, value: "" }]);
  };

  const removeVariable = (index: number) => {
    setVariables(variables.filter((_, i) => i !== index));
  };

  const updateVariable = (index: number, field: "key" | "value", val: string) => {
    const updated = [...variables];
    updated[index][field] = val;
    setVariables(updated);
  };

  const addDeterministicAssertion = (type: AssertionType = "contains") => {
    setAssertions([...assertions, { type, value: "", strict: true }]);
  };

  const addSemanticAssertion = (type: AssertionType = "faithfulness") => {
    setAssertions([...assertions, { type, threshold: 0.85, strict: true }]);
  };

  const removeAssertion = (index: number) => {
    setAssertions(assertions.filter((_, i) => i !== index));
  };

  const updateAssertion = (index: number, updates: Partial<AssertionConfig>) => {
    const updated = [...assertions];
    updated[index] = { ...updated[index], ...updates };
    setAssertions(updated);
  };

  const handleCopyCompletion = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleResetDefaults = () => {
    const preset = STARTER_PRESETS[0];
    setModel(preset.model);
    setJudgeModel(preset.judgeModel);
    setSystemPrompt(preset.systemPrompt);
    setTemplate(preset.template);
    setVariables(preset.variables);
    setAssertions(preset.assertions);
    setResult(null);
  };

  const handleLoadPreset = (presetName: string) => {
    const p = STARTER_PRESETS.find((s) => s.name === presetName);
    if (!p) return;
    setModel(p.model);
    setJudgeModel(p.judgeModel);
    setSystemPrompt(p.systemPrompt);
    setTemplate(p.template);
    setVariables(p.variables);
    setAssertions(p.assertions);
    setResult(null);
  };

  const handleRestoreHistory = (item: HistoryItem) => {
    setModel(item.model);
    setJudgeModel(item.judgeModel);
    setSystemPrompt(item.config.systemPrompt);
    setTemplate(item.config.template);
    setVariables(item.config.variables);
    setAssertions(item.config.assertions);
    setResult(item.result);
    setIsHistoryOpen(false);
  };

  return (
    <TooltipProvider>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header Title */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-semibold tracking-tight text-white flex items-center gap-2">
                <Terminal className="h-5 w-5 text-white" />
                Evaluation Workbench
              </h1>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Design prompts, inject test variables, and enforce deterministic & semantic LLM-as-a-judge quality gates.
            </p>
          </div>

          {/* Quick Presets Picker */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 hidden sm:inline">Preset:</span>
            <Select onValueChange={handleLoadPreset}>
              <SelectTrigger className="w-52 h-8 text-xs font-mono">
                <SelectValue placeholder="Load Starter Template" />
              </SelectTrigger>
              <SelectContent>
                {STARTER_PRESETS.map((p) => (
                  <SelectItem key={p.name} value={p.name} className="text-xs">
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 2. Sticky Action Toolbar */}
        <div className="sticky top-14 z-30 -mx-3 sm:-mx-5 md:-mx-8 px-3 sm:px-5 md:px-8 py-2.5 bg-background/95 backdrop-blur border-b border-border flex flex-wrap items-center justify-between gap-3 shadow-sm">
          {/* Left: Quick Model Selectors & Preflight Badges */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-zinc-500 uppercase font-mono">Target:</span>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="w-44 h-8 text-xs font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_MODELS.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="text-xs font-mono">
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-zinc-500 uppercase font-mono">Judge:</span>
              <Select value={judgeModel} onValueChange={setJudgeModel}>
                <SelectTrigger className="w-44 h-8 text-xs font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_MODELS.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="text-xs font-mono">
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Preflight Specs Pill */}
            <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded bg-zinc-950 border border-border text-[11px] font-mono text-zinc-400">
              <span>
                {targetCalls} Target + {judgeCalls} Judge {judgeCalls === 1 ? "Call" : "Calls"}
              </span>
              <span>•</span>
              <span>Est. {formatCost(estimatedCostUSD)}</span>
            </div>
          </div>

          {/* Right: Primary Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetDefaults}
              className="h-8 text-xs gap-1.5 text-zinc-400 hover:text-white shrink-0 whitespace-nowrap"
              title="Reset workbench to default settings"
            >
              <RotateCcw className="h-3 w-3" />
              <span className="hidden sm:inline">Reset</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsHistoryOpen(true)}
              className="h-8 text-xs gap-1.5 text-zinc-400 hover:text-white relative shrink-0 whitespace-nowrap"
              title="View past workbench execution runs"
            >
              <History className="h-3 w-3" />
              <span className="hidden sm:inline">History</span>
              {history.length > 0 && (
                <span className="ml-1 px-1 rounded-full bg-zinc-800 text-[10px] text-zinc-300 font-mono">
                  {history.length}
                </span>
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSuiteName(`playground-${Date.now().toString().slice(-4)}`);
                setIsSaveModalOpen(true);
              }}
              className="h-8 text-xs gap-1.5 text-zinc-300 hover:text-white shrink-0 whitespace-nowrap"
            >
              <Save className="h-3 w-3" />
              <span className="hidden sm:inline">Save as Suite</span>
            </Button>

            <Button
              onClick={() => evaluateMutation.mutate()}
              disabled={evaluateMutation.isPending}
              variant="default"
              size="sm"
              className="h-8 text-xs gap-1.5 px-4 shrink-0 whitespace-nowrap"
            >
              {evaluateMutation.isPending ? (
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full border-2 border-black border-t-transparent animate-spin" />
                  Evaluating...
                </span>
              ) : (
                <>
                  <Play className="h-3 w-3 fill-current" />
                  Run Evaluation
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Tab Switcher (< lg screens) */}
        <div className="block lg:hidden">
          <Tabs value={mobileTab} onValueChange={(v) => setMobileTab(v as any)}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="configure" className="text-xs">
                Workbench & Config
              </TabsTrigger>
              <TabsTrigger value="results" className="text-xs relative">
                Results & Trace
                {result && (
                  <span className={`ml-1.5 h-2 w-2 rounded-full ${result.passed ? "bg-white" : "bg-zinc-500"}`} />
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Error Alert */}
        {evaluateMutation.isError && (
          <div className="p-3.5 rounded-lg border border-border bg-zinc-950 text-zinc-300 text-xs flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 text-zinc-400" />
            <span>{evaluateMutation.error.message}</span>
          </div>
        )}

        {/* Main Workspace: Left Workbench, Right Results Surface */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ========================================================================= */}
          {/* LEFT COLUMN: WORKBENCH (Prompt, Variables, Assertions)                    */}
          {/* ========================================================================= */}
          <div className={`lg:col-span-7 space-y-6 ${mobileTab === "results" ? "hidden lg:block" : "block"}`}>
            {/* 1. System Prompt Instructions */}
            <Card className="border-border bg-card">
              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-semibold text-white flex items-center gap-2">
                  <Terminal className="h-3.5 w-3.5 text-zinc-400" />
                  System Instructions
                </CardTitle>
                <span className="text-[10px] text-zinc-500 font-mono">Optional persona & behavior</span>
              </CardHeader>
              <CardContent className="p-4 pt-1">
                <Textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={2}
                  placeholder="You are a helpful and precise assistant..."
                  className="font-mono text-xs bg-zinc-950 border-border resize-y leading-relaxed"
                />
              </CardContent>
            </Card>

            {/* 2. Prompt Template & Live Rendered Preview */}
            <Card className="border-border bg-card">
              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCode className="h-3.5 w-3.5 text-zinc-400" />
                  <CardTitle className="text-xs font-semibold text-white">Prompt Template</CardTitle>
                </div>
                <div className="flex items-center gap-1.5">
                  <Tabs value={templateTab} onValueChange={(v) => setTemplateTab(v as any)}>
                    <TabsList className="h-7 p-0.5 bg-zinc-900 border border-zinc-800">
                      <TabsTrigger value="template" className="h-6 text-[11px] px-2">
                        Template
                      </TabsTrigger>
                      <TabsTrigger value="preview" className="h-6 text-[11px] px-2">
                        <Eye className="h-3 w-3 mr-1" />
                        Live Rendered Preview
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-1 space-y-2">
                {templateTab === "template" ? (
                  <Textarea
                    value={template}
                    onChange={(e) => setTemplate(e.target.value)}
                    rows={6}
                    placeholder="Enter prompt template with {{variables}}..."
                    className="font-mono text-xs bg-zinc-950 border-border resize-y leading-relaxed"
                  />
                ) : (
                  <div className="p-3 rounded-md bg-zinc-950 border border-border font-mono text-xs text-zinc-200 whitespace-pre-wrap min-h-[140px] leading-relaxed select-text">
                    {renderedPrompt || <span className="text-zinc-600 italic">No prompt content</span>}
                  </div>
                )}

                {/* Variable Resolution Status Strip */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-500">Variables in template:</span>
                    {detectedVariables.length === 0 ? (
                      <span className="text-zinc-500">None detected</span>
                    ) : (
                      detectedVariables.map((v) => (
                        <Badge
                          key={v}
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 border-zinc-800 bg-zinc-950 text-zinc-300"
                        >
                          {"{{"}
                          {v}
                          {"}}"}
                        </Badge>
                      ))
                    )}
                  </div>

                  {missingVariables.length > 0 ? (
                    <span className="text-zinc-400 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 text-zinc-400" />
                      Missing: {missingVariables.join(", ")}
                    </span>
                  ) : (
                    <span className="text-zinc-400 flex items-center gap-1">
                      <Check className="h-3 w-3 text-white" />
                      All variables resolved
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 3. Test Variables Editor */}
            <Card className="border-border bg-card">
              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xs font-semibold text-white flex items-center gap-2">
                    <Boxes className="h-3.5 w-3.5 text-zinc-400" />
                    Test Case Variables ({variables.length})
                  </CardTitle>
                  <CardDescription className="text-[11px] text-zinc-400 mt-0.5">
                    Dynamic values injected into template tags like <code className="text-zinc-300">{"{{key}}"}</code>.
                  </CardDescription>
                </div>
                <Button
                  onClick={addVariable}
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1 text-zinc-300 hover:text-white"
                >
                  <Plus className="h-3 w-3" />
                  Add Variable
                </Button>
              </CardHeader>
              <CardContent className="p-4 pt-1 space-y-3">
                {variables.map((v, idx) => (
                  <div key={idx} className="p-3 rounded-lg border border-border bg-zinc-950/60 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          value={v.key}
                          onChange={(e) => updateVariable(idx, "key", e.target.value)}
                          placeholder="variable_name"
                          className="h-7 w-44 font-mono text-xs bg-zinc-950 border-border"
                        />
                        <Badge variant="outline" className="text-[9px] px-1 py-0 border-zinc-800 text-zinc-500 font-mono">
                          {v.value.includes("\n") || v.value.length > 50 ? "multiline" : "string"}
                        </Badge>
                      </div>
                      <Button
                        onClick={() => removeVariable(idx)}
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-zinc-500 hover:text-white"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <Textarea
                      value={v.value}
                      onChange={(e) => updateVariable(idx, "value", e.target.value)}
                      rows={v.value.includes("\n") || v.value.length > 60 ? 3 : 1}
                      placeholder="Variable value or multiline context..."
                      className="font-mono text-xs bg-zinc-950 border-border resize-y leading-relaxed"
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* 4. Assertion & Quality Gate Rules */}
            <Card className="border-border bg-card">
              <CardHeader className="p-4 pb-2 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-xs font-semibold text-white flex items-center gap-2">
                    <Scale className="h-3.5 w-3.5 text-zinc-400" />
                    Assertions & Evaluation Gates ({assertions.length})
                  </CardTitle>
                  <CardDescription className="text-[11px] text-zinc-400 mt-0.5">
                    Deterministic string/regex validations and qualitative semantic LLM-as-a-judge gates.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <Select onValueChange={(val) => addDeterministicAssertion(val as AssertionType)}>
                    <SelectTrigger className="h-7 text-xs px-2.5 w-auto min-w-[130px] font-mono whitespace-nowrap gap-1.5 bg-zinc-900 border-zinc-800 text-zinc-200 hover:text-white">
                      <Plus className="h-3 w-3 shrink-0" />
                      <span>Deterministic</span>
                    </SelectTrigger>
                    <SelectContent>
                      {DETERMINISTIC_TYPES.map((dt) => (
                        <SelectItem key={dt.type} value={dt.type} className="text-xs font-mono">
                          {dt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select onValueChange={(val) => addSemanticAssertion(val as AssertionType)}>
                    <SelectTrigger className="h-7 text-xs px-2.5 w-auto min-w-[145px] font-mono whitespace-nowrap gap-1.5 bg-zinc-900 border-zinc-800 text-zinc-200 hover:text-white">
                      <Plus className="h-3 w-3 shrink-0" />
                      <span>Semantic Judge</span>
                    </SelectTrigger>
                    <SelectContent>
                      {SEMANTIC_TYPES.map((st) => (
                        <SelectItem key={st.type} value={st.type} className="text-xs font-mono">
                          {st.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-2 space-y-4">
                {/* A. Deterministic Assertions */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] uppercase font-mono font-semibold text-zinc-500">
                      Deterministic Checks ({deterministicAssertions.length})
                    </span>
                  </div>
                  {deterministicAssertions.length === 0 ? (
                    <div className="p-3 rounded border border-dashed border-border text-center text-[11px] text-zinc-500">
                      No deterministic assertions added.
                    </div>
                  ) : (
                    deterministicAssertions.map((a, dIdx) => {
                      const realIdx = assertions.indexOf(a);
                      const dtInfo = DETERMINISTIC_TYPES.find((d) => d.type === a.type);

                      return (
                        <div
                          key={`det_assert_${a.type}_${dIdx}`}
                          className="p-3 rounded-lg border border-border bg-zinc-950/70 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="font-mono text-[10px] border-zinc-700 bg-zinc-900 text-zinc-200">
                                {dtInfo?.label || a.type}
                              </Badge>
                            </div>

                            <div className="flex items-center gap-3">
                              {/* Strict Mode Switch */}
                              <div className="flex items-center gap-1.5">
                                <label className="text-[10px] text-zinc-400 font-mono">Strict</label>
                                <Switch
                                  checked={a.strict ?? true}
                                  onCheckedChange={(checked) =>
                                    updateAssertion(realIdx, { strict: checked })
                                  }
                                />
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <HelpCircle className="h-3 w-3 text-zinc-600 cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    Strict assertions fail the entire test if not satisfied.
                                  </TooltipContent>
                                </Tooltip>
                              </div>

                              <Button
                                onClick={() => removeAssertion(realIdx)}
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-zinc-500 hover:text-white"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>

                          {/* Value Input */}
                          {a.type !== "python_ast" && a.type !== "sql_syntax" && (
                            <Input
                              value={String(a.value ?? "")}
                              onChange={(e) => updateAssertion(realIdx, { value: e.target.value })}
                              placeholder={dtInfo?.placeholder || "Expected value"}
                              className="h-7 font-mono text-xs bg-zinc-950 border-border"
                            />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* B. Semantic LLM-as-a-Judge Assertions */}
                <div className="space-y-2 pt-2 border-t border-border/60">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] uppercase font-mono font-semibold text-zinc-500">
                      Semantic LLM-as-a-Judge Gates ({semanticAssertions.length})
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      Evaluated by {judgeModel.split("/").pop()}
                    </span>
                  </div>

                  {semanticAssertions.length === 0 ? (
                    <div className="p-3 rounded border border-dashed border-border text-center text-[11px] text-zinc-500">
                      No semantic judge metrics added.
                    </div>
                  ) : (
                    semanticAssertions.map((a, sIdx) => {
                      const realIdx = assertions.indexOf(a);
                      const stInfo = SEMANTIC_TYPES.find((s) => s.type === a.type);

                      return (
                        <div
                          key={`sem_assert_${a.type}_${sIdx}`}
                          className="p-3 rounded-lg border border-border bg-zinc-950/70 space-y-2.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="font-mono text-[10px] border-zinc-700 bg-zinc-900 text-zinc-200">
                                  {stInfo?.label || a.type}
                                </Badge>
                              </div>
                              <p className="text-[10px] text-zinc-500 mt-0.5">
                                {stInfo?.description}
                              </p>
                            </div>

                            <div className="flex items-center gap-3">
                              {/* Strict Switch */}
                              <div className="flex items-center gap-1.5">
                                <label className="text-[10px] text-zinc-400 font-mono">Strict</label>
                                <Switch
                                  checked={a.strict ?? true}
                                  onCheckedChange={(checked) =>
                                    updateAssertion(realIdx, { strict: checked })
                                  }
                                />
                              </div>

                              <Button
                                onClick={() => removeAssertion(realIdx)}
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-zinc-500 hover:text-white"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>

                          {/* Threshold Slider with Value */}
                          <div className="flex items-center gap-3 pt-1">
                            <span className="text-[11px] text-zinc-400 font-mono min-w-[70px]">
                              Threshold:
                            </span>
                            <input
                              type="range"
                              min="0.5"
                              max="1.0"
                              step="0.05"
                              value={a.threshold ?? 0.85}
                              onChange={(e) =>
                                updateAssertion(realIdx, {
                                  threshold: parseFloat(e.target.value),
                                })
                              }
                              className="flex-1 accent-white h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                            />
                            <span className="text-xs font-mono font-medium text-white w-12 text-right">
                              {formatPercent(a.threshold ?? 0.85)}
                            </span>
                          </div>

                          {/* Dynamic Rubric Custom Prompt Textarea */}
                          {a.type === "dynamic_rubric" && (
                            <div className="space-y-1 pt-1">
                              <label className="text-[10px] text-zinc-400 font-mono block">
                                Custom Grading Rubric (Plain English):
                              </label>
                              <Textarea
                                value={a.rubric || ""}
                                onChange={(e) =>
                                  updateAssertion(realIdx, { rubric: e.target.value })
                                }
                                rows={2}
                                placeholder="Explain grading rules, required keywords, or style criteria..."
                                className="font-mono text-xs bg-zinc-950 border-border"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ========================================================================= */}
          {/* RIGHT COLUMN: RESULTS & EXECUTION TRACE SURFACE                           */}
          {/* ========================================================================= */}
          <div className={`lg:col-span-5 space-y-5 sticky top-28 ${mobileTab === "configure" ? "hidden lg:block" : "block"}`}>
            {!result ? (
              /* PRE-RUN EVALUATION READINESS SURFACE */
              <Card className="border-border bg-card">
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-white" />
                    <CardTitle className="text-sm font-semibold text-white">
                      Evaluation Pre-Flight Readiness
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs text-zinc-400 mt-1">
                    System configuration and estimated invocation requirements.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5 pt-1 space-y-4">
                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 gap-2.5 p-3 rounded-lg bg-zinc-950 border border-border text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-zinc-500 uppercase block">Target Model</span>
                      <span className="font-medium text-zinc-200 truncate block">{model}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 uppercase block">Judge Model</span>
                      <span className="font-medium text-zinc-200 truncate block">{judgeModel}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 uppercase block">Invocations</span>
                      <span className="font-medium text-zinc-200">
                        {targetCalls} Target + {judgeCalls} Judge
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 uppercase block">Est. Cost</span>
                      <span className="font-medium text-zinc-200">{formatCost(estimatedCostUSD)}</span>
                    </div>
                  </div>

                  {/* Readiness Checklist */}
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-zinc-300">
                      <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                      <span>{variables.length} Variables defined and ready</span>
                    </div>
                    <div className="flex items-center gap-2 text-zinc-300">
                      <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                      <span>
                        {assertions.length} Quality Gate Assertions ({deterministicAssertions.length} deterministic, {semanticAssertions.length} judge)
                      </span>
                    </div>
                    {missingVariables.length > 0 && (
                      <div className="flex items-center gap-2 text-zinc-400">
                        <AlertTriangle className="h-3.5 w-3.5 text-zinc-400" />
                        <span>Warning: {missingVariables.length} missing variable(s)</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-border/60">
                    <Button
                      onClick={() => evaluateMutation.mutate()}
                      disabled={evaluateMutation.isPending}
                      variant="default"
                      className="w-full text-xs gap-1.5 h-9"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" />
                      Run Live Evaluation
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              /* POST-RUN RESULTS & TRACE SURFACE */
              <div className="space-y-4">
                {/* 1. Overall Pass / Fail Banner */}
                <Card className={`border ${result.passed ? "border-zinc-700 bg-zinc-950" : "border-zinc-800 bg-zinc-950"}`}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {result.passed ? (
                        <CheckCircle2 className="h-6 w-6 text-white" />
                      ) : (
                        <XCircle className="h-6 w-6 text-zinc-400" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-white">
                            {result.passed ? "QUALITY GATE PASSED" : "QUALITY GATE FAILED"}
                          </span>
                        </div>
                        <span className="text-xs text-zinc-400 mt-0.5 block">
                          {result.assertion_results.filter((a) => a.passed).length} of {result.assertion_results.length} assertions satisfied
                        </span>
                      </div>
                    </div>

                    <Button
                      onClick={() => evaluateMutation.mutate()}
                      disabled={evaluateMutation.isPending}
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1 text-zinc-300 hover:text-white"
                    >
                      <RefreshCw className={`h-3 w-3 ${evaluateMutation.isPending ? "animate-spin" : ""}`} />
                      Re-run
                    </Button>
                  </CardContent>
                </Card>

                {/* 2. Telemetry Metadata Bar */}
                <div className="grid grid-cols-3 gap-2.5 p-3 rounded-lg bg-zinc-950 border border-border text-xs font-mono text-center">
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase block">Latency</span>
                    <span className="font-medium text-white">{formatMs(result.latency_ms)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase block">Tokens</span>
                    <span className="font-medium text-white">{result.total_tokens}t</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase block">Cost</span>
                    <span className="font-medium text-white">{formatCost(result.cost_usd)}</span>
                  </div>
                </div>

                {/* 3. Generated Model Response */}
                <Card className="border-border bg-card">
                  <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-xs font-semibold text-white flex items-center gap-2">
                      <Terminal className="h-3.5 w-3.5 text-zinc-400" />
                      Generated Completion
                    </CardTitle>
                    <Button
                      onClick={() => handleCopyCompletion(result.completion || "")}
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[10px] text-zinc-400 hover:text-white gap-1"
                    >
                      {isCopied ? <Check className="h-3 w-3 text-white" /> : <Copy className="h-3 w-3" />}
                      {isCopied ? "Copied" : "Copy"}
                    </Button>
                  </CardHeader>
                  <CardContent className="p-4 pt-1">
                    <div className="p-3 rounded-md bg-black font-mono text-xs text-zinc-200 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto border border-zinc-900 select-text">
                      {result.completion || <span className="text-zinc-600 italic">No output generated</span>}
                    </div>
                  </CardContent>
                </Card>

                {/* 4. Assertion Breakdown Checklist */}
                <Card className="border-border bg-card">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-xs font-semibold text-white flex items-center gap-2">
                      <Scale className="h-3.5 w-3.5 text-zinc-400" />
                      Assertion Breakdown & Reasoning
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-1 space-y-2.5">
                    {result.assertion_results.map((a, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                          a.passed
                            ? "border-zinc-800 bg-zinc-950"
                            : "border-zinc-700 bg-zinc-900/90"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {a.passed ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-white shrink-0" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                            )}
                            <span className="font-mono font-medium text-white">{a.assertion_type}</span>
                          </div>
                          {a.score !== undefined && (
                            <Badge variant="outline" className="font-mono text-[10px] border-zinc-800 bg-zinc-950 text-zinc-300">
                              Score: {formatPercent(a.score)}
                            </Badge>
                          )}
                        </div>

                        {a.reason && (
                          <p className="text-[11px] text-zinc-400 leading-relaxed pl-5 font-mono">
                            {a.reason}
                          </p>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* MODAL: Save as Reusable YAML Suite                                       */}
        {/* ========================================================================= */}
        <Dialog open={isSaveModalOpen} onOpenChange={setIsSaveModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <Save className="h-4 w-4" />
                Save as Evaluation Suite
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                Convert this playground session into a reusable YAML test suite in <code className="text-zinc-300">./evals</code>.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div>
                <label className="text-[11px] font-medium text-zinc-400 block mb-1">
                  Suite Name
                </label>
                <Input
                  value={suiteName}
                  onChange={(e) => setSuiteName(e.target.value)}
                  placeholder="e.g. financial-qa-suite"
                  className="font-mono text-xs bg-zinc-950 border-border"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-zinc-400 block mb-1">
                  Description
                </label>
                <Input
                  value={suiteDescription}
                  onChange={(e) => setSuiteDescription(e.target.value)}
                  placeholder="Brief description of the test suite"
                  className="text-xs bg-zinc-950 border-border"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-zinc-400 block mb-1">
                  Required Minimum Pass Rate: {formatPercent(suiteMinPassRate)}
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="1.0"
                  step="0.05"
                  value={suiteMinPassRate}
                  onChange={(e) => setSuiteMinPassRate(parseFloat(e.target.value))}
                  className="w-full accent-white h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                />
              </div>

              {saveSuccessMessage && (
                <div className="p-2 rounded bg-zinc-900 border border-zinc-800 text-white font-mono text-[11px]">
                  {saveSuccessMessage}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSaveModalOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                onClick={() => saveSuiteMutation.mutate()}
                disabled={!suiteName.trim() || saveSuiteMutation.isPending}
                variant="default"
                size="sm"
                className="text-xs gap-1.5"
              >
                <Save className="h-3 w-3" />
                {saveSuiteMutation.isPending ? "Saving..." : "Save Suite"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ========================================================================= */}
        {/* DRAWER: Run History & Version Restore                                    */}
        {/* ========================================================================= */}
        <Sheet open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
          <SheetContent side="right" className="w-full sm:max-w-md bg-zinc-950 text-white border-l border-border p-6 overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <History className="h-4 w-4" />
                Playground Run History
              </SheetTitle>
              <SheetDescription className="text-xs text-zinc-400">
                Restore configurations or compare previous iteration results.
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-3 py-4">
              {history.length === 0 ? (
                <div className="text-center py-12 text-xs text-zinc-500">
                  No previous runs in this session. Run an evaluation to start tracking history!
                </div>
              ) : (
                history.map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-lg border border-border bg-card space-y-2 hover:border-zinc-700 transition-all"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        {item.result.passed ? (
                          <Badge variant="outline" className="text-[10px] font-mono border-zinc-700 bg-zinc-900 text-zinc-200">
                            PASSED
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] font-mono border-zinc-800 bg-zinc-950 text-zinc-400">
                            FAILED
                          </Badge>
                        )}
                        <span className="text-[11px] text-zinc-500 font-mono">
                          #{history.length - idx}
                        </span>
                      </div>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {item.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </span>
                    </div>

                    <div className="text-[11px] font-mono text-zinc-400 space-y-0.5">
                      <div className="truncate">Model: {item.model}</div>
                      <div>
                        Latency: {formatMs(item.result.latency_ms)} • Cost: {formatCost(item.result.cost_usd)}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border/50 flex justify-end">
                      <Button
                        onClick={() => handleRestoreHistory(item)}
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-zinc-300 hover:text-white"
                      >
                        Restore Configuration →
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </TooltipProvider>
  );
}
