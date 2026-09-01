"use client";

import * as React from "react";
import { Check, Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ThemeToggle() {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground"
        aria-label="Toggle theme"
      >
        <Sun className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground relative"
          aria-label="Toggle theme"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-popover border-border min-w-[120px]">
        <DropdownMenuItem
          onClick={() => setTheme("light")}
          className="flex items-center justify-between text-xs cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Sun className="h-3.5 w-3.5 text-amber-500" />
            <span>Light</span>
          </div>
          {theme === "light" && <Check className="h-3 w-3" />}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("dark")}
          className="flex items-center justify-between text-xs cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Moon className="h-3.5 w-3.5 text-sky-400" />
            <span>Dark</span>
          </div>
          {theme === "dark" && <Check className="h-3 w-3" />}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("system")}
          className="flex items-center justify-between text-xs cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Laptop className="h-3.5 w-3.5 text-zinc-400" />
            <span>System</span>
          </div>
          {theme === "system" && <Check className="h-3 w-3" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
