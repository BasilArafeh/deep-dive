/**
 * Collapsible list of report sources with type badges and truncated URLs.
 */

"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { cn, formatSourceType, truncateText } from "@/lib/utils";
import type { SourceSummary } from "@/lib/types";

/**
 * @param sources - Source summaries from the finished report.
 * @param className - Optional wrapper classes.
 */
export function SourceList({
  sources,
  className,
}: {
  sources: SourceSummary[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className={cn("border-t border-border pt-8", className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between gap-3 text-left"
      >
        <span className="text-[10px] font-medium uppercase tracking-[1px] text-text-muted">
          Sources ({sources.length})
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "size-4 text-text-secondary transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <ul className="mt-4 space-y-4">
          {sources.map((source) => (
            <li key={source.url} className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-text-primary underline-offset-2 hover:underline"
                >
                  {source.title || "Untitled source"}
                </a>
                <span className="rounded-sm bg-chip-bg px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-text-secondary">
                  {formatSourceType(source.source_type)}
                </span>
              </div>
              <p className="mt-1 truncate text-xs text-text-muted">
                {truncateText(source.url, 72)}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
