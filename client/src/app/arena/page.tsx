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
  XCircle,
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white flex items-center gap-2">
            <Swords className="h-5 w-5 text-white" />
            Model Benchmark Arena Shootout
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Run head-to-head A/B evaluations on the exact same test cases to measure quality gates, latency, and cost trade-offs.
          </p>
        </div>
        <Button
          onClick={handleRunShootout}
          disabled={arenaMutation.isPending || !activeSuite}
          variant="default"
          className="gap-2 px-5 text-xs"
        >
          {arenaMutation.isPending ? (
            <span className="flex items-center gap-2">
              <span className="h-3.5 w-3.5 rounded-full border-2 border-black border-t-transparent animate-spin" />
              Running Shootout...
            </span>
          ) : (
            <>
              <Swords className="h-3.5 w-3.5" />
              Launch Arena Shootout
            </>
          )}
        </Button>
      </div>

      {arenaMutation.isError && (
        <div className="p-3.5 rounded-md border border-border bg-zinc-950 text-zinc-300 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-zinc-400" />
          <span>{arenaMutation.error.message}</span>
        </div>
      )}

      {/* Arena Configuration Bar */}
      <Card className="border-border bg-card">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-xs font-semibold text-white flex items-center gap-2">
            <Cpu className="h-3.5 w-3.5 text-zinc-400" />
            Battle Setup & Contenders
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-1">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Benchmark Suite */}
            <div>
              <label className="text-[11px] font-medium text-zinc-400 block mb-1">
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
              <label className="text-[11px] font-medium text-zinc-300 block mb-1">
                Model A (Primary)
              </label>
              <Select value={modelA} onValueChange={setModelA}>
                <SelectTrigger className="font-mono text-xs">
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
              <label className="text-[11px] font-medium text-zinc-300 block mb-1">
                Model B (Challenger)
              </label>
              <Select value={modelB} onValueChange={setModelB}>
                <SelectTrigger className="font-mono text-xs">
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
        <div className="space-y-5">
          {/* Winner Banner */}
          {winner && (
            <div className="p-4 rounded-lg border border-border bg-zinc-950 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white">
                  <Trophy className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider block">
                    Shootout Winner
                  </span>
                  <span className="text-sm font-semibold text-white font-mono">
                    {winner.name}: {winner.model}
                  </span>
                </div>
              </div>
              <Badge variant="outline" className="border-border text-zinc-300 font-mono text-xs">
                {result.run_a.total_tests} test cases evaluated
              </Badge>
            </div>
          )}

          {/* Delta KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Pass Rate Delta */}
            <Card className="border-border bg-card">
              <CardHeader className="p-4 pb-1 flex flex-row items-center justify-between">
                <CardTitle className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                  Pass Rate Delta (B - A)
                </CardTitle>
                <CheckCircle2 className="h-3.5 w-3.5 text-zinc-400" />
              </CardHeader>
              <CardContent className="p-4 pt-0 font-mono">
                <div className="text-xl font-bold text-white">
                  {result.pass_rate_delta > 0 ? `+${(result.pass_rate_delta * 100).toFixed(1)}%` : `${(result.pass_rate_delta * 100).toFixed(1)}%`}
                </div>
                <div className="flex justify-between text-[11px] text-zinc-500 mt-2 border-t border-border pt-1.5">
                  <span>A: <strong className="text-zinc-300">{formatPercent(result.run_a.pass_rate)}</strong></span>
                  <span>B: <strong className="text-zinc-300">{formatPercent(result.run_b.pass_rate)}</strong></span>
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
              <CardContent className="p-4 pt-0 font-mono">
                <div className="text-xl font-bold text-white">
                  {result.latency_p50_delta_ms > 0 ? `+${Math.round(result.latency_p50_delta_ms)}ms` : `${Math.round(result.latency_p50_delta_ms)}ms`}
                </div>
                <div className="flex justify-between text-[11px] text-zinc-500 mt-2 border-t border-border pt-1.5">
                  <span>A: <strong className="text-zinc-300">{formatMs(result.run_a.p50_latency_ms)}</strong></span>
                  <span>B: <strong className="text-zinc-300">{formatMs(result.run_b.p50_latency_ms)}</strong></span>
                </div>
              </CardContent>
            </Card>

            {/* Cost Delta */}
            <Card className="border-border bg-card">
              <CardHeader className="p-4 pb-1 flex flex-row items-center justify-between">
                <CardTitle className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                  Cost Delta
                </CardTitle>
                <Coins className="h-3.5 w-3.5 text-zinc-400" />
              </CardHeader>
              <CardContent className="p-4 pt-0 font-mono">
                <div className="text-xl font-bold text-white">
                  {result.cost_delta_usd > 0 ? `+${formatCost(result.cost_delta_usd)}` : formatCost(result.cost_delta_usd)}
                </div>
                <div className="flex justify-between text-[11px] text-zinc-500 mt-2 border-t border-border pt-1.5">
                  <span>A: <strong className="text-zinc-300">{formatCost(result.run_a.total_cost_usd)}</strong></span>
                  <span>B: <strong className="text-zinc-300">{formatCost(result.run_b.total_cost_usd)}</strong></span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Test Case by Test Case Comparison Matrix */}
          <div className="space-y-2.5">
            <h3 className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
              Head-to-Head Test Case Breakdown ({result.run_a.results.length} tests)
            </h3>
            <div className="space-y-3">
              {result.run_a.results.map((resA, idx) => {
                const resB = result.run_b.results[idx] || resA;
                const isMismatch = resA.passed !== resB.passed;

                return (
                  <Card
                    key={resA.test_id || idx}
                    className="border-border bg-card"
                  >
                    <CardHeader className="p-3 pb-2 flex flex-row items-center justify-between border-b border-border">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-xs border-border text-zinc-300">
                          Test: {resA.test_id}
                        </Badge>
                        {isMismatch && (
                          <Badge variant="secondary" className="text-[10px] bg-zinc-800 text-zinc-300">
                            Discrepancy
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="p-3 pt-2.5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* Model A Result */}
                        <div className="space-y-1.5 p-2.5 rounded bg-zinc-950 border border-border">
                          <div className="flex items-center justify-between font-mono text-xs">
                            <span className="font-medium text-zinc-200">Model A ({result.model_a})</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-zinc-500">{formatMs(resA.latency_ms)}</span>
                              <Badge variant="outline" className="text-[10px] border-zinc-800 text-zinc-300">
                                {resA.passed ? "PASSED" : "FAILED"}
                              </Badge>
                            </div>
                          </div>
                          <div className="p-2 rounded bg-black font-mono text-xs text-zinc-300 whitespace-pre-wrap max-h-32 overflow-y-auto leading-relaxed">
                            {resA.completion || <span className="text-zinc-600 italic">No completion</span>}
                          </div>
                        </div>

                        {/* Model B Result */}
                        <div className="space-y-1.5 p-2.5 rounded bg-zinc-950 border border-border">
                          <div className="flex items-center justify-between font-mono text-xs">
                            <span className="font-medium text-zinc-200">Model B ({result.model_b})</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-zinc-500">{formatMs(resB.latency_ms)}</span>
                              <Badge variant="outline" className="text-[10px] border-zinc-800 text-zinc-300">
                                {resB.passed ? "PASSED" : "FAILED"}
                              </Badge>
                            </div>
                          </div>
                          <div className="p-2 rounded bg-black font-mono text-xs text-zinc-300 whitespace-pre-wrap max-h-32 overflow-y-auto leading-relaxed">
                            {resB.completion || <span className="text-zinc-600 italic">No completion</span>}
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
