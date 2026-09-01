"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TOP_50_MODELS, MODEL_MAP, ModelInfo } from "@/lib/models-data";
import {
  Check,
  ChevronDown,
  Search,
  Plus,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchableModelSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  triggerClassName?: string;
  placeholder?: string;
  align?: "start" | "end" | "center";
}

export function SearchableModelSelect({
  value,
  onValueChange,
  className,
  triggerClassName,
  placeholder = "Select model...",
  align = "start",
}: SearchableModelSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [customInput, setCustomInput] = useState("");
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const customInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => searchInputRef.current?.focus(), 40);
    } else {
      setSearch("");
      setIsAddingCustom(false);
      setCustomInput("");
    }
  }, [open]);

  useEffect(() => {
    if (isAddingCustom) {
      setTimeout(() => customInputRef.current?.focus(), 40);
    }
  }, [isAddingCustom]);

  // Display name of current selected model
  const selectedDisplayName = useMemo(() => {
    const found = MODEL_MAP.get(value);
    if (found) return found.name;
    return value;
  }, [value]);

  // Filtered models list
  const filteredModels = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return TOP_50_MODELS;
    return TOP_50_MODELS.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        m.lab.toLowerCase().includes(q)
    );
  }, [search]);

  const handleSelect = (modelId: string) => {
    onValueChange(modelId);
    setOpen(false);
  };

  const handleSaveCustom = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = customInput.trim();
    if (trimmed) {
      onValueChange(trimmed);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "inline-flex items-center justify-between gap-2 h-8 px-3 rounded-md text-xs font-mono bg-zinc-900/60 border-0 hover:bg-zinc-800 transition-colors text-left text-zinc-100 outline-none focus-visible:ring-1 focus-visible:ring-zinc-600 truncate",
            triggerClassName
          )}
        >
          <span className="truncate font-normal">{selectedDisplayName || placeholder}</span>
          <ChevronDown className="h-3.5 w-3.5 text-zinc-400 shrink-0 opacity-80" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align={align}
        className={cn(
          "w-72 sm:w-80 p-0 bg-zinc-950/95 backdrop-blur-md border border-zinc-800 shadow-2xl rounded-lg text-zinc-200 overflow-hidden",
          className
        )}
      >
        {/* Instant Search Bar */}
        <div className="p-2 border-b border-zinc-800/80 bg-zinc-950 flex items-center gap-1.5">
          <Search className="h-3.5 w-3.5 text-zinc-500 shrink-0 ml-1" />
          <Input
            ref={searchInputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search 50 popular models..."
            className="h-7 text-xs font-mono bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-1 text-zinc-100 placeholder:text-zinc-500 shadow-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="text-zinc-500 hover:text-white p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Scrollable Models List */}
        <div className="max-h-64 overflow-y-auto p-1 divide-y divide-zinc-900/40">
          {filteredModels.length === 0 ? (
            <div className="p-4 text-center text-xs text-zinc-500 space-y-2">
              <p>No model found for &ldquo;{search}&rdquo;.</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleSelect(search.trim())}
                className="h-7 text-xs border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 gap-1"
              >
                <Plus className="h-3 w-3" />
                Use &ldquo;{search.trim()}&rdquo;
              </Button>
            </div>
          ) : (
            filteredModels.map((m) => {
              const isSelected = m.id === value;

              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleSelect(m.id)}
                  className={cn(
                    "w-full text-left px-2.5 py-2 rounded-md flex items-center justify-between gap-2 transition-colors text-xs font-mono",
                    isSelected
                      ? "bg-zinc-900 text-white font-medium"
                      : "hover:bg-zinc-900/70 text-zinc-300 hover:text-white"
                  )}
                >
                  <span className="truncate">{m.name}</span>
                  {isSelected && (
                    <Check className="h-3.5 w-3.5 text-white shrink-0" />
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Bottom Section: Custom Model Input */}
        <div className="p-2 border-t border-zinc-800/80 bg-zinc-950">
          {!isAddingCustom ? (
            <button
              type="button"
              onClick={() => setIsAddingCustom(true)}
              className="w-full text-left px-2.5 py-1.5 rounded-md flex items-center gap-2 text-xs font-mono text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
            >
              <Plus className="h-3.5 w-3.5 text-zinc-400" />
              <span>Custom Model Name...</span>
            </button>
          ) : (
            <form onSubmit={handleSaveCustom} className="flex items-center gap-1.5">
              <Input
                ref={customInputRef}
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder="e.g. provider/my-custom-model"
                className="h-7 text-xs font-mono bg-zinc-900 border-zinc-800 px-2"
              />
              <Button
                type="submit"
                size="sm"
                className="h-7 text-xs px-2.5 bg-white text-black hover:bg-zinc-200 shrink-0"
              >
                Set
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsAddingCustom(false)}
                className="h-7 w-7 p-0 text-zinc-400 hover:text-white shrink-0"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </form>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
