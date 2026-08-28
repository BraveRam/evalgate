"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  BarChart3,
  Boxes,
  Cpu,
  Download,
  LayoutDashboard,
  Play,
  Swords,
  Terminal,
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

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" className="border-r border-border bg-card">
      {/* Header with Brand & Logo */}
      <SidebarHeader className="border-b border-border p-3">
        <Link href="/" className="flex items-center gap-2.5 group overflow-hidden">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-900 border border-zinc-700 text-white transition-colors group-hover:border-zinc-500">
            <Terminal className="h-4 w-4" />
          </div>
          <div className="flex flex-col truncate group-data-[collapsible=icon]:hidden">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-xs text-white tracking-tight">
                EvalGate Studio
              </span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono truncate">
              Applied AI Evals
            </span>
          </div>
        </Link>
      </SidebarHeader>

      {/* Main Navigation Content */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.name}
                      size="default"
                      className={
                        isActive
                          ? "bg-zinc-800 text-white font-semibold shadow-sm"
                          : "text-zinc-400 hover:text-white hover:bg-zinc-900/80"
                      }
                    >
                      <Link href={item.href} prefetch={true} className="flex items-center gap-2.5">
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.name}</span>
                        {item.badge && (
                          <Badge
                            variant="outline"
                            className="ml-auto text-[9px] px-1 py-0 border-zinc-800 text-zinc-400 font-mono group-data-[collapsible=icon]:hidden"
                          >
                            {item.badge}
                          </Badge>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer Info Pill */}
      <SidebarFooter className="p-3 border-t border-border group-data-[collapsible=icon]:hidden">
        <div className="p-2.5 rounded-lg border border-border bg-zinc-950/90 space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-[11px] text-zinc-300 flex items-center gap-1.5">
              <Cpu className="h-3 w-3 text-zinc-400" />
              Local Engine
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
          </div>
          <p className="text-[10px] text-zinc-500 leading-tight">
            SQLite WAL + LangGraph Pipeline.
          </p>
        </div>
      </SidebarFooter>

      {/* Collapsible Rail Handle */}
      <SidebarRail />
    </Sidebar>
  );
}

// Named alias export for compatibility
export { AppSidebar as Sidebar };
