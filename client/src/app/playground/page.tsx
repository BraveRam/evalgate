"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { formatCost, formatMs } from "@/lib/utils";
import { AssertionConfig, AssertionType, TestCaseResult } from "@/types";
import { useMutation } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  Cpu,
  Layers,
  Play,
  Plus,
  Scale,
  Sparkles,
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

export default function PlaygroundPage() {
  const [model, setModel] = useState("openai/gpt-4o-mini");
  const [judgeModel, setJudgeModel] = useState("openai/gpt-4o-mini");
  const [systemPrompt, setSystemPrompt] = useState(
    "You are a precise financial analyst assistant. Answer user queries concisely using facts from context."
  );
  const [template, setTemplate] = useState(
    "Context: {{context}}\n\nQuestion: {{question}}\n\nAnswer:"
  );

  // Variables
  const [variables, setVariables] = useState<Array<{ key: string; value: string }>>([
    {
      key: "context",
      value: "ACME Corp reported Q3 2024 revenue of $45.2M, up 12% YoY with net margin of 18.5%.",
    },
    { key: "question", value: "What was ACME Corp's Q3 revenue and net margin?" },
  ]);

  // Assertions
  const [assertions, setAssertions] = useState<AssertionConfig[]>([
    { type: "contains", value: "$45.2M", strict: true },
    { type: "contains", value: "18.5%", strict: true },
    { type: "faithfulness", threshold: 0.85, strict: true },
    { type: "hallucination", threshold: 0.85, strict: true },
  ]);

  const [result, setResult] = useState<TestCaseResult | null>(null);

  // TanStack Mutation: Evaluate Playground
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
    },
  });

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

  const addAssertion = () => {
    setAssertions([...assertions, { type: "contains", value: "", strict: true }]);
  };

  const removeAssertion = (index: number) => {
    setAssertions(assertions.filter((_, i) => i !== index));
  };

  const updateAssertion = (index: number, updates: Partial<AssertionConfig>) => {
    const updated = [...assertions];
    updated[index] = { ...updated[index], ...updates };
    setAssertions(updated);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-emerald-400" />
            Prompt Evaluation Playground
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Test prompt templates live with variable injection, strict assertions, and LLM-as-a-judge quality gates.
          </p>
        </div>
        <Button
          onClick={() => evaluateMutation.mutate()}
          disabled={evaluateMutation.isPending}
          variant="glow"
          className="gap-2 px-6"
        >
          {evaluateMutation.isPending ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 rounded-full border-2 border-black border-t-transparent animate-spin" />
              Evaluating...
            </span>
          ) : (
            <>
              <Play className="h-4 w-4 fill-current" />
              Run Live Evaluation
            </>
          )}
        </Button>
      </div>

      {evaluateMutation.isError && (
        <div className="p-4 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300 text-sm flex items-center gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-400" />
          <span>{evaluateMutation.error.message}</span>
        </div>
      )}

      {/* Main Grid: Left Config, Right Output */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Config */}
        <div className="lg:col-span-7 space-y-6">
          {/* Target Model & Judge */}
          <Card className="border-border/80">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Cpu className="h-4 w-4 text-emerald-400" />
                Target & Judge Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-0 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                    Target Model
                  </label>
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger className="font-mono text-xs">
                      <SelectValue placeholder="Select target model" />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_MODELS.map((m) => (
                        <SelectItem key={m.id} value={m.id} className="font-mono text-xs">
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                    Judge Model (Semantic Evals)
                  </label>
                  <Select value={judgeModel} onValueChange={setJudgeModel}>
                    <SelectTrigger className="font-mono text-xs">
                      <SelectValue placeholder="Select judge model" />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_MODELS.map((m) => (
                        <SelectItem key={m.id} value={m.id} className="font-mono text-xs">
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                  System Prompt Instructions
                </label>
                <Textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={2}
                  className="text-xs"
                  placeholder="Enter system prompt guidelines..."
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                  Prompt Template (Supports <code className="text-emerald-400">{"{{variables}}"}</code>)
                </label>
                <Textarea
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  rows={4}
                  className="text-xs font-mono"
                  placeholder="Context: {{context}}\n\nQuestion: {{question}}"
                />
              </div>
            </CardContent>
          </Card>

          {/* Variables Matrix */}
          <Card className="border-border/80">
            <CardHeader className="p-5 pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Layers className="h-4 w-4 text-sky-400" />
                  Test Case Variables
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Injected into template placeholders during evaluation.
                </CardDescription>
              </div>
              <Button onClick={addVariable} variant="outline" size="sm" className="h-7 text-xs gap-1">
                <Plus className="h-3 w-3" />
                Add Var
              </Button>
            </CardHeader>
            <CardContent className="p-5 pt-0 space-y-3">
              {variables.map((v, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Input
                    value={v.key}
                    onChange={(e) => updateVariable(i, "key", e.target.value)}
                    placeholder="key"
                    className="w-36 font-mono text-xs shrink-0"
                  />
                  <Textarea
                    value={v.value}
                    onChange={(e) => updateVariable(i, "value", e.target.value)}
                    placeholder="value"
                    rows={1}
                    className="text-xs font-mono min-h-[36px] py-2"
                  />
                  <Button
                    onClick={() => removeVariable(i)}
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-muted-foreground hover:text-rose-400 shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Quality Gates & Assertions */}
          <Card className="border-border/80">
            <CardHeader className="p-5 pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Scale className="h-4 w-4 text-purple-400" />
                  Evaluation Gates & Assertions
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Deterministic rules and semantic LLM judges.
                </CardDescription>
              </div>
              <Button onClick={addAssertion} variant="outline" size="sm" className="h-7 text-xs gap-1">
                <Plus className="h-3 w-3" />
                Add Assertion
              </Button>
            </CardHeader>
            <CardContent className="p-5 pt-0 space-y-3">
              {assertions.map((a, i) => {
                const isSemantic = [
                  "faithfulness",
                  "hallucination",
                  "relevancy",
                  "coherence",
                  "bias",
                  "intent",
                  "dynamic",
                ].includes(a.type);

                return (
                  <div
                    key={i}
                    className="p-3 rounded-lg border border-border/60 bg-muted/20 space-y-3 text-xs"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <Select
                        value={a.type}
                        onValueChange={(val) =>
                          updateAssertion(i, {
                            type: val as AssertionType,
                            threshold: isSemantic ? 0.85 : undefined,
                          })
                        }
                      >
                        <SelectTrigger className="w-44 font-mono text-xs h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="contains">contains (substring)</SelectItem>
                          <SelectItem value="not_contains">not_contains</SelectItem>
                          <SelectItem value="exact">exact match</SelectItem>
                          <SelectItem value="regex">regex pattern</SelectItem>
                          <SelectItem value="json_schema">json_schema</SelectItem>
                          <SelectItem value="python_ast">python_ast syntax</SelectItem>
                          <SelectItem value="sql_syntax">sql_syntax check</SelectItem>
                          <SelectItem value="faithfulness">faithfulness (judge)</SelectItem>
                          <SelectItem value="hallucination">hallucination (judge)</SelectItem>
                          <SelectItem value="relevancy">relevancy (judge)</SelectItem>
                          <SelectItem value="coherence">coherence (judge)</SelectItem>
                          <SelectItem value="dynamic">dynamic rubric (judge)</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
                          <Switch
                            checked={a.strict ?? true}
                            onCheckedChange={(checked) => updateAssertion(i, { strict: checked })}
                          />
                          <span>Strict Gate</span>
                        </label>
                        <Button
                          onClick={() => removeAssertion(i)}
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-rose-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {!isSemantic && (
                      <Input
                        value={a.value || ""}
                        onChange={(e) => updateAssertion(i, { value: e.target.value })}
                        placeholder="Expected substring / regex / schema"
                        className="font-mono text-xs h-8"
                      />
                    )}

                    {isSemantic && (
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                          Pass Threshold:
                        </span>
                        <input
                          type="range"
                          min="0.5"
                          max="1.0"
                          step="0.05"
                          value={a.threshold ?? 0.85}
                          onChange={(e) =>
                            updateAssertion(i, { threshold: parseFloat(e.target.value) })
                          }
                          className="w-full accent-emerald-400"
                        />
                        <span className="font-mono text-[11px] text-emerald-400 w-10 text-right">
                          {((a.threshold ?? 0.85) * 100).toFixed(0)}%
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Execution Output & Trace */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="border-border/80 h-full flex flex-col">
            <CardHeader className="p-5 pb-3 flex flex-row items-center justify-between border-b border-border/40">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-400" />
                Live Evaluation Trace
              </CardTitle>
              {result && (
                <Badge
                  variant={result.passed ? "success" : "failure"}
                  className="gap-1 font-mono text-[11px]"
                >
                  {result.passed ? (
                    <>
                      <CheckCircle2 className="h-3 w-3" /> PASSED
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3 w-3" /> FAILED
                    </>
                  )}
                </Badge>
              )}
            </CardHeader>
            <CardContent className="p-5 flex-1 space-y-5">
              {!result ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-20 text-muted-foreground space-y-3">
                  <div className="h-12 w-12 rounded-xl bg-card border border-border/80 flex items-center justify-center text-muted-foreground">
                    <Play className="h-5 w-5 opacity-40 ml-0.5" />
                  </div>
                  <p className="text-xs">
                    Click <strong>&quot;Run Live Evaluation&quot;</strong> to generate completion and verify assertions.
                  </p>
                </div>
              ) : (
                <>
                  {/* Execution KPIs */}
                  <div className="grid grid-cols-3 gap-2 p-3 rounded-lg bg-muted/20 border border-border/60 text-center font-mono">
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase block">Latency</span>
                      <span className="text-xs font-bold text-foreground">{formatMs(result.latency_ms)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase block">Tokens</span>
                      <span className="text-xs font-bold text-foreground">{result.total_tokens}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase block">Cost</span>
                      <span className="text-xs font-bold text-emerald-400">{formatCost(result.cost_usd)}</span>
                    </div>
                  </div>

                  {/* Raw Output Preview */}
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-2">
                      Generated Completion
                    </label>
                    <div className="p-3.5 rounded-lg border border-border/80 bg-black/40 font-mono text-xs text-foreground whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                      {result.completion || <span className="text-muted-foreground italic">No completion output</span>}
                    </div>
                  </div>

                  {/* Assertion Checklist */}
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-2">
                      Assertion Breakdown ({result.assertion_results.filter((a) => a.passed).length}/{result.assertion_results.length})
                    </label>
                    <div className="space-y-2">
                      {result.assertion_results.map((ar, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-lg border text-xs space-y-1.5 transition-all ${
                            ar.passed
                              ? "border-emerald-500/30 bg-emerald-500/5 text-foreground"
                              : "border-rose-500/30 bg-rose-500/5 text-foreground"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {ar.passed ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                              ) : (
                                <XCircle className="h-4 w-4 text-rose-400 shrink-0" />
                              )}
                              <span className="font-mono font-semibold text-xs">{ar.assertion_type}</span>
                            </div>
                            <span className="font-mono text-[11px] text-muted-foreground">
                              Score: {(ar.score * 100).toFixed(0)}%
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-relaxed pl-6">
                            {ar.reason}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
