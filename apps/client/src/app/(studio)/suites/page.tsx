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
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { formatCost, formatMs, formatPercent } from "@/lib/utils";
import { usePageTitle } from "@/lib/use-page-title";
import { CodeViewer } from "@/components/ui/CodeViewer";
import { streamSuiteRun } from "@/lib/ws";
import {
  CostEstimateResponse,
  SuiteConfig,
  SuiteRunResult,
  SuiteSummary,
  TestCaseResult,
} from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Boxes,
  Calculator,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Coins,
  Copy,
  Cpu,
  ExternalLink,
  FileCode,
  Filter,
  Layers,
  Play,
  Plus,
  RefreshCw,
  Scale,
  Search,
  SlidersHorizontal,
  Sparkles,
  Terminal,
  Trash2,
  XCircle,
  Zap,
} from "lucide-react";

// Safe YAML serializer for source preview
function jsonToYaml(obj: any, indent = 0): string {
  const spaces = " ".repeat(indent);
  if (obj === null || obj === undefined) return "null";
  if (typeof obj === "string") {
    if (obj.includes("\n")) {
      return "|\n" + obj.split("\n").map((l) => spaces + "  " + l).join("\n");
    }
    return `"${obj.replace(/"/g, '\\"')}"`;
  }
  if (typeof obj === "number" || typeof obj === "boolean") return String(obj);
  if (Array.isArray(obj)) {
    if (obj.length === 0) return "[]";
    return "\n" + obj.map((item) => `${spaces}- ` + jsonToYaml(item, indent + 2).trimStart()).join("\n");
  }
  if (typeof obj === "object") {
    const keys = Object.keys(obj);
    if (keys.length === 0) return "{}";
    return (
      (indent > 0 ? "\n" : "") +
      keys
        .map((k) => `${spaces}${k}: ` + jsonToYaml(obj[k], indent + 2).trimStart())
        .join("\n")
    );
  }
  return String(obj);
}

