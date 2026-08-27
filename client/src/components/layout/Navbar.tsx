"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { Activity, ExternalLink, Flame, Github, Terminal } from "lucide-react";

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
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="flex h-14 items-center justify-between px-6">
        {/* Left: Brand */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 group-hover:scale-105 transition-transform shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              <Flame className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-base text-foreground">
                Eval<span className="text-emerald-400">Gate</span>
              </span>
              <Badge variant="outline" className="text-[10px] text-muted-foreground border-border/80 px-1.5 py-0">
                STUDIO v{backendVersion}
              </Badge>
            </div>
          </Link>
        </div>

        {/* Right: Status & Actions */}
        <div className="flex items-center gap-3">
          {/* Live Status Pill */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-border/60 bg-card/40 text-xs">
            <span
              className={`h-2 w-2 rounded-full animate-pulse ${
                backendStatus === "online"
                  ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                  : backendStatus === "offline"
                  ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]"
                  : "bg-amber-400"
              }`}
            />
            <span className="text-muted-foreground text-[11px] font-mono">
              {backendStatus === "online" ? "API Online" : backendStatus === "offline" ? "API Offline" : "Connecting..."}
            </span>
          </div>

          <a
            href="http://127.0.0.1:8000/docs"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors px-2 py-1"
          >
            <Terminal className="h-3.5 w-3.5" />
            <span>API Docs</span>
            <ExternalLink className="h-3 w-3 opacity-60" />
          </a>

          <a
            href="https://github.com/BraveRam/evalgate"
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground hover:text-foreground p-2 rounded-md hover:bg-accent transition-colors"
          >
            <Github className="h-4 w-4" />
          </a>
        </div>
      </div>
    </header>
  );
}
