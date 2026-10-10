"use client";

import type { TOCItemType } from "fumadocs-core/toc";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type DocsTOCProps = {
  items: TOCItemType[];
};

// Right-rail table of contents with an active-heading tracker. Uses a single
// IntersectionObserver over the heading targets rather than scroll math.
export const DocsTOC = ({ items }: DocsTOCProps) => {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const ids = items.map((item) => item.url.replace(/^#/, ""));
    const headings = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => el !== null);
    if (headings.length === 0) return;

    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        // Highest heading in the trigger band wins.
        const firstVisible = headings.find((h) => visible.has(h.id));
        if (firstVisible) {
          setActiveId(firstVisible.id);
          return;
        }
        // Band empty: only fall back to Overview when we're actually above the
        // first heading. Mid-document — scrolling through a section body whose
        // heading has left the band before the next one enters — keep the
        // current section, so it doesn't flicker back to Overview in the gap.
        if (headings[0].getBoundingClientRect().top > 0) {
          setActiveId(null);
        }
      },
      { rootMargin: "0px 0px -70% 0px", threshold: 0 },
    );

    for (const heading of headings) observer.observe(heading);
    return () => observer.disconnect();
  }, [items]);

  if (items.length === 0) return null;

  const linkClass = (isActive: boolean, depth = 2) =>
    cn(
      "flex h-7 min-w-0 shrink-0 items-center text-sm transition-colors",
      depth >= 3 ? "pl-[26px]" : "pl-3.5",
      // The active entry draws its own 2px ink rule over the 1px rail.
      isActive
        ? "font-medium text-ink-primary shadow-[inset_2px_0_0_var(--color-ink-primary)]"
        : "text-ink-secondary hover:text-ink-primary",
    );

  return (
    <aside className="sticky top-13 hidden max-h-[calc(100dvh-4.25rem)] w-[260px] shrink-0 flex-col gap-3 self-start overflow-y-auto pt-[34px] pr-6 pb-8 pl-1 xl:flex">
      <p className="font-medium text-ink-primary text-sm">On this page</p>
      <nav className="flex flex-col shadow-[inset_1px_0_0_color-mix(in_oklab,var(--color-ink-primary)_10%,transparent)]">
        <a href="#overview" className={linkClass(activeId === null)}>
          <span className="truncate">Overview</span>
        </a>
        {items.map((item) => {
          const id = item.url.replace(/^#/, "");
          const isActive = activeId === id;
          return (
            // One line per entry: long headings truncate, the full text on hover.
            <a
              key={item.url}
              href={item.url}
              title={typeof item.title === "string" ? item.title : undefined}
              className={linkClass(isActive, item.depth)}
            >
              <span className="truncate">{item.title}</span>
            </a>
          );
        })}
      </nav>
    </aside>
  );
};
