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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
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
          <Button onClick={() => refetchSuites()} variant="outline" size="sm" className="gap-1.5 text-xs">
            <RefreshCw className="h-3 w-3" />
            Refresh
          </Button>
          {activeSuiteName && (
            <Button
              onClick={() => handleStartLiveStream(activeSuiteName)}
              variant="default"
              size="sm"
              className="gap-1.5 text-xs"
            >
              <Zap className="h-3 w-3 fill-current" />
              Run Suite Live
            </Button>
          )}
        </div>
      </div>

      {/* Grid: Left Suites List, Right Suite Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Suites List */}
        <div className="lg:col-span-4 space-y-3">
          <h3 className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider px-1">
            Discovered Suites ({suites.length})
          </h3>
          <div className="space-y-2">
            {suites.map((s) => {
              const isSelected = s.name === activeSuiteName;
              return (
                <div
                  key={s.name}
                  onClick={() => setSelectedSuiteName(s.name)}
                  className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? "border-zinc-600 bg-zinc-900/90 shadow-sm"
                      : "border-border bg-card hover:border-zinc-700 hover:bg-zinc-900/40"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-xs text-white flex items-center gap-1.5">
                        <FileCode className="h-3.5 w-3.5 text-zinc-400" />
                        {s.name}
                      </h4>
                      <p className="text-[11px] text-zinc-400 mt-1 line-clamp-1">
                        {s.description || "No description provided"}
                      </p>
                    </div>
                    <ChevronRight className={`h-3.5 w-3.5 text-zinc-500 transition-transform ${isSelected ? "translate-x-0.5 text-white" : ""}`} />
                  </div>
                  <div className="flex items-center gap-2 mt-2.5 text-[10px] font-mono text-zinc-400">
                    <span>{s.test_count} tests</span>
                    <span>•</span>
                    <span className="truncate max-w-[130px]">{s.target_model}</span>
                    <span>•</span>
                    <Badge variant="outline" className="text-[10px] px-1 py-0 border-zinc-800 text-zinc-400">
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
            <Card className="border-border bg-card h-80 flex items-center justify-center text-center p-8 text-zinc-500 text-xs">
              {isDetailsLoading ? "Loading suite configuration..." : "Select a suite on the left to inspect test cases."}
            </Card>
          ) : (
            <div className="space-y-5">
              {/* Suite Header Info Card */}
              <Card className="border-border bg-card">
                <CardHeader className="p-5 pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                        {selectedSuite.name}
                        <Badge variant="outline" className="font-mono text-[10px] text-zinc-300 border-zinc-700 bg-zinc-900">
                          {formatPercent(selectedSuite.min_pass_rate ?? 1.0)} required
                        </Badge>
                      </CardTitle>
                      <CardDescription className="text-xs text-zinc-400 mt-0.5">
                        {selectedSuite.description}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => estimateMutation.mutate(selectedSuite.name)}
                        disabled={estimateMutation.isPending}
                        variant="outline"
                        size="sm"
                        className="text-xs gap-1.5 h-8"
                      >
                        <Calculator className="h-3 w-3 text-zinc-400" />
                        {estimateMutation.isPending ? "Estimating..." : "Estimate Cost"}
                      </Button>
                      <Button
                        onClick={() => handleStartLiveStream(selectedSuite.name)}
                        variant="default"
                        size="sm"
                        className="text-xs gap-1.5 h-8"
                      >
                        <Zap className="h-3 w-3 fill-current" />
                        Run Suite
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-5 pt-0 space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 rounded-md bg-zinc-950 border border-border text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-zinc-500 uppercase block">Target Model</span>
                      <span className="font-medium text-zinc-200">{selectedSuite.target.model}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 uppercase block">Target Type</span>
                      <span className="font-medium text-zinc-200">{selectedSuite.target.type}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 uppercase block">Test Cases</span>
                      <span className="font-medium text-zinc-200">{selectedSuite.tests.length} cases</span>
                    </div>
                  </div>

                  {selectedSuite.target.template && (
                    <div>
                      <label className="text-[11px] font-medium text-zinc-400 block mb-1">
                        Prompt Template
                      </label>
                      <div className="p-2.5 rounded-md bg-black border border-border font-mono text-xs text-zinc-200 whitespace-pre-wrap">
                        {selectedSuite.target.template}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Test Cases Matrix */}
              <div className="space-y-2.5">
                <h3 className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                  Test Case Matrix ({selectedSuite.tests.length})
                </h3>
                <div className="space-y-2.5">
                  {selectedSuite.tests.map((tc, idx) => (
                    <Card key={tc.id || idx} className="border-border bg-card">
                      <CardHeader className="p-3.5 pb-1.5 flex flex-row items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="font-mono text-[10px] bg-zinc-800 text-zinc-200">
                            #{tc.id}
                          </Badge>
                          {tc.description && (
                            <span className="text-xs text-zinc-400">{tc.description}</span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-zinc-500">
                          {Object.keys(tc.vars).length} vars • {(tc.assertions || []).length} assertions
                        </span>
                      </CardHeader>
                      <CardContent className="p-3.5 pt-1 space-y-2">
                        {/* Variables */}
                        <div className="p-2 rounded bg-zinc-950 border border-border text-xs font-mono space-y-0.5">
                          {Object.entries(tc.vars).map(([k, v]) => (
                            <div key={k} className="flex items-start gap-2">
                              <span className="text-zinc-400 shrink-0">{k}:</span>
                              <span className="text-zinc-200 truncate">{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
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
                                className="text-[10px] font-mono border-border bg-zinc-950 text-zinc-400"
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
                  {isStreamRunning ? "Running tests..." : finalRunResult ? "Execution Complete" : "Connecting..."}
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
              <div
                className="p-3.5 rounded-lg border border-border bg-zinc-950 space-y-2.5 font-mono text-xs"
              >
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
                    key={tc.test_id || i}
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

      {/* Pre-Flight Cost Estimation Dialog */}
      <Dialog open={isCostModalOpen} onOpenChange={setIsCostModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold text-white">
              <Calculator className="h-4 w-4 text-zinc-400" />
              Pre-Flight Cost Estimation
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Projected token usage and USD inference cost before executing suite.
            </DialogDescription>
          </DialogHeader>
          {costEstimate && (
            <div className="space-y-3 py-2 font-mono text-xs">
              <div className="p-3.5 rounded-lg border border-border bg-zinc-950 space-y-2">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Suite:</span>
                  <span className="font-medium text-zinc-200">{costEstimate.suite_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Target Model:</span>
                  <span className="font-medium text-zinc-200">{costEstimate.target_model}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Total Tests:</span>
                  <span className="font-medium text-zinc-200">{costEstimate.total_tests}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-1.5">
                  <span className="text-zinc-500">Est. Input:</span>
                  <span className="font-medium text-zinc-200">{costEstimate.estimated_input_tokens}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Est. Output:</span>
                  <span className="font-medium text-zinc-200">{costEstimate.estimated_output_tokens}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-1.5 text-xs font-semibold">
                  <span className="text-white">Projected Cost:</span>
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
