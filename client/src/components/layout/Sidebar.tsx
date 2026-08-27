"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Boxes,
  Compass,
  Download,
  Flame,
  LayoutDashboard,
  Play,
  Swords,
} from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    name: "Overview",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    name: "Playground",
    href: "/playground",
    icon: Play,
    badge: "Live",
  },
  {
    name: "Suites & Tests",
    href: "/suites",
    icon: Boxes,
  },
  {
    name: "Arena Shootout",
    href: "/arena",
    icon: Swords,
    badge: "A/B",
  },
  {
    name: "Analytics & Trends",
    href: "/analytics",
    icon: BarChart3,
  },
  {
    name: "CI/CD & Export",
    href: "/export",
    icon: Download,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 shrink-0 border-r border-border/60 bg-card/30 flex flex-col justify-between py-6 px-4">
      <div className="space-y-6">
        <div className="px-3">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Evaluation Suite
          </p>
        </div>

        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all group",
                  isActive
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={cn(
                      "h-4 w-4 transition-colors",
                      isActive
                        ? "text-emerald-400"
                        : "text-muted-foreground group-hover:text-foreground"
                    )}
                  />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-full font-mono font-medium",
                      isActive
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Info Pill */}
      <div className="p-3.5 rounded-xl border border-border/60 bg-card/60 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-foreground">Local-First Engine</span>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          SQLite WAL storage with deterministic metrics & LLM-as-a-judge gates.
        </p>
      </div>
    </aside>
  );
}
