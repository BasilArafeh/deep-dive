/**
 * Numbered key finding with an inline citation badge.
 */

"use client";

import { CitationBadge } from "@/components/report/CitationBadge";
import type { Finding } from "@/lib/types";

/**
 * @param finding - Finding point and citation metadata.
 * @param index - 1-based display index.
 */
export function FindingItem({
  finding,
  index,
}: {
  finding: Finding;
  index: number;
}) {
  return (
    <li className="flex gap-3 text-base leading-relaxed text-text-primary">
      <span className="mt-0.5 w-6 shrink-0 text-sm italic text-text-muted">
        {index}.
      </span>
      <p className="min-w-0">
        <span>{finding.point}</span>{" "}
        <CitationBadge
          url={finding.citation_url}
          title={finding.citation_title}
          index={index}
          className="ml-1"
        />
      </p>
    </li>
  );
}
