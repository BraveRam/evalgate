"use client";

import React, { useEffect, useMemo, useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { api } from "@/lib/api";
import { formatCost, formatMs, formatPercent } from "@/lib/utils";
import { ArenaComparisonResult, SuiteRunResult, TestCaseResult } from "@/types";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Clock,
  Coins,
  Cpu,
  Equal,
  FileCode,
  FileDiff,
  HelpCircle,
  History,
  Info,
  RotateCcw,
  Sparkles,
  Swords,
  Trash2,
  Trophy,
  XCircle,
  Zap,
} from "lucide-react";

export interface ArenaModelOption {
  id: string;
  name: string;
  provider: string;
  badge: string;
}

export const ARENA_MODELS: ArenaModelOption[] = [
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", provider: "OpenAI", badge: "Fast & Cheap" },
  { id: "openai/gpt-4o", name: "GPT-4o", provider: "OpenAI", badge: "Flagship Reasoning" },
  { id: "anthropic/claude-3-5-sonnet", name: "Claude 3.5 Sonnet", provider: "Anthropic", badge: "Coding Champion" },
  { id: "google/gemini-2.0-flash", name: "Gemini 2.0 Flash", provider: "Google", badge: "Low Latency" },
  { id: "deepseek/deepseek-v4-pro-0813", name: "DeepSeek v4 Pro", provider: "DeepSeek", badge: "Value Benchmark" },
  { id: "mock/simulator", name: "Mock Simulator", provider: "Local Sandbox", badge: "$0.00 / Zero-Cost" },
];

export interface StoredComparisonRecord {
  id: string;
  suite_name: string;
  model_a: string;
  model_b: string;
  verdict_headline: string;
  verdict_type: "BASELINE_WINS" | "CANDIDATE_WINS" | "NO_WINNER_BOTH_FAILED" | "TIE";
  pass_rate_delta: number;
  latency_delta_ms: number;
  cost_delta_usd: number;
  timestamp: string;
  result: ArenaComparisonResult;
}

export interface VerdictAnalysis {
  verdictType: "BASELINE_WINS" | "CANDIDATE_WINS" | "NO_WINNER_BOTH_FAILED" | "TIE";
  headline: string;
  explanation: string;
  qualityWinner: { label: string; detail: string; status: "A" | "B" | "TIE" | "NONE" };
  speedWinner: { label: string; detail: string; status: "A" | "B" | "TIE" };
  costWinner: { label: string; detail: string; status: "A" | "B" | "TIE" };
}

/**
 * Calculates a multi-dimensional shootout verdict with strict ranking rules:
 * 1. Quality gate threshold is mandatory (a failing model cannot win).
 * 2. Higher pass rate takes precedence.
 * 3. Lower P50 latency breaks quality ties.
 * 4. Lower inference cost breaks latency ties.
 */
