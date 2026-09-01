import React from "react";
import type { Metadata } from "next";
import { DocsLayoutClient } from "@/components/docs/DocsLayoutClient";

export const metadata: Metadata = {
  title: {
    default: "Documentation | EvalGate Studio",
    template: "%s | EvalGate Studio Docs",
  },
  description:
    "Comprehensive developer guide for local-first prompt evaluation, LLM-as-a-judge quality gates, benchmark shootouts, and CI/CD regression testing.",
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <DocsLayoutClient>{children}</DocsLayoutClient>;
}
