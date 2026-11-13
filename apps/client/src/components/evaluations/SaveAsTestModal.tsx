"use client";

import React, { useState } from "react";
import { BookmarkPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { AssertionConfig, SaveTraceResponse, TestCaseResult } from "@/types";

interface SaveAsTestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suiteName: string;
  trace: TestCaseResult | null;
  onSaved?: (res: SaveTraceResponse) => void;
}

function getInitialContextText(trace: TestCaseResult): string {
  if (Array.isArray(trace.context)) {
    return JSON.stringify(trace.context, null, 2);
  }
  if (typeof trace.context === "string") {
    return trace.context;
  }
  return "";
}

function getInitialGroundTruthText(trace: TestCaseResult): string {
  if (trace.ground_truth === undefined || trace.ground_truth === null) {
    return "";
  }
  return typeof trace.ground_truth === "string"
    ? trace.ground_truth
    : JSON.stringify(trace.ground_truth, null, 2);
}

function SaveAsTestForm({
  suiteName,
  trace,
  onOpenChange,
  onSaved,
}: {
  suiteName: string;
  trace: TestCaseResult;
  onOpenChange: (open: boolean) => void;
  onSaved?: (res: SaveTraceResponse) => void;
}) {
  const [testId, setTestId] = useState(
    () => `${trace.test_id}-reg-${Math.random().toString(36).slice(2, 6)}`
  );
  const [description, setDescription] = useState(() => `Saved from trace ${trace.test_id}`);
  const [varsJson, setVarsJson] = useState(() => JSON.stringify(trace.vars ?? {}, null, 2));
  const [contextText, setContextText] = useState(() => getInitialContextText(trace));
  const [groundTruthText, setGroundTruthText] = useState(() => getInitialGroundTruthText(trace));
  const [assertionsJson, setAssertionsJson] = useState(() => {
    const failedAssertions: AssertionConfig[] = (trace.assertion_results ?? [])
      .filter((ar) => !ar.passed)
      .map((ar) => ({
        type: ar.assertion_type as AssertionConfig["type"],
        strict: ar.strict ?? true,
      }));
    return JSON.stringify(failedAssertions, null, 2);
  });
  const [targetDataset, setTargetDataset] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!suiteName) return;
    const cleanedId = testId.trim();
    if (!cleanedId) {
      setErrorMsg("Test case ID is required.");
      return;
    }

    let parsedVars: Record<string, unknown>;
    try {
      const candidate = JSON.parse(varsJson || "{}");
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
        setErrorMsg("Variables must be a JSON object.");
        return;
      }
      parsedVars = candidate as Record<string, unknown>;
    } catch {
      setErrorMsg("Variables must be valid JSON.");
      return;
    }

    let parsedAssertions: AssertionConfig[] = [];
    try {
      const candidate = JSON.parse(assertionsJson || "[]");
      if (!Array.isArray(candidate)) {
        setErrorMsg("Assertions must be a JSON array.");
        return;
      }
      parsedAssertions = candidate as AssertionConfig[];
    } catch {
      setErrorMsg("Assertions must be valid JSON.");
      return;
    }

    let parsedContext: string | string[] | null = null;
    const trimmedContext = contextText.trim();
    if (trimmedContext) {
      if (trimmedContext.startsWith("[")) {
        try {
          const candidate = JSON.parse(trimmedContext);
          parsedContext = Array.isArray(candidate)
            ? candidate.map((item) => String(item))
            : trimmedContext;
        } catch {
          parsedContext = trimmedContext;
        }
      } else {
        parsedContext = trimmedContext;
      }
    }

    const trimmedGt = groundTruthText.trim();
    const groundTruth = trimmedGt ? trimmedGt : null;

    setErrorMsg(null);
    setIsSaving(true);
    try {
      const res = await api.saveTraceToSuite(suiteName, {
        id: cleanedId,
        description: description.trim() || null,
        vars: parsedVars,
        context: parsedContext,
        ground_truth: groundTruth,
        assertions: parsedAssertions,
        target_dataset: targetDataset.trim() || null,
      });
      onSaved?.(res);
      onOpenChange(false);
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } }; message?: string })
          ?.response?.data?.detail ||
        (err as { message?: string })?.message ||
        "Failed to save trace as test case.";
      setErrorMsg(detail);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="space-y-3 py-1 text-xs">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor="save-trace-id" className="block text-xs font-medium text-zinc-300">
              Test Case ID
            </label>
            <Input
              id="save-trace-id"
              value={testId}
              onChange={(e) => setTestId(e.target.value)}
              className="font-mono text-xs"
              placeholder="e.g. test_refund_regression"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="save-trace-dataset" className="block text-xs font-medium text-zinc-300">
              Target JSONL (optional)
            </label>
            <Input
              id="save-trace-dataset"
              value={targetDataset}
              onChange={(e) => setTargetDataset(e.target.value)}
              className="font-mono text-xs"
              placeholder="Auto (<suite>.regressions.jsonl)"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="save-trace-desc" className="block text-xs font-medium text-zinc-300">
            Description
          </label>
          <Input
            id="save-trace-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="text-xs"
            placeholder="Short description of the regression case"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="save-trace-vars" className="block text-xs font-medium text-zinc-300">
            Variables (JSON)
          </label>
          <Textarea
            id="save-trace-vars"
            value={varsJson}
            onChange={(e) => setVarsJson(e.target.value)}
            rows={4}
            className="font-mono text-xs"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor="save-trace-context" className="block text-xs font-medium text-zinc-300">
              Context (text or JSON array)
            </label>
            <Textarea
              id="save-trace-context"
              value={contextText}
              onChange={(e) => setContextText(e.target.value)}
              rows={3}
              className="font-mono text-xs"
              placeholder="Optional RAG context"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="save-trace-gt" className="block text-xs font-medium text-zinc-300">
              Ground Truth (optional)
            </label>
            <Textarea
              id="save-trace-gt"
              value={groundTruthText}
              onChange={(e) => setGroundTruthText(e.target.value)}
              rows={3}
              className="font-mono text-xs"
              placeholder="Expected output"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="save-trace-assertions" className="block text-xs font-medium text-zinc-300">
            Starter Assertions (JSON array)
          </label>
          <Textarea
            id="save-trace-assertions"
            value={assertionsJson}
            onChange={(e) => setAssertionsJson(e.target.value)}
            rows={3}
            className="font-mono text-xs"
          />
        </div>

        {errorMsg && (
          <p className="rounded border border-red-900/60 bg-red-950/40 px-2.5 py-1.5 text-xs text-red-300">
            {errorMsg}
          </p>
        )}
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={isSaving}
        >
          Cancel
        </Button>
        <Button type="button" onClick={handleSave} disabled={isSaving}>
          {isSaving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Save to Dataset
        </Button>
      </DialogFooter>
    </>
  );
}

export function SaveAsTestModal({
  open,
  onOpenChange,
  suiteName,
  trace,
  onSaved,
}: SaveAsTestModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold text-white">
            <BookmarkPlus className="h-4 w-4 text-zinc-300" />
            Save Trace as Test Case
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-400">
            Review and scrub PII or secrets before appending to {suiteName}&apos;s JSONL regression dataset. Timestamps, latency, cost, and raw provider metadata are stripped automatically.
          </DialogDescription>
        </DialogHeader>

        {open && trace && (
          <SaveAsTestForm
            key={`${suiteName}-${trace.test_id}`}
            suiteName={suiteName}
            trace={trace}
            onOpenChange={onOpenChange}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
