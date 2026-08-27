"use client";

import React, { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { SuiteConfig, SuiteSummary } from "@/types";
import {
  Check,
  Code2,
  Copy,
  Download,
  FileCode,
  Github,
  Plug,
  Terminal,
} from "lucide-react";

export default function ExportPage() {
  const [suites, setSuites] = useState<SuiteSummary[]>([]);
  const [selectedSuiteName, setSelectedSuiteName] = useState<string>("");
  const [selectedSuite, setSelectedSuite] = useState<SuiteConfig | null>(null);
  const [copiedTab, setCopiedTab] = useState<string | null>(null);

  useEffect(() => {
    const loadSuites = async () => {
      try {
        const list = await api.listSuites();
        setSuites(list);
        if (list.length > 0) setSelectedSuiteName(list[0].name);
      } catch {
        // ignore
      }
    };
    loadSuites();
  }, []);

  useEffect(() => {
    if (!selectedSuiteName) return;
    api.getSuite(selectedSuiteName).then(setSelectedSuite).catch(() => {});
  }, [selectedSuiteName]);

  const copyToClipboard = (text: string, tabKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTab(tabKey);
    setTimeout(() => setCopiedTab(null), 2000);
  };

  const downloadFile = (content: string, filename: string) => {
    const element = document.createElement("a");
    const file = new Blob([content], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const suitePath = selectedSuiteName ? `evals/${selectedSuiteName}.yaml` : "evals/rag_qa.yaml";

  // 1. GitHub Actions CI
  const githubActionsYaml = `name: EvalGate Prompt Quality Gates

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  eval-gate:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Set up Python & uv
        uses: astral-sh/setup-uv@v3
        with:
          version: "latest"

      - name: Install EvalGate
        run: uv sync --frozen

      - name: Run Quality Gate Suite (${selectedSuiteName || "rag-qa"})
        env:
          VERCEL_AI_GATEWAY_KEY: \${{ secrets.VERCEL_AI_GATEWAY_KEY }}
          OPENAI_API_KEY: \${{ secrets.OPENAI_API_KEY }}
        run: |
          uv run evalgate run ${suitePath} \\
            --model ${selectedSuite?.target.model || "openai/gpt-4o-mini"} \\
            --min-pass-rate ${selectedSuite?.min_pass_rate ?? 1.0} \\
            --concurrency 10
`;

  // 2. Python Pytest
  const pytestCode = `\"\"\"
Automated Pytest Prompt Regression Gate for ${selectedSuiteName || "Suite"}
\"\"\"
import pytest
from pathlib import Path
from evalgate.cli.loader import load_suite_from_yaml
from evalgate.runner.runner import SuiteRunner


@pytest.mark.asyncio
async def test_evalgate_${(selectedSuiteName || "suite").replace(/[^a-zA-Z0-9_]/g, "_")}_gate():
    suite_path = Path("${suitePath}")
    assert suite_path.exists(), f"Suite file not found at {suite_path}"
    
    suite = load_suite_from_yaml(suite_path)
    runner = SuiteRunner()
    
    result = await runner.run_suite(
        suite=suite,
        concurrency=10,
        save_to_storage=True,
    )
    
    assert result.passed, (
        f"EvalGate Quality Gate Failed: pass rate {result.pass_rate*100:.1f}% "
        f"< required {suite.min_pass_rate*100:.1f}%. "
        f"Failed {result.failed_tests}/{result.total_tests} test cases."
    )
`;

  // 3. MCP Config
  const mcpConfigJson = JSON.stringify(
    {
      mcpServers: {
        evalgate: {
          command: "uv",
          args: ["run", "evalgate", "mcp"],
          env: {
            VERCEL_AI_GATEWAY_KEY: "${VERCEL_AI_GATEWAY_KEY}",
            OPENAI_API_KEY: "${OPENAI_API_KEY}",
          },
        },
      },
    },
    null,
    2
  );

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Download className="h-6 w-6 text-emerald-400" />
            CI/CD & 1-Click Code Export
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Export evaluation suites to GitHub Actions CI workflows, Python Pytest suites, and Model Context Protocol configs.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedSuiteName} onValueChange={setSelectedSuiteName}>
            <SelectTrigger className="w-56 font-mono text-xs">
              <SelectValue placeholder="Select suite" />
            </SelectTrigger>
            <SelectContent>
              {suites.map((s) => (
                <SelectItem key={s.name} value={s.name} className="font-mono text-xs">
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabs of Export Targets */}
      <Tabs defaultValue="github" className="space-y-6">
        <TabsList className="grid grid-cols-3 w-full max-w-md bg-muted/40 p-1">
          <TabsTrigger value="github" className="text-xs gap-1.5">
            <Github className="h-3.5 w-3.5" />
            GitHub Actions
          </TabsTrigger>
          <TabsTrigger value="pytest" className="text-xs gap-1.5">
            <Code2 className="h-3.5 w-3.5" />
            Pytest Suite
          </TabsTrigger>
          <TabsTrigger value="mcp" className="text-xs gap-1.5">
            <Plug className="h-3.5 w-3.5" />
            MCP Client
          </TabsTrigger>
        </TabsList>

        {/* 1. GitHub Actions CI Tab */}
        <TabsContent value="github">
          <Card className="border-border/80">
            <CardHeader className="p-6 pb-3 flex flex-row items-center justify-between border-b border-border/40">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Github className="h-4 w-4 text-foreground" />
                  .github/workflows/evals.yml
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Automate prompt regression checks on every Pull Request.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => copyToClipboard(githubActionsYaml, "github")}
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1.5"
                >
                  {copiedTab === "github" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedTab === "github" ? "Copied!" : "Copy YAML"}
                </Button>
                <Button
                  onClick={() => downloadFile(githubActionsYaml, "evals.yml")}
                  variant="secondary"
                  size="sm"
                  className="text-xs gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <pre className="p-4 rounded-lg bg-black/50 border border-border/60 text-xs font-mono text-foreground whitespace-pre-wrap leading-relaxed overflow-x-auto">
                {githubActionsYaml}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 2. Pytest Suite Tab */}
        <TabsContent value="pytest">
          <Card className="border-border/80">
            <CardHeader className="p-6 pb-3 flex flex-row items-center justify-between border-b border-border/40">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Code2 className="h-4 w-4 text-emerald-400" />
                  tests/test_eval_gate.py
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Execute quality gate assertions inside standard Python pytest runs.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => copyToClipboard(pytestCode, "pytest")}
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1.5"
                >
                  {copiedTab === "pytest" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedTab === "pytest" ? "Copied!" : "Copy Python"}
                </Button>
                <Button
                  onClick={() => downloadFile(pytestCode, "test_eval_gate.py")}
                  variant="secondary"
                  size="sm"
                  className="text-xs gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <pre className="p-4 rounded-lg bg-black/50 border border-border/60 text-xs font-mono text-foreground whitespace-pre-wrap leading-relaxed overflow-x-auto">
                {pytestCode}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. MCP Config Tab */}
        <TabsContent value="mcp">
          <Card className="border-border/80">
            <CardHeader className="p-6 pb-3 flex flex-row items-center justify-between border-b border-border/40">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Plug className="h-4 w-4 text-purple-400" />
                  mcp_config.json
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Plug EvalGate MCP tools into Antigravity, Cursor, and Claude Desktop.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => copyToClipboard(mcpConfigJson, "mcp")}
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1.5"
                >
                  {copiedTab === "mcp" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedTab === "mcp" ? "Copied!" : "Copy JSON"}
                </Button>
                <Button
                  onClick={() => downloadFile(mcpConfigJson, "mcp_config.json")}
                  variant="secondary"
                  size="sm"
                  className="text-xs gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <pre className="p-4 rounded-lg bg-black/50 border border-border/60 text-xs font-mono text-foreground whitespace-pre-wrap leading-relaxed overflow-x-auto">
                {mcpConfigJson}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
