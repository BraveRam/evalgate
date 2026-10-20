"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { usePageTitle } from "@/lib/use-page-title";
import { formatCost, formatMs, formatPercent } from "@/lib/utils";
import { PromptArenaRequest, PromptArenaResult, PromptEstimate, PromptVariant } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SearchableModelSelect } from "@/components/ui/SearchableModelSelect";
import { AttemptDetails } from "@/components/evaluations/AttemptDetails";
import { CodeViewer } from "@/components/ui/CodeViewer";

export default function PromptArenaPage() {
  usePageTitle("Prompt Arena");
  const cache = useQueryClient();
  const [selectedSuite, setSelectedSuite] = useState("");
  const [draft, setDraft] = useState<PromptArenaRequest | null>(null);
  const [result, setResult] = useState<PromptArenaResult | null>(null);
  const [pending, setPending] = useState<{ request: PromptArenaRequest; estimate: PromptEstimate } | null>(null);
  const [applied, setApplied] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const suites = useQuery({ queryKey: ["suites"], queryFn: () => api.listSuites() });
  const choices = (suites.data ?? []).filter(suite => !!suite.name && suite.target_type !== "webhook");
  const suiteName = selectedSuite || choices[0]?.name || "";
  const suite = useQuery({
    queryKey: ["suite", suiteName],
    queryFn: () => api.getSuite(suiteName),
    enabled: !!suiteName,
  });
  const sourcePrompt: PromptVariant = {
    template: suite.data?.target.template ?? "",
    system_prompt: suite.data?.target.system_prompt ?? "",
  };
  const settings: PromptArenaRequest = draft?.suite_name === suiteName ? draft : {
    suite_name: suiteName,
    model: suite.data?.target.model ?? "openai/gpt-4o-mini",
    prompt_a: sourcePrompt,
    prompt_b: { ...sourcePrompt },
    repeat: suite.data?.repeat ?? 1,
    concurrency: 10,
  };
  const valid = !!suite.data && settings.model.trim().length > 0
    && settings.prompt_a.template.trim().length > 0 && settings.prompt_b.template.trim().length > 0
    && Number.isInteger(settings.repeat) && (settings.repeat ?? 0) >= 1 && (settings.repeat ?? 0) <= 100
    && Number.isInteger(settings.concurrency) && settings.concurrency >= 1 && settings.concurrency <= 50;
  const history = useQuery({
    queryKey: ["prompt-arena-history", offset],
    queryFn: () => api.listPromptComparisons(offset),
  });
  const apply = useMutation({
    mutationFn: ({ id, variant }: { id: string; variant: "A" | "B" }) => api.applyPrompt(id, variant),
    onSuccess: (_, { id }) => {
      setApplied(id);
      cache.invalidateQueries({ queryKey: ["suite"] });
      cache.invalidateQueries({ queryKey: ["suites"] });
    },
  });
  const compare = useMutation({
    mutationFn: (request: PromptArenaRequest) => api.comparePrompts(request),
    onSuccess: data => {
      setResult(data);
      setApplied(null);
      apply.reset();
      cache.invalidateQueries({ queryKey: ["prompt-arena-history"] });
      cache.invalidateQueries({ queryKey: ["runs"] });
    },
  });
  const estimate = useMutation({
    mutationFn: (request: PromptArenaRequest) => api.estimatePrompts(request),
    onSuccess: (data, request) => setPending({
      request: { ...request, suite_fingerprint: data.suite_fingerprint },
      estimate: data,
    }),
  });
  const restore = useMutation({
    mutationFn: (id: string) => api.getPromptComparison(id),
    onSuccess: data => {
      setResult(data);
      setApplied(null);
      apply.reset();
      compare.reset();
    },
  });
  const busy = estimate.isPending || compare.isPending || restore.isPending || apply.isPending;
  const error = suites.error || suite.error || estimate.error || compare.error || restore.error || apply.error;
  const runs = result ? [result.comparison.run_a, result.comparison.run_b] : [];
  const changePrompt = (side: "prompt_a" | "prompt_b", update: Partial<PromptVariant>) =>
    setDraft({ ...settings, [side]: { ...settings[side], ...update } });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Prompt Arena</h1>
        <p className="mt-2 text-sm text-zinc-400">Compare two prompts using one model and identical tests, assertions, and sampling settings.</p>
        <Link href="/docs/prompt-arena" className="text-sm underline text-zinc-300">How to use Prompt Arena</Link>
      </header>
      {error && <p role="alert" className="rounded border border-red-900 p-3 text-sm text-red-300">{error.message}</p>}
      {suites.isSuccess && choices.length === 0 && <p>Create a model-backed suite in <Link href="/suites" className="underline">Suites &amp; Tests</Link> first.</p>}
      {suite.data && <section className="rounded-lg border border-border bg-card p-5 space-y-4" aria-label="Prompt comparison setup">
        <div className="grid gap-4 sm:grid-cols-4">
          <label className="space-y-2 text-sm">
            <span>Evaluation suite</span>
            <select aria-label="Evaluation suite" className="w-full rounded border border-border bg-zinc-950 p-2"
              value={suiteName} disabled={busy} onChange={event => { setSelectedSuite(event.target.value); setDraft(null); estimate.reset(); }}>
              {choices.map(item => <option key={item.name} value={item.name}>{item.name}</option>)}
            </select>
          </label>
          <div className="space-y-2 text-sm"><span>Shared model</span>
            <SearchableModelSelect value={settings.model} onValueChange={model => setDraft({ ...settings, model })} />
          </div>
          <label className="space-y-2 text-sm"><span>Attempts per test</span>
            <Input aria-label="Prompt attempts per test" type="number" min={1} max={100} value={settings.repeat ?? ""}
              onChange={event => setDraft({ ...settings, repeat: Number(event.target.value) })} />
          </label>
          <label className="space-y-2 text-sm"><span>Concurrency</span>
            <Input aria-label="Prompt concurrency" type="number" min={1} max={50} value={settings.concurrency}
              onChange={event => setDraft({ ...settings, concurrency: Number(event.target.value) })} />
          </label>
        </div>
        <p className="text-xs text-zinc-400">
          Per-test YAML repeat overrides take precedence. Each variant uses the suite&apos;s temperature, top-p, context, tools, schema, and quality threshold.
          Saved suite baselines do not gate this experiment. A runs before B with the same concurrency limit.
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          {(["A", "B"] as const).map(side => {
            const key = side === "A" ? "prompt_a" : "prompt_b";
            return <fieldset key={side} className="space-y-3 rounded border border-border p-4">
              <legend className="px-1 font-semibold">Prompt {side}</legend>
              <label className="block space-y-2 text-sm"><span>System instructions</span>
                <Textarea aria-label={`Prompt ${side} system instructions`} className="min-h-24 font-mono text-xs"
                  value={settings[key].system_prompt} onChange={event => changePrompt(key, { system_prompt: event.target.value })} />
              </label>
              <label className="block space-y-2 text-sm"><span>Prompt template</span>
                <Textarea aria-label={`Prompt ${side} template`} className="min-h-44 font-mono text-xs"
                  value={settings[key].template} onChange={event => changePrompt(key, { template: event.target.value })} />
              </label>
              <p className="text-xs text-zinc-500">Use the suite&apos;s existing template variables, such as {"{{question}}"}.</p>
            </fieldset>;
          })}
        </div>
        {!valid && <p className="text-xs text-amber-300">Provide both templates, a model, 1–100 attempts, and concurrency from 1–50.</p>}
        <Button disabled={!valid || busy} onClick={() => estimate.mutate(settings)}>
          {estimate.isPending ? "Estimating…" : compare.isPending ? "Comparing prompts…" : "Compare prompts"}
        </Button>
      </section>}

      {result && <section className="space-y-4 rounded-lg border border-border bg-card p-5" aria-label="Prompt comparison results">
        <header>
          <h2 className="text-lg font-semibold">Comparison results</h2>
          <p className="text-xs text-zinc-400">{result.suite_snapshot.name} · {result.model} · {result.comparison_id}</p>
          <p className="mt-2 text-sm">
            {result.comparison.pass_rate_delta === 0 ? "Tied observed pass rates" : result.comparison.pass_rate_delta > 0 ? "Prompt B has the higher observed pass rate" : "Prompt A has the higher observed pass rate"}.
            {" "}Repeated outcomes describe this sample; they do not establish statistical significance.
          </p>
        </header>
        <div className="grid gap-4 sm:grid-cols-2">
          {runs.map((run, index) => <div key={run.run_id} className="space-y-3 rounded border border-border p-4">
            <h3 className="font-semibold">Prompt {index === 0 ? "A" : "B"} · {run.passed ? "Gate passed" : "Gate failed"}</h3>
            <p>{formatPercent(run.pass_rate)} · {run.passed_attempts ?? run.passed_tests}/{run.total_attempts ?? run.total_tests} attempts passed</p>
            <p className="text-sm text-zinc-400">P50 {formatMs(run.p50_latency_ms)} · P95 {formatMs(run.p95_latency_ms)} · {run.total_tokens} tokens · {formatCost(run.total_cost_usd)}</p>
            <Button variant="outline" disabled={busy || applied === result.comparison_id}
              onClick={() => apply.mutate({ id: result.comparison_id, variant: index === 0 ? "A" : "B" })}>
              Apply prompt {index === 0 ? "A" : "B"} to suite
            </Button>
          </div>)}
        </div>
        <p className="text-xs text-zinc-400">Applying changes only the suite&apos;s template and system instructions. Tests, model, and other settings are preserved. A changed suite must be compared again first.</p>
        {applied === result.comparison_id && <p role="status" className="text-sm text-emerald-300">Prompt applied to suite.</p>}
        <details className="rounded border border-border p-3">
          <summary className="cursor-pointer text-sm">Compared prompts and saved suite snapshot</summary>
          <CodeViewer language="json" code={JSON.stringify({
            model: result.model, prompt_a: result.prompt_a, prompt_b: result.prompt_b,
            repeat: result.repeat, concurrency: result.concurrency, suite: result.suite_snapshot,
          }, null, 2)} />
        </details>
        {runs[0].results.map(a => {
          const b = runs[1].results.find(item => item.test_id === a.test_id);
          return <details key={a.test_id} className="rounded border border-border p-3">
            <summary className="cursor-pointer text-sm">{a.test_id} · A {formatPercent(a.success_rate ?? Number(a.passed))} / B {formatPercent(b?.success_rate ?? Number(b?.passed))}</summary>
            <div className="mt-3 grid gap-4 lg:grid-cols-2">
              {[a, b].map((item, index) => item && <div key={index} className="min-w-0 space-y-2">
                <h4 className="text-sm font-semibold">Prompt {index === 0 ? "A" : "B"} output</h4>
                <pre className="whitespace-pre-wrap break-words text-xs text-zinc-300">{item.completion || "No output"}</pre>
                {item.error && <p className="text-xs text-red-300">{item.error}</p>}
                {item.assertion_results.filter(assertion => !assertion.passed).map((assertion, i) =>
                  <p key={i} className="text-xs text-red-300">{assertion.assertion_type}: {assertion.reason}</p>)}
                <AttemptDetails result={item} />
              </div>)}
            </div>
          </details>;
        })}
      </section>}

      <section className="space-y-3 rounded-lg border border-border bg-card p-5" aria-label="Saved prompt comparisons">
        <h2 className="font-semibold">Saved comparisons</h2>
        <p className="text-xs text-zinc-400">Stored in the local database, including both prompts, original suite, settings, and attempt outputs.</p>
        {history.error && <p role="alert">{history.error.message}</p>}
        {history.isSuccess && history.data.length === 0 && <p className="text-sm text-zinc-500">No saved comparisons on this page.</p>}
        {history.data?.map(item => <button key={item.comparison_id} disabled={busy}
          className="block w-full rounded border border-border p-3 text-left text-sm hover:bg-zinc-900 disabled:opacity-50"
          onClick={() => restore.mutate(item.comparison_id)}>
          {item.suite_name} · {item.model} · A {formatPercent(item.pass_rate_a)} / B {formatPercent(item.pass_rate_b)}
          <span className="block text-xs text-zinc-500">{new Date(item.created_at).toLocaleString()} · {item.comparison_id}</span>
        </button>)}
        <div className="flex gap-2">
          <Button variant="outline" disabled={offset === 0 || busy} onClick={() => setOffset(Math.max(0, offset - 20))}>Newer</Button>
          <Button variant="outline" disabled={(history.data?.length ?? 0) < 20 || busy} onClick={() => setOffset(offset + 20)}>Older</Button>
        </div>
      </section>
      <Dialog open={!!pending} onOpenChange={open => { if (!open) setPending(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Prompt comparison estimate</DialogTitle>
            <DialogDescription>Both variants will run using these estimated settings. Semantic judge costs are additional.</DialogDescription>
          </DialogHeader>
          {pending && <div className="space-y-3 text-sm">
            <p>{pending.request.suite_name} · {pending.request.model}</p>
            <p>A: {pending.estimate.estimate_a.total_attempts} attempts · B: {pending.estimate.estimate_b.total_attempts} attempts</p>
            <p>{pending.estimate.total_attempts} total attempts · Estimated target cost {formatCost(pending.estimate.estimated_cost_usd)}</p>
            <p className="text-xs text-zinc-400">Target cost is approximate. This comparison does not edit the suite.</p>
            <Button onClick={() => { const request = pending.request; setPending(null); compare.mutate(request); }}>
              Start prompt comparison
            </Button>
          </div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