function calculateVerdict(
  runA: SuiteRunResult,
  runB: SuiteRunResult,
  modelAName: string,
  modelBName: string,
  minPassRate: number = 1.0
): VerdictAnalysis {
  const aPassRate = runA.pass_rate ?? 0;
  const bPassRate = runB.pass_rate ?? 0;
  const aPassed = runA.passed ?? (aPassRate >= minPassRate);
  const bPassed = runB.passed ?? (bPassRate >= minPassRate);

  // Quality Winner
  let qualityWinner: VerdictAnalysis["qualityWinner"];
  if (aPassRate > bPassRate) {
    qualityWinner = {
      label: `Baseline (${modelAName})`,
      detail: `${formatPercent(aPassRate)} vs ${formatPercent(bPassRate)} (${runA.passed_tests}/${runA.total_tests} passed)`,
      status: "A",
    };
  } else if (bPassRate > aPassRate) {
    qualityWinner = {
      label: `Candidate (${modelBName})`,
      detail: `${formatPercent(bPassRate)} vs ${formatPercent(aPassRate)} (${runB.passed_tests}/${runB.total_tests} passed)`,
      status: "B",
    };
  } else if (aPassRate === 0 && bPassRate === 0) {
    qualityWinner = {
      label: "No Winner",
      detail: `Both models failed 100% of test cases (0/${runA.total_tests})`,
      status: "NONE",
    };
  } else {
    qualityWinner = {
      label: "Tied Quality",
      detail: `Both achieved ${formatPercent(aPassRate)} pass rate (${runA.passed_tests}/${runA.total_tests})`,
      status: "TIE",
    };
  }

  // Speed Winner
  const latencyDelta = (runB.p50_latency_ms || 0) - (runA.p50_latency_ms || 0);
  let speedWinner: VerdictAnalysis["speedWinner"];
  if (Math.abs(latencyDelta) < 15) {
    speedWinner = {
      label: "Equal Latency",
      detail: `Both ~${formatMs(runA.p50_latency_ms)} P50`,
      status: "TIE",
    };
  } else if (latencyDelta > 0) {
    speedWinner = {
      label: `Baseline (${modelAName})`,
      detail: `${formatMs(Math.abs(latencyDelta))} faster P50`,
      status: "A",
    };
  } else {
    speedWinner = {
      label: `Candidate (${modelBName})`,
      detail: `${formatMs(Math.abs(latencyDelta))} faster P50`,
      status: "B",
    };
  }

  // Cost Winner
  const costDelta = (runB.total_cost_usd || 0) - (runA.total_cost_usd || 0);
  let costWinner: VerdictAnalysis["costWinner"];
  if (Math.abs(costDelta) < 0.000001) {
    costWinner = {
      label: "Equal Cost",
      detail: `${formatCost(runA.total_cost_usd)} total spend`,
      status: "TIE",
    };
  } else if (costDelta > 0) {
    costWinner = {
      label: `Baseline (${modelAName})`,
      detail: `${formatCost(Math.abs(costDelta))} cheaper total`,
      status: "A",
    };
  } else {
    costWinner = {
      label: `Candidate (${modelBName})`,
      detail: `${formatCost(Math.abs(costDelta))} cheaper total`,
      status: "B",
    };
  }

  // Overall verdict based on strict hierarchy
  // Rule 1: Quality Gate is mandatory. If both fail, No Overall Winner.
  if (!aPassed && !bPassed) {
    return {
      verdictType: "NO_WINNER_BOTH_FAILED",
      headline: "Inconclusive · No Winner",
      explanation: `Both models failed the required quality threshold (${formatPercent(minPassRate)}). Superior latency or lower token cost cannot declare a model successful when quality assertions fail.`,
      qualityWinner,
      speedWinner,
      costWinner,
    };
  }

  // Rule 2: If one passed and one failed
  if (aPassed && !bPassed) {
    return {
      verdictType: "BASELINE_WINS",
      headline: `Baseline Wins · ${modelAName}`,
      explanation: `Baseline satisfied the quality gate (${formatPercent(aPassRate)}) while Candidate failed (${formatPercent(bPassRate)}).`,
      qualityWinner,
      speedWinner,
      costWinner,
    };
  }
  if (bPassed && !aPassed) {
    return {
      verdictType: "CANDIDATE_WINS",
      headline: `Candidate Wins · ${modelBName}`,
      explanation: `Candidate satisfied the quality gate (${formatPercent(bPassRate)}) while Baseline failed (${formatPercent(aPassRate)}).`,
      qualityWinner,
      speedWinner,
      costWinner,
    };
  }

  // Rule 3: Both passed — higher pass rate wins
  if (aPassRate > bPassRate) {
    return {
      verdictType: "BASELINE_WINS",
      headline: `Baseline Wins · ${modelAName}`,
      explanation: `Baseline achieved higher assertion pass rate (${formatPercent(aPassRate)} vs ${formatPercent(bPassRate)}).`,
      qualityWinner,
      speedWinner,
      costWinner,
    };
  }
  if (bPassRate > aPassRate) {
    return {
      verdictType: "CANDIDATE_WINS",
      headline: `Candidate Wins · ${modelBName}`,
      explanation: `Candidate achieved higher assertion pass rate (${formatPercent(bPassRate)} vs ${formatPercent(aPassRate)}).`,
      qualityWinner,
      speedWinner,
      costWinner,
    };
  }

  // Rule 4: Tied pass rates — lower latency wins
  if (latencyDelta > 20) {
    return {
      verdictType: "BASELINE_WINS",
      headline: `Baseline Wins · ${modelAName}`,
      explanation: `Both models matched on quality (${formatPercent(aPassRate)}), but Baseline is ${formatMs(latencyDelta)} faster.`,
      qualityWinner,
      speedWinner,
      costWinner,
    };
  }
  if (latencyDelta < -20) {
    return {
      verdictType: "CANDIDATE_WINS",
      headline: `Candidate Wins · ${modelBName}`,
      explanation: `Both models matched on quality (${formatPercent(bPassRate)}), but Candidate is ${formatMs(Math.abs(latencyDelta))} faster.`,
      qualityWinner,
      speedWinner,
      costWinner,
    };
  }

  // Rule 5: Tied quality and speed — lower cost wins
  if (costDelta > 0.00001) {
    return {
      verdictType: "BASELINE_WINS",
      headline: `Baseline Wins · ${modelAName}`,
      explanation: `Both models matched on quality and latency, but Baseline is ${formatCost(costDelta)} cheaper.`,
      qualityWinner,
      speedWinner,
      costWinner,
    };
  }
  if (costDelta < -0.00001) {
    return {
      verdictType: "CANDIDATE_WINS",
      headline: `Candidate Wins · ${modelBName}`,
      explanation: `Both models matched on quality and latency, but Candidate is ${formatCost(Math.abs(costDelta))} cheaper.`,
      qualityWinner,
      speedWinner,
      costWinner,
    };
  }

  return {
    verdictType: "TIE",
    headline: "Statistical Draw · Tied Contenders",
    explanation: `Both models performed identically across pass rate (${formatPercent(aPassRate)}), P50 latency, and token cost.`,
    qualityWinner,
    speedWinner,
    costWinner,
  };
}

/**
 * Line-by-line diff helper
 */
function computeLineDiff(textA: string, textB: string) {
  const linesA = textA.split("\n");
  const linesB = textB.split("\n");
  const diff: { type: "same" | "add" | "remove"; text: string }[] = [];

  let i = 0;
  let j = 0;
  while (i < linesA.length || j < linesB.length) {
    if (i < linesA.length && j < linesB.length && linesA[i] === linesB[j]) {
      diff.push({ type: "same", text: linesA[i] });
      i++;
      j++;
    } else if (i < linesA.length && (j >= linesB.length || !linesB.includes(linesA[i]))) {
      diff.push({ type: "remove", text: linesA[i] });
      i++;
    } else if (j < linesB.length) {
      diff.push({ type: "add", text: linesB[j] });
      j++;
    } else {
      break;
    }
  }
  return diff;
}

