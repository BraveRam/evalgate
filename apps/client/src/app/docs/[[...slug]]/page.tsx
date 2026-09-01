import React from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  DocsPage,
  DocsTitle,
  DocsDescription,
  DocsBody,
} from "fumadocs-ui/page";
import { DOCS_PAGES } from "@/lib/docs-data";

interface PageProps {
  params: Promise<{
    slug?: string[];
  }>;
}

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

export default async function Page(props: PageProps) {
  const { slug } = await props.params;
  const pageKey = !slug || slug.length === 0 ? "index" : slug.join("/");
  const page = DOCS_PAGES[pageKey];

  if (!page) {
    notFound();
  }

  return (
    <DocsPage
      toc={page.toc}
      tableOfContent={{
        style: "clerk",
        single: false,
      }}
      breadcrumb={{
        enabled: true,
      }}
    >
      <DocsTitle className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
        {page.title}
      </DocsTitle>
      <DocsDescription className="text-sm sm:text-base text-zinc-400 mt-1">
        {page.description}
      </DocsDescription>
      <DocsBody className="mt-6 prose prose-invert max-w-none text-zinc-300">
        {page.content}
      </DocsBody>
    </DocsPage>
  );
}
