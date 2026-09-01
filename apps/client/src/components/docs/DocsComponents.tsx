"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  ChevronDown,
  Copy,
  FileCode,
  Info,
  Lightbulb,
  ShieldCheck,
  Terminal,
} from "lucide-react";

import Prism from "prismjs";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-python";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-json";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-markdown";

// ==========================================
// 1. CodeTabs Component (with Active Indicator & Copy Button)
// ==========================================
export interface TabItem {
  label: string;
  language?: string;
  code: string;
  filename?: string;
}

function highlightSnippet(code: string, language?: string) {
  if (!code) return "";
  const lang = (language || "yaml").toLowerCase();
  const grammar =
    Prism.languages[lang] ||
    (lang === "yml" ? Prism.languages.yaml : null) ||
    (lang === "py" ? Prism.languages.python : null) ||
    (lang === "sh" || lang === "shell" ? Prism.languages.bash : null) ||
    (lang === "ts" || lang === "tsx" ? Prism.languages.typescript : null) ||
    (lang === "js" || lang === "jsx" ? Prism.languages.javascript : null) ||
    Prism.languages.yaml ||
    Prism.languages.plain;

  try {
    return Prism.highlight(code, grammar, lang);
  } catch {
    return code;
  }
}

export function CodeTabs({ tabs }: { tabs: TabItem[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isCopied, setIsCopied] = useState(false);

  const activeTab = tabs[activeIndex] || tabs[0];

  const highlightedHtml = React.useMemo(() => {
    return highlightSnippet(activeTab.code, activeTab.language);
  }, [activeTab.code, activeTab.language]);

  const handleCopy = () => {
    if (activeTab?.code) {
      navigator.clipboard.writeText(activeTab.code);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-zinc-950 overflow-hidden my-4 shadow-sm">
      {/* Tab Navigation Header */}
      <div className="flex items-center justify-between bg-zinc-900/90 border-b border-border px-2 py-1.5 gap-2">
        {/* Tab Buttons */}
        <div className="flex items-center gap-1 overflow-x-auto">
          {tabs.map((tab, idx) => {
            const isActive = idx === activeIndex;
            return (
              <button
                key={tab.label}
                onClick={() => setActiveIndex(idx)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono transition-all cursor-pointer ${
                  isActive
                    ? "bg-zinc-800 text-white font-semibold shadow-xs border border-zinc-700"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 border border-transparent"
                }`}
              >
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Controls: Language Badge & Copy Button */}
        <div className="flex items-center gap-2 shrink-0">
          {activeTab.language && (
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider hidden sm:inline">
              {activeTab.language}
            </span>
          )}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800 transition-colors cursor-pointer"
            title="Copy code snippet"
          >
            {isCopied ? (
              <>
                <Check className="h-3 w-3 text-white" />
                <span className="text-white">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Code Content */}
      <div className="p-4 overflow-x-auto bg-black/60">
        <pre
          className="font-mono text-xs text-zinc-200 whitespace-pre leading-relaxed"
          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
        />
      </div>
    </div>
  );
}

// ==========================================
// 2. Standalone CodeBlock (with Copy Button & Header)
// ==========================================
export function CodeBlock({
  code,
  language = "yaml",
  filename,
}: {
  code: string;
  language?: string;
  filename?: string;
}) {
  const [isCopied, setIsCopied] = useState(false);

  const highlightedHtml = React.useMemo(() => {
    return highlightSnippet(code, language);
  }, [code, language]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="rounded-lg border border-border bg-zinc-950 overflow-hidden my-4 shadow-sm">
      <div className="flex items-center justify-between bg-zinc-900/90 border-b border-border px-3 py-2 text-xs font-mono">
        <span className="text-zinc-300 font-semibold flex items-center gap-1.5">
          <FileCode className="h-3.5 w-3.5 text-zinc-400" />
          {filename || language?.toUpperCase() || "SNIPPET"}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800 transition-colors cursor-pointer"
        >
          {isCopied ? (
            <>
              <Check className="h-3 w-3 text-white" />
              <span className="text-white">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="p-4 overflow-x-auto bg-black/60">
        <pre
          className="font-mono text-xs text-zinc-200 whitespace-pre leading-relaxed"
          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
        />
      </div>
    </div>
  );
}

// ==========================================
// 3. Callout Component
// ==========================================
export function Callout({
  type = "info",
  title,
  children,
}: {
  type?: "info" | "warning" | "error" | "idea" | "success";
  title?: string;
  children: React.ReactNode;
}) {
  const config = {
    info: {
      icon: Info,
      border: "border-border",
      bg: "bg-zinc-950/80",
      text: "text-zinc-300",
    },
    idea: {
      icon: Lightbulb,
      border: "border-border",
      bg: "bg-zinc-950/80",
      text: "text-zinc-300",
    },
    warning: {
      icon: AlertTriangle,
      border: "border-border",
      bg: "bg-zinc-950/80",
      text: "text-zinc-300",
    },
    error: {
      icon: AlertCircle,
      border: "border-border",
      bg: "bg-zinc-950/80",
      text: "text-zinc-300",
    },
    success: {
      icon: ShieldCheck,
      border: "border-border",
      bg: "bg-zinc-950/80",
      text: "text-zinc-300",
    },
  }[type];

  const Icon = config.icon;

  return (
    <div className={`p-4 rounded-lg border ${config.border} ${config.bg} space-y-1.5 my-4`}>
      {title && (
        <div className="flex items-center gap-2 font-semibold text-xs text-white">
          <Icon className="h-4 w-4 text-zinc-400 shrink-0" />
          <span>{title}</span>
        </div>
      )}
      <div className={`text-xs ${config.text} leading-relaxed`}>{children}</div>
    </div>
  );
}

// ==========================================
// 4. Steps & Step
// ==========================================
export function Steps({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6 my-6 border-l border-zinc-800 pl-6 ml-3">
      {children}
    </div>
  );
}

export function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative space-y-1.5">
      <div className="absolute -left-[37px] top-0 flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 border border-zinc-700 text-xs font-mono font-bold text-white shadow-xs">
        {number}
      </div>
      <h4 className="font-semibold text-sm text-white">{title}</h4>
      <div className="text-xs text-zinc-400 leading-relaxed">{children}</div>
    </div>
  );
}

// ==========================================
// 5. Cards & Card
// ==========================================
export function Cards({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 my-6">{children}</div>;
}

export function Card({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  icon?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      prefetch={true}
      className="group p-4 rounded-lg border border-border bg-zinc-950/80 hover:bg-zinc-900/90 hover:border-zinc-700 transition-all space-y-2 block"
    >
      <div className="flex items-center gap-2.5">
        {icon && (
          <div className="p-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300 group-hover:text-white transition-colors">
            {icon}
          </div>
        )}
        <h4 className="font-semibold text-xs text-white group-hover:text-zinc-100 transition-colors">
          {title}
        </h4>
      </div>
      <p className="text-xs text-zinc-400 leading-relaxed">{description}</p>
    </Link>
  );
}

// ==========================================
// 6. Accordions & Accordion
// ==========================================
export function Accordions({ children }: { children: React.ReactNode }) {
  return <div className="space-y-2 my-4">{children}</div>;
}

export function Accordion({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg border border-border bg-zinc-950/60 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3.5 text-xs font-semibold text-white hover:bg-zinc-900/60 transition-colors text-left"
      >
        <span>{title}</span>
        <ChevronDown
          className={`h-4 w-4 text-zinc-400 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-white" : ""
          }`}
        />
      </button>
      {isOpen && (
        <div className="p-4 pt-0 text-xs text-zinc-400 border-t border-border/40 mt-1 leading-relaxed">
          {children}
        </div>
      )}
    </div>
  );
}

// ==========================================
// 7. TypeTable Component
// ==========================================
export function TypeTable({
  type,
}: {
  type: Record<string, { type: string; default?: string; description: string }>;
}) {
  return (
    <div className="rounded-xl border border-border bg-zinc-950/90 overflow-hidden my-6 shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-border bg-zinc-900/90 text-[11px] font-mono text-zinc-400">
              <th className="py-3 px-4 font-semibold uppercase tracking-wider w-1/4">Property</th>
              <th className="py-3 px-4 font-semibold uppercase tracking-wider w-1/4">Type</th>
              <th className="py-3 px-4 font-semibold uppercase tracking-wider w-1/2">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {Object.entries(type).map(([propName, info]) => (
              <tr key={propName} className="hover:bg-zinc-900/50 transition-colors">
                <td className="py-3.5 px-4 font-mono align-top">
                  <span className="inline-block px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700/70 text-white font-semibold text-[11px]">
                    {propName}
                  </span>
                </td>
                <td className="py-3.5 px-4 font-mono align-top">
                  <span className="inline-block px-2 py-0.5 rounded bg-zinc-900/60 border border-zinc-800 text-zinc-300 text-[11px]">
                    {info.type}
                  </span>
                  {info.default && (
                    <span className="block text-[10px] text-zinc-500 font-mono mt-1">
                      default: {info.default}
                    </span>
                  )}
                </td>
                <td className="py-3.5 px-4 text-zinc-300 leading-relaxed text-xs align-top">
                  {info.description}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
