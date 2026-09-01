"use client";

import { useEffect } from "react";

/**
 * Sets document.title synchronously and maintains it to prevent browser tab flickering to localhost
 */
export function usePageTitle(title: string) {
  useEffect(() => {
    if (typeof document !== "undefined") {
      const fullTitle = title.includes("EvalGate Studio")
        ? title
        : `${title} | EvalGate Studio`;
      document.title = fullTitle;
    }
  }, [title]);
}
