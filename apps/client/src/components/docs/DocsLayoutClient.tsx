"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BarChart3,
  BookOpen,
  Boxes,
  Cpu,
  ExternalLink,
  Github,
  LayoutDashboard,
  Menu,
  Play,
  Rocket,
  Search,
  Server,
  ShieldCheck,
  Swords,
  Terminal,
  Workflow,
  X,
} from "lucide-react";

interface NavLinkItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

interface NavSection {
  title: string;
  items: NavLinkItem[];
}

const DOCS_NAV_SECTIONS: NavSection[] = [
  {
    title: "Getting Started",
    items: [
      {
        name: "Overview & Quick Start",
        href: "/docs",
        icon: Rocket,
      },
    ],
  },
  {
    title: "Core Concepts",
    items: [
      {
        name: "Test Suites & YAML Spec",
        href: "/docs/suites",
        icon: Boxes,
      },
      {
        name: "Assertions & Quality Gates",
        href: "/docs/assertions",
        icon: ShieldCheck,
      },
    ],
  },
  {
    title: "Studio Features",
    items: [
      {
        name: "Evaluation Workbench",
        href: "/docs/playground",
        icon: Play,
      },
      {
        name: "Model Arena Shootout",
        href: "/docs/arena",
        icon: Swords,
      },
      {
        name: "Historical Analytics",
        href: "/docs/analytics",
        icon: BarChart3,
      },
    ],
  },
  {
    title: "DevOps & Reference",
    items: [
      {
        name: "CI/CD & GitHub Actions",
        href: "/docs/ci-cd",
        icon: Workflow,
      },
      {
        name: "Model Context Protocol (MCP)",
        href: "/docs/mcp",
        icon: Cpu,
      },
      {
        name: "REST & WebSocket API",
        href: "/docs/api",
        icon: Server,
      },
      {
        name: "Open Source License",
        href: "/docs/license",
        icon: ShieldCheck,
      },
    ],
  },
];

export function DocsLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSections = DOCS_NAV_SECTIONS.map((sec) => ({
    ...sec,
    items: sec.items.filter(
      (item) =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sec.title.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter((sec) => sec.items.length > 0);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* 1. Docs Sticky Top Navbar */}
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border/80 bg-background/95 px-4 sm:px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        {/* Left: Mobile Toggle & Brand */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden h-8 w-8 p-0 text-zinc-400 hover:text-white"
            aria-label="Toggle Docs Menu"
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>

          <Link href="/docs" className="flex items-center gap-2.5 group">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-900 border border-zinc-700 text-white transition-colors group-hover:border-zinc-500">
              <Terminal className="h-3.5 w-3.5" />
            </div>
            <span className="font-semibold text-sm text-white tracking-tight">
              EvalGate Docs
            </span>
          </Link>
        </div>

        {/* Center: Search Filter */}
        <div className="hidden sm:flex items-center flex-1 max-w-sm mx-4">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documentation..."
              className="h-8 pl-8 pr-3 text-xs bg-zinc-950/80 border-border/80 focus-visible:ring-1 focus-visible:ring-zinc-600 placeholder:text-zinc-500"
            />
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/" prefetch={true}>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5 border-border bg-zinc-950/80 text-zinc-300 hover:text-white hover:bg-zinc-900"
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              <span>Back to Studio</span>
            </Button>
          </Link>

          <a
            href="https://github.com/BraveRam/evalgate"
            target="_blank"
            rel="noreferrer"
            className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
            title="GitHub Repository"
          >
            <Github className="h-4 w-4" />
          </a>
        </div>
      </header>

      {/* 2. Main Content Grid */}
      <div className="flex-1 max-w-7xl w-full mx-auto flex items-start">
        {/* Left Sidebar (Desktop) */}
        <aside className="w-64 shrink-0 border-r border-border/60 hidden md:block p-4 sticky top-14 self-start h-[calc(100vh-3.5rem)] overflow-y-auto">
          <nav className="space-y-6">
            {filteredSections.map((sec) => (
              <div key={sec.title} className="space-y-1.5">
                <h4 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider px-2">
                  {sec.title}
                </h4>
                <div className="space-y-0.5">
                  {sec.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        prefetch={true}
                        className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                          isActive
                            ? "bg-zinc-800 text-white font-semibold shadow-xs"
                            : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 top-14 z-50 bg-background/95 backdrop-blur-sm md:hidden p-4 overflow-y-auto border-b border-border">
            <div className="mb-4">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documentation..."
                className="h-9 text-xs bg-zinc-950 border-border"
              />
            </div>
            <nav className="space-y-6">
              {filteredSections.map((sec) => (
                <div key={sec.title} className="space-y-1.5">
                  <h4 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider px-2">
                    {sec.title}
                  </h4>
                  <div className="space-y-1">
                    {sec.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = pathname === item.href;

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                            isActive
                              ? "bg-zinc-800 text-white font-semibold"
                              : "text-zinc-400 hover:text-white hover:bg-zinc-900"
                          }`}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span>{item.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 p-4 sm:p-8 lg:p-10">{children}</main>
      </div>
    </div>
  );
}
