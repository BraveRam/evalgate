"use client";

import React, { useMemo, useState } from "react";
import Prism from "prismjs";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-python";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-json";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-diff";
import { Check, Copy, FileCode } from "lucide-react";

export interface CodeViewerProps {
  code: string;
  language?: string;
  filename?: string;
  maxHeight?: string;
  className?: string;
  copyable?: boolean;
  header?: boolean;
  compact?: boolean;
  showLineNumbers?: boolean;
}

export function CodeViewer({
  code,
  language = "yaml",
  filename,
  maxHeight,
  className = "",
  copyable = true,
  header = true,
  compact = false,
  showLineNumbers = false,
}: CodeViewerProps) {
  const [isCopied, setIsCopied] = useState(false);

  const highlightedLines = useMemo(() => {
    if (!code) return [];
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
      const highlighted = Prism.highlight(code, grammar, lang);
      return highlighted.split("\n");
    } catch {
      return code.split("\n");
    }
  }, [code, language]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div
      className={`rounded-lg border border-border bg-zinc-950 overflow-hidden font-mono text-xs shadow-xs ${className}`}
    >
      {header && (
        <div
          className={`flex items-center justify-between bg-zinc-900/90 border-b border-border px-3 text-xs ${
            compact ? "py-1" : "py-1.5"
          }`}
        >
          <div className="flex items-center gap-2">
            <FileCode className="h-3.5 w-3.5 text-zinc-400" />
            <span className="text-zinc-300 font-semibold truncate">
              {filename || language.toUpperCase()}
            </span>
          </div>
          {copyable && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800 transition-colors cursor-pointer"
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
          )}
        </div>
      )}
      <div
        className={`overflow-x-auto bg-black/75 leading-relaxed font-mono ${
          compact ? "p-2.5" : "p-3.5"
        }`}
        style={maxHeight ? { maxHeight, overflowY: "auto" } : undefined}
      >
        <div className="text-zinc-200 text-xs space-y-0.5 select-text">
          {highlightedLines.map((lineHtml, lIdx) => (
            <div key={lIdx} className="flex hover:bg-zinc-900/40 rounded-xs">
              {showLineNumbers && (
                <span className="w-8 shrink-0 text-zinc-600 text-right pr-3 select-none text-[11px]">
                  {lIdx + 1}
                </span>
              )}
              <span
                className="whitespace-pre flex-1"
                dangerouslySetInnerHTML={{ __html: lineHtml || " " }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
