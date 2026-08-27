"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Boxes,
  Download,
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
    <aside className="w-60 shrink-0 border-r border-border bg-card flex flex-col justify-between py-6 px-3">
      <div className="space-y-6">
        <div className="px-3">
          <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
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
                prefetch={true}
                className={cn(
                  "flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors",
                  isActive
                    ? "bg-zinc-800 text-white font-semibold"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-900"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={cn(
                      "h-4 w-4",
                      isActive ? "text-white" : "text-zinc-400"
                    )}
                  />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 font-mono">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Info Pill */}
      <div className="p-3 rounded-lg border border-border bg-zinc-950/80 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-zinc-200">Local-First Engine</span>
          <span className="h-1.5 w-1.5 rounded-full bg-white" />
        </div>
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          SQLite WAL storage with deterministic metrics & LLM-as-a-judge gates.
        </p>
      </div>
    </aside>
  );
}
