"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { formatCost, formatMs, formatPercent } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  CheckCircle2,
  Clock,
  Coins,
  RefreshCw,
  Trash2,
  XCircle,
} from "lucide-react";

export default function AnalyticsPage() {
  const queryClient = useQueryClient();
  const [selectedSuite, setSelectedSuite] = useState<string>("all");

  // TanStack Query: Fetch suites
  const { data: suites = [] } = useQuery({
    queryKey: ["suites"],
    queryFn: api.listSuites,
  });

  // TanStack Query: Fetch runs
  const {
    data: runs = [],
    isLoading,
    refetch: refetchRuns,
  } = useQuery({
    queryKey: ["runs", selectedSuite],
    queryFn: () => api.listRuns(selectedSuite === "all" ? undefined : selectedSuite, 50),
  });

  // TanStack Mutation: Delete run
  const deleteMutation = useMutation({
    mutationFn: (runId: string) => api.deleteRun(runId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["runs"] });
    },
    onError: (err: Error) => {
      alert(`Delete failed: ${err.message}`);
    },
  });

  const handleDeleteRun = (runId: string) => {
    if (!confirm("Are you sure you want to delete this run trace?")) return;
    deleteMutation.mutate(runId);
  };

  // Prepare chronological chart data (oldest to newest)
  const chartData = [...runs].reverse().map((r, idx) => ({
    name: `Run #${idx + 1}`,
    time: new Date(r.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    passRate: Math.round(r.pass_rate * 100),
    p50Latency: Math.round(r.p50_latency_ms),
    p95Latency: Math.round(r.p95_latency_ms),
    tokens: r.total_tokens,
    cost: parseFloat(r.total_cost_usd.toFixed(5)),
    model: r.target_model,
  }));

  const totalRuns = runs.length;
  const passedRuns = runs.filter((r) => r.passed).length;
  const avgPassRate = totalRuns > 0 ? passedRuns / totalRuns : 1.0;
  const avgP50 = totalRuns > 0 ? runs.reduce((a, b) => a + b.p50_latency_ms, 0) / totalRuns : 0;
  const totalCostUSD = runs.reduce((a, b) => a + b.total_cost_usd, 0);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-purple-400" />
            Historical Regression Trends & Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track pass rate regressions, P50/P95 latency degradation, and token cost curves across historical executions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedSuite} onValueChange={setSelectedSuite}>
            <SelectTrigger className="w-56 font-mono text-xs">
              <SelectValue placeholder="All Suites" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="font-mono text-xs">
                All Suites ({suites.length})
              </SelectItem>
              {suites.map((s) => (
                <SelectItem key={s.name} value={s.name} className="font-mono text-xs">
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => refetchRuns()} variant="outline" size="sm" className="gap-2 text-xs">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Aggregate Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/70">
          <CardHeader className="p-5 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Sampled Runs
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="text-2xl font-bold font-mono text-foreground">{totalRuns}</div>
            <p className="text-xs text-muted-foreground mt-1">Recorded in SQLite database</p>
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader className="p-5 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Mean Pass Rate
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="text-2xl font-bold font-mono text-emerald-400">
              {formatPercent(avgPassRate)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{passedRuns} of {totalRuns} passed gate</p>
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader className="p-5 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Mean P50 Latency
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="text-2xl font-bold font-mono text-purple-400">
              {formatMs(avgP50)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Across executions</p>
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader className="p-5 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Incurred Cost
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="text-2xl font-bold font-mono text-amber-400">
              {formatCost(totalCostUSD)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Calculated token fees</p>
          </CardContent>
        </Card>
      </div>

      {/* Visual Regression Charts */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pass Rate Trend */}
          <Card className="border-border/80">
            <CardHeader className="p-5 pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                Pass Rate Stability (%)
              </CardTitle>
              <CardDescription className="text-xs">
                Quality gate pass rate percentage over sequential runs.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-2 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="passRateGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="name" stroke="#71717a" fontSize={11} />
                  <YAxis domain={[0, 100]} stroke="#71717a" fontSize={11} unit="%" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#18181b",
                      borderColor: "#27272a",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="passRate"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#passRateGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Latency Regression Curve */}
          <Card className="border-border/80">
            <CardHeader className="p-5 pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-purple-400" />
                P50 & P95 Latency Regression (ms)
              </CardTitle>
              <CardDescription className="text-xs">
                Median and 95th percentile response times across runs.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-2 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="name" stroke="#71717a" fontSize={11} />
                  <YAxis stroke="#71717a" fontSize={11} unit="ms" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#18181b",
                      borderColor: "#27272a",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="p50Latency" name="P50 Latency" stroke="#a855f7" strokeWidth={2} dot />
                  <Line type="monotone" dataKey="p95Latency" name="P95 Latency" stroke="#ec4899" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Historical Runs Drilldown Table */}
      <Card className="border-border/80">
        <CardHeader className="p-6 pb-4">
          <CardTitle className="text-base font-semibold">Evaluation Run History</CardTitle>
          <CardDescription className="text-xs mt-1">
            Complete execution traces with individual test case results and delete capability.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {runs.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              No historical runs recorded.
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
                    <th className="py-3 px-4 font-medium">Tokens</th>
                    <th className="py-3 px-4 font-medium">Cost</th>
                    <th className="py-3 px-4 font-medium">Timestamp</th>
                    <th className="py-3 px-6 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {runs.map((r) => (
                    <tr key={r.run_id} className="hover:bg-accent/30 transition-colors">
                      <td className="py-3.5 px-6">
                        {r.passed ? (
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
                      <td className="py-3.5 px-4 font-medium text-foreground">{r.suite_name}</td>
                      <td className="py-3.5 px-4 font-mono text-muted-foreground">{r.target_model}</td>
                      <td className="py-3.5 px-4 font-mono">
                        <span className={r.pass_rate >= 1.0 ? "text-emerald-400 font-semibold" : "text-rose-400"}>
                          {formatPercent(r.pass_rate)}
                        </span>
                        <span className="text-[10px] text-muted-foreground ml-1">
                          ({r.passed_tests}/{r.total_tests})
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-muted-foreground">{formatMs(r.p50_latency_ms)}</td>
                      <td className="py-3.5 px-4 font-mono text-muted-foreground">{r.total_tokens}</td>
                      <td className="py-3.5 px-4 font-mono text-muted-foreground">{formatCost(r.total_cost_usd)}</td>
                      <td className="py-3.5 px-4 font-mono text-muted-foreground">
                        {new Date(r.timestamp).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <Button
                          onClick={() => handleDeleteRun(r.run_id)}
                          disabled={deleteMutation.isPending}
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-rose-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
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
