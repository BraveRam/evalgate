"use client";

import React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatCost, formatMs, formatPercent } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
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
  const { data: suites = [] } = useQuery({
    queryKey: ["suites"],
    queryFn: api.listSuites,
  });

  const { data: recentRuns = [] } = useQuery({
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Applied AI Evaluation Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Prompt regression testing, semantic LLM judges, and side-by-side model arena shootout.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/playground">
            <Button variant="outline" size="sm" className="gap-2 text-xs">
              <Play className="h-3.5 w-3.5" />
              Playground
            </Button>
          </Link>
          <Link href="/suites">
            <Button variant="glow" size="sm" className="gap-2 text-xs">
              <Zap className="h-3.5 w-3.5" />
              Run Suites
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pass Rate */}
        <Card className="border-border/70 hover:border-emerald-500/30 transition-all">
          <CardHeader className="p-5 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Gate Pass Rate
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="text-2xl font-bold text-foreground font-mono">
              {formatPercent(globalPassRate)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {passedRunsCount} of {totalRunsCount} recent runs passed gate
            </p>
          </CardContent>
        </Card>

        {/* Total Suites & Tests */}
        <Card className="border-border/70 hover:border-sky-500/30 transition-all">
          <CardHeader className="p-5 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Discovered Suites
            </CardTitle>
            <Boxes className="h-4 w-4 text-sky-400" />
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="text-2xl font-bold text-foreground font-mono">
              {suites.length} <span className="text-sm font-normal text-muted-foreground">({totalTests} tests)</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              In workspace <code className="text-[11px] bg-muted px-1 rounded">./evals</code>
            </p>
          </CardContent>
        </Card>

        {/* P50 Latency */}
        <Card className="border-border/70 hover:border-purple-500/30 transition-all">
          <CardHeader className="p-5 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Avg P50 Latency
            </CardTitle>
            <Clock className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="text-2xl font-bold text-foreground font-mono">
              {formatMs(avgP50Latency)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Across active targets</p>
          </CardContent>
        </Card>

        {/* Estimated Total Spend */}
        <Card className="border-border/70 hover:border-amber-500/30 transition-all">
          <CardHeader className="p-5 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Inference Spend
            </CardTitle>
            <Coins className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="text-2xl font-bold text-foreground font-mono">
              {formatCost(totalCost)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Tracked across executions</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Launch Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Link href="/playground" className="block group">
          <Card className="h-full border-border/80 group-hover:border-emerald-500/40 group-hover:bg-card transition-all cursor-pointer">
            <CardHeader className="p-6">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Play className="h-5 w-5" />
              </div>
              <CardTitle className="text-base group-hover:text-emerald-400 transition-colors flex items-center justify-between">
                <span>Prompt Playground</span>
                <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </CardTitle>
              <CardDescription className="mt-2">
                Experiment with system prompts, variables, JSON schemas, and live semantic judge evaluations on-the-fly.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/arena" className="block group">
          <Card className="h-full border-border/80 group-hover:border-purple-500/40 group-hover:bg-card transition-all cursor-pointer">
            <CardHeader className="p-6">
              <div className="h-10 w-10 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Swords className="h-5 w-5" />
              </div>
              <CardTitle className="text-base group-hover:text-purple-400 transition-colors flex items-center justify-between">
                <span>Arena Shootout</span>
                <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </CardTitle>
              <CardDescription className="mt-2">
                Benchmark Model A vs Model B side-by-side with pass rate differences, latency curves, and cost deltas.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/suites" className="block group">
          <Card className="h-full border-border/80 group-hover:border-sky-500/40 group-hover:bg-card transition-all cursor-pointer">
            <CardHeader className="p-6">
              <div className="h-10 w-10 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Boxes className="h-5 w-5" />
              </div>
              <CardTitle className="text-base group-hover:text-sky-400 transition-colors flex items-center justify-between">
                <span>Suites & Test Matrix</span>
                <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </CardTitle>
              <CardDescription className="mt-2">
                Manage YAML test suites, pre-flight dry-run cost estimation, and live streaming test case execution.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>

      {/* Recent Evaluation Runs Table */}
      <Card className="border-border/80">
        <CardHeader className="p-6 pb-4 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Recent Evaluation Runs</CardTitle>
            <CardDescription className="text-xs mt-1">
              Historical execution traces saved to local SQLite database.
            </CardDescription>
          </div>
          <Link href="/analytics">
            <Button variant="ghost" size="sm" className="text-xs gap-1.5 text-muted-foreground hover:text-foreground">
              <span>View All Trends</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {recentRuns.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              No evaluation runs recorded yet. Run a suite from the <Link href="/suites" className="text-emerald-400 hover:underline">Suites page</Link>!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 text-muted-foreground border-y border-border/60">
                  <tr>
                    <th className="py-3 px-6 font-medium">Status</th>
                    <th className="py-3 px-4 font-medium">Suite</th>
                    <th className="py-3 px-4 font-medium">Model</th>
                    <th className="py-3 px-4 font-medium">Pass Rate</th>
                    <th className="py-3 px-4 font-medium">P50 Latency</th>
                    <th className="py-3 px-4 font-medium">Cost</th>
                    <th className="py-3 px-6 font-medium text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {recentRuns.map((run) => (
                    <tr key={run.run_id} className="hover:bg-accent/30 transition-colors">
                      <td className="py-3.5 px-6">
                        {run.passed ? (
                          <Badge variant="success" className="gap-1 font-mono text-[10px]">
                            <CheckCircle2 className="h-3 w-3" />
                            PASSED
                          </Badge>
                        ) : (
                          <Badge variant="failure" className="gap-1 font-mono text-[10px]">
                            <XCircle className="h-3 w-3" />
                            FAILED
                          </Badge>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-foreground">{run.suite_name}</td>
                      <td className="py-3.5 px-4 font-mono text-muted-foreground">{run.target_model}</td>
                      <td className="py-3.5 px-4 font-mono">
                        <span className={run.pass_rate >= 1.0 ? "text-emerald-400 font-semibold" : "text-rose-400"}>
                          {formatPercent(run.pass_rate)}
                        </span>
                        <span className="text-[10px] text-muted-foreground ml-1">
                          ({run.passed_tests}/{run.total_tests})
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-muted-foreground">{formatMs(run.p50_latency_ms)}</td>
                      <td className="py-3.5 px-4 font-mono text-muted-foreground">{formatCost(run.total_cost_usd)}</td>
                      <td className="py-3.5 px-6 font-mono text-muted-foreground text-right">
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
