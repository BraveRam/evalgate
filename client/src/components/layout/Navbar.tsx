"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { ExternalLink, Github, Terminal } from "lucide-react";

export function Navbar() {
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

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center justify-between px-6">
        {/* Left: Brand */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-900 border border-zinc-700 text-white">
              <Terminal className="h-3.5 w-3.5" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold tracking-tight text-sm text-white">
                EvalGate
              </span>
              <Badge variant="outline" className="text-[10px] text-zinc-400 border-zinc-800 px-1.5 py-0">
                v{backendVersion}
              </Badge>
            </div>
          </Link>
        </div>

        {/* Right: Status & Actions */}
        <div className="flex items-center gap-4">
          {/* Status Indicator */}
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full border border-border bg-zinc-950 text-xs">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                backendStatus === "online"
                  ? "bg-white"
                  : backendStatus === "offline"
                  ? "bg-zinc-600"
                  : "bg-zinc-400 animate-pulse"
              }`}
            />
            <span className="text-zinc-400 text-[11px] font-mono">
              {backendStatus === "online" ? "API Connected" : backendStatus === "offline" ? "API Disconnected" : "Connecting..."}
            </span>
          </div>

          <a
            href="http://127.0.0.1:8000/docs"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-zinc-400 hover:text-white flex items-center gap-1.5 transition-colors"
          >
            <span>API Docs</span>
            <ExternalLink className="h-3 w-3 opacity-70" />
          </a>

          <a
            href="https://github.com/BraveRam/evalgate"
            target="_blank"
            rel="noreferrer"
            className="text-zinc-400 hover:text-white p-1 rounded-md transition-colors"
          >
            <Github className="h-4 w-4" />
          </a>
        </div>
      </div>
    </header>
  );
}
