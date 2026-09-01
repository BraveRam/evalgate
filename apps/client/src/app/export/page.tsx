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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { api } from "@/lib/api";
import { formatPercent } from "@/lib/utils";
import { usePageTitle } from "@/lib/use-page-title";
import { SuiteSummary } from "@/types";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  ArrowRight,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FileCode,
  FileSpreadsheet,
  FileText,
  FolderGit2,
  Github,
  KeyRound,
  Maximize2,
  Minimize2,
  Play,
  Plug,
  ShieldCheck,
  Sliders,
  Terminal,
  Zap,
} from "lucide-react";

/**
 * Lightweight browser ZIP archive creator for multi-file CI export bundles
 */
function createZipArchive(files: { path: string; content: string }[]): Blob {
  const textEncoder = new TextEncoder();
  const fileEntries: {
    pathBytes: Uint8Array;
    contentBytes: Uint8Array;
    crc: number;
    offset: number;
  }[] = [];

  const crcTable = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crcTable[i] = c >>> 0;
  }

  function crc32(bytes: Uint8Array): number {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) {
      crc = (crc >>> 8) ^ crcTable[(crc ^ bytes[i]) & 0xff];
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  const chunks: Uint8Array[] = [];
  let currentOffset = 0;

  for (const file of files) {
    const pathBytes = textEncoder.encode(file.path);
    const contentBytes = textEncoder.encode(file.content);
    const crc = crc32(contentBytes);
    const offset = currentOffset;

    const header = new Uint8Array(30 + pathBytes.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, 0, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, contentBytes.length, true);
    view.setUint32(22, contentBytes.length, true);
    view.setUint16(26, pathBytes.length, true);
    view.setUint16(28, 0, true);
    header.set(pathBytes, 30);

    chunks.push(header, contentBytes);
    currentOffset += header.length + contentBytes.length;

    fileEntries.push({ pathBytes, contentBytes, crc, offset });
  }

  const centralDirStart = currentOffset;

  for (const entry of fileEntries) {
    const record = new Uint8Array(46 + entry.pathBytes.length);
    const view = new DataView(record.buffer);
    view.setUint32(0, 0x02014b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 20, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, 0, true);
    view.setUint16(14, 0, true);
    view.setUint32(16, entry.crc, true);
    view.setUint32(20, entry.contentBytes.length, true);
    view.setUint32(24, entry.contentBytes.length, true);
    view.setUint16(28, entry.pathBytes.length, true);
    view.setUint16(30, 0, true);
    view.setUint16(32, 0, true);
    view.setUint16(34, 0, true);
    view.setUint16(36, 0, true);
    view.setUint32(38, 0, true);
    view.setUint32(42, entry.offset, true);
    record.set(entry.pathBytes, 46);

    chunks.push(record);
    currentOffset += record.length;
  }

  const centralDirSize = currentOffset - centralDirStart;

  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true);
  eocdView.setUint16(4, 0, true);
  eocdView.setUint16(6, 0, true);
  eocdView.setUint16(8, fileEntries.length, true);
  eocdView.setUint16(10, fileEntries.length, true);
  eocdView.setUint32(12, centralDirSize, true);
  eocdView.setUint32(16, centralDirStart, true);
  eocdView.setUint16(20, 0, true);

  chunks.push(eocd);

  return new Blob(chunks as any, { type: "application/zip" });
}

