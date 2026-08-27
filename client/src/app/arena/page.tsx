"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { formatCost, formatMs, formatPercent } from "@/lib/utils";
import { ArenaComparisonResult } from "@/types";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Coins,
  Cpu,
  Swords,
  Trophy,
} from "lucide-react";

const ARENA_MODELS = [
  { id: "openai/gpt-4o-mini", label: "OpenAI GPT-4o-mini" },
  { id: "openai/gpt-4o", label: "OpenAI GPT-4o" },
  { id: "anthropic/claude-3-5-sonnet", label: "Anthropic Claude 3.5 Sonnet" },
  { id: "google/gemini-2.0-flash", label: "Google Gemini 2.0 Flash" },
  { id: "deepseek/deepseek-v4-pro-0813", label: "DeepSeek v4 Pro" },
  { id: "mock/simulator", label: "Mock Simulator" },
];

export default function ArenaPage() {
  const [selectedSuite, setSelectedSuite] = useState<string>("");
  const [modelA, setModelA] = useState("openai/gpt-4o-mini");
  const [modelB, setModelB] = useState("deepseek/deepseek-v4-pro-0813");
  const [concurrency, setConcurrency] = useState(10);
  const [result, setResult] = useState<ArenaComparisonResult | null>(null);

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

  const activeSuite = selectedSuite || (suites.length > 0 ? suites[0].name : "");

  // TanStack Mutation: Arena comparison
  const arenaMutation = useMutation({
    mutationFn: (params: { suite_name: string; model_a: string; model_b: string; concurrency: number }) =>
      api.compareArena(params),
    onSuccess: (data) => {
      setResult(data);
    },
  });

  const handleRunShootout = () => {
    if (!activeSuite) return;
    arenaMutation.mutate({
      suite_name: activeSuite,
      model_a: modelA,
      model_b: modelB,
      concurrency,
    });
  };

  // Determine winner
  const getWinner = () => {
    if (!result) return null;
    if (result.run_a.pass_rate > result.run_b.pass_rate) return { model: result.model_a, name: "Model A" };
    if (result.run_b.pass_rate > result.run_a.pass_rate) return { model: result.model_b, name: "Model B" };
    if (result.run_a.p50_latency_ms < result.run_b.p50_latency_ms) return { model: result.model_a, name: "Model A (Speed)" };
    if (result.run_b.p50_latency_ms < result.run_a.p50_latency_ms) return { model: result.model_b, name: "Model B (Speed)" };
    return { model: "Tie", name: "Tie" };
  };

  const winner = getWinner();

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Swords className="h-6 w-6 text-purple-400" />
            Model Benchmark Arena Shootout
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Run head-to-head A/B evaluations on the exact same test cases to measure quality gates, latency, and cost trade-offs.
          </p>
        </div>
        <Button
          onClick={handleRunShootout}
          disabled={arenaMutation.isPending || !activeSuite}
          variant="glow"
          className="gap-2 px-6"
        >
          {arenaMutation.isPending ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 rounded-full border-2 border-black border-t-transparent animate-spin" />
              Running Shootout...
            </span>
          ) : (
            <>
              <Swords className="h-4 w-4" />
              Launch Arena Shootout
            </>
          )}
        </Button>
      </div>

      {arenaMutation.isError && (
        <div className="p-4 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300 text-sm flex items-center gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-400" />
          <span>{arenaMutation.error.message}</span>
        </div>
      )}

      {/* Arena Configuration Bar */}
      <Card className="border-border/80">
        <CardHeader className="p-5 pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Cpu className="h-4 w-4 text-purple-400" />
            Battle Setup & Contenders
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Benchmark Suite */}
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                Benchmark Suite
              </label>
              <Select value={activeSuite} onValueChange={setSelectedSuite}>
                <SelectTrigger className="font-mono text-xs">
                  <SelectValue placeholder="Select suite" />
                </SelectTrigger>
                <SelectContent>
                  {suites.map((s) => (
                    <SelectItem key={s.name} value={s.name} className="font-mono text-xs">
                      {s.name} ({s.test_count} tests)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Model A */}
            <div>
              <label className="text-xs font-medium text-emerald-400 block mb-1.5 flex items-center gap-1">
                <span>Model A (Primary)</span>
              </label>
              <Select value={modelA} onValueChange={setModelA}>
                <SelectTrigger className="font-mono text-xs border-emerald-500/30 bg-emerald-500/5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ARENA_MODELS.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="font-mono text-xs">
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Model B */}
            <div>
              <label className="text-xs font-medium text-purple-400 block mb-1.5 flex items-center gap-1">
                <span>Model B (Challenger)</span>
              </label>
              <Select value={modelB} onValueChange={setModelB}>
                <SelectTrigger className="font-mono text-xs border-purple-500/30 bg-purple-500/5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ARENA_MODELS.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="font-mono text-xs">
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results View */}
      {result && (
        <div className="space-y-6">
          {/* Winner Banner */}
          {winner && (
            <div className="p-5 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <Trophy className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-xs text-amber-400 font-semibold uppercase tracking-wider block">
                    Arena Shootout Winner
                  </span>
                  <span className="text-base font-bold text-foreground font-mono">
                    {winner.name}: {winner.model}
                  </span>
                </div>
              </div>
              <Badge variant="outline" className="border-amber-500/40 text-amber-300 font-mono text-xs">
                {result.run_a.total_tests} test cases evaluated
              </Badge>
            </div>
          )}

          {/* Delta KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Pass Rate Delta */}
            <Card className="border-border/80">
              <CardHeader className="p-5 pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Pass Rate Delta (B - A)
                </CardTitle>
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              </CardHeader>
              <CardContent className="p-5 pt-0 font-mono">
                <div className="flex items-baseline gap-2">
                  <span className={`text-2xl font-bold ${result.pass_rate_delta >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {result.pass_rate_delta > 0 ? `+${(result.pass_rate_delta * 100).toFixed(1)}%` : `${(result.pass_rate_delta * 100).toFixed(1)}%`}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-2 border-t border-border/40 pt-2">
                  <span>Model A: <strong className="text-foreground">{formatPercent(result.run_a.pass_rate)}</strong></span>
                  <span>Model B: <strong className="text-foreground">{formatPercent(result.run_b.pass_rate)}</strong></span>
                </div>
              </CardContent>
            </Card>

            {/* P50 Latency Delta */}
            <Card className="border-border/80">
              <CardHeader className="p-5 pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  P50 Latency Delta
                </CardTitle>
                <Clock className="h-4 w-4 text-purple-400" />
              </CardHeader>
              <CardContent className="p-5 pt-0 font-mono">
                <div className="flex items-baseline gap-2">
                  <span className={`text-2xl font-bold ${result.latency_p50_delta_ms <= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {result.latency_p50_delta_ms > 0 ? `+${Math.round(result.latency_p50_delta_ms)}ms` : `${Math.round(result.latency_p50_delta_ms)}ms`}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {result.latency_p50_delta_ms <= 0 ? "(Model B Faster)" : "(Model A Faster)"}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-2 border-t border-border/40 pt-2">
                  <span>A: <strong className="text-foreground">{formatMs(result.run_a.p50_latency_ms)}</strong></span>
                  <span>B: <strong className="text-foreground">{formatMs(result.run_b.p50_latency_ms)}</strong></span>
                </div>
              </CardContent>
            </Card>

            {/* Cost Delta */}
            <Card className="border-border/80">
              <CardHeader className="p-5 pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Cost Delta
                </CardTitle>
                <Coins className="h-4 w-4 text-amber-400" />
              </CardHeader>
              <CardContent className="p-5 pt-0 font-mono">
                <div className="flex items-baseline gap-2">
                  <span className={`text-2xl font-bold ${result.cost_delta_usd <= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {result.cost_delta_usd > 0 ? `+${formatCost(result.cost_delta_usd)}` : formatCost(result.cost_delta_usd)}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-2 border-t border-border/40 pt-2">
                  <span>A: <strong className="text-foreground">{formatCost(result.run_a.total_cost_usd)}</strong></span>
                  <span>B: <strong className="text-foreground">{formatCost(result.run_b.total_cost_usd)}</strong></span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Test Case by Test Case Comparison Matrix */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Head-to-Head Test Case Breakdown ({result.run_a.results.length} tests)
            </h3>
            <div className="space-y-4">
              {result.run_a.results.map((resA, idx) => {
                const resB = result.run_b.results[idx] || resA;
                const isMismatch = resA.passed !== resB.passed;

                return (
                  <Card
                    key={resA.test_id || idx}
                    className={`border transition-all ${
                      isMismatch
                        ? "border-amber-500/40 bg-amber-500/5"
                        : "border-border/70 bg-card/60"
                    }`}
                  >
                    <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between border-b border-border/40">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-xs">
                          Test: {resA.test_id}
                        </Badge>
                        {isMismatch && (
                          <Badge variant="warning" className="text-[10px]">
                            Discrepancy
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Model A Result */}
                        <div className="space-y-2 p-3 rounded-lg bg-black/30 border border-emerald-500/20">
                          <div className="flex items-center justify-between font-mono text-xs">
                            <span className="font-semibold text-emerald-400">Model A: {result.model_a}</span>
                            <div className="flex items-center gap-2">
                              <span>{formatMs(resA.latency_ms)}</span>
                              <Badge variant={resA.passed ? "success" : "failure"} className="text-[10px]">
                                {resA.passed ? "PASSED" : "FAILED"}
                              </Badge>
                            </div>
                          </div>
                          <div className="p-2.5 rounded bg-black/50 font-mono text-xs text-foreground whitespace-pre-wrap max-h-36 overflow-y-auto leading-relaxed">
                            {resA.completion || <span className="text-muted-foreground italic">No completion</span>}
                          </div>
                        </div>

                        {/* Model B Result */}
                        <div className="space-y-2 p-3 rounded-lg bg-black/30 border border-purple-500/20">
                          <div className="flex items-center justify-between font-mono text-xs">
                            <span className="font-semibold text-purple-400">Model B: {result.model_b}</span>
                            <div className="flex items-center gap-2">
                              <span>{formatMs(resB.latency_ms)}</span>
                              <Badge variant={resB.passed ? "success" : "failure"} className="text-[10px]">
                                {resB.passed ? "PASSED" : "FAILED"}
                              </Badge>
                            </div>
                          </div>
                          <div className="p-2.5 rounded bg-black/50 font-mono text-xs text-foreground whitespace-pre-wrap max-h-36 overflow-y-auto leading-relaxed">
                            {resB.completion || <span className="text-muted-foreground italic">No completion</span>}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
