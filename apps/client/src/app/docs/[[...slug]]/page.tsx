import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DOCS_PAGES } from "@/lib/docs-data";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronRight,
  ExternalLink,
  Github,
  Sparkles,
} from "lucide-react";

interface PageProps {
  params: Promise<{
    slug?: string[];
  }>;
}

const PAGE_ORDER = [
  { key: "index", label: "Overview & Quick Start", href: "/docs" },
  { key: "suites", label: "Test Suites & YAML Spec", href: "/docs/suites" },
  { key: "assertions", label: "Assertions & Quality Gates", href: "/docs/assertions" },
  { key: "playground", label: "Evaluation Workbench", href: "/docs/playground" },
  { key: "arena", label: "Model Arena Shootout", href: "/docs/arena" },
  { key: "analytics", label: "Historical Analytics", href: "/docs/analytics" },
  { key: "ci-cd", label: "CI/CD & GitHub Actions", href: "/docs/ci-cd" },
  { key: "api", label: "REST & WebSocket API", href: "/docs/api" },
];

export async function generateStaticParams() {
  return [
    { slug: [] },
    { slug: ["suites"] },
    { slug: ["assertions"] },
    { slug: ["playground"] },
    { slug: ["arena"] },
    { slug: ["analytics"] },
    { slug: ["ci-cd"] },
    { slug: ["api"] },
  ];
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { slug } = await props.params;
  const pageKey = !slug || slug.length === 0 ? "index" : slug.join("/");
  const page = DOCS_PAGES[pageKey];

  if (!page) {
    return {
      title: "Documentation",
    };
  }

  return {
    title: `${page.title} | EvalGate Docs`,
    description: page.description,
  };
}

export default async function DocPage(props: PageProps) {
  const { slug } = await props.params;
  const pageKey = !slug || slug.length === 0 ? "index" : slug.join("/");
  const page = DOCS_PAGES[pageKey];

  if (!page) {
    notFound();
  }

  const currentIndex = PAGE_ORDER.findIndex((p) => p.key === pageKey);
  const prevPage = currentIndex > 0 ? PAGE_ORDER[currentIndex - 1] : null;
  const nextPage = currentIndex < PAGE_ORDER.length - 1 ? PAGE_ORDER[currentIndex + 1] : null;

  return (
    <div className="flex gap-10">
      {/* Center Article Content */}
      <article className="flex-1 min-w-0 max-w-4xl space-y-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-mono">
          <Link href="/docs" className="hover:text-white transition-colors">
            Docs
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-zinc-600" />
          <span className="text-zinc-400">{page.category}</span>
          <ChevronRight className="h-3.5 w-3.5 text-zinc-600" />
          <span className="text-zinc-200 font-semibold truncate">{page.title}</span>
        </div>

        {/* Page Header */}
        <header className="space-y-3 border-b border-border/60 pb-6">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] font-mono border-zinc-800 text-zinc-400">
              {page.category}
            </Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {page.title}
          </h1>
          <p className="text-sm sm:text-base text-zinc-400 leading-relaxed">
            {page.description}
          </p>
        </header>

        {/* Page Body Content */}
        <div className="prose prose-invert max-w-none text-zinc-300">
          {page.content}
        </div>

        {/* Pagination Controls */}
        <div className="flex items-center justify-between gap-4 pt-8 border-t border-border/60">
          {prevPage ? (
            <Link href={prevPage.href} prefetch={true} className="group flex flex-col items-start gap-1">
              <span className="text-[11px] text-zinc-500 font-mono flex items-center gap-1 group-hover:text-zinc-300">
                <ArrowLeft className="h-3 w-3" />
                <span>Previous</span>
              </span>
              <span className="text-xs font-semibold text-zinc-300 group-hover:text-white">
                {prevPage.label}
              </span>
            </Link>
          ) : <div />}

          {nextPage ? (
            <Link href={nextPage.href} prefetch={true} className="group flex flex-col items-end gap-1">
              <span className="text-[11px] text-zinc-500 font-mono flex items-center gap-1 group-hover:text-zinc-300">
                <span>Next</span>
                <ArrowRight className="h-3 w-3" />
              </span>
              <span className="text-xs font-semibold text-zinc-300 group-hover:text-white">
                {nextPage.label}
              </span>
            </Link>
          ) : <div />}
        </div>
      </article>

      {/* Right Table of Contents (Desktop) */}
      <aside className="w-56 shrink-0 hidden xl:block sticky top-20 h-[calc(100vh-5rem)] overflow-y-auto space-y-4">
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-zinc-300 tracking-tight">
            On this page
          </h4>
          <nav className="space-y-1 text-xs">
            {page.toc.map((item) => (
              <a
                key={item.url}
                href={item.url}
                className="block text-zinc-400 hover:text-white transition-colors py-1 leading-snug"
                style={{ paddingLeft: `${(item.depth - 2) * 12}px` }}
              >
                {item.title}
              </a>
            ))}
          </nav>
        </div>

        <div className="pt-4 border-t border-border/40 space-y-2 text-xs">
          <a
            href="https://github.com/BraveRam/evalgate"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors"
          >
            <Github className="h-3.5 w-3.5" />
            <span>Edit on GitHub</span>
          </a>
        </div>
      </aside>
    </div>
  );
}
