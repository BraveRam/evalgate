"use client";

import React, { useState } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { formatCost, formatMs, formatPercent } from "@/lib/utils";
import { usePageTitle } from "@/lib/use-page-title";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  Clock,
  Coins,
  Cpu,
  Database,
  ExternalLink,
  FileCode,
  Layers,
  Play,
  RefreshCw,
  Sparkles,
  Terminal,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";

export default function DashboardOverview() {
  usePageTitle("Overview");
  const queryClient = useQueryClient();
  const [isRetryingHealth, setIsRetryingHealth] = useState(false);

  // TanStack Queries
  const {
    data: health,
    isLoading: isHealthLoading,
    isError: isHealthError,
    refetch: refetchHealth,
  } = useQuery({
    queryKey: ["health"],
    queryFn: api.getHealth,
    refetchInterval: 10000,
  });

  const {
    data: suites = [],
    isLoading: isSuitesLoading,
  } = useQuery({
    queryKey: ["suites"],
    queryFn: api.listSuites,
  });

  const {
    data: recentRuns = [],
    isLoading: isRunsLoading,
  } = useQuery({
    queryKey: ["runs", "recent"],
    queryFn: () => api.listRuns(undefined, 20),
  });

  const handleRetryHealth = async () => {
    setIsRetryingHealth(true);
    try {
      await refetchHealth();
    } finally {
      setIsRetryingHealth(false);
    }
  };

  // Aggregations
  const totalTests = suites.reduce((acc, s) => acc + (s.test_count || 0), 0);
  const totalRunsCount = recentRuns.length;
  const passedRunsCount = recentRuns.filter((r) => r.passed).length;
  const failedRunsCount = totalRunsCount - passedRunsCount;

  const globalPassRate =
    totalRunsCount > 0 ? passedRunsCount / totalRunsCount : null;
  const avgP50Latency =
    totalRunsCount > 0
      ? recentRuns.reduce((acc, r) => acc + r.p50_latency_ms, 0) / totalRunsCount
      : null;
  const totalCost =
    totalRunsCount > 0
      ? recentRuns.reduce((acc, r) => acc + r.total_cost_usd, 0)
      : null;

  const latestRun = recentRuns.length > 0 ? recentRuns[0] : null;

  // Identify Attention Required items
  const failedRuns = recentRuns.filter((r) => !r.passed);
  const slowRuns = recentRuns.filter(
    (r) => r.p95_latency_ms > 2500 || r.p50_latency_ms > 1500
  );
  const testedSuiteNames = new Set(recentRuns.map((r) => r.suite_name));
  const untestedSuites = suites.filter((s) => !testedSuiteNames.has(s.name));

  const hasProblems =
    failedRuns.length > 0 || slowRuns.length > 0 || untestedSuites.length > 0;

  // System status flags
  const isApiOnline = !isHealthError && health?.status === "ok";
  const providerMode = health?.provider_mode || (isApiOnline ? "Gateway Active" : "Offline");
  const isProviderConfigured = health?.provider_configured ?? false;

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white flex items-center gap-2.5">
            <Terminal className="h-5 w-5 text-white" />
            Applied AI Evaluation Dashboard
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Prompt regression testing, semantic LLM judges, and side-by-side model arena shootout.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/playground" prefetch={true}>
            <Button variant="outline" size="sm" className="gap-2 text-xs">
              <Play className="h-3 w-3" />
              Playground
            </Button>
          </Link>
          <Link href="/suites" prefetch={true}>
            <Button variant="default" size="sm" className="gap-2 text-xs">
              <Zap className="h-3 w-3 fill-current" />
              Run Suites
            </Button>
          </Link>
        </div>
      </div>

      {/* 2. Workspace Readiness & Health Strip */}
      <div className="p-3.5 rounded-lg border border-border bg-zinc-950/70 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          {/* API Status */}
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                isApiOnline
                  ? "bg-white"
                  : isHealthLoading
                  ? "bg-zinc-400 animate-pulse"
                  : "bg-zinc-600"
              }`}
            />
            <span className="text-zinc-300 font-medium font-mono text-[11px]">
              {isApiOnline
                ? `API Connected (v${health?.version || "0.1.0"})`
                : isHealthLoading
                ? "Checking API..."
                : "API Offline"}
            </span>
            {!isApiOnline && !isHealthLoading && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRetryHealth}
                disabled={isRetryingHealth}
                className="h-6 px-1.5 text-[10px] text-zinc-400 hover:text-white"
              >
                <RefreshCw
                  className={`h-2.5 w-2.5 mr-1 ${isRetryingHealth ? "animate-spin" : ""}`}
                />
                Retry
              </Button>
            )}
          </div>

          <div className="hidden sm:block h-3.5 w-px bg-border" />

          {/* Model Provider Status */}
          <div className="flex items-center gap-1.5 text-zinc-400">
            <Cpu className="h-3.5 w-3.5 text-zinc-500" />
            <span className="text-zinc-500">Provider:</span>
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 font-mono ${
                isProviderConfigured
                  ? "border-zinc-700 bg-zinc-900 text-zinc-200"
                  : "border-zinc-800 bg-zinc-950 text-zinc-400"
              }`}
            >
              {providerMode}
            </Badge>
          </div>

          <div className="hidden sm:block h-3.5 w-px bg-border" />

          {/* Discovered Suites Count */}
          <div className="flex items-center gap-1.5 text-zinc-400">
            <Boxes className="h-3.5 w-3.5 text-zinc-500" />
            <span className="text-zinc-300 font-mono text-[11px]">
              {suites.length} Suites Ready
            </span>
          </div>

          <div className="hidden md:block h-3.5 w-px bg-border" />

          {/* Storage Status */}
          <div className="hidden md:flex items-center gap-1.5 text-zinc-400">
            <Database className="h-3.5 w-3.5 text-zinc-500" />
            <span className="text-zinc-400 text-[11px]">SQLite WAL Active</span>
          </div>
        </div>

        {/* Last Run Info */}
        <div className="flex items-center gap-1.5 text-zinc-500 text-[11px] font-mono">
          <Clock className="h-3 w-3" />
          <span>
            {latestRun
              ? `Last evaluated: ${new Date(latestRun.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}`
              : "No evaluations yet"}
          </span>
        </div>
      </div>

      {/* 3. KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pass Rate */}
        <Card className="border-0 bg-zinc-950/60 shadow-none">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
              Gate Pass Rate
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-zinc-400" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {isRunsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-7 w-20" />
                <Skeleton className="h-3 w-32" />
              </div>
            ) : totalRunsCount === 0 ? (
              <>
                <div className="text-2xl font-bold text-zinc-600 font-mono">—</div>
                <p className="text-[11px] text-zinc-500 mt-1">Not yet measured</p>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold text-white font-mono">
                  {formatPercent(globalPassRate!)}
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">
                  {passedRunsCount} of {totalRunsCount} recent runs passed
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Total Suites & Tests */}
        <Card className="border-0 bg-zinc-950/60 shadow-none">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
              Discovered Suites
            </CardTitle>
            <Boxes className="h-4 w-4 text-zinc-400" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {isSuitesLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-7 w-20" />
                <Skeleton className="h-3 w-32" />
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold text-white font-mono">
                  {suites.length}{" "}
                  <span className="text-xs font-normal text-zinc-500">
                    ({totalTests} tests)
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">
                  In workspace <code className="text-[10px] bg-zinc-900 px-1 rounded text-zinc-400">./evals</code>
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* P50 Latency */}
        <Card className="border-0 bg-zinc-950/60 shadow-none">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
              Avg P50 Latency
            </CardTitle>
            <Clock className="h-4 w-4 text-zinc-400" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {isRunsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-7 w-20" />
                <Skeleton className="h-3 w-32" />
              </div>
            ) : totalRunsCount === 0 ? (
              <>
                <div className="text-2xl font-bold text-zinc-600 font-mono">—</div>
                <p className="text-[11px] text-zinc-500 mt-1">No runs recorded</p>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold text-white font-mono">
                  {formatMs(avgP50Latency!)}
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">Across active targets</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Estimated Spend */}
        <Card className="border-0 bg-zinc-950/60 shadow-none">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
              Inference Spend
            </CardTitle>
            <Coins className="h-4 w-4 text-zinc-400" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {isRunsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-7 w-20" />
                <Skeleton className="h-3 w-32" />
              </div>
            ) : totalRunsCount === 0 ? (
              <>
                <div className="text-2xl font-bold text-zinc-600 font-mono">—</div>
                <p className="text-[11px] text-zinc-500 mt-1">No token spend yet</p>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold text-white font-mono">
                  {formatCost(totalCost!)}
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">Calculated token fees</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ========================================================================= */}
      {/* EMPTY WORKSPACE STATE: Action-Oriented Setup & Example Suites             */}
      {/* ========================================================================= */}
      {totalRunsCount === 0 ? (
        <div className="space-y-6">
          {/* Step-by-Step Onboarding Panel */}
          <Card className="border-border bg-gradient-to-b from-zinc-900/60 to-zinc-950/80">
            <CardHeader className="p-6 pb-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                <Sparkles className="h-4 w-4 text-white" />
                Getting Started
              </div>
              <CardTitle className="text-base font-semibold text-white mt-1">
                Set up your first prompt evaluation
              </CardTitle>
              <CardDescription className="text-xs text-zinc-400">
                EvalGate automates prompt regression testing, LLM-as-a-judge quality gates, and model shootouts in 3 steps.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-2 space-y-6">
              {/* 3 Step Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg border border-border bg-zinc-950/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 text-[11px] font-mono font-semibold text-white">
                      1
                    </span>
                    <FileCode className="h-4 w-4 text-zinc-500" />
                  </div>
                  <h3 className="text-xs font-semibold text-white">Create or Import a YAML Suite</h3>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Define test variables, reference contexts, and strict assertions inside declarative <code className="text-zinc-300">evals/*.yaml</code> files.
                  </p>
                </div>

                <div className="p-4 rounded-lg border border-border bg-zinc-950/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 text-[11px] font-mono font-semibold text-white">
                      2
                    </span>
                    <Cpu className="h-4 w-4 text-zinc-500" />
                  </div>
                  <h3 className="text-xs font-semibold text-white">Configure a Model Provider</h3>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Set your <code className="text-zinc-300">VERCEL_AI_GATEWAY_KEY</code> or run completely offline with the zero-cost mock simulator ($0.00).
                  </p>
                </div>

                <div className="p-4 rounded-lg border border-border bg-zinc-950/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 text-[11px] font-mono font-semibold text-white">
                      3
                    </span>
                    <Zap className="h-4 w-4 text-zinc-500" />
                  </div>
                  <h3 className="text-xs font-semibold text-white">Run & Enforce Quality Gates</h3>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Execute evaluations with concurrency limits, inspect P50/P95 latencies, and prevent prompt regressions in CI/CD.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border/60">
                <Link href="/suites" prefetch={true}>
                  <Button variant="default" size="sm" className="text-xs gap-1.5">
                    <Zap className="h-3.5 w-3.5 fill-current" />
                    Explore & Run Suites
                  </Button>
                </Link>
                <Link href="/playground" prefetch={true}>
                  <Button variant="outline" size="sm" className="text-xs gap-1.5">
                    <Play className="h-3.5 w-3.5" />
                    Open Playground
                  </Button>
                </Link>
                <Link href="/export" prefetch={true}>
                  <Button variant="outline" size="sm" className="text-xs gap-1.5 text-zinc-400 hover:text-white">
                    <ExternalLink className="h-3.5 w-3.5" />
                    CI/CD Setup Guides
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Example Discovered Suites Ready to Run */}
          {suites.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <div>
                  <h2 className="text-xs font-semibold text-white flex items-center gap-2">
                    <Boxes className="h-4 w-4 text-zinc-400" />
                    Example Suites Available in Workspace
                  </h2>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    Pre-configured starter templates ready for instant testing.
                  </p>
                </div>
                <Link href="/suites" prefetch={true}>
                  <Button variant="ghost" size="sm" className="text-xs text-zinc-400 hover:text-white gap-1">
                    <span>View all ({suites.length})</span>
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {suites.map((s, idx) => (
                  <Link
                    key={s.name ? `suite_card_${s.name}` : `suite_idx_${idx}`}
                    href={`/suites`}
                    prefetch={true}
                    className="block group"
                  >
                    <Card className="h-full border border-border bg-zinc-950/70 hover:border-zinc-700 hover:bg-zinc-900/60 transition-all">
                      <CardHeader className="p-4 pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-xs font-semibold text-white group-hover:text-zinc-200 truncate">
                            {s.name}
                          </CardTitle>
                          <Badge variant="outline" className="text-[9px] px-1 py-0 border border-zinc-800 text-zinc-400 font-mono shrink-0">
                            {formatPercent(s.min_pass_rate)} gate
                          </Badge>
                        </div>
                        <CardDescription className="text-[11px] text-zinc-400 line-clamp-2 mt-1 min-h-[32px]">
                          {s.description || "Prompt evaluation and assertion suite."}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-4 pt-1 flex items-center justify-between text-[10px] font-mono text-zinc-500 border-t border-border/40 mt-2">
                        <span>{s.test_count} test cases</span>
                        <span className="text-zinc-400 group-hover:text-white flex items-center gap-1 transition-colors">
                          Run Suite →
                        </span>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Informative Empty Recent Runs Preview */}
          <Card className="border-border bg-card">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-xs font-semibold text-white flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-zinc-400" />
                Recent Evaluation Runs
              </CardTitle>
              <CardDescription className="text-[11px] text-zinc-400">
                When you execute evaluation suites, historical metrics and regression logs will be tracked here.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 text-center border-t border-border/60">
              <div className="max-w-md mx-auto space-y-3 py-4">
                <div className="flex justify-center">
                  <div className="h-10 w-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500">
                    <Layers className="h-5 w-5" />
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-zinc-300">No evaluation runs recorded yet</h3>
                  <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                    Runs will automatically capture status, pass rate gates, P50/P95 latency degradation, token consumption, and dollar spend in SQLite.
                  </p>
                </div>
                <div className="pt-2">
                  <Link href="/suites" prefetch={true}>
                    <Button variant="default" size="sm" className="text-xs gap-1.5">
                      <Zap className="h-3 w-3 fill-current" />
                      Run Your First Suite
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* ========================================================================= */
        /* ACTIVE WORKSPACE STATE: Attention Required, Summary & Recent Runs         */
        /* ========================================================================= */
        <div className="space-y-8">
          {/* Attention Required Panel (Prioritizing Problems) */}
          <Card className={`border ${hasProblems ? "border-zinc-800 bg-zinc-950/90" : "border-border bg-card"}`}>
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between border-b border-border/50">
              <div className="flex items-center gap-2">
                {hasProblems ? (
                  <AlertTriangle className="h-4 w-4 text-zinc-300" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-white" />
                )}
                <CardTitle className="text-xs font-semibold text-white">
                  {hasProblems ? "Attention Required" : "System Status"}
                </CardTitle>
              </div>
              <Badge
                variant="outline"
                className={`text-[10px] font-mono ${
                  hasProblems
                    ? "border-zinc-700 bg-zinc-900 text-zinc-300"
                    : "border-zinc-800 bg-zinc-950 text-zinc-400"
                }`}
              >
                {hasProblems
                  ? `${failedRuns.length} failed • ${slowRuns.length} slow`
                  : "All Gates Passing"}
              </Badge>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {failedRuns.length > 0 && (
                <div className="p-3 rounded-md bg-zinc-900/80 border border-zinc-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <XCircle className="h-4 w-4 text-zinc-400 shrink-0" />
                    <div>
                      <span className="font-semibold text-white">
                        {failedRuns.length} Quality Gate Regression{failedRuns.length > 1 ? "s" : ""}
                      </span>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        Latest failure: <strong className="text-zinc-200">{failedRuns[0].suite_name}</strong> ({formatPercent(failedRuns[0].pass_rate)} pass rate vs {formatPercent(1.0)} required).
                      </p>
                    </div>
                  </div>
                  <Link href="/analytics" prefetch={true}>
                    <Button variant="ghost" size="sm" className="text-xs text-zinc-300 hover:text-white h-7 px-2">
                      Inspect Trace →
                    </Button>
                  </Link>
                </div>
              )}

              {slowRuns.length > 0 && (
                <div className="p-3 rounded-md bg-zinc-900/60 border border-zinc-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <Clock className="h-4 w-4 text-zinc-400 shrink-0" />
                    <div>
                      <span className="font-semibold text-white">
                        Latency Degradation Detected ({slowRuns.length} run{slowRuns.length > 1 ? "s" : ""})
                      </span>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        {slowRuns[0].suite_name} recorded P95 latency of {formatMs(slowRuns[0].p95_latency_ms)}.
                      </p>
                    </div>
                  </div>
                  <Link href="/analytics" prefetch={true}>
                    <Button variant="ghost" size="sm" className="text-xs text-zinc-300 hover:text-white h-7 px-2">
                      Latency Curves →
                    </Button>
                  </Link>
                </div>
              )}

              {untestedSuites.length > 0 && (
                <div className="p-3 rounded-md bg-zinc-900/40 border border-zinc-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <Boxes className="h-4 w-4 text-zinc-500 shrink-0" />
                    <div>
                      <span className="font-semibold text-zinc-300">
                        {untestedSuites.length} Untested Suite{untestedSuites.length > 1 ? "s" : ""}
                      </span>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        {untestedSuites.map((s) => s.name).join(", ")} has not been evaluated yet.
                      </p>
                    </div>
                  </div>
                  <Link href="/suites" prefetch={true}>
                    <Button variant="ghost" size="sm" className="text-xs text-zinc-300 hover:text-white h-7 px-2">
                      Run Now →
                    </Button>
                  </Link>
                </div>
              )}

              {!hasProblems && (
                <div className="text-xs text-zinc-400 flex items-center gap-2 py-1">
                  <CheckCircle2 className="h-4 w-4 text-white" />
                  <span>All evaluation suites are passing minimum quality gates with zero recorded regressions.</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Latest Run Snapshot & Deep-Dive */}
          {latestRun && (
            <Card className="border-border bg-card">
              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xs font-semibold text-white flex items-center gap-2">
                    <TrendingUp className="h-3.5 w-3.5 text-zinc-400" />
                    Latest Run Summary
                  </CardTitle>
                  <CardDescription className="text-[11px] text-zinc-400 mt-0.5">
                    Execution details for <strong className="text-zinc-200">{latestRun.suite_name}</strong>
                  </CardDescription>
                </div>
                <Badge
                  variant="outline"
                  className={`text-[10px] font-mono ${
                    latestRun.passed
                      ? "border-zinc-700 bg-zinc-900 text-zinc-200"
                      : "border-zinc-800 bg-zinc-950 text-zinc-400"
                  }`}
                >
                  {latestRun.passed ? "GATE PASSED" : "GATE FAILED"}
                </Badge>
              </CardHeader>
              <CardContent className="p-4 pt-2 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded bg-zinc-950 border border-border text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase block">Model</span>
                    <span className="text-zinc-200 font-medium truncate block">{latestRun.target_model}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase block">Pass Rate</span>
                    <span className="text-zinc-200 font-medium">
                      {formatPercent(latestRun.pass_rate)} ({latestRun.passed_tests}/{latestRun.total_tests})
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase block">P50 / P95 Latency</span>
                    <span className="text-zinc-200 font-medium">
                      {formatMs(latestRun.p50_latency_ms)} / {formatMs(latestRun.p95_latency_ms)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase block">Cost & Tokens</span>
                    <span className="text-zinc-200 font-medium">
                      {formatCost(latestRun.total_cost_usd)} ({latestRun.total_tokens}t)
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Evaluation Runs Table */}
          <Card className="border-border bg-card">
            <CardHeader className="p-5 pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-white">Recent Evaluation Runs</CardTitle>
                <CardDescription className="text-xs text-zinc-400 mt-0.5">
                  Historical execution traces saved to local SQLite database.
                </CardDescription>
              </div>
              <Link href="/analytics" prefetch={true}>
                <Button variant="ghost" size="sm" className="text-xs gap-1 text-zinc-400 hover:text-white">
                  <span>View Full Trends</span>
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[640px]">
                  <thead className="bg-zinc-950 text-zinc-400 border-y border-border">
                    <tr>
                      <th className="py-2.5 px-5 font-medium">Status</th>
                      <th className="py-2.5 px-4 font-medium">Suite</th>
                      <th className="py-2.5 px-4 font-medium">Model</th>
                      <th className="py-2.5 px-4 font-medium">Pass Rate</th>
                      <th className="py-2.5 px-4 font-medium">P50 Latency</th>
                      <th className="py-2.5 px-4 font-medium">Cost</th>
                      <th className="py-2.5 px-5 font-medium text-right">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {recentRuns.map((run, idx) => (
                      <tr key={run.run_id ? `run_row_${run.run_id}` : `run_row_idx_${idx}`} className="hover:bg-zinc-900/50 transition-colors">
                        <td className="py-3 px-5">
                          {run.passed ? (
                            <Badge variant="outline" className="gap-1 font-mono text-[10px] border-zinc-700 bg-zinc-900 text-zinc-200">
                              <CheckCircle2 className="h-3 w-3" />
                              PASSED
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1 font-mono text-[10px] border-zinc-800 bg-zinc-950 text-zinc-400">
                              <XCircle className="h-3 w-3" />
                              FAILED
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 px-4 font-medium text-white">{run.suite_name}</td>
                        <td className="py-3 px-4 font-mono text-zinc-400">{run.target_model}</td>
                        <td className="py-3 px-4 font-mono">
                          <span className="text-white font-medium">
                            {formatPercent(run.pass_rate)}
                          </span>
                          <span className="text-[10px] text-zinc-500 ml-1">
                            ({run.passed_tests}/{run.total_tests})
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-zinc-400">{formatMs(run.p50_latency_ms)}</td>
                        <td className="py-3 px-4 font-mono text-zinc-400">{formatCost(run.total_cost_usd)}</td>
                        <td className="py-3 px-5 font-mono text-zinc-500 text-right">
                          {new Date(run.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
