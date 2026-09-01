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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip as UiTooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { api } from "@/lib/api";
import { formatCost, formatMs, formatPercent } from "@/lib/utils";
import { usePageTitle } from "@/lib/use-page-title";
import { CodeViewer } from "@/components/ui/CodeViewer";
import { SuiteRunResult, TestCaseResult } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Coins,
  Copy,
  Cpu,
  Download,
  ExternalLink,
  Eye,
  FileCode,
  FileSpreadsheet,
  Filter,
  Layers,
  Play,
  RefreshCw,
  Search,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Trash2,
  XCircle,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * Custom Recharts Tooltip with deep run & sample size context
 */
function CustomAnalyticsTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload;
  if (!data) return null;

  return (
    <div className="p-3 rounded-lg border border-border bg-zinc-950/95 shadow-xl text-xs font-mono space-y-2 min-w-[240px]">
      <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
        <span className="text-[10px] text-zinc-400 font-sans font-medium">
          {data.fullDate || data.timeLabel}
        </span>
        <Badge
          variant="outline"
          className={`text-[9px] px-1 py-0 ${
            data.passed
              ? "border-zinc-700 bg-zinc-900 text-zinc-200"
              : "border-zinc-800 bg-zinc-950 text-zinc-400"
          }`}
        >
          {data.passed ? "PASSED" : "FAILED"}
        </Badge>
      </div>

      <div className="space-y-1 text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-zinc-500">Suite:</span>
          <span className="text-white font-medium truncate max-w-[160px]">
            {data.suiteName}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-zinc-500">Target Model:</span>
          <span className="text-zinc-300 truncate max-w-[160px]">
            {data.targetModel}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/40 text-[10px]">
        <div>
          <span className="text-zinc-500 block">Pass Rate</span>
          <span className="text-white font-semibold">
            {formatPercent(data.rawPassRate)} ({data.passedTests}/{data.totalTests})
          </span>
        </div>
        <div>
          <span className="text-zinc-500 block">Latency P50 / P95</span>
          <span className="text-zinc-200">
            {formatMs(data.p50Latency)} / {formatMs(data.p95Latency)}
          </span>
        </div>
        <div>
          <span className="text-zinc-500 block">Inference Cost</span>
          <span className="text-zinc-200">{formatCost(data.costUsd)}</span>
        </div>
        <div>
          <span className="text-zinc-500 block">Tokens</span>
          <span className="text-zinc-200">{data.tokens} toks</span>
        </div>
      </div>
    </div>
  );
}

/**
 * CSV Export helper for historical evaluation traces
 */
