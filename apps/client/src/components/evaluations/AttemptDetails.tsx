"use client";

import { TestCaseResult } from "@/types";

export function AttemptDetails({ result }: { result: TestCaseResult }) {
  const attempts = result.attempts ?? [];
  const count = result.attempt_count ?? (attempts.length || 1);
  const passed = result.passed_attempts ?? Number(result.passed);
  if (count === 1) return null;
  return (
    <section aria-label={`Reliability for ${result.test_id}`} className="space-y-2 text-xs">
      <p className="text-zinc-200">
        {passed}/{count} attempts passed ({((passed / count) * 100).toFixed(1)}%)
        {result.inconsistent && <span className="ml-2 text-amber-300">Inconsistent</span>}
      </p>
      <details className="rounded border border-zinc-800 p-2">
        <summary className="cursor-pointer text-zinc-400">Inspect attempts</summary>
        <p className="my-2 text-zinc-500">Summary output shows the first failing attempt, or the first attempt when all pass. Summary latency is the mean; tokens and cost are totals.</p>
        <div className="space-y-2">
          {attempts.map((attempt, index) => (
            <details key={index} className="rounded border border-zinc-800 p-2">
              <summary className={attempt.passed ? "text-emerald-300 cursor-pointer" : "text-red-300 cursor-pointer"}>
                Attempt {index + 1}: {attempt.passed ? "Passed" : "Failed"}
                {` · ${attempt.latency_ms.toFixed(0)} ms · ${attempt.total_tokens} tokens · $${attempt.cost_usd.toFixed(6)}`}
              </summary>
              <pre className="mt-2 whitespace-pre-wrap break-words text-zinc-300">{attempt.completion || "No output"}</pre>
              {attempt.error && <p className="mt-2 text-red-300">{attempt.error}</p>}
              {attempt.assertion_results.map((assertion, i) => (
                <p key={i} className="mt-1 text-zinc-400">
                  {assertion.passed ? "Pass" : "Fail"}: {assertion.assertion_type} — {assertion.reason}
                </p>
              ))}
            </details>
          ))}
        </div>
      </details>
    </section>
  );
}
