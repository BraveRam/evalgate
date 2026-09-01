"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlignLeft, Github } from "lucide-react";
import { motion } from "framer-motion";

export interface TOCItem {
  title: string;
  url: string;
  depth: number;
}

export function DocsTOC({ items }: { items: TOCItem[] }) {
  const [activeId, setActiveId] = useState<string>(
    items[0]?.url.replace("#", "") || ""
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLElement>>(new Map());

  // Set up IntersectionObserver to update activeId on page scroll
  useEffect(() => {
    if (typeof window === "undefined" || items.length === 0) return;

    const headingIds = items.map((item) => item.url.replace("#", ""));
    const headingElements = headingIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    if (headingElements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Find visible headings
        const visibleEntries = entries.filter((e) => e.isIntersecting);
        if (visibleEntries.length > 0) {
          // Pick the first visible heading near the top of the viewport
          const topEntry = visibleEntries.reduce((prev, curr) =>
            curr.boundingClientRect.top < prev.boundingClientRect.top ? curr : prev
          );
          setActiveId(topEntry.target.id);
        } else {
          // If no heading is intersecting at the threshold, find the heading that passed top
          for (let i = headingElements.length - 1; i >= 0; i--) {
            const el = headingElements[i];
            const rect = el.getBoundingClientRect();
            if (rect.top <= 140) {
              setActiveId(el.id);
              break;
            }
          }
        }
      },
      {
        rootMargin: "-80px 0px -60% 0px",
        threshold: [0, 0.5, 1],
      }
    );

    headingElements.forEach((el) => observer.observe(el));

    // Also track scroll directly for quick micro-scrolls
    const handleScroll = () => {
      let currentActive = headingIds[0];
      for (const id of headingIds) {
        const el = document.getElementById(id);
        if (el) {
          const top = el.getBoundingClientRect().top;
          if (top <= 140) {
            currentActive = id;
          } else {
            break;
          }
        }
      }
      setActiveId(currentActive);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", handleScroll);
    };
  }, [items]);

  // Positions and measurements for the dynamic SVG branch line
  const [itemPositions, setItemPositions] = useState<
    Array<{ id: string; x: number; y: number; height: number; depth: number }>
  >([]);

  useEffect(() => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();

    const positions = items.map((item) => {
      const id = item.url.replace("#", "");
      const node = itemRefs.current.get(id);
      if (!node) {
        return {
          id,
          x: item.depth === 3 ? 20 : 8,
          y: 16,
          height: 28,
          depth: item.depth,
        };
      }
      const rect = node.getBoundingClientRect();
      const y = rect.top - containerRect.top + rect.height / 2;
      const x = item.depth === 3 ? 20 : 8;
      return {
        id,
        x,
        y,
        height: rect.height,
        depth: item.depth,
      };
    });

    setItemPositions(positions);
  }, [items]);

  // Generate SVG Path for the complete background branch line
  const backgroundPath = useMemo(() => {
    if (itemPositions.length <= 1) return "";
    let d = `M ${itemPositions[0].x} ${itemPositions[0].y}`;

    for (let i = 0; i < itemPositions.length - 1; i++) {
      const current = itemPositions[i];
      const next = itemPositions[i + 1];

      if (current.x === next.x) {
        d += ` L ${next.x} ${next.y}`;
      } else {
        const midY = (current.y + next.y) / 2;
        d += ` C ${current.x} ${midY}, ${next.x} ${midY}, ${next.x} ${next.y}`;
      }
    }
    return d;
  }, [itemPositions]);

  // Active item coordinates
  const activePosition = useMemo(() => {
    return itemPositions.find((p) => p.id === activeId) || itemPositions[0];
  }, [itemPositions, activeId]);

  const activeIndex = useMemo(() => {
    return itemPositions.findIndex((p) => p.id === activeId);
  }, [itemPositions, activeId]);

  // Active highlight curve path segment
  const activePathSegment = useMemo(() => {
    if (!activePosition || itemPositions.length === 0) return "";
    if (activeIndex === -1) return "";

    const current = itemPositions[activeIndex];
    const prev = activeIndex > 0 ? itemPositions[activeIndex - 1] : null;

    if (!prev) {
      return `M ${current.x} ${Math.max(0, current.y - 12)} L ${current.x} ${current.y + 12}`;
    }

    const midY = (prev.y + current.y) / 2;
    if (prev.x === current.x) {
      return `M ${prev.x} ${prev.y} L ${current.x} ${current.y}`;
    } else {
      return `M ${prev.x} ${prev.y} C ${prev.x} ${midY}, ${current.x} ${midY}, ${current.x} ${current.y}`;
    }
  }, [itemPositions, activePosition, activeIndex]);

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, url: string) => {
    e.preventDefault();
    const targetId = url.replace("#", "");
    const element = document.getElementById(targetId);
    if (element) {
      const offset = element.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top: offset, behavior: "smooth" });
      setActiveId(targetId);
      window.history.pushState(null, "", url);
    }
  };

  if (items.length === 0) return null;

  return (
    <div className="space-y-4 text-xs select-none">
      {/* Header */}
      <div className="flex items-center gap-2 text-zinc-300 font-semibold tracking-tight">
        <AlignLeft className="h-3.5 w-3.5 text-zinc-400" />
        <span>On this page</span>
      </div>

      {/* Relative Container with SVG Track & Item List */}
      <div ref={containerRef} className="relative pl-6">
        {/* SVG Animated Branch Backbone Line */}
        {itemPositions.length > 0 && (
          <svg
            className="absolute left-0 top-0 w-8 h-full pointer-events-none overflow-visible"
            aria-hidden="true"
          >
            {/* Background connecting branch path */}
            <path
              d={backgroundPath}
              fill="none"
              stroke="#27272a"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Active highlight curve */}
            {activePathSegment && (
              <motion.path
                d={activePathSegment}
                fill="none"
                stroke="#fde047"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={false}
                animate={{ d: activePathSegment }}
                transition={{ type: "spring", stiffness: 350, damping: 30 }}
              />
            )}

            {/* Glowing animated cursor dot */}
            {activePosition && (
              <motion.g
                initial={false}
                animate={{
                  x: activePosition.x,
                  y: activePosition.y,
                }}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 32,
                }}
              >
                {/* Glow ring */}
                <circle r="6" fill="#fde047" opacity="0.25" />
                {/* Center dot */}
                <circle
                  r="3.5"
                  fill="#fde047"
                  stroke="#09090b"
                  strokeWidth="1.5"
                />
              </motion.g>
            )}
          </svg>
        )}

        {/* Heading Link List */}
        <nav className="space-y-2">
          {items.map((item) => {
            const id = item.url.replace("#", "");
            const isActive = activeId === id;
            const isNested = item.depth === 3;

            return (
              <div
                key={item.url}
                ref={(el) => {
                  if (el) itemRefs.current.set(id, el);
                  else itemRefs.current.delete(id);
                }}
                className={`transition-all ${isNested ? "pl-3.5" : "pl-0"}`}
              >
                <a
                  href={item.url}
                  onClick={(e) => handleLinkClick(e, item.url)}
                  className={`block py-1 leading-snug transition-colors font-medium ${
                    isActive
                      ? "text-yellow-300 font-semibold drop-shadow-[0_0_8px_rgba(253,224,71,0.3)]"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {item.title}
                </a>
              </div>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
