"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";
import { formatCost, formatMs, formatPercent } from "@/lib/utils";
import { streamSuiteRun } from "@/lib/ws";
import {
  CostEstimateResponse,
  SuiteRunResult,
  TestCaseResult,
} from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Boxes,
  Calculator,
  CheckCircle2,
  ChevronRight,
  FileCode,
  RefreshCw,
  XCircle,
  Zap,
} from "lucide-react";

export default function SuitesPage() {
  const queryClient = useQueryClient();
  const [selectedSuiteName, setSelectedSuiteName] = useState<string | null>(null);

  // TanStack Query: Fetch all suites
  const {
    data: suites = [],
    isLoading: isSuitesLoading,
    refetch: refetchSuites,
  } = useQuery({
    queryKey: ["suites"],
    queryFn: api.listSuites,
  });

  // Select first suite by default if none selected
  const activeSuiteName = selectedSuiteName || (suites.length > 0 ? suites[0].name : null);

  // TanStack Query: Fetch details for selected suite
  const {
    data: selectedSuite,
    isLoading: isDetailsLoading,
  } = useQuery({
    queryKey: ["suite", activeSuiteName],
    queryFn: () => (activeSuiteName ? api.getSuite(activeSuiteName) : null),
    enabled: !!activeSuiteName,
  });

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

  // TanStack Mutation: Cost estimation
  const estimateMutation = useMutation({
    mutationFn: (suiteName: string) => api.estimateCost(suiteName),
    onSuccess: (data) => {
      setCostEstimate(data);
      setIsCostModalOpen(true);
    },
    onError: (err: Error) => {
      alert(`Cost estimation failed: ${err.message}`);
    },
  });

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

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Boxes className="h-6 w-6 text-sky-400" />
            Evaluation Suites & Test Matrix
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Declarative YAML test suites with regression gates, pre-flight cost estimation, and live streaming test execution.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => refetchSuites()} variant="outline" size="sm" className="gap-2 text-xs">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          {activeSuiteName && (
            <Button
              onClick={() => handleStartLiveStream(activeSuiteName)}
              variant="glow"
              size="sm"
              className="gap-2 text-xs"
            >
              <Zap className="h-3.5 w-3.5" />
              Run Suite Live
            </Button>
          )}
        </div>
      </div>

      {/* Grid: Left Suites List, Right Suite Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Suites List */}
        <div className="lg:col-span-4 space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
            Discovered Suites ({suites.length})
          </h3>
          <div className="space-y-2">
            {suites.map((s) => {
              const isSelected = s.name === activeSuiteName;
              return (
                <div
                  key={s.name}
                  onClick={() => setSelectedSuiteName(s.name)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? "border-emerald-500/50 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.1)]"
                      : "border-border/70 bg-card/40 hover:border-border hover:bg-card/70"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                        <FileCode className="h-4 w-4 text-sky-400" />
                        {s.name}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                        {s.description || "No description provided"}
                      </p>
                    </div>
                    <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isSelected ? "translate-x-1 text-emerald-400" : ""}`} />
                  </div>
                  <div className="flex items-center gap-3 mt-3 text-[11px] font-mono text-muted-foreground">
                    <span>{s.test_count} tests</span>
                    <span>•</span>
                    <span className="truncate max-w-[140px]">{s.target_model}</span>
                    <span>•</span>
                    <Badge variant="outline" className="text-[10px] px-1 py-0">
                      {formatPercent(s.min_pass_rate)} gate
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Suite Detail Inspector */}
        <div className="lg:col-span-8">
          {!selectedSuite ? (
            <Card className="border-border/80 h-96 flex items-center justify-center text-center p-8 text-muted-foreground">
              {isDetailsLoading ? "Loading suite configuration..." : "Select a suite on the left to inspect test cases."}
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Suite Header Info Card */}
              <Card className="border-border/80">
                <CardHeader className="p-6 pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg font-bold flex items-center gap-2">
                        {selectedSuite.name}
                        <Badge variant="outline" className="font-mono text-[11px] text-emerald-400 border-emerald-500/30">
                          {formatPercent(selectedSuite.min_pass_rate ?? 1.0)} required
                        </Badge>
                      </CardTitle>
                      <CardDescription className="text-xs mt-1">
                        {selectedSuite.description}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => estimateMutation.mutate(selectedSuite.name)}
                        disabled={estimateMutation.isPending}
                        variant="outline"
                        size="sm"
                        className="text-xs gap-1.5"
                      >
                        <Calculator className="h-3.5 w-3.5 text-amber-400" />
                        {estimateMutation.isPending ? "Estimating..." : "Estimate Cost"}
                      </Button>
                      <Button
                        onClick={() => handleStartLiveStream(selectedSuite.name)}
                        variant="glow"
                        size="sm"
                        className="text-xs gap-1.5"
                      >
                        <Zap className="h-3.5 w-3.5" />
                        Run Suite
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6 pt-0 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-lg bg-muted/30 border border-border/60 text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase block">Target Model</span>
                      <span className="font-semibold text-foreground">{selectedSuite.target.model}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase block">Target Type</span>
                      <span className="font-semibold text-foreground">{selectedSuite.target.type}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase block">Test Cases</span>
                      <span className="font-semibold text-foreground">{selectedSuite.tests.length} cases</span>
                    </div>
                  </div>

                  {selectedSuite.target.template && (
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                        Prompt Template
                      </label>
                      <div className="p-3 rounded-lg bg-black/40 border border-border/60 font-mono text-xs text-foreground whitespace-pre-wrap">
                        {selectedSuite.target.template}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Test Cases Matrix */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Test Case Matrix ({selectedSuite.tests.length})
                </h3>
                <div className="space-y-3">
                  {selectedSuite.tests.map((tc, idx) => (
                    <Card key={tc.id || idx} className="border-border/70 hover:border-border transition-all">
                      <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="font-mono text-xs">
                            #{tc.id}
                          </Badge>
                          {tc.description && (
                            <span className="text-xs text-muted-foreground">{tc.description}</span>
                          )}
                        </div>
                        <span className="text-[11px] font-mono text-muted-foreground">
                          {Object.keys(tc.vars).length} vars • {(tc.assertions || []).length} assertions
                        </span>
                      </CardHeader>
                      <CardContent className="p-4 pt-1 space-y-3">
                        {/* Variables */}
                        <div className="p-2.5 rounded-md bg-muted/20 border border-border/40 text-xs font-mono space-y-1">
                          {Object.entries(tc.vars).map(([k, v]) => (
                            <div key={k} className="flex items-start gap-2">
                              <span className="text-emerald-400 shrink-0">{k}:</span>
                              <span className="text-foreground truncate">{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
                            </div>
                          ))}
                        </div>

                        {/* Assertions */}
                        {tc.assertions && tc.assertions.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {tc.assertions.map((a, aIdx) => (
                              <Badge
                                key={aIdx}
                                variant="outline"
                                className="text-[10px] font-mono border-border/60 bg-card/40"
                              >
                                {a.type} {a.value ? `="${a.value}"` : ""} {a.threshold ? `(>=${a.threshold})` : ""}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Live WebSocket Streaming Test Runner Dialog */}
      <Dialog open={isStreamingModalOpen} onOpenChange={setIsStreamingModalOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Zap className="h-4 w-4 text-emerald-400" />
              Live Evaluation Stream: <span className="font-mono text-emerald-400">{streamingSuiteName}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Streaming real-time execution events from LangGraph state machine via WebSockets.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-3">
            {/* Progress bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-muted-foreground">
                  {isStreamRunning ? "Running tests..." : finalRunResult ? "Execution Complete" : "Connecting..."}
                </span>
                <span className="text-emerald-400 font-bold">
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
              <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{streamError}</span>
              </div>
            )}

            {/* Final Summary Card */}
            {finalRunResult && (
              <div
                className={`p-4 rounded-xl border space-y-3 font-mono text-xs ${
                  finalRunResult.passed
                    ? "border-emerald-500/40 bg-emerald-500/10"
                    : "border-rose-500/40 bg-rose-500/10"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm flex items-center gap-2">
                    {finalRunResult.passed ? (
                      <>
                        <CheckCircle2 className="h-5 w-5 text-emerald-400" /> PASSED QUALITY GATE
                      </>
                    ) : (
                      <>
                        <XCircle className="h-5 w-5 text-rose-400" /> FAILED QUALITY GATE
                      </>
                    )}
                  </span>
                  <Badge variant={finalRunResult.passed ? "success" : "failure"} className="text-xs">
                    {formatPercent(finalRunResult.pass_rate)}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/40 text-center">
                  <div>
                    <span className="text-[10px] text-muted-foreground block">P50 Latency</span>
                    <span className="font-bold">{formatMs(finalRunResult.p50_latency_ms)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Total Tokens</span>
                    <span className="font-bold">{finalRunResult.total_tokens}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Total Cost</span>
                    <span className="font-bold text-emerald-400">{formatCost(finalRunResult.total_cost_usd)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Live Streaming Test Results */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground">Test Case Stream</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {streamCompletedResults.map((tc, i) => (
                  <div
                    key={tc.test_id || i}
                    className={`p-3 rounded-lg border text-xs space-y-2 font-mono ${
                      tc.passed
                        ? "border-emerald-500/30 bg-card/60"
                        : "border-rose-500/30 bg-rose-500/5"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {tc.passed ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <XCircle className="h-4 w-4 text-rose-400" />
                        )}
                        <span className="font-semibold text-foreground">Test: {tc.test_id}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span>{formatMs(tc.latency_ms)}</span>
                        <span>•</span>
                        <span>{formatCost(tc.cost_usd)}</span>
                      </div>
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate pl-6">
                      {tc.completion ? `"${tc.completion.slice(0, 100)}..."` : "No output"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pre-Flight Cost Estimation Dialog */}
      <Dialog open={isCostModalOpen} onOpenChange={setIsCostModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Calculator className="h-5 w-5 text-amber-400" />
              Pre-Flight Cost Estimation
            </DialogTitle>
            <DialogDescription className="text-xs">
              Projected token usage and USD inference cost before executing suite.
            </DialogDescription>
          </DialogHeader>
          {costEstimate && (
            <div className="space-y-4 py-3 font-mono text-xs">
              <div className="p-4 rounded-xl border border-border/80 bg-muted/20 space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Suite:</span>
                  <span className="font-bold text-foreground">{costEstimate.suite_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Target Model:</span>
                  <span className="font-bold text-foreground">{costEstimate.target_model}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Test Cases:</span>
                  <span className="font-bold text-foreground">{costEstimate.total_tests}</span>
                </div>
                <div className="flex justify-between border-t border-border/40 pt-2">
                  <span className="text-muted-foreground">Est. Input Tokens:</span>
                  <span className="font-bold text-foreground">{costEstimate.estimated_input_tokens}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Est. Output Tokens:</span>
                  <span className="font-bold text-foreground">{costEstimate.estimated_output_tokens}</span>
                </div>
                <div className="flex justify-between border-t border-border/40 pt-2 text-sm">
                  <span className="font-bold text-foreground">Projected Cost:</span>
                  <span className="font-bold text-emerald-400">{formatCost(costEstimate.estimated_cost_usd)}</span>
                </div>
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>Unit Cost per Test:</span>
                  <span>{formatCost(costEstimate.cost_per_test_usd)}</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
