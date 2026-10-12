/**
 * Compact citation chip used in findings and chat answers.
 * Hover/focus reveals the source title in a tooltip.
 */

"use client";

import { cn, truncateText } from "@/lib/utils";

/**
 * @param url - Destination URL for the citation.
 * @param title - Source title shown in the tooltip and as accessible name.
 * @param index - Optional numeric index for numbered citations.
 * @param className - Optional extra classes.
 */
export function CitationBadge({
  url,
  title,
  index,
  className,
}: {
  url: string;
  title: string;
  index?: number;
  className?: string;
}) {
  const label = index !== undefined ? `[${index}]` : truncateText(title, 28);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      aria-label={`Source: ${title}`}
      className={cn(
        "group relative inline-flex max-w-full items-center rounded-sm bg-chip-bg px-1.5 py-0.5 align-baseline text-xs font-medium text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary",
        className,
      )}
    >
      <span className="truncate">{label}</span>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-max max-w-56 -translate-x-1/2 rounded-md border border-border bg-surface px-2 py-1 text-left text-xs font-normal text-text-primary group-hover:block group-focus-visible:block"
      >
        {title}
      </span>
    </a>
  );
}
