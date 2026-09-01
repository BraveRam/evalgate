"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { api } from "@/lib/api";
import { BookOpen, ExternalLink, Github } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";

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
            className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors hidden sm:inline"
          >
            Studio
          </Link>
          <span className="text-xs text-muted-foreground/60 hidden sm:inline">/</span>
          <span className="text-xs font-semibold text-foreground truncate">{currentRouteName}</span>
        </div>
      </div>

      {/* Right: Status & Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2.5">
        {/* Status Indicator */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full border border-border bg-card text-xs">
          <span
            className={`h-1.5 w-1.5 rounded-full shrink-0 ${
              backendStatus === "online"
                ? "bg-emerald-500"
                : backendStatus === "offline"
                ? "bg-rose-500"
                : "bg-amber-500 animate-pulse"
            }`}
          />
          <span className="text-muted-foreground text-[10px] sm:text-[11px] font-mono whitespace-nowrap">
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

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Docs Link */}
        <Link
          href="/docs"
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-2 py-1 rounded hover:bg-accent transition-colors"
          title="Fumadocs Documentation"
        >
          <BookOpen className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Docs</span>
        </Link>

        {/* GitHub Repository */}
        <a
          href="https://github.com/BraveRam/evalgate"
          target="_blank"
          rel="noreferrer"
          className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-accent transition-colors"
          title="GitHub Repository"
        >
          <Github className="h-4 w-4" />
        </a>
      </div>
    </header>
  );
}