function exportRunsToCSV(runsToExport: SuiteRunResult[]) {
  const headers = [
    "Run ID",
    "Suite Name",
    "Target Model",
    "Status",
    "Pass Rate (%)",
    "Passed Tests",
    "Total Tests",
    "P50 Latency (ms)",
    "P95 Latency (ms)",
    "Total Tokens",
    "Inference Cost ($USD)",
    "Timestamp (ISO)",
  ];

  const rows = runsToExport.map((r) => [
    r.run_id,
    `"${r.suite_name}"`,
    `"${r.target_model}"`,
    r.passed ? "PASSED" : "FAILED",
    (r.pass_rate * 100).toFixed(1),
    r.passed_tests,
    r.total_tests,
    Math.round(r.p50_latency_ms),
    Math.round(r.p95_latency_ms),
    r.total_tokens,
    r.total_cost_usd.toFixed(6),
    `"${new Date(r.timestamp).toISOString()}"`,
  ]);

  const csvContent =
    "data:text/csv;charset=utf-8," +
    [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute(
    "download",
    `evalgate-analytics-export-${new Date().toISOString().slice(0, 10)}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function AnalyticsPage() {
  usePageTitle("Analytics & Trends");
  const queryClient = useQueryClient();

  // Filters State
  const [selectedSuite, setSelectedSuite] = useState<string>("all");
  const [selectedModel, setSelectedModel] = useState<string>("all");
  const [dateRange, setDateRange] = useState<"all" | "24h" | "7d" | "30d">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "passed" | "failed">("all");
  const [searchTableQuery, setSearchTableQuery] = useState("");

  // Chart Controls
  const [hideOutliers, setHideOutliers] = useState(true);
  const [viewAggregation, setViewAggregation] = useState<"runs" | "daily">("runs");

  // Inspection Modal
  const [selectedRunForDetails, setSelectedRunForDetails] = useState<SuiteRunResult | null>(null);

  // TanStack Query: Fetch suites
  const { data: suites = [] } = useQuery({
    queryKey: ["suites"],
    queryFn: api.listSuites,
  });

  // TanStack Query: Fetch runs
  const {
    data: allRuns = [],
    isLoading: isRunsLoading,
    refetch: refetchRuns,
  } = useQuery({
    queryKey: ["runs", "analytics"],
    queryFn: () => api.listRuns(undefined, 100),
  });

  // Delete Confirmation State
  const [runToDelete, setRunToDelete] = useState<string | null>(null);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);

  // TanStack Mutation: Delete run
  const deleteMutation = useMutation({
    mutationFn: (runId: string) => api.deleteRun(runId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["runs"] });
      setRunToDelete(null);
      setDeleteErrorMessage(null);
    },
    onError: (err: Error) => {
      setDeleteErrorMessage(err.message);
    },
  });

  const handleDeleteRun = (runId: string) => {
    setDeleteErrorMessage(null);
    setRunToDelete(runId);
  };

  // Discovered models across runs
  const discoveredModels = useMemo(() => {
    const set = new Set<string>();
    for (const r of allRuns) {
      if (r.target_model) set.add(r.target_model);
    }
    return Array.from(set);
  }, [allRuns]);

  // Filtered runs based on active filters
  const filteredRuns = useMemo(() => {
    const now = Date.now();

    return allRuns.filter((r) => {
      // Suite filter
      if (selectedSuite !== "all" && r.suite_name !== selectedSuite) return false;

      // Model filter
      if (selectedModel !== "all" && r.target_model !== selectedModel) return false;

      // Status filter
      if (statusFilter === "passed" && !r.passed) return false;
      if (statusFilter === "failed" && r.passed) return false;

      // Date range filter
      if (dateRange !== "all") {
        const runTime = new Date(r.timestamp).getTime();
        const diffMs = now - runTime;
        if (dateRange === "24h" && diffMs > 24 * 60 * 60 * 1000) return false;
        if (dateRange === "7d" && diffMs > 7 * 24 * 60 * 60 * 1000) return false;
        if (dateRange === "30d" && diffMs > 30 * 24 * 60 * 60 * 1000) return false;
      }

      return true;
    });
  }, [allRuns, selectedSuite, selectedModel, statusFilter, dateRange]);

  // Filtered runs for table (with search query)
  const tableRuns = useMemo(() => {
    if (!searchTableQuery.trim()) return filteredRuns;
    const q = searchTableQuery.toLowerCase();
    return filteredRuns.filter(
      (r) =>
        r.suite_name.toLowerCase().includes(q) ||
        r.target_model.toLowerCase().includes(q) ||
        r.run_id.toLowerCase().includes(q)
    );
  }, [filteredRuns, searchTableQuery]);

  // Time-sorted chronological data (oldest to newest)
  const chronologicalRuns = useMemo(() => {
    return [...filteredRuns].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [filteredRuns]);

  // Aggregated KPI Stats
  const totalRunsCount = filteredRuns.length;
  const passedRunsCount = filteredRuns.filter((r) => r.passed).length;
  const overallGatePassRate = totalRunsCount > 0 ? passedRunsCount / totalRunsCount : null;

  const totalEvaluatedTests = filteredRuns.reduce((acc, r) => acc + (r.total_tests || 0), 0);
  const totalPassedTests = filteredRuns.reduce((acc, r) => acc + (r.passed_tests || 0), 0);
  const testLevelAccuracy =
    totalEvaluatedTests > 0 ? totalPassedTests / totalEvaluatedTests : null;

  const medianP50Latency =
    totalRunsCount > 0
      ? filteredRuns.reduce((acc, r) => acc + (r.p50_latency_ms || 0), 0) / totalRunsCount
      : null;

  const totalCumulativeCostUSD = filteredRuns.reduce(
    (acc, r) => acc + (r.total_cost_usd || 0),
    0
  );
  const totalTokensConsumed = filteredRuns.reduce(
    (acc, r) => acc + (r.total_tokens || 0),
    0
  );

  // Identify Regressions & Anomalies
  const detectedAnomalies = useMemo(() => {
    const list: {
      type: "REGRESSION" | "LATENCY" | "COST";
      title: string;
      description: string;
      runId: string;
      suiteName: string;
      timestamp: string;
    }[] = [];

    // Group runs by suite to detect regressions against baseline
    const suiteMap = new Map<string, SuiteRunResult[]>();
    for (const r of chronologicalRuns) {
      if (!suiteMap.has(r.suite_name)) suiteMap.set(r.suite_name, []);
      suiteMap.get(r.suite_name)!.push(r);
    }

    for (const [suiteName, sRuns] of suiteMap.entries()) {
      if (sRuns.length >= 2) {
        const latest = sRuns[sRuns.length - 1];
        const previous = sRuns[sRuns.length - 2];
        if (latest.pass_rate < previous.pass_rate) {
          list.push({
            type: "REGRESSION",
            title: `Quality Regression in ${suiteName}`,
            description: `Pass rate dropped from ${formatPercent(previous.pass_rate)} to ${formatPercent(latest.pass_rate)}.`,
            runId: latest.run_id,
            suiteName,
            timestamp: latest.timestamp,
          });
        }
      } else if (sRuns.length === 1 && !sRuns[0].passed) {
        list.push({
          type: "REGRESSION",
          title: `Failing Quality Gate in ${suiteName}`,
          description: `Latest run achieved ${formatPercent(sRuns[0].pass_rate)} pass rate (${sRuns[0].passed_tests}/${sRuns[0].total_tests} passed).`,
          runId: sRuns[0].run_id,
          suiteName,
          timestamp: sRuns[0].timestamp,
        });
      }
    }

    // Latency anomalies (> 2500ms P95 or > 1500ms P50)
    for (const r of filteredRuns.slice(0, 10)) {
      if (r.p95_latency_ms > 3000) {
        list.push({
          type: "LATENCY",
          title: `High Tail Latency in ${r.suite_name}`,
          description: `P95 response time reached ${formatMs(r.p95_latency_ms)} on ${r.target_model}.`,
          runId: r.run_id,
          suiteName: r.suite_name,
          timestamp: r.timestamp,
        });
      }
    }

    return list.slice(0, 5);
  }, [chronologicalRuns, filteredRuns]);

  // Outlier detection in latency (> 10000ms)
  const outlierRunsCount = useMemo(() => {
    return chronologicalRuns.filter((r) => r.p50_latency_ms > 10000 || r.p95_latency_ms > 10000)
      .length;
  }, [chronologicalRuns]);

  // Chart Data: Run-by-run with formatted timestamp
  const chartData = useMemo(() => {
    let cumulativeCost = 0;

    return chronologicalRuns.map((r, idx) => {
      cumulativeCost += r.total_cost_usd || 0;

      const dateObj = new Date(r.timestamp);
      const timeLabel = dateObj.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      const fullDate = `${dateObj.toLocaleDateString([], {
        month: "short",
        day: "numeric",
      })}, ${timeLabel}`;

      const p50 = Math.round(r.p50_latency_ms || 0);
      const p95 = Math.round(r.p95_latency_ms || 0);

      return {
        id: r.run_id,
        index: idx + 1,
        timeLabel: fullDate,
        fullDate,
        suiteName: r.suite_name,
        targetModel: r.target_model,
        passed: r.passed,
        rawPassRate: r.pass_rate,
        passRate: Math.round((r.pass_rate || 0) * 100),
        passedTests: r.passed_tests || 0,
        totalTests: r.total_tests || 0,
        p50Latency: hideOutliers && p50 > 10000 ? 10000 : p50,
        p95Latency: hideOutliers && p95 > 10000 ? 10000 : p95,
        isOutlier: p50 > 10000 || p95 > 10000,
        tokens: r.total_tokens || 0,
        costUsd: r.total_cost_usd || 0,
        costUsdFormatted: parseFloat((r.total_cost_usd || 0).toFixed(5)),
        cumulativeCost: parseFloat(cumulativeCost.toFixed(5)),
      };
    });
  }, [chronologicalRuns, hideOutliers]);

  return (
    <TooltipProvider>
      <div className="space-y-7 max-w-7xl mx-auto">
        {/* 1. Header Toolbar & Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-semibold tracking-tight text-white flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-white" />
                Historical Regression Trends & Analytics
              </h1>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Time-series tracking of pass-rate regressions, P50/P95 latency degradation, and cumulative token spend.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => exportRunsToCSV(filteredRuns)}
              disabled={filteredRuns.length === 0}
              variant="outline"
              size="sm"
              className="text-xs gap-1.5 h-8 bg-zinc-900 border-zinc-800 text-zinc-200"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </Button>
            <Button
              onClick={() => refetchRuns()}
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-8"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Refresh</span>
            </Button>
          </div>
        </div>

        {/* 2. Global Multi-Dimensional Filter Bar */}
        <Card className="border-border bg-card">
          <CardContent className="p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
                <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                  <Filter className="h-3.5 w-3.5 text-zinc-500" />
                  <span className="text-zinc-500 text-[11px] uppercase font-mono">Filters:</span>
                </div>

                {/* Suite Filter */}
                <Select value={selectedSuite} onValueChange={setSelectedSuite}>
                  <SelectTrigger className="w-44 h-8 font-mono text-xs bg-zinc-950">
                    <SelectValue placeholder="All Suites" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="font-mono text-xs">
                      All Suites ({suites.length})
                    </SelectItem>
                    {suites.map((s, idx) => (
                      <SelectItem
                        key={s.name ? `suite_opt_${s.name}` : `suite_idx_${idx}`}
                        value={s.name}
                        className="font-mono text-xs"
                      >
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Model Filter */}
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger className="w-44 h-8 font-mono text-xs bg-zinc-950">
                    <SelectValue placeholder="All Models" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="font-mono text-xs">
                      All Models ({discoveredModels.length})
                    </SelectItem>
                    {discoveredModels.map((m, idx) => (
                      <SelectItem
                        key={m ? `model_opt_${m}` : `model_idx_${idx}`}
                        value={m}
                        className="font-mono text-xs"
                      >
                        {m.split("/").pop()} ({m.split("/")[0]})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Date Range Filter */}
                <Select value={dateRange} onValueChange={(v) => setDateRange(v as any)}>
                  <SelectTrigger className="w-32 h-8 font-mono text-xs bg-zinc-950">
                    <SelectValue placeholder="Timeframe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All Time</SelectItem>
                    <SelectItem value="24h" className="text-xs">Last 24 Hours</SelectItem>
                    <SelectItem value="7d" className="text-xs">Last 7 Days</SelectItem>
                    <SelectItem value="30d" className="text-xs">Last 30 Days</SelectItem>
                  </SelectContent>
                </Select>

                {/* Status Filter */}
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                  <SelectTrigger className="w-32 h-8 font-mono text-xs bg-zinc-950">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All Outcomes</SelectItem>
                    <SelectItem value="passed" className="text-xs">Passed Only</SelectItem>
                    <SelectItem value="failed" className="text-xs">Regressions Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Chart Outlier Toggle */}
              <div className="flex items-center gap-2 pl-2 border-l border-border">
                <label className="text-[11px] text-zinc-400 font-mono flex items-center gap-1.5 cursor-pointer">
                  <span>Cap Outliers (&gt;10s)</span>
                  <Switch checked={hideOutliers} onCheckedChange={setHideOutliers} />
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. Actionable Regressions & Anomalies Panel */}
        {detectedAnomalies.length > 0 ? (
          <Card className="border-border bg-gradient-to-b from-zinc-900/60 to-zinc-950/80">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between border-b border-border/40">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-zinc-400" />
                <CardTitle className="text-xs font-semibold text-white">
                  Detected Quality & Latency Regressions ({detectedAnomalies.length})
                </CardTitle>
              </div>
              <Badge variant="outline" className="text-[10px] font-mono border-zinc-800 text-zinc-400">
                Action Required
              </Badge>
            </CardHeader>
            <CardContent className="p-4 space-y-2.5">
              {detectedAnomalies.map((anomaly, aIdx) => (
                <div
                  key={aIdx}
                  className="p-3 rounded-lg border border-border bg-zinc-950 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    {anomaly.type === "REGRESSION" ? (
                      <XCircle className="h-4 w-4 text-zinc-400 shrink-0" />
                    ) : (
                      <Clock className="h-4 w-4 text-zinc-400 shrink-0" />
                    )}
                    <div>
                      <span className="font-semibold text-white">{anomaly.title}</span>
                      <p className="text-[11px] text-zinc-400 mt-0.5">{anomaly.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-mono text-zinc-500 hidden sm:inline">
                      {new Date(anomaly.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <Link href={`/suites`} prefetch={true}>
                      <Button variant="ghost" size="sm" className="text-xs text-zinc-300 hover:text-white h-7 px-2">
                        Inspect Suite →
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : totalRunsCount > 0 ? (
          <div className="p-3 rounded-lg border border-border bg-zinc-950/70 flex items-center gap-2 text-xs text-zinc-400">
            <CheckCircle2 className="h-4 w-4 text-white" />
            <span>All filtered evaluations are passing minimum quality thresholds with stable latency curves.</span>
          </div>
        ) : null}

        {/* 4. Aggregate Summary Stats Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Overall Gate Pass Rate */}
          <Card className="border-border bg-card">
            <CardHeader className="p-4 pb-1 flex flex-row items-center justify-between">
              <CardTitle className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                Overall Gate Pass Rate
              </CardTitle>
              <CheckCircle2 className="h-4 w-4 text-zinc-400" />
            </CardHeader>
            <CardContent className="p-4 pt-1 space-y-1">
              <div className="text-2xl font-bold font-mono text-white">
                {overallGatePassRate !== null ? formatPercent(overallGatePassRate) : "—"}
              </div>
              <p className="text-[11px] text-zinc-500">
                {passedRunsCount} of {totalRunsCount} evaluated runs passed gate
              </p>
            </CardContent>
          </Card>

          {/* Test-Level Accuracy */}
          <Card className="border-border bg-card">
            <CardHeader className="p-4 pb-1 flex flex-row items-center justify-between">
              <CardTitle className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                Test-Level Accuracy
              </CardTitle>
              <Layers className="h-4 w-4 text-zinc-400" />
            </CardHeader>
            <CardContent className="p-4 pt-1 space-y-1">
              <div className="text-2xl font-bold font-mono text-white">
                {testLevelAccuracy !== null ? formatPercent(testLevelAccuracy) : "—"}
              </div>
              <p className="text-[11px] text-zinc-500">
                {totalPassedTests} of {totalEvaluatedTests} individual tests passed
              </p>
            </CardContent>
          </Card>

          {/* Median P50 Latency */}
          <Card className="border-border bg-card">
            <CardHeader className="p-4 pb-1 flex flex-row items-center justify-between">
              <CardTitle className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                Average P50 Latency
              </CardTitle>
              <Clock className="h-4 w-4 text-zinc-400" />
            </CardHeader>
            <CardContent className="p-4 pt-1 space-y-1">
              <div className="text-2xl font-bold font-mono text-white">
                {medianP50Latency !== null ? formatMs(medianP50Latency) : "—"}
              </div>
              <p className="text-[11px] text-zinc-500">
                Across {totalRunsCount} recorded runs
              </p>
            </CardContent>
          </Card>

          {/* Total Incurred Cost */}
          <Card className="border-border bg-card">
            <CardHeader className="p-4 pb-1 flex flex-row items-center justify-between">
              <CardTitle className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                Total Incurred Cost
              </CardTitle>
              <Coins className="h-4 w-4 text-zinc-400" />
            </CardHeader>
            <CardContent className="p-4 pt-1 space-y-1">
              <div className="text-2xl font-bold font-mono text-white">
                {formatCost(totalCumulativeCostUSD)}
              </div>
              <p className="text-[11px] text-zinc-500">
                {totalTokensConsumed.toLocaleString()} tokens consumed
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 5. Time-Series Visualization Charts */}
        {chartData.length > 0 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Chart 1: Pass Rate & Sample Size Stability */}
              <Card className="border-border bg-card">
                <CardHeader className="p-4 pb-2 border-b border-border/40 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-xs font-semibold text-white flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-zinc-400" />
                      Pass Rate Stability & Test Sample Size
                    </CardTitle>
                    <CardDescription className="text-[11px] text-zinc-500 mt-0.5">
                      Chronological pass rate (%) alongside test cases evaluated per execution.
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-3 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData}>
                      <defs>
                        <linearGradient id="passRateGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ffffff" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#ffffff" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis dataKey="timeLabel" stroke="#52525b" fontSize={10} tickMargin={6} />
                      <YAxis
                        yAxisId="left"
                        domain={[0, 100]}
                        stroke="#52525b"
                        fontSize={10}
                        unit="%"
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        stroke="#71717a"
                        fontSize={10}
                        unit=" tests"
                      />
                      <RechartsTooltip content={<CustomAnalyticsTooltip />} />
                      <Bar
                        yAxisId="right"
                        dataKey="totalTests"
                        name="Tests in Run"
                        fill="#3f3f46"
                        radius={[2, 2, 0, 0]}
                        maxBarSize={16}
                      />
                      <Area
                        yAxisId="left"
                        type="monotone"
                        dataKey="passRate"
                        name="Gate Pass Rate"
                        stroke="#ffffff"
                        strokeWidth={1.5}
                        fillOpacity={1}
                        fill="url(#passRateGrad)"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Chart 2: P50 & P95 Latency Curves */}
              <Card className="border-border bg-card">
                <CardHeader className="p-4 pb-2 border-b border-border/40 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-xs font-semibold text-white flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-zinc-400" />
                      P50 (Median) & P95 (Tail) Latency Curves
                    </CardTitle>
                    <CardDescription className="text-[11px] text-zinc-500 mt-0.5">
                      Response latency timeline {hideOutliers && "(outliers > 10s capped)"}.
                    </CardDescription>
                  </div>
                  {outlierRunsCount > 0 && hideOutliers && (
                    <Badge variant="outline" className="text-[9px] font-mono border-zinc-800 text-zinc-400">
                      {outlierRunsCount} outlier capped
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="p-4 pt-3 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis dataKey="timeLabel" stroke="#52525b" fontSize={10} tickMargin={6} />
                      <YAxis stroke="#52525b" fontSize={10} unit="ms" />
                      <RechartsTooltip content={<CustomAnalyticsTooltip />} />
                      <Legend
                        wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                      />
                      <Line
                        type="monotone"
                        dataKey="p50Latency"
                        name="P50 Latency"
                        stroke="#ffffff"
                        strokeWidth={1.5}
                        dot={{ r: 2 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="p95Latency"
                        name="P95 Latency"
                        stroke="#71717a"
                        strokeWidth={1.5}
                        strokeDasharray="4 4"
                        dot={{ r: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Chart 3: Cumulative Spend & Token Consumption Economics */}
            <Card className="border-border bg-card">
              <CardHeader className="p-4 pb-2 border-b border-border/40">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-xs font-semibold text-white flex items-center gap-2">
                      <Coins className="h-3.5 w-3.5 text-zinc-400" />
                      Token Consumption & Cumulative Spend Curves ($USD)
                    </CardTitle>
                    <CardDescription className="text-[11px] text-zinc-500 mt-0.5">
                      Cumulative inference expenditures and token footprint across historical runs.
                    </CardDescription>
                  </div>
                  <div className="text-xs font-mono text-zinc-400">
                    Cumulative: <strong className="text-white">{formatCost(totalCumulativeCostUSD)}</strong>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-3 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData}>
                    <defs>
                      <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ffffff" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#ffffff" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="timeLabel" stroke="#52525b" fontSize={10} tickMargin={6} />
                    <YAxis
                      yAxisId="left"
                      stroke="#52525b"
                      fontSize={10}
                      unit="$"
                      tickFormatter={(val) => val.toFixed(4)}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      stroke="#71717a"
                      fontSize={10}
                      unit=" toks"
                    />
                    <RechartsTooltip content={<CustomAnalyticsTooltip />} />
                    <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                    <Bar
                      yAxisId="right"
                      dataKey="tokens"
                      name="Tokens Consumed"
                      fill="#27272a"
                      radius={[2, 2, 0, 0]}
                      maxBarSize={20}
                    />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="cumulativeCost"
                      name="Cumulative Spend ($USD)"
                      stroke="#ffffff"
                      strokeWidth={1.5}
                      fillOpacity={1}
                      fill="url(#costGrad)"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 6. Diagnostic Evaluation Run History Table */}
        <Card className="border-border bg-card">
          <CardHeader className="p-4 pb-3 border-b border-border/40">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-sm font-semibold text-white">
                  Evaluation Run History ({tableRuns.length} of {allRuns.length} recorded)
                </CardTitle>
                <CardDescription className="text-xs text-zinc-400 mt-0.5">
                  Complete execution traces with individual test case outputs and latency metrics.
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
                  <Input
                    value={searchTableQuery}
                    onChange={(e) => setSearchTableQuery(e.target.value)}
                    placeholder="Search runs by suite or model..."
                    className="pl-8 h-8 text-xs w-60 bg-zinc-950 border-border"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {tableRuns.length === 0 ? (
              <div className="text-center py-12 text-xs text-zinc-500">
                No evaluation runs match the selected filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-950 text-zinc-400 border-b border-border">
                    <tr>
                      <th className="py-2.5 px-4 font-medium">Status</th>
                      <th className="py-2.5 px-3 font-medium">Suite</th>
                      <th className="py-2.5 px-3 font-medium">Target Model</th>
                      <th className="py-2.5 px-3 font-medium">Pass Rate</th>
                      <th className="py-2.5 px-3 font-medium">P50 / P95 Latency</th>
                      <th className="py-2.5 px-3 font-medium">Tokens</th>
                      <th className="py-2.5 px-3 font-medium">Cost</th>
                      <th className="py-2.5 px-3 font-medium">Timestamp</th>
                      <th className="py-2.5 px-4 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {tableRuns.map((r, idx) => (
                      <tr
                        key={r.run_id ? `analytics_run_${r.run_id}` : `analytics_run_idx_${idx}`}
                        className="hover:bg-zinc-900/50 transition-colors"
                      >
                        <td className="py-3 px-4">
                          {r.passed ? (
                            <Badge
                              variant="outline"
                              className="gap-1 font-mono text-[10px] border-zinc-700 bg-zinc-900 text-zinc-200"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              PASSED
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="gap-1 font-mono text-[10px] border-zinc-800 bg-zinc-950 text-zinc-400"
                            >
                              <XCircle className="h-3 w-3" />
                              FAILED
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 px-3 font-medium text-white">
                          <button
                            onClick={() => setSelectedSuite(r.suite_name)}
                            className="hover:underline text-left"
                          >
                            {r.suite_name}
                          </button>
                        </td>
                        <td className="py-3 px-3 font-mono text-zinc-400">
                          {r.target_model}
                        </td>
                        <td className="py-3 px-3 font-mono">
                          <span className="text-white font-medium">
                            {formatPercent(r.pass_rate)}
                          </span>
                          <span className="text-[10px] text-zinc-500 ml-1">
                            ({r.passed_tests}/{r.total_tests})
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-zinc-400">
                          {formatMs(r.p50_latency_ms)} / {formatMs(r.p95_latency_ms)}
                        </td>
                        <td className="py-3 px-3 font-mono text-zinc-400">
                          {r.total_tokens}
                        </td>
                        <td className="py-3 px-3 font-mono text-zinc-400">
                          {formatCost(r.total_cost_usd)}
                        </td>
                        <td className="py-3 px-3 font-mono text-zinc-500">
                          {new Date(r.timestamp).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              onClick={() => setSelectedRunForDetails(r)}
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-zinc-400 hover:text-white"
                              title="Inspect Run Trace"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              onClick={() => handleDeleteRun(r.run_id)}
                              disabled={deleteMutation.isPending}
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-zinc-500 hover:text-white"
                              title="Delete Trace"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 7. Run Details Modal Dialog */}
        <Dialog
          open={!!selectedRunForDetails}
          onOpenChange={(open) => !open && setSelectedRunForDetails(null)}
        >
          {selectedRunForDetails && (
            <DialogContent className="max-w-3xl bg-zinc-950 border-border text-xs max-h-[85vh] overflow-y-auto">
              <DialogHeader className="border-b border-border pb-3">
                <div className="flex items-center justify-between pr-6">
                  <div className="flex items-center gap-2">
                    <DialogTitle className="text-sm font-semibold text-white">
                      Run Trace Inspector: {selectedRunForDetails.suite_name}
                    </DialogTitle>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-mono ${
                        selectedRunForDetails.passed
                          ? "border-zinc-700 bg-zinc-900 text-zinc-200"
                          : "border-zinc-800 bg-zinc-950 text-zinc-400"
                      }`}
                    >
                      {selectedRunForDetails.passed ? "PASSED" : "FAILED"}
                    </Badge>
                  </div>
                </div>
                <DialogDescription className="text-xs text-zinc-400 font-mono mt-1">
                  Run ID: {selectedRunForDetails.run_id} · Model: {selectedRunForDetails.target_model}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 pt-3">
                {/* Telemetry Summary Bar */}
                <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase block">Pass Rate</span>
                    <span className="text-white font-semibold">
                      {formatPercent(selectedRunForDetails.pass_rate)} ({selectedRunForDetails.passed_tests}/{selectedRunForDetails.total_tests})
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase block">P50 / P95 Latency</span>
                    <span className="text-zinc-200">
                      {formatMs(selectedRunForDetails.p50_latency_ms)} / {formatMs(selectedRunForDetails.p95_latency_ms)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase block">Tokens</span>
                    <span className="text-zinc-200">{selectedRunForDetails.total_tokens}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase block">Inference Cost</span>
                    <span className="text-zinc-200">{formatCost(selectedRunForDetails.total_cost_usd)}</span>
                  </div>
                </div>

                {/* Test Cases Results */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
                    Individual Test Case Results ({selectedRunForDetails.results?.length || 0})
                  </h4>
                  <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                    {selectedRunForDetails.results?.map((tc, tcIdx) => (
                      <Card
                        key={tc.test_id ? `tc_${tc.test_id}` : `tc_idx_${tcIdx}`}
                        className="border-border bg-card p-3 space-y-2 text-xs font-mono"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={`text-[9px] ${
                                tc.passed
                                  ? "border-zinc-700 bg-zinc-900 text-zinc-200"
                                  : "border-zinc-800 bg-zinc-950 text-zinc-400"
                              }`}
                            >
                              {tc.passed ? "PASSED" : "FAILED"}
                            </Badge>
                            <span className="font-semibold text-white">#{tc.test_id}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                            <span>{formatMs(tc.latency_ms)}</span>
                            <span>•</span>
                            <span>{tc.total_tokens} toks</span>
                            <span>•</span>
                            <span>{formatCost(tc.cost_usd)}</span>
                          </div>
                        </div>

                        {/* Assertion results */}
                        {tc.assertion_results && tc.assertion_results.length > 0 && (
                          <div className="space-y-1 pt-1 border-t border-border/40">
                            <span className="text-[10px] text-zinc-500 uppercase block">Assertions</span>
                            <div className="space-y-1">
                              {tc.assertion_results.map((ar, arIdx) => (
                                <div
                                  key={arIdx}
                                  className="text-[11px] flex items-start gap-1.5 text-zinc-300"
                                >
                                  {ar.passed ? (
                                    <CheckCircle2 className="h-3.5 w-3.5 text-white shrink-0 mt-0.5" />
                                  ) : (
                                    <XCircle className="h-3.5 w-3.5 text-zinc-500 shrink-0 mt-0.5" />
                                  )}
                                  <span>
                                    <strong>{ar.assertion_type}</strong>: {ar.reason || (ar.passed ? "Satisfied condition" : "Failed check")}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Completion */}
                        {tc.completion && (
                          <div className="space-y-1 pt-1 border-t border-border/40">
                            <span className="text-[10px] text-zinc-500 uppercase block font-mono">Completion</span>
                            <CodeViewer
                              code={tc.completion}
                              language={
                                tc.completion.trim().startsWith("{") ||
                                tc.completion.trim().startsWith("[")
                                  ? "json"
                                  : "markdown"
                              }
                              header={false}
                              maxHeight="120px"
                              compact={true}
                            />
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            </DialogContent>
          )}
        </Dialog>

        {/* 8. Shadcn Delete Confirmation Dialog */}
        <Dialog
          open={!!runToDelete}
          onOpenChange={(open) => {
            if (!open) {
              setRunToDelete(null);
              setDeleteErrorMessage(null);
            }
          }}
        >
          <DialogContent className="max-w-md bg-zinc-950 border-border text-xs">
            <DialogHeader>
              <div className="flex items-center gap-2 text-white font-semibold">
                <AlertTriangle className="h-4 w-4 text-zinc-400" />
                <DialogTitle className="text-sm font-semibold text-white">
                  Delete Evaluation Run Trace
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-zinc-400 mt-2 leading-relaxed">
                Are you sure you want to permanently delete run trace{" "}
                <code className="font-mono text-white bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
                  {runToDelete}
                </code>
                ? This action removes the trace and its assertion logs from the local database.
              </DialogDescription>
            </DialogHeader>

            {deleteErrorMessage && (
              <div className="p-2.5 rounded bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 flex items-center gap-2">
                <AlertCircle className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                <span>{deleteErrorMessage}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/40">
              <Button
                onClick={() => {
                  setRunToDelete(null);
                  setDeleteErrorMessage(null);
                }}
                variant="outline"
                size="sm"
                className="text-xs h-8"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (runToDelete) {
                    deleteMutation.mutate(runToDelete);
                  }
                }}
                disabled={deleteMutation.isPending}
                variant="default"
                size="sm"
                className="text-xs h-8 gap-1.5"
              >
                {deleteMutation.isPending ? (
                  <span className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-full border-2 border-black border-t-transparent animate-spin" />
                    Deleting...
                  </span>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete Run</span>
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