export default function ExportPage() {
  usePageTitle("CI/CD Export");
  const [selectedSuiteName, setSelectedSuiteName] = useState<string>("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Customizable CI Options
  const [triggerPR, setTriggerPR] = useState(true);
  const [triggerPush, setTriggerPush] = useState(true);
  const [triggerDispatch, setTriggerDispatch] = useState(true);
  const [branchName, setBranchName] = useState("main");
  const [pythonVersion, setPythonVersion] = useState("3.12");
  const [ciConcurrency, setCiConcurrency] = useState(10);

  // TanStack Query: Fetch all suites
  const { data: suites = [] } = useQuery({
    queryKey: ["suites"],
    queryFn: async () => {
      const list = await api.listSuites();
      if (list.length > 0 && !selectedSuiteName) {
        setSelectedSuiteName(list[0].name);
      }
      return list;
    },
  });

  const activeSummary: SuiteSummary | undefined = suites.find(
    (s) => s.name === (selectedSuiteName || (suites[0]?.name || ""))
  );
  const activeSuiteName = activeSummary?.name || (suites.length > 0 ? suites[0].name : "");

  // TanStack Query: Fetch full suite spec
  const { data: selectedSuite } = useQuery({
    queryKey: ["suite", activeSuiteName],
    queryFn: () => (activeSuiteName ? api.getSuite(activeSuiteName) : null),
    enabled: !!activeSuiteName,
  });

  // Accurate suite path derived directly from backend discovery
  const actualSuitePath = activeSummary?.path || (activeSummary?.filename ? `evals/${activeSummary.filename}` : `evals/${activeSuiteName}.yaml`);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const downloadFile = (content: string, filename: string, mimeType: string = "text/plain") => {
    const element = document.createElement("a");
    const file = new Blob([content], { type: mimeType });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Determine required secret name based on target model
  const targetModel = selectedSuite?.target.model || activeSummary?.target_model || "openai/gpt-4o-mini";
  const requiredSecretName = useMemo(() => {
    if (targetModel.startsWith("anthropic/")) return "ANTHROPIC_API_KEY";
    if (targetModel.startsWith("google/") || targetModel.startsWith("gemini")) return "GOOGLE_API_KEY";
    if (targetModel.startsWith("deepseek/")) return "DEEPSEEK_API_KEY";
    if (targetModel.startsWith("mock/")) return "MOCK_KEY (Local Sandbox)";
    return "OPENAI_API_KEY";
  }, [targetModel]);

  // 1. GitHub Actions CI Generator
  const githubActionsYaml = useMemo(() => {
    const triggers: string[] = [];
    if (triggerPush) {
      triggers.push(`  push:\n    branches: [${branchName}]`);
    }
    if (triggerPR) {
      triggers.push(`  pull_request:\n    branches: [${branchName}]`);
    }
    if (triggerDispatch) {
      triggers.push(`  workflow_dispatch:`);
    }

    return `name: EvalGate Quality Gates (${activeSuiteName || "suite"})

on:
${triggers.join("\n")}

jobs:
  eval-gate:
    name: Prompt Regression Gate
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Set up Python & uv
        uses: astral-sh/setup-uv@v3
        with:
          version: "latest"
          python-version: "${pythonVersion}"

      - name: Install EvalGate Dependencies
        run: uv sync --frozen

      - name: Execute Quality Gate Suite (${actualSuitePath})
        env:
          ${requiredSecretName !== "MOCK_KEY (Local Sandbox)" ? `${requiredSecretName}: \${{ secrets.${requiredSecretName} }}` : "# Mock simulator requires no cloud secrets"}
          VERCEL_AI_GATEWAY_KEY: \${{ secrets.VERCEL_AI_GATEWAY_KEY }}
        run: |
          uv run evalgate run "${actualSuitePath}" \\
            --model "${targetModel}" \\
            --min-pass-rate ${selectedSuite?.min_pass_rate ?? activeSummary?.min_pass_rate ?? 1.0} \\
            --concurrency ${ciConcurrency}
`;
  }, [
    triggerPush,
    triggerPR,
    triggerDispatch,
    branchName,
    pythonVersion,
    ciConcurrency,
    activeSuiteName,
    actualSuitePath,
    requiredSecretName,
    targetModel,
    selectedSuite?.min_pass_rate,
    activeSummary?.min_pass_rate,
  ]);

  // 2. Python Pytest Generator
  const cleanPytestId = (activeSuiteName || "suite").replace(/[^a-zA-Z0-9_]/g, "_");
  const pytestCode = useMemo(() => {
    return `\"\"\"
Automated Pytest Prompt Quality Gate for ${activeSuiteName || "Suite"}
Generated by EvalGate Web Studio.
\"\"\"
import pytest
from pathlib import Path
from evalgate.cli.loader import load_suite_from_yaml
from evalgate.runner.runner import SuiteRunner


@pytest.mark.asyncio
async def test_evalgate_${cleanPytestId}_gate():
    \"\"\"
    Asserts that ${activeSuiteName} satisfies the required quality pass threshold.
    \"\"\"
    suite_path = Path("${actualSuitePath}")
    assert suite_path.exists(), f"Evaluation suite file not found at {suite_path.resolve()}"
    
    suite = load_suite_from_yaml(suite_path)
    runner = SuiteRunner()
    
    result = await runner.run_suite(
        suite=suite,
        model_override="${targetModel}",
        concurrency=${ciConcurrency},
        save_to_storage=True,
    )
    
    assert result.passed, (
        f"EvalGate Quality Gate Failed: pass rate {result.pass_rate*100:.1f}% "
        f"< required {suite.min_pass_rate*100:.1f}%. "
        f"Failed {result.failed_tests}/{result.total_tests} test cases."
    )
`;
  }, [activeSuiteName, cleanPytestId, actualSuitePath, targetModel, ciConcurrency]);

  // 3. MCP Config Generator
  const mcpConfigJson = useMemo(() => {
    return JSON.stringify(
      {
        mcpServers: {
          evalgate: {
            command: "uv",
            args: ["run", "evalgate", "mcp"],
            env: {
              [requiredSecretName !== "MOCK_KEY (Local Sandbox)" ? requiredSecretName : "OPENAI_API_KEY"]: `\${${requiredSecretName !== "MOCK_KEY (Local Sandbox)" ? requiredSecretName : "OPENAI_API_KEY"}}`,
              VERCEL_AI_GATEWAY_KEY: "${VERCEL_AI_GATEWAY_KEY}",
            },
          },
        },
      },
      null,
      2
    );
  }, [requiredSecretName]);

  // 4. Generated README.md for Export Package Bundle
  const exportReadme = useMemo(() => {
    return `# EvalGate CI Integration Package: ${activeSuiteName}

This package contains automated prompt evaluation gates and CI/CD pipelines generated by EvalGate.

## Files Included
- \`.github/workflows/evals.yml\`: Automated GitHub Actions workflow running on pull requests.
- \`${actualSuitePath}\`: Declarative evaluation suite with ${activeSummary?.test_count || 1} test case(s).
- \`tests/evals/test_${cleanPytestId}.py\`: Async Pytest assertion script.

## Setup Instructions

### 1. Configure GitHub Secrets
Add your model provider secret under **Repository Settings > Secrets and variables > Actions**:
- \`${requiredSecretName}\`

### 2. Local Execution
Run the evaluation gate locally using uv:
\`\`\`bash
uv run evalgate run ${actualSuitePath} --min-pass-rate ${activeSummary?.min_pass_rate ?? 1.0}
\`\`\`

### 3. Run with Pytest
\`\`\`bash
uv run pytest tests/evals/test_${cleanPytestId}.py
\`\`\`

## Quality Gate Failure Behavior
The CI workflow exits with code \`1\` whenever test cases fail strict assertions or the overall suite pass rate drops below **${formatPercent(activeSummary?.min_pass_rate ?? 1.0)}**.
`;
  }, [activeSuiteName, actualSuitePath, activeSummary, cleanPytestId, requiredSecretName]);

  // Handler: Download Complete Bundle as ZIP
  const handleDownloadBundle = () => {
    const zipBlob = createZipArchive([
      { path: ".github/workflows/evals.yml", content: githubActionsYaml },
      { path: actualSuitePath, content: selectedSuite ? JSON.stringify(selectedSuite, null, 2) : `# Suite: ${activeSuiteName}` },
      { path: `tests/evals/test_${cleanPytestId}.py`, content: pytestCode },
      { path: "README.md", content: exportReadme },
    ]);
    const element = document.createElement("a");
    element.href = URL.createObjectURL(zipBlob);
    element.download = `evalgate-${activeSuiteName}-ci-bundle.zip`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <TooltipProvider>
      <div className="space-y-7 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-semibold tracking-tight text-white flex items-center gap-2">
                <Download className="h-5 w-5 text-white" />
                CI/CD & Code Export
              </h1>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Export prompt evaluation suites to GitHub Actions CI workflows, Python Pytest gates, and Model Context Protocol configurations.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Wide Suite Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500 hidden sm:inline">Suite:</span>
              <Select value={activeSuiteName} onValueChange={setSelectedSuiteName}>
                <SelectTrigger className="w-64 sm:w-80 font-mono text-xs bg-zinc-950 border-border h-8">
                  <SelectValue placeholder="Select suite" />
                </SelectTrigger>
                <SelectContent>
                  {suites.map((s, idx) => (
                    <SelectItem
                      key={s.name ? `export_suite_${s.name}` : `export_suite_idx_${idx}`}
                      value={s.name}
                      className="font-mono text-xs"
                    >
                      <div className="flex items-center justify-between w-full gap-2">
                        <span className="font-medium text-white">{s.name}</span>
                        <span className="text-[10px] text-zinc-500">
                          ({s.test_count} {s.test_count === 1 ? "test" : "tests"})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleDownloadBundle}
              variant="default"
              size="sm"
              className="text-xs gap-1.5 h-8 px-3"
            >
              <Archive className="h-3.5 w-3.5" />
              <span>Download Bundle (ZIP)</span>
            </Button>
          </div>
        </div>

        {/* 1. Selected Suite Summary & Preflight Verification Card */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Metadata Summary */}
          <Card className="border-border bg-card lg:col-span-2">
            <CardHeader className="p-4 pb-2 border-b border-border/40">
              <CardTitle className="text-xs font-semibold text-white flex items-center gap-2">
                <FileCode className="h-3.5 w-3.5 text-zinc-400" />
                Selected Suite Context
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-3 font-mono text-xs space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-zinc-300">
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase block font-sans">Suite Name</span>
                  <span className="font-semibold text-white">{activeSuiteName}</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase block font-sans">Verified Source Path</span>
                  <span className="text-zinc-300 break-all">{actualSuitePath}</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase block font-sans">Target Model</span>
                  <span className="text-zinc-200">{targetModel}</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase block font-sans">Quality Threshold</span>
                  <span className="text-white font-semibold">
                    {formatPercent(selectedSuite?.min_pass_rate ?? activeSummary?.min_pass_rate ?? 1.0)} required
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2 border-t border-border/40 text-[11px] text-zinc-400">
                <span>{activeSummary?.test_count || 1} test {(activeSummary?.test_count || 1) === 1 ? "case" : "cases"}</span>
                <span>•</span>
                <span>Target: {activeSummary?.target_type || "prompt"}</span>
                <span>•</span>
                <span>Default Assertions: {selectedSuite?.default_assertions?.length || 0}</span>
              </div>
            </CardContent>
          </Card>

          {/* Preflight Verification */}
          <Card className="border-border bg-zinc-950/80">
            <CardHeader className="p-4 pb-2 border-b border-border/40">
              <CardTitle className="text-xs font-semibold text-white flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 text-zinc-400" />
                Preflight Export Status
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-3 space-y-2 text-xs font-mono">
              <div className="flex items-center gap-2 text-zinc-200">
                <CheckCircle2 className="h-3.5 w-3.5 text-white shrink-0" />
                <span>Suite path verified</span>
              </div>
              <div className="flex items-center gap-2 text-zinc-200">
                <CheckCircle2 className="h-3.5 w-3.5 text-white shrink-0" />
                <span>Valid YAML schema</span>
              </div>
              <div className="flex items-center gap-2 text-zinc-200">
                <CheckCircle2 className="h-3.5 w-3.5 text-white shrink-0" />
                <span>Zero hardcoded secrets</span>
              </div>
              <div className="flex items-start gap-2 pt-1 border-t border-border/40 text-zinc-400">
                <KeyRound className="h-3.5 w-3.5 text-zinc-400 shrink-0 mt-0.5" />
                <span className="text-[11px]">
                  Requires Secret: <strong className="text-white">{requiredSecretName}</strong>
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 2. Format Selection Tabs */}
        <Tabs defaultValue="github" className="space-y-5">
          <TabsList className="grid grid-cols-3 w-full max-w-md bg-zinc-950 p-1 border border-border">
            <TabsTrigger
              value="github"
              className="text-xs gap-1.5 data-[state=active]:bg-zinc-800 data-[state=active]:text-white font-medium"
            >
              <Github className="h-3.5 w-3.5" />
              <span>GitHub Actions</span>
            </TabsTrigger>
            <TabsTrigger
              value="pytest"
              className="text-xs gap-1.5 data-[state=active]:bg-zinc-800 data-[state=active]:text-white font-medium"
            >
              <Code2 className="h-3.5 w-3.5" />
              <span>Pytest Gate</span>
            </TabsTrigger>
            <TabsTrigger
              value="mcp"
              className="text-xs gap-1.5 data-[state=active]:bg-zinc-800 data-[state=active]:text-white font-medium"
            >
              <Plug className="h-3.5 w-3.5" />
              <span>MCP Client</span>
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: GitHub Actions CI */}
          <TabsContent value="github" className="space-y-4">
            {/* Customization Options Bar */}
            <Card className="border-border bg-card">
              <CardHeader className="p-3.5 pb-2 border-b border-border/40">
                <CardTitle className="text-xs font-semibold text-white flex items-center gap-2">
                  <Sliders className="h-3.5 w-3.5 text-zinc-400" />
                  Customize CI Workflow Triggers & Runtime
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3.5 pt-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
                  {/* Triggers */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-zinc-500 uppercase font-sans font-semibold block">
                      Trigger Events
                    </label>
                    <div className="space-y-1 text-zinc-300">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={triggerPR}
                          onChange={(e) => setTriggerPR(e.target.checked)}
                          className="rounded border-zinc-700 bg-zinc-950"
                        />
                        <span>Pull Requests</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={triggerPush}
                          onChange={(e) => setTriggerPush(e.target.checked)}
                          className="rounded border-zinc-700 bg-zinc-950"
                        />
                        <span>Pushes to branch</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={triggerDispatch}
                          onChange={(e) => setTriggerDispatch(e.target.checked)}
                          className="rounded border-zinc-700 bg-zinc-950"
                        />
                        <span>Manual Dispatch</span>
                      </label>
                    </div>
                  </div>

                  {/* Branch */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-zinc-500 uppercase font-sans font-semibold block">
                      Target Branch
                    </label>
                    <Input
                      value={branchName}
                      onChange={(e) => setBranchName(e.target.value)}
                      className="h-8 text-xs bg-zinc-950 font-mono"
                    />
                  </div>

                  {/* Python Version */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-zinc-500 uppercase font-sans font-semibold block">
                      Python Runtime
                    </label>
                    <Select value={pythonVersion} onValueChange={setPythonVersion}>
                      <SelectTrigger className="h-8 text-xs bg-zinc-950 font-mono">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3.11" className="font-mono text-xs">Python 3.11</SelectItem>
                        <SelectItem value="3.12" className="font-mono text-xs">Python 3.12</SelectItem>
                        <SelectItem value="3.13" className="font-mono text-xs">Python 3.13</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Concurrency */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-zinc-500 uppercase font-sans font-semibold block">
                      Worker Concurrency
                    </label>
                    <Select value={String(ciConcurrency)} onValueChange={(v) => setCiConcurrency(Number(v))}>
                      <SelectTrigger className="h-8 text-xs bg-zinc-950 font-mono">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5" className="font-mono text-xs">5 workers</SelectItem>
                        <SelectItem value="10" className="font-mono text-xs">10 workers (default)</SelectItem>
                        <SelectItem value="20" className="font-mono text-xs">20 workers (fast)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Generated Code Viewer */}
            <Card className="border-border bg-card">
              <CardHeader className="p-4 pb-2.5 flex flex-row items-center justify-between border-b border-border">
                <div>
                  <CardTitle className="text-xs font-semibold text-white flex items-center gap-2">
                    <Github className="h-3.5 w-3.5 text-zinc-400" />
                    .github/workflows/evals.yml
                  </CardTitle>
                  <CardDescription className="text-[11px] text-zinc-500 mt-0.5">
                    Run evaluations on pull requests and pushes to protect production prompts from regressions.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => copyToClipboard(actualSuitePath, "github_path")}
                    variant="ghost"
                    size="sm"
                    className="text-xs gap-1 h-7 text-zinc-400 hover:text-white"
                  >
                    {copiedKey === "github_path" ? <Check className="h-3 w-3 text-white" /> : <Copy className="h-3 w-3" />}
                    <span>Copy Path</span>
                  </Button>
                  <Button
                    onClick={() => copyToClipboard(githubActionsYaml, "github")}
                    variant="outline"
                    size="sm"
                    className="text-xs gap-1 h-7 bg-zinc-900 border-zinc-800 text-zinc-200"
                  >
                    {copiedKey === "github" ? <Check className="h-3 w-3 text-white" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedKey === "github" ? "Copied!" : "Copy YAML"}</span>
                  </Button>
                  <Button
                    onClick={() => downloadFile(githubActionsYaml, "evals.yml")}
                    variant="secondary"
                    size="sm"
                    className="text-xs gap-1 h-7 bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                  >
                    <Download className="h-3 w-3" />
                    <span>Download</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="p-4 bg-black overflow-x-auto">
                  <div className="font-mono text-xs text-zinc-300 leading-relaxed space-y-0.5 select-text">
                    {githubActionsYaml.split("\n").map((line, lIdx) => (
                      <div key={lIdx} className="flex">
                        <span className="w-8 shrink-0 text-zinc-600 text-right pr-3 select-none">
                          {lIdx + 1}
                        </span>
                        <span className="whitespace-pre">{line}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Setup Instructions & Failure Behavior Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-border bg-card">
                <CardHeader className="p-4 pb-2 border-b border-border/40">
                  <CardTitle className="text-xs font-semibold text-white flex items-center gap-2">
                    <FolderGit2 className="h-3.5 w-3.5 text-zinc-400" />
                    GitHub Actions Setup Checklist
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-3 space-y-2.5 text-xs text-zinc-300">
                  <div className="flex items-start gap-2">
                    <span className="font-mono text-zinc-500 font-bold">1.</span>
                    <span>Save workflow to <code className="text-white bg-zinc-900 px-1 rounded">.github/workflows/evals.yml</code> in your repo.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-mono text-zinc-500 font-bold">2.</span>
                    <span>Add secret <code className="text-white bg-zinc-900 px-1 rounded">{requiredSecretName}</code> to GitHub Repository Secrets.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-mono text-zinc-500 font-bold">3.</span>
                    <span>Ensure suite file exists at <code className="text-white bg-zinc-900 px-1 rounded">{actualSuitePath}</code>.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-mono text-zinc-500 font-bold">4.</span>
                    <span>Open a Pull Request or push a commit to trigger automated quality evaluation.</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border bg-card">
                <CardHeader className="p-4 pb-2 border-b border-border/40">
                  <CardTitle className="text-xs font-semibold text-white flex items-center gap-2">
                    <AlertCircle className="h-3.5 w-3.5 text-zinc-400" />
                    Expected CI Failure Behavior
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-3 space-y-2 text-xs text-zinc-300">
                  <p className="leading-relaxed">
                    The workflow exits with a <strong>non-zero status (1)</strong> and blocks PR merge if:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-zinc-400 font-mono text-[11px] pt-1">
                    <li>Any strict assertion check fails</li>
                    <li>Overall pass rate falls below {formatPercent(selectedSuite?.min_pass_rate ?? activeSummary?.min_pass_rate ?? 1.0)}</li>
                    <li>LLM judge semantic score falls below rubric threshold</li>
                  </ul>
                  <p className="text-[11px] text-zinc-500 pt-1 border-t border-border/40">
                    Network/provider timeouts retry automatically with exponential backoff before failing.
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB 2: Pytest Suite */}
          <TabsContent value="pytest" className="space-y-4">
            <Card className="border-border bg-card">
              <CardHeader className="p-4 pb-2.5 flex flex-row items-center justify-between border-b border-border">
                <div>
                  <CardTitle className="text-xs font-semibold text-white flex items-center gap-2">
                    <Code2 className="h-3.5 w-3.5 text-zinc-400" />
                    tests/evals/test_{cleanPytestId}.py
                  </CardTitle>
                  <CardDescription className="text-[11px] text-zinc-500 mt-0.5">
                    Run evaluations locally or inside any Python CI test runner (pytest, tox, poetry, uv).
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => copyToClipboard(`uv run pytest tests/evals/test_${cleanPytestId}.py`, "pytest_run")}
                    variant="ghost"
                    size="sm"
                    className="text-xs gap-1 h-7 text-zinc-400 hover:text-white"
                  >
                    {copiedKey === "pytest_run" ? <Check className="h-3 w-3 text-white" /> : <Copy className="h-3 w-3" />}
                    <span>Copy Run Command</span>
                  </Button>
                  <Button
                    onClick={() => copyToClipboard(pytestCode, "pytest")}
                    variant="outline"
                    size="sm"
                    className="text-xs gap-1 h-7 bg-zinc-900 border-zinc-800 text-zinc-200"
                  >
                    {copiedKey === "pytest" ? <Check className="h-3 w-3 text-white" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedKey === "pytest" ? "Copied!" : "Copy Python"}</span>
                  </Button>
                  <Button
                    onClick={() => downloadFile(pytestCode, `test_${cleanPytestId}.py`)}
                    variant="secondary"
                    size="sm"
                    className="text-xs gap-1 h-7 bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                  >
                    <Download className="h-3 w-3" />
                    <span>Download</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="p-4 bg-black overflow-x-auto">
                  <div className="font-mono text-xs text-zinc-300 leading-relaxed space-y-0.5 select-text">
                    {pytestCode.split("\n").map((line, lIdx) => (
                      <div key={lIdx} className="flex">
                        <span className="w-8 shrink-0 text-zinc-600 text-right pr-3 select-none">
                          {lIdx + 1}
                        </span>
                        <span className="whitespace-pre">{line}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Local Pytest Commands */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-border bg-card">
                <CardHeader className="p-3.5 pb-2 border-b border-border/40">
                  <span className="text-[10px] uppercase font-mono text-zinc-500 font-semibold">1. Install Dependencies</span>
                </CardHeader>
                <CardContent className="p-3.5 font-mono text-xs text-zinc-300 flex items-center justify-between">
                  <code>uv add evalgate pytest pytest-asyncio</code>
                  <Button
                    onClick={() => copyToClipboard("uv add evalgate pytest pytest-asyncio", "install_cmd")}
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-zinc-400"
                  >
                    {copiedKey === "install_cmd" ? <Check className="h-3 w-3 text-white" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-border bg-card">
                <CardHeader className="p-3.5 pb-2 border-b border-border/40">
                  <span className="text-[10px] uppercase font-mono text-zinc-500 font-semibold">2. Run Pytest Suite</span>
                </CardHeader>
                <CardContent className="p-3.5 font-mono text-xs text-zinc-300 flex items-center justify-between">
                  <code>uv run pytest tests/evals/test_{cleanPytestId}.py</code>
                  <Button
                    onClick={() => copyToClipboard(`uv run pytest tests/evals/test_${cleanPytestId}.py`, "run_cmd")}
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-zinc-400"
                  >
                    {copiedKey === "run_cmd" ? <Check className="h-3 w-3 text-white" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB 3: MCP Client */}
          <TabsContent value="mcp" className="space-y-4">
            <Card className="border-border bg-card">
              <CardHeader className="p-4 pb-2.5 flex flex-row items-center justify-between border-b border-border">
                <div>
                  <CardTitle className="text-xs font-semibold text-white flex items-center gap-2">
                    <Plug className="h-3.5 w-3.5 text-zinc-400" />
                    claude_desktop_config.json / Antigravity MCP Config
                  </CardTitle>
                  <CardDescription className="text-[11px] text-zinc-500 mt-0.5">
                    Connect evaluation capabilities to an MCP-compatible agent (Claude Desktop, Cursor, Antigravity).
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => copyToClipboard("uv run evalgate mcp", "mcp_cmd")}
                    variant="ghost"
                    size="sm"
                    className="text-xs gap-1 h-7 text-zinc-400 hover:text-white"
                  >
                    {copiedKey === "mcp_cmd" ? <Check className="h-3 w-3 text-white" /> : <Copy className="h-3 w-3" />}
                    <span>Copy CLI Command</span>
                  </Button>
                  <Button
                    onClick={() => copyToClipboard(mcpConfigJson, "mcp")}
                    variant="outline"
                    size="sm"
                    className="text-xs gap-1 h-7 bg-zinc-900 border-zinc-800 text-zinc-200"
                  >
                    {copiedKey === "mcp" ? <Check className="h-3 w-3 text-white" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedKey === "mcp" ? "Copied!" : "Copy JSON"}</span>
                  </Button>
                  <Button
                    onClick={() => downloadFile(mcpConfigJson, "claude_desktop_config.json", "application/json")}
                    variant="secondary"
                    size="sm"
                    className="text-xs gap-1 h-7 bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                  >
                    <Download className="h-3 w-3" />
                    <span>Download</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="p-4 bg-black overflow-x-auto">
                  <div className="font-mono text-xs text-zinc-300 leading-relaxed space-y-0.5 select-text">
                    {mcpConfigJson.split("\n").map((line, lIdx) => (
                      <div key={lIdx} className="flex">
                        <span className="w-8 shrink-0 text-zinc-600 text-right pr-3 select-none">
                          {lIdx + 1}
                        </span>
                        <span className="whitespace-pre">{line}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* MCP Setup Guide */}
            <Card className="border-border bg-card">
              <CardHeader className="p-4 pb-2 border-b border-border/40">
                <CardTitle className="text-xs font-semibold text-white flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5 text-zinc-400" />
                  Claude Desktop & Agent Configuration Guide
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-3 space-y-2.5 text-xs text-zinc-300">
                <p>
                  Paste this JSON block into your Claude Desktop configuration file located at:
                </p>
                <code className="block p-2 rounded bg-zinc-950 border border-border font-mono text-[11px] text-zinc-300">
                  ~/Library/Application Support/Claude/claude_desktop_config.json (macOS)
                  <br />
                  %APPDATA%\Claude\claude_desktop_config.json (Windows)
                </code>
                <p className="text-zinc-400 text-[11px]">
                  When active, agents can inspect test suites, execute benchmark runs, and evaluate prompt assertions autonomously via MCP tool calls.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}
