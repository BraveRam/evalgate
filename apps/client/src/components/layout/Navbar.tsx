"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { api } from "@/lib/api";
import { ExternalLink, Github } from "lucide-react";

const ROUTE_NAMES: Record<string, string> = {
  "/": "Overview",
  "/playground": "Prompt Playground",
  "/suites": "Suites & Test Matrix",
  "/arena": "Arena Shootout",
  "/analytics": "Analytics & Trends",
  "/export": "CI/CD Exporter",
};

export function Navbar() {
  const pathname = usePathname();
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline">("checking");
  const [backendVersion, setBackendVersion] = useState<string>("0.1.0");

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const data = await api.getHealth();
        if (data.status === "ok") {
          setBackendStatus("online");
          setBackendVersion(data.version || "0.1.0");
        } else {
          setBackendStatus("offline");
        }
      } catch {
        setBackendStatus("offline");
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  const currentRouteName = ROUTE_NAMES[pathname] || "Dashboard";

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-background/95 px-3 sm:px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Left: Sidebar Trigger & Breadcrumb */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <SidebarTrigger />
        <div className="h-4 w-px bg-border hidden sm:block" />
        <div className="flex items-center gap-1.5 min-w-0">
          <Link
            href="/"
            prefetch={true}
            className="text-xs font-medium text-zinc-400 hover:text-white transition-colors hidden sm:inline"
          >
            Studio
          </Link>
          <span className="text-xs text-zinc-600 hidden sm:inline">/</span>
          <span className="text-xs font-semibold text-white truncate">{currentRouteName}</span>
        </div>
      </div>

      {/* Right: Status & Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Status Indicator */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full border border-border bg-zinc-950 text-xs">
          <span
            className={`h-1.5 w-1.5 rounded-full shrink-0 ${
              backendStatus === "online"
                ? "bg-white"
                : backendStatus === "offline"
                ? "bg-zinc-600"
                : "bg-zinc-400 animate-pulse"
            }`}
          />
          <span className="text-zinc-400 text-[10px] sm:text-[11px] font-mono whitespace-nowrap">
            {backendStatus === "online" ? (
              <>
                <span className="hidden sm:inline">API </span>v{backendVersion}
              </>
            ) : backendStatus === "offline" ? (
              "Offline"
            ) : (
              "Connecting"
            )}
          </span>
        </div>

        {/* API Docs Link */}
        <a
          href="/docs"
          target="_blank"
          rel="noreferrer"
          className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 px-2 py-1 rounded hover:bg-zinc-900 transition-colors"
          title="Interactive API Documentation"
        >
          <span className="hidden md:inline">API Docs</span>
          <ExternalLink className="h-3 w-3 opacity-70" />
        </a>

        {/* GitHub Repository */}
        <a
          href="https://github.com/BraveRam/evalgate"
          target="_blank"
          rel="noreferrer"
          className="text-zinc-400 hover:text-white p-1.5 rounded-md hover:bg-zinc-900 transition-colors"
          title="GitHub Repository"
        >
          <Github className="h-4 w-4" />
        </a>
      </div>
    </header>
  );
}