export default function ArenaPage() {
  const [selectedSuite, setSelectedSuite] = useState<string>("");
  const [modelA, setModelA] = useState("openai/gpt-4o-mini");
  const [modelB, setModelB] = useState("deepseek/deepseek-v4-pro-0813");
  const [concurrency] = useState(10);
  const [result, setResult] = useState<ArenaComparisonResult | null>(null);

  // UI States
  const [caseFilter, setCaseFilter] = useState<"all" | "discrepancies" | "passed" | "failed">("all");
  const [caseSearchQuery, setCaseSearchQuery] = useState("");
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null);
  const [diffViewMode, setDiffViewMode] = useState<"side_by_side" | "diff" | "raw">("side_by_side");
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isVerdictHelpOpen, setIsVerdictHelpOpen] = useState(false);

  // Comparison History in localStorage
  const [history, setHistory] = useState<StoredComparisonRecord[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("evalgate_arena_history");
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch {
      // ignore
    }
  }, []);

  const saveToHistory = (res: ArenaComparisonResult, verdict: VerdictAnalysis) => {
    try {
      const record: StoredComparisonRecord = {
        id: `arena_${Date.now()}`,
        suite_name: res.suite_name,
        model_a: res.model_a,
        model_b: res.model_b,
        verdict_headline: verdict.headline,
        verdict_type: verdict.verdictType,
        pass_rate_delta: res.pass_rate_delta,
        latency_delta_ms: res.latency_p50_delta_ms,
        cost_delta_usd: res.cost_delta_usd,
        timestamp: new Date().toISOString(),
        result: res,
      };
      const updated = [record, ...history.slice(0, 24)];
      setHistory(updated);
      localStorage.setItem("evalgate_arena_history", JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem("evalgate_arena_history");
  };

  // TanStack Query: Fetch suites
  const { data: suites = [] } = useQuery({
    queryKey: ["suites"],
    queryFn: async () => {
      const list = await api.listSuites();
      if (list.length > 0 && !selectedSuite) {
        setSelectedSuite(list[0].name);
      }
      return list;
    },
  });

  const activeSuiteObj = suites.find((s) => s.name === (selectedSuite || (suites[0]?.name || "")));
  const activeSuiteName = activeSuiteObj?.name || (suites.length > 0 ? suites[0].name : "");

  // Model helper names
  const modelAObj = ARENA_MODELS.find((m) => m.id === modelA) || {
    id: modelA,
    name: modelA.split("/").pop() || modelA,
    provider: modelA.split("/")[0] || "Custom",
    badge: "Contender",
  };
  const modelBObj = ARENA_MODELS.find((m) => m.id === modelB) || {
    id: modelB,
    name: modelB.split("/").pop() || modelB,
    provider: modelB.split("/")[0] || "Custom",
    badge: "Contender",
  };

  // TanStack Mutation: Arena comparison
  const arenaMutation = useMutation({
    mutationFn: (params: { suite_name: string; model_a: string; model_b: string; concurrency: number }) =>
      api.compareArena(params),
    onSuccess: (data) => {
      setResult(data);
      const verdict = calculateVerdict(
        data.run_a,
        data.run_b,
        modelAObj.name,
        modelBObj.name,
        activeSuiteObj?.min_pass_rate ?? 1.0
      );
      saveToHistory(data, verdict);
    },
  });

  const handleRunShootout = () => {
    if (!activeSuiteName) return;
    arenaMutation.mutate({
      suite_name: activeSuiteName,
      model_a: modelA,
      model_b: modelB,
      concurrency,
    });
  };

  const handleNewComparison = () => {
    setResult(null);
  };

  const handleRestoreRecord = (rec: StoredComparisonRecord) => {
    setSelectedSuite(rec.suite_name);
    setModelA(rec.model_a);
    setModelB(rec.model_b);
    setResult(rec.result);
    setIsHistoryOpen(false);
  };

  // Calculate verdict for current result
  const verdict = useMemo(() => {
    if (!result) return null;
    return calculateVerdict(
      result.run_a,
      result.run_b,
      modelAObj.name,
      modelBObj.name,
      activeSuiteObj?.min_pass_rate ?? 1.0
    );
  }, [result, modelAObj.name, modelBObj.name, activeSuiteObj?.min_pass_rate]);

  // Filtered test cases
  const filteredCases = useMemo(() => {
    if (!result) return [];
    const casesA = result.run_a.results || [];
    const casesB = result.run_b.results || [];

    return casesA
      .map((resA, idx) => {
        const resB = casesB[idx] || resA;
        const isMismatch = resA.passed !== resB.passed;
        const bothPassed = resA.passed && resB.passed;
        const bothFailed = !resA.passed && !resB.passed;
        return { resA, resB, idx, isMismatch, bothPassed, bothFailed };
      })
      .filter(({ resA, resB, isMismatch, bothPassed, bothFailed }) => {
        if (caseFilter === "discrepancies" && !isMismatch) return false;
        if (caseFilter === "passed" && !bothPassed) return false;
        if (caseFilter === "failed" && !bothFailed) return false;

        if (caseSearchQuery.trim()) {
          const q = caseSearchQuery.toLowerCase();
          const matchId = resA.test_id?.toLowerCase().includes(q);
          const matchA = resA.completion?.toLowerCase().includes(q);
          const matchB = resB.completion?.toLowerCase().includes(q);
          if (!matchId && !matchA && !matchB) return false;
        }
        return true;
      });
  }, [result, caseFilter, caseSearchQuery]);

  const totalEvaluatedTests = result?.run_a.total_tests || 0;
  const isSingleTestCase = totalEvaluatedTests === 1;

  return (
    <TooltipProvider>
      <div className="space-y-7 max-w-7xl mx-auto">
        {/* Top Header & Global Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-semibold tracking-tight text-white flex items-center gap-2">
                <Swords className="h-5 w-5 text-white" />
                Model Benchmark Arena Shootout
              </h1>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Head-to-head evaluation between Baseline and Candidate models on identical test cases.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => setIsVerdictHelpOpen(true)}
              variant="ghost"
              size="sm"
              className="text-xs text-zinc-400 hover:text-white gap-1.5 h-8"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              <span>Verdict Rules</span>
            </Button>

            <Button
              onClick={() => setIsHistoryOpen(true)}
              variant="outline"
              size="sm"
              className="text-xs gap-1.5 h-8 bg-zinc-900 border-zinc-800 text-zinc-200"
            >
              <History className="h-3.5 w-3.5" />
              <span>History ({history.length})</span>
            </Button>

            {result ? (
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleRunShootout}
                  disabled={arenaMutation.isPending}
                  variant="default"
                  size="sm"
                  className="gap-1.5 text-xs h-8"
                >
                  {arenaMutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full border-2 border-black border-t-transparent animate-spin" />
                      Re-running...
                    </span>
                  ) : (
                    <>
                      <RotateCcw className="h-3.5 w-3.5" />
                      Run Again
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleNewComparison}
                  variant="outline"
                  size="sm"
                  className="text-xs h-8"
                >
                  New Comparison
                </Button>
              </div>
            ) : (
              <Button
                onClick={handleRunShootout}
                disabled={arenaMutation.isPending || !activeSuiteName}
                variant="default"
                size="sm"
                className="gap-2 px-4 text-xs h-8"
              >
                {arenaMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 rounded-full border-2 border-black border-t-transparent animate-spin" />
                    Running Shootout...
                  </span>
                ) : (
                  <>
                    <Swords className="h-3.5 w-3.5" />
                    Run Comparison
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Error Alert */}
        {arenaMutation.isError && (
          <div className="p-3.5 rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-300 text-xs flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 text-zinc-400" />
            <span>{arenaMutation.error.message}</span>
          </div>
        )}

        {/* 1. Contenders & Setup Card */}
        <Card className="border-border bg-card">
          <CardHeader className="p-4 pb-2.5 border-b border-border/50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold text-white flex items-center gap-2">
                <Cpu className="h-3.5 w-3.5 text-zinc-400" />
                Comparison Setup & Contenders
              </CardTitle>
              {activeSuiteObj && (
                <span className="text-[11px] font-mono text-zinc-400">
                  {activeSuiteObj.test_count} {activeSuiteObj.test_count === 1 ? "test case" : "test cases"} · Quality Gate: {formatPercent(activeSuiteObj.min_pass_rate)}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-3.5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Benchmark Suite */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-zinc-400 block">
                  Evaluation Suite
                </label>
                <Select value={activeSuiteName} onValueChange={setSelectedSuite}>
                  <SelectTrigger className="font-mono text-xs bg-zinc-950 border-border h-9">
                    <SelectValue placeholder="Select suite" />
                  </SelectTrigger>
                  <SelectContent>
                    {suites.map((s, idx) => (
                      <SelectItem
                        key={s.name ? `arena_suite_${s.name}` : `arena_suite_${idx}`}
                        value={s.name}
                        className="font-mono text-xs"
                      >
                        {s.name} ({s.test_count} {s.test_count === 1 ? "test" : "tests"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-zinc-500">
                  Runs identical variables & quality assertions against both models.
                </p>
              </div>

              {/* Baseline Model (Model A) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-zinc-200 block">
                    Baseline Model (Model A)
                  </label>
                  <span className="text-[10px] font-mono text-zinc-500">{modelAObj.provider}</span>
                </div>
                <Select value={modelA} onValueChange={setModelA}>
                  <SelectTrigger className="font-mono text-xs bg-zinc-950 border-border h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ARENA_MODELS.map((m, idx) => (
                      <SelectItem
                        key={m.id ? `arena_m1_${m.id}` : `arena_m1_${idx}`}
                        value={m.id}
                        className="font-mono text-xs"
                      >
                        <div className="flex items-center justify-between w-full gap-2">
                          <span className="font-medium text-white">{m.name}</span>
                          <span className="text-[10px] text-zinc-500">{m.badge}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] font-mono text-zinc-500 truncate">
                  ID: {modelA}
                </p>
              </div>

              {/* Candidate Model (Model B) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-zinc-200 block">
                    Candidate Model (Model B)
                  </label>
                  <span className="text-[10px] font-mono text-zinc-500">{modelBObj.provider}</span>
                </div>
                <Select value={modelB} onValueChange={setModelB}>
                  <SelectTrigger className="font-mono text-xs bg-zinc-950 border-border h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ARENA_MODELS.map((m, idx) => (
                      <SelectItem
                        key={m.id ? `arena_m2_${m.id}` : `arena_m2_${idx}`}
                        value={m.id}
                        className="font-mono text-xs"
                      >
                        <div className="flex items-center justify-between w-full gap-2">
                          <span className="font-medium text-white">{m.name}</span>
                          <span className="text-[10px] text-zinc-500">{m.badge}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] font-mono text-zinc-500 truncate">
                  ID: {modelB}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. Results & Diagnostic Surfaces */}
        {result && verdict && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Small Sample Warning if 1 Test Case */}
            {isSingleTestCase && (
              <div className="p-3.5 rounded-lg border border-zinc-800 bg-zinc-950/90 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="h-4 w-4 text-zinc-400 shrink-0" />
                  <div>
                    <span className="font-semibold text-zinc-200">Limited Benchmark Sample</span>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      This comparison evaluated 1 test case. Results may not be representative for large prompt variations.
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-zinc-500 shrink-0">1 test case evaluated</span>
              </div>
            )}

            {/* A. Overall Comparison Verdict Banner */}
            <Card className="border-border bg-gradient-to-b from-zinc-900/80 to-zinc-950/90 overflow-hidden">
              <CardHeader className="p-5 pb-3 border-b border-border/40">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3.5">
                    <div className="h-10 w-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white shrink-0 mt-0.5">
                      {verdict.verdictType === "NO_WINNER_BOTH_FAILED" ? (
                        <XCircle className="h-5 w-5 text-zinc-400" />
                      ) : verdict.verdictType === "TIE" ? (
                        <Equal className="h-5 w-5 text-zinc-300" />
                      ) : (
                        <Trophy className="h-5 w-5 text-white" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                          Comparison Verdict
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-mono ${
                            verdict.verdictType === "NO_WINNER_BOTH_FAILED"
                              ? "border-zinc-800 bg-zinc-950 text-zinc-400"
                              : verdict.verdictType === "TIE"
                              ? "border-zinc-700 bg-zinc-900 text-zinc-300"
                              : "border-zinc-700 bg-zinc-900 text-white font-semibold"
                          }`}
                        >
                          {verdict.verdictType === "NO_WINNER_BOTH_FAILED"
                            ? "INCONCLUSIVE"
                            : verdict.verdictType === "TIE"
                            ? "STATISTICAL TIE"
                            : "DEFINITIVE WINNER"}
                        </Badge>
                      </div>
                      <h2 className="text-base font-semibold text-white mt-1">
                        {verdict.headline}
                      </h2>
                      <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                        {verdict.explanation}
                      </p>
                    </div>
                  </div>

                  <div className="text-right font-mono text-[11px] text-zinc-500 shrink-0 self-start sm:self-auto">
                    <span>
                      {totalEvaluatedTests} {totalEvaluatedTests === 1 ? "test case" : "test cases"} evaluated
                    </span>
                  </div>
                </div>
              </CardHeader>

              {/* Multi-Dimensional Champion Pillars */}
              <CardContent className="p-5 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  {/* Quality Pillar */}
                  <div className="p-3.5 rounded-lg border border-border bg-zinc-950/70 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase font-semibold text-zinc-500 flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-zinc-400" />
                        Quality Winner
                      </span>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                          verdict.qualityWinner.status === "NONE"
                            ? "text-zinc-500 bg-zinc-900"
                            : "text-zinc-200 bg-zinc-900"
                        }`}
                      >
                        {verdict.qualityWinner.label}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-300 font-medium pt-0.5">
                      {verdict.qualityWinner.detail}
                    </p>
                  </div>

                  {/* Speed Pillar */}
                  <div className="p-3.5 rounded-lg border border-border bg-zinc-950/70 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase font-semibold text-zinc-500 flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-zinc-400" />
                        Speed Winner
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded text-zinc-200 bg-zinc-900">
                        {verdict.speedWinner.label}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-300 font-medium pt-0.5">
                      {verdict.speedWinner.detail}
                    </p>
                  </div>

                  {/* Cost Pillar */}
                  <div className="p-3.5 rounded-lg border border-border bg-zinc-950/70 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase font-semibold text-zinc-500 flex items-center gap-1.5">
                        <Coins className="h-3.5 w-3.5 text-zinc-400" />
                        Cost Winner
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded text-zinc-200 bg-zinc-900">
                        {verdict.costWinner.label}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-300 font-medium pt-0.5">
                      {verdict.costWinner.detail}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* B. Explicit Plain-Language Delta Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* Pass Rate Delta */}
              <Card className="border-border bg-card">
                <CardHeader className="p-4 pb-1 flex flex-row items-center justify-between">
                  <CardTitle className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                    Pass Rate Accuracy
                  </CardTitle>
                  <CheckCircle2 className="h-3.5 w-3.5 text-zinc-400" />
                </CardHeader>
                <CardContent className="p-4 pt-1 font-mono space-y-1.5">
                  <div className="text-lg font-bold text-white">
                    {result.pass_rate_delta > 0
                      ? `+${formatPercent(result.pass_rate_delta)} Candidate`
                      : result.pass_rate_delta < 0
                      ? `${formatPercent(result.pass_rate_delta)} Candidate`
                      : `Tied (${formatPercent(result.run_a.pass_rate)})`}
                  </div>
                  <div className="text-[11px] text-zinc-400 flex items-center justify-between pt-1 border-t border-border/50">
                    <span>A: {formatPercent(result.run_a.pass_rate)}</span>
                    <span>B: {formatPercent(result.run_b.pass_rate)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* P50 Latency Delta */}
              <Card className="border-border bg-card">
                <CardHeader className="p-4 pb-1 flex flex-row items-center justify-between">
                  <CardTitle className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                    P50 Latency Delta
                  </CardTitle>
                  <Clock className="h-3.5 w-3.5 text-zinc-400" />
                </CardHeader>
                <CardContent className="p-4 pt-1 font-mono space-y-1.5">
                  <div className="text-lg font-bold text-white">
                    {result.latency_p50_delta_ms > 15
                      ? `${formatMs(result.latency_p50_delta_ms)} faster Baseline`
                      : result.latency_p50_delta_ms < -15
                      ? `${formatMs(Math.abs(result.latency_p50_delta_ms))} faster Candidate`
                      : "Identical P50"}
                  </div>
                  <div className="text-[11px] text-zinc-400 flex items-center justify-between pt-1 border-t border-border/50">
                    <span>A: {formatMs(result.run_a.p50_latency_ms)}</span>
                    <span>B: {formatMs(result.run_b.p50_latency_ms)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Inference Cost Delta */}
              <Card className="border-border bg-card">
                <CardHeader className="p-4 pb-1 flex flex-row items-center justify-between">
                  <CardTitle className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                    Inference Spend
                  </CardTitle>
                  <Coins className="h-3.5 w-3.5 text-zinc-400" />
                </CardHeader>
                <CardContent className="p-4 pt-1 font-mono space-y-1.5">
                  <div className="text-lg font-bold text-white">
                    {result.cost_delta_usd > 0.00001
                      ? `${formatCost(result.cost_delta_usd)} cheaper Baseline`
                      : result.cost_delta_usd < -0.00001
                      ? `${formatCost(Math.abs(result.cost_delta_usd))} cheaper Candidate`
                      : "Identical Cost"}
                  </div>
                  <div className="text-[11px] text-zinc-400 flex items-center justify-between pt-1 border-t border-border/50">
                    <span>A: {formatCost(result.run_a.total_cost_usd)}</span>
                    <span>B: {formatCost(result.run_b.total_cost_usd)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Token Efficiency */}
              <Card className="border-border bg-card">
                <CardHeader className="p-4 pb-1 flex flex-row items-center justify-between">
                  <CardTitle className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                    Total Tokens
                  </CardTitle>
                  <FileCode className="h-3.5 w-3.5 text-zinc-400" />
                </CardHeader>
                <CardContent className="p-4 pt-1 font-mono space-y-1.5">
                  <div className="text-lg font-bold text-white">
                    {result.run_b.total_tokens - result.run_a.total_tokens > 0
                      ? `+${result.run_b.total_tokens - result.run_a.total_tokens} Candidate`
                      : result.run_b.total_tokens - result.run_a.total_tokens < 0
                      ? `${result.run_b.total_tokens - result.run_a.total_tokens} Candidate`
                      : "Equal Tokens"}
                  </div>
                  <div className="text-[11px] text-zinc-400 flex items-center justify-between pt-1 border-t border-border/50">
                    <span>A: {result.run_a.total_tokens} toks</span>
                    <span>B: {result.run_b.total_tokens} toks</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* C. Head-to-Head Test Case Breakdown Matrix */}
            <div className="space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
                <div>
                  <h3 className="text-xs font-semibold text-white flex items-center gap-2">
                    <FileDiff className="h-4 w-4 text-zinc-400" />
                    Diagnostic Test Case Matrix ({filteredCases.length} of {totalEvaluatedTests})
                  </h3>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    Compare completions, assertion scores, and response diffs for every prompt permutation.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={caseSearchQuery}
                    onChange={(e) => setCaseSearchQuery(e.target.value)}
                    placeholder="Search test ID or output..."
                    className="h-7 text-xs w-48 bg-zinc-950 border-border"
                  />
                  <Select value={caseFilter} onValueChange={(v) => setCaseFilter(v as any)}>
                    <SelectTrigger className="h-7 text-xs w-36 font-mono bg-zinc-950">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">All Test Cases</SelectItem>
                      <SelectItem value="discrepancies" className="text-xs">Discrepancies Only</SelectItem>
                      <SelectItem value="passed" className="text-xs">Both Passed</SelectItem>
                      <SelectItem value="failed" className="text-xs">Both Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {filteredCases.length === 0 ? (
                <Card className="border-border bg-card p-8 text-center text-xs text-zinc-500">
                  No test cases matched the selected filter.
                </Card>
              ) : (
                <div className="space-y-3">
                  {filteredCases.map(({ resA, resB, idx, isMismatch }) => {
                    const isExpanded = expandedCaseId === (resA.test_id || String(idx));
                    const assertionsA = resA.assertion_results || [];
                    const assertionsB = resB.assertion_results || [];
                    const failedA = assertionsA.filter((a) => !a.passed);
                    const failedB = assertionsB.filter((a) => !a.passed);

                    return (
                      <Card
                        key={resA.test_id ? `arena_res_${resA.test_id}` : `arena_res_idx_${idx}`}
                        className="border-border bg-card overflow-hidden"
                      >
                        {/* Case Card Header */}
                        <div
                          onClick={() => setExpandedCaseId(isExpanded ? null : resA.test_id || String(idx))}
                          className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-zinc-900/40 transition-colors border-b border-border/40"
                        >
                          <div className="flex items-center gap-3">
                            <Badge variant="secondary" className="font-mono text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-200">
                              #{resA.test_id}
                            </Badge>
                            {isMismatch ? (
                              <Badge variant="outline" className="text-[10px] font-mono border-zinc-700 bg-zinc-900 text-zinc-200">
                                ⚠️ Discrepancy (Outcomes Differ)
                              </Badge>
                            ) : resA.passed ? (
                              <span className="text-[11px] text-zinc-400">Both Models Passed Quality Gate</span>
                            ) : (
                              <span className="text-[11px] text-zinc-500">Both Models Failed Quality Gate</span>
                            )}
                          </div>

                          <div className="flex items-center gap-4 text-xs font-mono">
                            <div className="flex items-center gap-2">
                              <span className="text-zinc-500 text-[11px]">A:</span>
                              <span className={resA.passed ? "text-zinc-200" : "text-zinc-500"}>
                                {resA.passed ? "PASSED" : "FAILED"} ({assertionsA.length - failedA.length}/{assertionsA.length})
                              </span>
                            </div>
                            <span className="text-zinc-700">|</span>
                            <div className="flex items-center gap-2">
                              <span className="text-zinc-500 text-[11px]">B:</span>
                              <span className={resB.passed ? "text-zinc-200" : "text-zinc-500"}>
                                {resB.passed ? "PASSED" : "FAILED"} ({assertionsB.length - failedB.length}/{assertionsB.length})
                              </span>
                            </div>
                            <ChevronDown
                              className={`h-3.5 w-3.5 text-zinc-500 transition-transform ${
                                isExpanded ? "rotate-180 text-white" : ""
                              }`}
                            />
                          </div>
                        </div>

                        {/* Side-by-Side Model Diagnostics */}
                        <CardContent className="p-4 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Baseline Model A Details */}
                            <div className="p-3.5 rounded-lg border border-border bg-zinc-950 space-y-3">
                              <div className="flex items-center justify-between border-b border-border/50 pb-2">
                                <div>
                                  <span className="text-xs font-semibold text-white block">
                                    Baseline: {modelAObj.name}
                                  </span>
                                  <span className="text-[10px] font-mono text-zinc-500">
                                    {result.model_a}
                                  </span>
                                </div>
                                <div className="text-right">
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] font-mono ${
                                      resA.passed
                                        ? "border-zinc-700 bg-zinc-900 text-zinc-200"
                                        : "border-zinc-800 bg-zinc-950 text-zinc-400"
                                    }`}
                                  >
                                    {resA.passed ? "PASSED" : "FAILED"} ({assertionsA.length - failedA.length}/{assertionsA.length})
                                  </Badge>
                                </div>
                              </div>

                              {/* Telemetry Strip */}
                              <div className="flex items-center gap-3 text-[11px] font-mono text-zinc-400">
                                <span>{formatMs(resA.latency_ms)}</span>
                                <span>•</span>
                                <span>{resA.total_tokens} tokens</span>
                                <span>•</span>
                                <span>{formatCost(resA.cost_usd)}</span>
                              </div>

                              {/* Failed Assertions Breakdown */}
                              {failedA.length > 0 && (
                                <div className="space-y-1 p-2 rounded bg-zinc-900/60 border border-zinc-800 text-xs">
                                  <span className="text-[10px] font-mono uppercase font-semibold text-zinc-400 block">
                                    Failed Assertions ({failedA.length})
                                  </span>
                                  <div className="space-y-1 pt-0.5">
                                    {failedA.map((fa, faIdx) => (
                                      <div key={faIdx} className="text-[11px] font-mono text-zinc-400 flex items-start gap-1.5">
                                        <XCircle className="h-3 w-3 shrink-0 mt-0.5 text-zinc-500" />
                                        <span>
                                          <strong>{fa.assertion_type}</strong>: {fa.reason || "Did not satisfy condition"}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Completion Text */}
                              <div className="space-y-1">
                                <span className="text-[10px] font-mono uppercase text-zinc-500 block">
                                  Model Completion Output
                                </span>
                                <div className="p-2.5 rounded bg-black border border-zinc-800 text-xs font-mono text-zinc-300 whitespace-pre-wrap max-h-40 overflow-y-auto select-text leading-relaxed">
                                  {resA.completion || <span className="text-zinc-600 italic">No output generated</span>}
                                </div>
                              </div>
                            </div>

                            {/* Candidate Model B Details */}
                            <div className="p-3.5 rounded-lg border border-border bg-zinc-950 space-y-3">
                              <div className="flex items-center justify-between border-b border-border/50 pb-2">
                                <div>
                                  <span className="text-xs font-semibold text-white block">
                                    Candidate: {modelBObj.name}
                                  </span>
                                  <span className="text-[10px] font-mono text-zinc-500">
                                    {result.model_b}
                                  </span>
                                </div>
                                <div className="text-right">
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] font-mono ${
                                      resB.passed
                                        ? "border-zinc-700 bg-zinc-900 text-zinc-200"
                                        : "border-zinc-800 bg-zinc-950 text-zinc-400"
                                    }`}
                                  >
                                    {resB.passed ? "PASSED" : "FAILED"} ({assertionsB.length - failedB.length}/{assertionsB.length})
                                  </Badge>
                                </div>
                              </div>

                              {/* Telemetry Strip */}
                              <div className="flex items-center gap-3 text-[11px] font-mono text-zinc-400">
                                <span>{formatMs(resB.latency_ms)}</span>
                                <span>•</span>
                                <span>{resB.total_tokens} tokens</span>
                                <span>•</span>
                                <span>{formatCost(resB.cost_usd)}</span>
                              </div>

                              {/* Failed Assertions Breakdown */}
                              {failedB.length > 0 && (
                                <div className="space-y-1 p-2 rounded bg-zinc-900/60 border border-zinc-800 text-xs">
                                  <span className="text-[10px] font-mono uppercase font-semibold text-zinc-400 block">
                                    Failed Assertions ({failedB.length})
                                  </span>
                                  <div className="space-y-1 pt-0.5">
                                    {failedB.map((fb, fbIdx) => (
                                      <div key={fbIdx} className="text-[11px] font-mono text-zinc-400 flex items-start gap-1.5">
                                        <XCircle className="h-3 w-3 shrink-0 mt-0.5 text-zinc-500" />
                                        <span>
                                          <strong>{fb.assertion_type}</strong>: {fb.reason || "Did not satisfy condition"}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Completion Text */}
                              <div className="space-y-1">
                                <span className="text-[10px] font-mono uppercase text-zinc-500 block">
                                  Model Completion Output
                                </span>
                                <div className="p-2.5 rounded bg-black border border-zinc-800 text-xs font-mono text-zinc-300 whitespace-pre-wrap max-h-40 overflow-y-auto select-text leading-relaxed">
                                  {resB.completion || <span className="text-zinc-600 italic">No output generated</span>}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Expanded Full Unified Line Diff Mode */}
                          {isExpanded && (
                            <div className="space-y-2 pt-2 border-t border-border/50">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-mono uppercase font-semibold text-zinc-400">
                                  Unified Response Output Diff (Baseline vs Candidate)
                                </span>
                              </div>
                              <div className="p-3 rounded bg-black border border-border text-xs font-mono space-y-0.5 max-h-60 overflow-y-auto select-text">
                                {computeLineDiff(resA.completion || "", resB.completion || "").map((diffLine, dIdx) => (
                                  <div
                                    key={dIdx}
                                    className={`py-0.5 px-1.5 rounded flex items-start gap-2 ${
                                      diffLine.type === "add"
                                        ? "bg-zinc-900 text-zinc-200 border-l-2 border-zinc-400"
                                        : diffLine.type === "remove"
                                        ? "bg-zinc-950 text-zinc-500 border-l-2 border-zinc-800"
                                        : "text-zinc-400"
                                    }`}
                                  >
                                    <span className="shrink-0 text-zinc-600 select-none">
                                      {diffLine.type === "add" ? "+" : diffLine.type === "remove" ? "-" : " "}
                                    </span>
                                    <span className="whitespace-pre-wrap break-all">{diffLine.text}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. "How Verdict is Calculated" Modal Dialog */}
        <Dialog open={isVerdictHelpOpen} onOpenChange={setIsVerdictHelpOpen}>
          <DialogContent className="max-w-md bg-zinc-950 border-border text-xs">
            <DialogHeader>
              <DialogTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <Trophy className="h-4 w-4 text-white" />
                How the Arena Verdict is Calculated
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                Evaluation rankings follow a strict hierarchy where quality accuracy always takes precedence.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3.5 pt-2 font-sans text-zinc-300">
              <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 space-y-1.5">
                <span className="font-semibold text-white block">Rule 1: Quality Gate is Mandatory</span>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  If both models fail the minimum pass rate (e.g. 0/1 test cases), the outcome is strictly <strong>Inconclusive (No Winner)</strong>. Faster speed or lower cost cannot declare a failing model as the winner.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 space-y-1.5">
                <span className="font-semibold text-white block">Rule 2: Pass Rate Takes Precedence</span>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  The model that achieves a strictly higher assertion pass rate wins the shootout, regardless of slight differences in latency.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 space-y-1.5">
                <span className="font-semibold text-white block">Rule 3: Latency & Cost Break Ties</span>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  When both models pass with equal accuracy, lower P50 latency breaks the tie. If latency is within 20ms, lower inference token cost breaks the tie.
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* 4. Comparison History Drawer */}
        <Sheet open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
          <SheetContent side="right" className="w-full sm:max-w-md bg-zinc-950 border-border p-6 overflow-y-auto">
            <SheetHeader className="pb-4 border-b border-border">
              <div className="flex items-center justify-between">
                <SheetTitle className="text-sm font-semibold text-white flex items-center gap-2">
                  <History className="h-4 w-4 text-white" />
                  Past Shootout Comparisons
                </SheetTitle>
                {history.length > 0 && (
                  <Button
                    onClick={clearHistory}
                    variant="ghost"
                    size="sm"
                    className="text-xs text-zinc-500 hover:text-white h-7 gap-1"
                  >
                    <Trash2 className="h-3 w-3" />
                    Clear
                  </Button>
                )}
              </div>
              <SheetDescription className="text-xs text-zinc-400">
                Restore previous side-by-side shootout comparisons and trace logs.
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-3 pt-4">
              {history.length === 0 ? (
                <div className="text-center py-12 text-xs text-zinc-500">
                  No comparison records saved yet.
                </div>
              ) : (
                history.map((item, idx) => (
                  <div
                    key={item.id ? `hist_${item.id}` : `hist_idx_${idx}`}
                    className="p-3.5 rounded-lg border border-border bg-card hover:border-zinc-700 transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-white">
                        {item.suite_name}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500">
                        {new Date(item.timestamp).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="text-[11px] font-mono text-zinc-400">
                      <span>{item.model_a.split("/").pop()}</span>
                      <span className="text-zinc-600 mx-1.5">vs</span>
                      <span>{item.model_b.split("/").pop()}</span>
                    </div>

                    <div className="text-xs text-zinc-300 font-medium">
                      {item.verdict_headline}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border/50">
                      <span className="text-[10px] font-mono text-zinc-500">
                        P50: {item.latency_delta_ms > 0 ? `+${Math.round(item.latency_delta_ms)}ms` : `${Math.round(item.latency_delta_ms)}ms`}
                      </span>
                      <Button
                        onClick={() => handleRestoreRecord(item)}
                        variant="ghost"
                        size="sm"
                        className="text-xs h-6 px-2 text-zinc-300 hover:text-white"
                      >
                        Restore →
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
