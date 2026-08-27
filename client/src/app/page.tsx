"use client";

import React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { formatCost, formatMs, formatPercent } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  Clock,
  Coins,
  Play,
  Swords,
  XCircle,
  Zap,
} from "lucide-react";

export default function DashboardOverview() {
  const { data: suites = [], isLoading: isSuitesLoading } = useQuery({
    queryKey: ["suites"],
    queryFn: api.listSuites,
  });

  const { data: recentRuns = [], isLoading: isRunsLoading } = useQuery({
    queryKey: ["runs", "recent"],
    queryFn: () => api.listRuns(undefined, 10),
  });

  const totalTests = suites.reduce((acc, s) => acc + (s.test_count || 0), 0);
  const totalRunsCount = recentRuns.length;
  const passedRunsCount = recentRuns.filter((r) => r.passed).length;
  const globalPassRate =
    totalRunsCount > 0 ? passedRunsCount / totalRunsCount : 1.0;
  const avgP50Latency =
    totalRunsCount > 0
      ? recentRuns.reduce((acc, r) => acc + r.p50_latency_ms, 0) / totalRunsCount
      : 0;
  const totalCost = recentRuns.reduce((acc, r) => acc + r.total_cost_usd, 0);

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pass Rate */}
        <Card className="border-border bg-card">
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
            ) : (
              <>
                <div className="text-2xl font-bold text-white font-mono">
                  {formatPercent(globalPassRate)}
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">
                  {passedRunsCount} of {totalRunsCount} recent runs passed
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Total Suites & Tests */}
        <Card className="border-border bg-card">
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
                  {suites.length} <span className="text-xs font-normal text-zinc-500">({totalTests} tests)</span>
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">
                  In workspace <code className="text-[10px] bg-zinc-900 px-1 rounded text-zinc-400">./evals</code>
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* P50 Latency */}
        <Card className="border-border bg-card">
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
            ) : (
              <>
                <div className="text-2xl font-bold text-white font-mono">
                  {formatMs(avgP50Latency)}
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">Across active targets</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Estimated Total Spend */}
        <Card className="border-border bg-card">
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
            ) : (
              <>
                <div className="text-2xl font-bold text-white font-mono">
                  {formatCost(totalCost)}
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">Calculated token fees</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Launch Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/playground" prefetch={true} className="block group">
          <Card className="h-full border-border bg-card hover:bg-zinc-900/60 hover:border-zinc-700 transition-all">
            <CardHeader className="p-5">
              <div className="h-8 w-8 rounded-md bg-zinc-900 border border-zinc-800 text-white flex items-center justify-center mb-3">
                <Play className="h-4 w-4 fill-current" />
              </div>
              <CardTitle className="text-sm text-white flex items-center justify-between">
                <span>Prompt Playground</span>
                <ArrowRight className="h-3.5 w-3.5 text-zinc-500 group-hover:text-white transition-colors" />
              </CardTitle>
              <CardDescription className="text-xs text-zinc-400 mt-1.5">
                Experiment with system prompts, variables, JSON schemas, and live semantic judge evaluations.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/arena" prefetch={true} className="block group">
          <Card className="h-full border-border bg-card hover:bg-zinc-900/60 hover:border-zinc-700 transition-all">
            <CardHeader className="p-5">
              <div className="h-8 w-8 rounded-md bg-zinc-900 border border-zinc-800 text-white flex items-center justify-center mb-3">
                <Swords className="h-4 w-4" />
              </div>
              <CardTitle className="text-sm text-white flex items-center justify-between">
                <span>Arena Shootout</span>
                <ArrowRight className="h-3.5 w-3.5 text-zinc-500 group-hover:text-white transition-colors" />
              </CardTitle>
              <CardDescription className="text-xs text-zinc-400 mt-1.5">
                Benchmark Model A vs Model B side-by-side with pass rate differences, latency curves, and cost deltas.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/suites" prefetch={true} className="block group">
          <Card className="h-full border-border bg-card hover:bg-zinc-900/60 hover:border-zinc-700 transition-all">
            <CardHeader className="p-5">
              <div className="h-8 w-8 rounded-md bg-zinc-900 border border-zinc-800 text-white flex items-center justify-center mb-3">
                <Boxes className="h-4 w-4" />
              </div>
              <CardTitle className="text-sm text-white flex items-center justify-between">
                <span>Suites & Test Matrix</span>
                <ArrowRight className="h-3.5 w-3.5 text-zinc-500 group-hover:text-white transition-colors" />
              </CardTitle>
              <CardDescription className="text-xs text-zinc-400 mt-1.5">
                Manage YAML test suites, pre-flight dry-run cost estimation, and live streaming test case execution.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>

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
              <span>View Trends</span>
              <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {isRunsLoading ? (
            <div className="p-5 space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-border/50">
                  <Skeleton className="h-5 w-20 rounded" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          ) : recentRuns.length === 0 ? (
            <div className="text-center py-12 text-xs text-zinc-500">
              No evaluation runs recorded yet. Run a suite from the <Link href="/suites" className="text-white underline">Suites page</Link>!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
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
                  {recentRuns.map((run) => (
                    <tr key={run.run_id} className="hover:bg-zinc-900/50 transition-colors">
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
