"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { SuiteRunResult } from "@/types";

export function BaselinePanel({ run }: { run: SuiteRunResult }) {
  const queryClient = useQueryClient();
  const [exported, setExported] = useState(false);
  const baselineQuery = useQuery({
    queryKey: ["baselines", run.suite_name],
    queryFn: () => api.getBaseline(run.suite_name),
  });
  const baseline = baselineQuery.data;
  const isBaseline = baseline?.run.run_id === run.run_id;
  const comparisonQuery = useQuery({
    queryKey: ["baseline-comparison", run.run_id, baseline?.run.run_id],
    queryFn: () => api.compareBaseline(run.run_id),
    enabled: !!baseline && !isBaseline,
  });
  const updateBaseline = useMutation({
    mutationFn: () => api.setBaseline(run.suite_name, run.run_id),
    onSuccess: (data) => {
      setExported(false);
      queryClient.setQueryData(["baselines", run.suite_name], data);
      queryClient.invalidateQueries({ queryKey: ["baseline-comparison"] });
    },
  });
  const removeBaseline = useMutation({
    mutationFn: () => api.deleteBaseline(run.suite_name),
    onSuccess: () => {
      queryClient.setQueryData(["baselines", run.suite_name], null);
      queryClient.invalidateQueries({ queryKey: ["baseline-comparison"] });
    },
  });

  const exportBaseline = () => {
    if (!baseline) return;
    const blob = new Blob([JSON.stringify(baseline, null, 2) + "\n"], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${run.suite_name.replace(/[^a-z0-9_-]/gi, "_")}-baseline.json`;
    link.click();
    URL.revokeObjectURL(url);
    setExported(true);
  };

  const comparison = comparisonQuery.data;
  const error = baselineQuery.error || updateBaseline.error || removeBaseline.error
    || (!!baseline && !isBaseline && comparisonQuery.error);

  return (
    <section className="rounded-lg border border-zinc-700 bg-zinc-900/30 p-3 space-y-3" aria-label="Regression baseline">
      <h4 className="text-sm font-semibold text-white">Regression baseline</h4>
      <p className="text-xs text-zinc-400">
        {baselineQuery.isLoading ? "Loading baseline…" : baseline
          ? `Saved baseline: ${baseline.run.run_id}`
          : "No baseline saved. Choose a successful run to protect this suite from new failures."}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline"
          disabled={!run.passed || !run.results.length || isBaseline || baselineQuery.isLoading
            || updateBaseline.isPending || removeBaseline.isPending}
          onClick={() => updateBaseline.mutate()}>
          {updateBaseline.isPending ? "Saving…" : isBaseline ? "This is the saved baseline" : "Use this run as baseline"}
        </Button>
        {baseline && <>
          <Button size="sm" variant="outline" onClick={exportBaseline}>Export baseline JSON</Button>
          <Button size="sm" variant="ghost" disabled={removeBaseline.isPending || updateBaseline.isPending}
            onClick={() => removeBaseline.mutate()}>Remove baseline</Button>
        </>}
      </div>
      {exported && <p role="status" className="text-xs text-zinc-300">Baseline JSON downloaded.</p>}
      {error && <p role="alert" className="text-xs text-red-400">{String(error instanceof Error ? error.message : error)}</p>}
      {!!baseline && !isBaseline && comparisonQuery.isLoading && <p className="text-xs text-zinc-400">Comparing runs…</p>}
      {baseline && !isBaseline && comparison && <div className="space-y-3">
        <p className={comparison.passed ? "text-emerald-400" : "text-red-400"} role="status">
          {comparison.passed ? "Regression gate passed" : "Regression gate failed"}
          {` · ${comparison.regressed_test_ids.length} new failures · ${comparison.missing_test_ids.length} missing tests`}
        </p>
        <p className="text-xs text-zinc-400">
          {comparison.improved_test_ids.length} improved · {comparison.changed_test_ids.length} changed outputs
          {` · ${comparison.added_test_ids.length} added tests`}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono text-zinc-300">
          <span>Pass rate: {comparison.pass_rate_delta >= 0 ? "+" : ""}{(comparison.pass_rate_delta * 100).toFixed(1)} pp</span>
          <span>P50 latency: {comparison.latency_p50_delta_ms >= 0 ? "+" : ""}{comparison.latency_p50_delta_ms.toFixed(2)} ms</span>
          <span>Cost: {comparison.cost_delta_usd >= 0 ? "+" : "−"}${Math.abs(comparison.cost_delta_usd).toFixed(6)}</span>
        </div>
        {comparison.cases.filter((item) => item.status !== "unchanged").map((item) => (
          <details key={item.test_id} className="rounded border border-zinc-800 p-2">
            <summary className="cursor-pointer text-zinc-200">{item.test_id} — {item.status}</summary>
            <div className="grid sm:grid-cols-2 gap-3 mt-2">
              <div><p className="text-zinc-500 mb-1">Baseline output</p><pre className="whitespace-pre-wrap break-words text-xs">{item.baseline?.completion ?? "Test absent"}</pre></div>
              <div><p className="text-zinc-500 mb-1">Current output</p><pre className="whitespace-pre-wrap break-words text-xs">{item.current?.completion ?? "Test absent"}</pre></div>
            </div>
            {item.current?.assertion_results.filter((assertion) => !assertion.passed).map((assertion, index) => (
              <p key={index} className="mt-2 text-xs text-red-400">{assertion.reason}</p>
            ))}
            {item.output_diff && <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-zinc-400">{item.output_diff}</pre>}
          </details>
        ))}
      </div>}
    </section>
  );
}