export default function SuitesPage() {
  usePageTitle("Suites & Test Matrix");
  const queryClient = useQueryClient();

  // Search, Filter, and Sort Controls
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name");

  const [selectedSuiteName, setSelectedSuiteName] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "cases" | "history" | "yaml">("overview");

  // Create Suite Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newSuiteName, setNewSuiteName] = useState("");
  const [newSuiteDescription, setNewSuiteDescription] = useState("");
  const [newSuiteModel, setNewSuiteModel] = useState("openai/gpt-4o-mini");
  const [newSuiteType, setNewSuiteType] = useState("prompt");
  const [newSuiteMinPassRate, setNewSuiteMinPassRate] = useState(1.0);
  const [newSuiteTemplate, setNewSuiteTemplate] = useState("Context: {{context}}\n\nQuestion: {{question}}\n\nAnswer:");
  const [isCopiedYaml, setIsCopiedYaml] = useState(false);
  const [isCopiedPath, setIsCopiedPath] = useState(false);

  // Live Stream Runner Modal state
  const [isStreamingModalOpen, setIsStreamingModalOpen] = useState(false);
  const [streamingSuiteName, setStreamingSuiteName] = useState("");
  const [streamTotalTests, setStreamTotalTests] = useState(0);
  const [streamCompletedResults, setStreamCompletedResults] = useState<TestCaseResult[]>([]);
  const [finalRunResult, setFinalRunResult] = useState<SuiteRunResult | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [isStreamRunning, setIsStreamRunning] = useState(false);

  // Cost Estimate Modal state
  const [costEstimate, setCostEstimate] = useState<CostEstimateResponse | null>(null);
  const [isCostModalOpen, setIsCostModalOpen] = useState(false);

  // Expanded Test Case row in matrix
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null);

  // TanStack Queries
  const { data: suites = [], isLoading: isSuitesLoading, refetch: refetchSuites } = useQuery({
    queryKey: ["suites"],
    queryFn: api.listSuites,
  });

  const { data: allRuns = [] } = useQuery({
    queryKey: ["runs", "all"],
    queryFn: () => api.listRuns(undefined, 100),
  });

  // Calculate latest run per suite
  const suiteHealthMap = useMemo(() => {
    const map = new Map<string, { latestRun?: SuiteRunResult; status: "PASSING" | "FAILING" | "NEVER_RUN" }>();
    if (!Array.isArray(suites)) return map;
    for (const s of suites) {
      if (!s || !s.name) continue;
      const suiteRuns = allRuns.filter((r) => r.suite_name === s.name);
      if (suiteRuns.length === 0) {
        map.set(s.name, { status: "NEVER_RUN" });
      } else {
        const latest = suiteRuns[0];
        map.set(s.name, {
          latestRun: latest,
          status: latest.passed ? "PASSING" : "FAILING",
        });
      }
    }
    return map;
  }, [suites, allRuns]);

  // Filtered & Sorted Suites
  const filteredSuites = useMemo(() => {
    if (!Array.isArray(suites)) return [];
    return suites
      .filter((s) => {
        if (!s) return false;
        const name = s.name || "";
        const desc = s.description || "";
        const model = s.target_model || "";

        // Search filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = name.toLowerCase().includes(q);
          const matchDesc = desc.toLowerCase().includes(q);
          const matchModel = model.toLowerCase().includes(q);
          if (!matchName && !matchDesc && !matchModel) return false;
        }

        // Status filter
        const health = (name ? suiteHealthMap.get(name)?.status : undefined) || "NEVER_RUN";
        if (statusFilter === "passing" && health !== "PASSING") return false;
        if (statusFilter === "failing" && health !== "FAILING") return false;
        if (statusFilter === "never_run" && health !== "NEVER_RUN") return false;

        return true;
      })
      .sort((a, b) => {
        const nameA = a?.name || "";
        const nameB = b?.name || "";
        if (sortBy === "name") return nameA.localeCompare(nameB);
        if (sortBy === "tests") return (b?.test_count || 0) - (a?.test_count || 0);
        if (sortBy === "pass_rate") return (b?.min_pass_rate || 0) - (a?.min_pass_rate || 0);
        return 0;
      });
  }, [suites, searchQuery, statusFilter, sortBy, suiteHealthMap]);

  // Active Selected Suite
  const activeSuiteName =
    selectedSuiteName && suites.some((s) => s.name === selectedSuiteName)
      ? selectedSuiteName
      : filteredSuites.length > 0
      ? filteredSuites[0].name
      : suites.length > 0
      ? suites[0].name
      : null;

  // Selected Suite Details Query
  const { data: selectedSuite, isLoading: isDetailsLoading } = useQuery({
    queryKey: ["suite", activeSuiteName],
    queryFn: () => (activeSuiteName ? api.getSuite(activeSuiteName) : null),
    enabled: !!activeSuiteName,
  });

  // Runs for the active selected suite
  const selectedSuiteRuns = useMemo(() => {
    if (!activeSuiteName) return [];
    return allRuns.filter((r) => r.suite_name === activeSuiteName);
  }, [allRuns, activeSuiteName]);

  const activeSuiteHealth = activeSuiteName ? suiteHealthMap.get(activeSuiteName) : null;
  const latestSuiteRun = activeSuiteHealth?.latestRun || (selectedSuiteRuns.length > 0 ? selectedSuiteRuns[0] : null);

  // TanStack Mutation: Cost estimation
  const estimateMutation = useMutation({
    mutationFn: (suiteName: string) => api.estimateCost(suiteName),
    onSuccess: (data) => {
      setCostEstimate(data);
      setIsCostModalOpen(true);
    },
    onError: (err: Error) => {
      console.error("Cost estimation error:", err);
    },
  });

  // Create Suite Mutation
  const createSuiteMutation = useMutation({
    mutationFn: async () => {
      const formattedName = newSuiteName.trim().toLowerCase().replace(/\s+/g, "-");
      return api.createSuite(
        {
          name: formattedName,
          description: newSuiteDescription || "Custom YAML test suite",
          min_pass_rate: newSuiteMinPassRate,
          target: {
            type: newSuiteType as any,
            model: newSuiteModel,
            template: newSuiteTemplate,
            temperature: 0.0,
          },
          tests: [
            {
              id: `${formattedName}-1`,
              description: "Initial test case",
              vars: {
                context: "Sample reference context text.",
                question: "What is the key information?",
              },
              assertions: [{ type: "contains", value: "information", strict: true }],
            },
          ],
        },
        `${formattedName}.yaml`
      );
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["suites"] });
      setSelectedSuiteName(newSuiteName.trim().toLowerCase().replace(/\s+/g, "-"));
      setIsCreateModalOpen(false);
      setNewSuiteName("");
      setNewSuiteDescription("");
    },
  });

  // Live WebSocket Streaming Execution
  const handleStartLiveStream = (suiteName: string) => {
    setStreamingSuiteName(suiteName);
    setStreamTotalTests(0);
    setStreamCompletedResults([]);
    setFinalRunResult(null);
    setStreamError(null);
    setIsStreamRunning(true);
    setIsStreamingModalOpen(true);

    streamSuiteRun({
      suiteName,
      concurrency: 10,
      onStarted: (data) => {
        setStreamTotalTests(data.total_tests);
      },
      onTestComplete: (tc) => {
        setStreamCompletedResults((prev) => [...prev, tc]);
      },
      onFinished: (summary) => {
        setFinalRunResult(summary);
        setIsStreamRunning(false);
        queryClient.invalidateQueries({ queryKey: ["runs"] });
      },
      onError: (err) => {
        setStreamError(err);
        setIsStreamRunning(false);
      },
    });
  };

  const handleCopyYaml = () => {
    if (!selectedSuite) return;
    navigator.clipboard.writeText(jsonToYaml(selectedSuite));
    setIsCopiedYaml(true);
    setTimeout(() => setIsCopiedYaml(false), 2000);
  };

  const handleCopyPath = () => {
    if (!activeSuiteName) return;
    navigator.clipboard.writeText(`evals/${activeSuiteName}.yaml`);
    setIsCopiedPath(true);
    setTimeout(() => setIsCopiedPath(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white flex items-center gap-2">
            <Boxes className="h-5 w-5 text-white" />
            Evaluation Suites & Test Matrix
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Declarative YAML test suites with regression gates, pre-flight cost estimation, and live streaming test execution.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setIsCreateModalOpen(true)}
            variant="default"
            size="sm"
            className="gap-1.5 text-xs h-8"
          >
            <Plus className="h-3.5 w-3.5" />
            Create Suite
          </Button>
          <Button
            onClick={() => {
              refetchSuites();
              queryClient.invalidateQueries({ queryKey: ["runs"] });
            }}
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs h-8 text-zinc-300 hover:text-white"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </Button>
        </div>
      </div>

      {/* 2. Main 2-Column Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ========================================================================= */}
        {/* LEFT COLUMN: Search, Filters & Suite List                                 */}
        {/* ========================================================================= */}
        <div className="lg:col-span-4 space-y-3">
          {/* Search and Filters Bar */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search suites by name or model..."
                className="pl-8 h-8 text-xs bg-zinc-950 border-border"
              />
            </div>

            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-7 text-xs flex-1 font-mono bg-zinc-950">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Statuses</SelectItem>
                  <SelectItem value="passing" className="text-xs">Passing</SelectItem>
                  <SelectItem value="failing" className="text-xs">Failing</SelectItem>
                  <SelectItem value="never_run" className="text-xs">Never Run</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="h-7 text-xs flex-1 font-mono bg-zinc-950">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name" className="text-xs">Name (A-Z)</SelectItem>
                  <SelectItem value="tests" className="text-xs">Most Tests</SelectItem>
                  <SelectItem value="pass_rate" className="text-xs">Gate Threshold</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Suites List */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between px-1 text-[11px] text-zinc-500 font-mono">
              <span>SUITES ({filteredSuites.length})</span>
            </div>

            {filteredSuites.length === 0 ? (
              <div className="p-6 rounded-lg border border-dashed border-border text-center text-xs text-zinc-500 space-y-2">
                <p>No matching suites found.</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("all");
                  }}
                  className="text-xs text-zinc-400 hover:text-white h-7"
                >
                  Clear Filters
                </Button>
              </div>
            ) : (
              filteredSuites.map((s, idx) => {
                const isSelected = s.name === activeSuiteName;
                const health = suiteHealthMap.get(s.name);
                const status = health?.status || "NEVER_RUN";

                return (
                  <div
                    key={s.name ? `suite_list_${s.name}` : `suite_idx_${idx}`}
                    onClick={() => setSelectedSuiteName(s.name)}
                    className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? "border-zinc-500 bg-zinc-900/90 shadow-sm"
                        : "border-border bg-card hover:border-zinc-700 hover:bg-zinc-900/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-xs text-white truncate">
                            {s.name}
                          </h4>
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-1 line-clamp-1">
                          {s.description || "Prompt evaluation and assertion suite."}
                        </p>
                      </div>

                      {/* Status Indicator Badge */}
                      <Badge
                        variant="outline"
                        className={`text-[9px] px-1.5 py-0 font-mono shrink-0 ${
                          status === "PASSING"
                            ? "border-zinc-700 bg-zinc-900 text-zinc-200"
                            : status === "FAILING"
                            ? "border-zinc-800 bg-zinc-950 text-zinc-400"
                            : "border-zinc-900 bg-zinc-950 text-zinc-600"
                        }`}
                      >
                        {status === "PASSING"
                          ? "PASSING"
                          : status === "FAILING"
                          ? "FAILING"
                          : "NEVER RUN"}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 mt-2.5 text-[10px] font-mono text-zinc-500">
                      <span>{s.test_count ?? 0} tests</span>
                      <span>•</span>
                      <span className="truncate max-w-[110px] text-zinc-400">
                        {s.target_model || "default"}
                      </span>
                      {s.min_pass_rate !== undefined && !isNaN(s.min_pass_rate) && (
                        <span className="text-zinc-400">
                          • {Math.round(s.min_pass_rate * 100)}% gate
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: Selected Suite Detail & Health Inspector                    */}
        {/* ========================================================================= */}
        <div className="lg:col-span-8">
          {!selectedSuite ? (
            <Card className="border-border bg-card h-80 flex items-center justify-center text-center p-8 text-zinc-500 text-xs">
              {isDetailsLoading ? "Loading suite configuration..." : "Select a suite on the left to inspect test cases."}
            </Card>
          ) : (
            <div className="space-y-5">
              {/* 1. Header & Health Summary Banner */}
              <Card className="border-border bg-card">
                <CardHeader className="p-5 pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base font-semibold text-white">
                          {selectedSuite.name}
                        </CardTitle>
                        <Badge
                          variant="outline"
                          className={`font-mono text-[10px] ${
                            activeSuiteHealth?.status === "PASSING"
                              ? "border-zinc-700 bg-zinc-900 text-zinc-200"
                              : activeSuiteHealth?.status === "FAILING"
                              ? "border-zinc-800 bg-zinc-950 text-zinc-400"
                              : "border-zinc-900 bg-zinc-950 text-zinc-600"
                          }`}
                        >
                          {activeSuiteHealth?.status === "PASSING"
                            ? "PASSING"
                            : activeSuiteHealth?.status === "FAILING"
                            ? "FAILING"
                            : "NEVER RUN"}
                        </Badge>
                      </div>
                      <CardDescription className="text-xs text-zinc-400 mt-1">
                        {selectedSuite.description || "Declarative prompt evaluation suite."}
                      </CardDescription>
                    </div>

                    {/* Suite Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <Button
                        onClick={() => estimateMutation.mutate(selectedSuite.name)}
                        disabled={estimateMutation.isPending}
                        variant="outline"
                        size="sm"
                        className="text-xs gap-1.5 h-8 text-zinc-300 hover:text-white whitespace-nowrap shrink-0"
                      >
                        <Calculator className="h-3.5 w-3.5 text-zinc-400" />
                        {estimateMutation.isPending ? "Estimating..." : "Estimate Cost"}
                      </Button>
                      <Button
                        onClick={() => handleStartLiveStream(selectedSuite.name)}
                        variant="default"
                        size="sm"
                        className="text-xs gap-1.5 h-8 whitespace-nowrap shrink-0"
                      >
                        <Zap className="h-3.5 w-3.5 fill-current" />
                        Run Suite Live
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {/* Telemetry & Spec Strip */}
                <CardContent className="p-5 pt-0 space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-lg bg-zinc-950 border border-border text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-zinc-500 uppercase block">Architecture</span>
                      <span className="font-medium text-zinc-200 truncate block">
                        {selectedSuite.target?.type || "prompt"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 uppercase block">Target Model</span>
                      <span className="font-medium text-zinc-200 truncate block">
                        {selectedSuite.target?.model || "default"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 uppercase block">Test Cases</span>
                      <span className="font-medium text-zinc-200">
                        {selectedSuite.tests?.length || 0} cases
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 uppercase block">Quality Gate</span>
                      <span className="font-medium text-zinc-200">
                        {selectedSuite.min_pass_rate !== undefined && !isNaN(selectedSuite.min_pass_rate)
                          ? `${Math.round(selectedSuite.min_pass_rate * 100)}% Pass`
                          : "No gate configured"}
                      </span>
                    </div>
                  </div>

                  {/* Health Telemetry Bar (if runs exist) */}
                  {latestSuiteRun && (
                    <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                      <div className="flex items-center gap-2">
                        {latestSuiteRun.passed ? (
                          <CheckCircle2 className="h-4 w-4 text-white" />
                        ) : (
                          <XCircle className="h-4 w-4 text-zinc-500" />
                        )}
                        <span className="text-white font-medium">
                          Latest Run: {formatPercent(latestSuiteRun.pass_rate)} ({latestSuiteRun.passed_tests}/{latestSuiteRun.total_tests} passed)
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-zinc-400 text-[11px]">
                        <span>P50: {formatMs(latestSuiteRun.p50_latency_ms)}</span>
                        <span>•</span>
                        <span>Cost: {formatCost(latestSuiteRun.total_cost_usd)}</span>
                        <span>•</span>
                        <span>
                          {new Date(latestSuiteRun.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 2. Detail Tabs: Overview, Test Matrix, Run History, YAML Source */}
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                <TabsList className="grid grid-cols-4 w-full bg-zinc-950 border border-border h-9">
                  <TabsTrigger value="overview" className="text-xs">
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="cases" className="text-xs">
                    Test Cases ({selectedSuite.tests?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger value="history" className="text-xs">
                    History ({selectedSuiteRuns.length})
                  </TabsTrigger>
                  <TabsTrigger value="yaml" className="text-xs">
                    YAML Source
                  </TabsTrigger>
                </TabsList>

                {/* TAB 1: OVERVIEW */}
                <TabsContent value="overview" className="space-y-4 pt-3">
                  {selectedSuite.target?.template && (
                    <Card className="border-border bg-card">
                      <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                        <CardTitle className="text-xs font-semibold text-white flex items-center gap-2">
                          <Terminal className="h-3.5 w-3.5 text-zinc-400" />
                          Prompt Template
                        </CardTitle>
                        <Link href="/playground">
                          <Button variant="ghost" size="sm" className="h-6 text-[10px] text-zinc-400 hover:text-white gap-1">
                            <ExternalLink className="h-3 w-3" />
                            Open in Playground
                          </Button>
                        </Link>
                      </CardHeader>
                      <CardContent className="p-4 pt-1">
                        <CodeViewer
                          code={selectedSuite.target.template}
                          language="markdown"
                          header={false}
                          maxHeight="240px"
                          compact={true}
                        />
                      </CardContent>
                    </Card>
                  )}

                  {selectedSuite.target?.system_prompt && (
                    <Card className="border-border bg-card">
                      <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-xs font-semibold text-white">System Prompt</CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 pt-1">
                        <CodeViewer
                          code={selectedSuite.target.system_prompt}
                          language="markdown"
                          header={false}
                          compact={true}
                        />
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* TAB 2: TEST CASES MATRIX */}
                <TabsContent value="cases" className="space-y-3 pt-3">
                  <div className="space-y-2.5">
                    {selectedSuite.tests?.map((tc, idx) => {
                      const isExpanded = expandedCaseId === (tc.id || String(idx));
                      const matchingResult = latestSuiteRun?.results?.find(
                        (r) => r.test_id === tc.id
                      );

                      return (
                        <Card key={tc.id ? `tc_${tc.id}` : `tc_idx_${idx}`} className="border-border bg-card overflow-hidden">
                          <div
                            onClick={() =>
                              setExpandedCaseId(isExpanded ? null : tc.id || String(idx))
                            }
                            className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-zinc-900/40 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <Badge variant="secondary" className="font-mono text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-200">
                                #{tc.id}
                              </Badge>
                              {tc.description && (
                                <span className="text-xs text-zinc-300 font-medium">
                                  {tc.description}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-3">
                              <span className="text-[10px] font-mono text-zinc-500">
                                {Object.keys(tc.vars || {}).length} vars • {(tc.assertions || []).length} assertions
                              </span>
                              {matchingResult && (
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] font-mono ${
                                    matchingResult.passed
                                      ? "border-zinc-700 bg-zinc-900 text-zinc-200"
                                      : "border-zinc-800 bg-zinc-950 text-zinc-400"
                                  }`}
                                >
                                  {matchingResult.passed ? "PASSED" : "FAILED"}
                                </Badge>
                              )}
                              <ChevronDown
                                className={`h-3.5 w-3.5 text-zinc-500 transition-transform ${
                                  isExpanded ? "rotate-180 text-white" : ""
                                }`}
                              />
                            </div>
                          </div>

                          {/* Expanded Case Details */}
                          {isExpanded && (
                            <CardContent className="p-3.5 pt-0 border-t border-border/50 space-y-3 bg-zinc-950/60">
                              {/* Variables */}
                              <div>
                                <span className="text-[10px] uppercase font-mono text-zinc-500 block mb-1">
                                  Variables Payload
                                </span>
                                <div className="p-2.5 rounded bg-black border border-border text-xs font-mono space-y-1">
                                  {Object.entries(tc.vars || {}).map(([k, v]) => (
                                    <div key={k} className="flex items-start gap-2">
                                      <span className="text-zinc-500 shrink-0">{k}:</span>
                                      <span className="text-zinc-200 break-all select-text">
                                        {typeof v === "object" ? JSON.stringify(v, null, 2) : String(v)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Assertions */}
                              {tc.assertions && tc.assertions.length > 0 && (
                                <div>
                                  <span className="text-[10px] uppercase font-mono text-zinc-500 block mb-1">
                                    Quality Gate Assertions
                                  </span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {tc.assertions.map((a, aIdx) => {
                                      const formattedVal =
                                        typeof a.value === "object" && a.value !== null
                                          ? `(${Object.keys(a.value.properties || {}).length} properties)`
                                          : a.value
                                          ? `="${a.value}"`
                                          : "";

                                      return (
                                        <Badge
                                          key={aIdx}
                                          variant="outline"
                                          className="text-[10px] font-mono border-zinc-800 bg-zinc-950 text-zinc-300"
                                        >
                                          {a.type} {formattedVal} {a.threshold ? `(>=${a.threshold})` : ""}
                                        </Badge>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* Latest Execution Output (if available) */}
                              {matchingResult?.completion && (
                                <div>
                                  <span className="text-[10px] uppercase font-mono text-zinc-500 block mb-1">
                                    Latest Completion ({formatMs(matchingResult.latency_ms)})
                                  </span>
                                  <CodeViewer
                                    code={matchingResult.completion}
                                    language={
                                      matchingResult.completion.trim().startsWith("{") ||
                                      matchingResult.completion.trim().startsWith("[")
                                        ? "json"
                                        : "markdown"
                                    }
                                    header={false}
                                    maxHeight="160px"
                                    compact={true}
                                  />
                                </div>
                              )}
                            </CardContent>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                </TabsContent>

                {/* TAB 3: LOCAL RUN HISTORY */}
                <TabsContent value="history" className="space-y-3 pt-3">
                  {selectedSuiteRuns.length === 0 ? (
                    <Card className="border-border bg-card p-8 text-center text-xs text-zinc-500 space-y-2">
                      <p>No historical runs recorded for this suite.</p>
                      <Button
                        onClick={() => handleStartLiveStream(selectedSuite.name)}
                        variant="default"
                        size="sm"
                        className="text-xs"
                      >
                        Execute First Run
                      </Button>
                    </Card>
                  ) : (
                    <div className="space-y-2">
                      {selectedSuiteRuns.map((run, rIdx) => (
                        <div
                          key={run.run_id ? `suite_run_${run.run_id}` : `suite_run_idx_${rIdx}`}
                          className="p-3.5 rounded-lg border border-border bg-card flex items-center justify-between gap-3 text-xs font-mono"
                        >
                          <div className="flex items-center gap-2.5">
                            {run.passed ? (
                              <Badge variant="outline" className="border-zinc-700 bg-zinc-900 text-zinc-200 text-[10px]">
                                PASSED
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-zinc-800 bg-zinc-950 text-zinc-400 text-[10px]">
                                FAILED
                              </Badge>
                            )}
                            <span className="text-white font-medium">
                              {formatPercent(run.pass_rate)} ({run.passed_tests}/{run.total_tests})
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-zinc-400 text-[11px]">
                            <span>P50: {formatMs(run.p50_latency_ms)}</span>
                            <span>•</span>
                            <span>{formatCost(run.total_cost_usd)}</span>
                            <span>•</span>
                            <span>{new Date(run.timestamp).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* TAB 4: RAW YAML SPEC */}
                <TabsContent value="yaml" className="space-y-3 pt-3">
                  <Card className="border-border bg-card overflow-hidden">
                    <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between border-b border-border/40">
                      <div>
                        <CardTitle className="text-xs font-semibold text-white flex items-center gap-2">
                          <FileCode className="h-3.5 w-3.5 text-zinc-400" />
                          evals/{selectedSuite.name}.yaml
                        </CardTitle>
                        <CardDescription className="text-[11px] text-zinc-400 mt-0.5">
                          Declarative test configuration saved to disk
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={handleCopyYaml}
                          variant="outline"
                          size="sm"
                          className="h-7 text-[11px] gap-1 border-border bg-zinc-950 text-zinc-300 hover:text-white"
                        >
                          {isCopiedYaml ? <Check className="h-3 w-3 text-white" /> : <Copy className="h-3 w-3" />}
                          {isCopiedYaml ? "Copied YAML" : "Copy YAML"}
                        </Button>
                        <Link href="/playground">
                          <Button
                            variant="default"
                            size="sm"
                            className="h-7 text-[11px] gap-1"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Open in Playground
                          </Button>
                        </Link>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <CodeViewer
                        code={jsonToYaml(selectedSuite)}
                        language="yaml"
                        showLineNumbers={true}
                        header={false}
                        maxHeight="420px"
                        copyable={false}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: Create New Suite                                                  */}
      {/* ========================================================================= */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create Evaluation Suite
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Define a new declarative test suite saved to <code className="text-zinc-300">./evals/*.yaml</code>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <label className="text-[11px] font-medium text-zinc-400 block mb-1">
                Suite Name (Slug)
              </label>
              <Input
                value={newSuiteName}
                onChange={(e) => setNewSuiteName(e.target.value)}
                placeholder="e.g. customer-support-gate"
                className="font-mono text-xs bg-zinc-950 border-border"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-zinc-400 block mb-1">
                Description
              </label>
              <Input
                value={newSuiteDescription}
                onChange={(e) => setNewSuiteDescription(e.target.value)}
                placeholder="Evaluates tone, accuracy, and resolution speed"
                className="text-xs bg-zinc-950 border-border"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-zinc-400 block mb-1">
                  Target Model
                </label>
                <Select value={newSuiteModel} onValueChange={setNewSuiteModel}>
                  <SelectTrigger className="h-8 text-xs font-mono bg-zinc-950">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai/gpt-4o-mini" className="text-xs font-mono">OpenAI GPT-4o-mini</SelectItem>
                    <SelectItem value="openai/gpt-4o" className="text-xs font-mono">OpenAI GPT-4o</SelectItem>
                    <SelectItem value="anthropic/claude-3-5-sonnet" className="text-xs font-mono">Claude 3.5 Sonnet</SelectItem>
                    <SelectItem value="google/gemini-2.0-flash" className="text-xs font-mono">Gemini 2.0 Flash</SelectItem>
                    <SelectItem value="mock/simulator" className="text-xs font-mono">Mock Simulator ($0.00)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-[11px] font-medium text-zinc-400 block mb-1">
                  Pass Threshold ({Math.round(newSuiteMinPassRate * 100)}%)
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="1.0"
                  step="0.05"
                  value={newSuiteMinPassRate}
                  onChange={(e) => setNewSuiteMinPassRate(parseFloat(e.target.value))}
                  className="w-full accent-white h-1.5 bg-zinc-800 rounded-lg cursor-pointer mt-2"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-medium text-zinc-400 block mb-1">
                Prompt Template
              </label>
              <Textarea
                value={newSuiteTemplate}
                onChange={(e) => setNewSuiteTemplate(e.target.value)}
                rows={3}
                className="font-mono text-xs bg-zinc-950 border-border"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCreateModalOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={() => createSuiteMutation.mutate()}
              disabled={!newSuiteName.trim() || createSuiteMutation.isPending}
              variant="default"
              size="sm"
              className="text-xs gap-1.5"
            >
              <Plus className="h-3 w-3" />
              {createSuiteMutation.isPending ? "Creating..." : "Create Suite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL: Live WebSocket Streaming Test Runner                              */}
      {/* ========================================================================= */}
      <Dialog open={isStreamingModalOpen} onOpenChange={setIsStreamingModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold text-white">
              <Zap className="h-4 w-4 fill-current" />
              Live Evaluation Stream: <span className="font-mono text-zinc-300">{streamingSuiteName}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Streaming real-time execution events from LangGraph state machine via WebSockets.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Progress bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-400">
                  {isStreamRunning ? "Running tests concurrently..." : finalRunResult ? "Execution Complete" : "Connecting..."}
                </span>
                <span className="text-white font-medium">
                  {streamCompletedResults.length} / {streamTotalTests || "?"} completed
                </span>
              </div>
              <Progress
                value={
                  streamTotalTests > 0
                    ? (streamCompletedResults.length / streamTotalTests) * 100
                    : 0
                }
              />
            </div>

            {/* Error banner */}
            {streamError && (
              <div className="p-3 rounded-md border border-border bg-zinc-950 text-zinc-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-zinc-400" />
                <span>{streamError}</span>
              </div>
            )}

            {/* Final Summary Card */}
            {finalRunResult && (
              <div className="p-3.5 rounded-lg border border-border bg-zinc-950 space-y-2.5 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-white flex items-center gap-2">
                    {finalRunResult.passed ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-white" /> PASSED QUALITY GATE
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 text-zinc-500" /> FAILED QUALITY GATE
                      </>
                    )}
                  </span>
                  <Badge variant="outline" className="text-xs border-zinc-700 bg-zinc-900 text-white">
                    {formatPercent(finalRunResult.pass_rate)}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border text-center">
                  <div>
                    <span className="text-[10px] text-zinc-500 block">P50 Latency</span>
                    <span className="font-medium text-white">{formatMs(finalRunResult.p50_latency_ms)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 block">Total Tokens</span>
                    <span className="font-medium text-white">{finalRunResult.total_tokens}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 block">Total Cost</span>
                    <span className="font-medium text-zinc-300">{formatCost(finalRunResult.total_cost_usd)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Live Streaming Test Results */}
            <div className="space-y-1.5">
              <h4 className="text-[11px] font-medium text-zinc-500 uppercase">Test Case Stream</h4>
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {streamCompletedResults.map((tc, i) => (
                  <div
                    key={tc.test_id ? `stream_tc_${tc.test_id}_${i}` : `stream_${i}`}
                    className="p-2.5 rounded border border-border bg-card text-xs space-y-1 font-mono"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {tc.passed ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-zinc-500" />
                        )}
                        <span className="font-medium text-white">Test: {tc.test_id}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                        <span>{formatMs(tc.latency_ms)}</span>
                        <span>•</span>
                        <span>{formatCost(tc.cost_usd)}</span>
                      </div>
                    </div>
                    <div className="text-[10px] text-zinc-400 truncate pl-5">
                      {tc.completion ? `"${tc.completion.slice(0, 80)}..."` : "No output"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL: Pre-Flight Cost Estimation                                        */}
      {/* ========================================================================= */}
      <Dialog open={isCostModalOpen} onOpenChange={setIsCostModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold text-white">
              <Calculator className="h-4 w-4 text-zinc-400" />
              Pre-Flight Run Estimate
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Projected invocations, token consumption, and dollar spend before execution.
            </DialogDescription>
          </DialogHeader>
          {costEstimate && (
            <div className="space-y-3 py-2 font-mono text-xs">
              <div className="p-3.5 rounded-lg border border-border bg-zinc-950 space-y-2.5">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Suite Name:</span>
                  <span className="font-medium text-zinc-200">{costEstimate.suite_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Target Model:</span>
                  <span className="font-medium text-zinc-200">{costEstimate.target_model}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Test Cases:</span>
                  <span className="font-medium text-zinc-200">{costEstimate.total_tests} test cases</span>
                </div>
                <div className="flex justify-between border-t border-border pt-1.5">
                  <span className="text-zinc-500">Estimated Input Tokens:</span>
                  <span className="font-medium text-zinc-200">{costEstimate.estimated_input_tokens} tokens</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Estimated Output Tokens:</span>
                  <span className="font-medium text-zinc-200">{costEstimate.estimated_output_tokens} tokens</span>
                </div>
                <div className="flex justify-between border-t border-border pt-1.5 text-xs font-semibold">
                  <span className="text-white">Projected Total Cost:</span>
                  <span className="text-white">{formatCost(costEstimate.estimated_cost_usd)}</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
