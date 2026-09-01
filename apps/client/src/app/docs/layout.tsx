import React from "react";
import type { Metadata } from "next";
import { RootProvider } from "fumadocs-ui/provider/next";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { DOCS_PAGE_TREE } from "@/lib/docs-data";
import { Terminal } from "lucide-react";

export const metadata: Metadata = {
  title: {
    default: "Documentation | EvalGate Studio",
    template: "%s | EvalGate Studio Docs",
  },
  description:
    "Comprehensive guide for EvalGate: Prompt evaluation, LLM-as-a-judge quality gates, benchmark shootouts, and CI/CD regression testing.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <RootProvider>
      <DocsLayout
        tree={DOCS_PAGE_TREE}
        nav={{
          title: (
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-zinc-900 border border-zinc-700 text-white">
                <Terminal className="h-3.5 w-3.5" />
              </div>
              <span className="font-semibold text-xs text-white">EvalGate Docs</span>
            </div>
          ),
          url: "/docs",
        }}
        sidebar={{
          defaultOpenLevel: 2,
        }}
      >
        {children}
      </DocsLayout>
    </RootProvider>
  );
}
