/**
 * Top navigation bar shared across landing, research, and report screens.
 * Shows the DEEP DIVE logo, optional topic, and optional PDF action.
 */

"use client";

import Link from "next/link";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn, truncateText } from "@/lib/utils";

/**
 * @param topic - Optional research topic shown beside the logo (hidden on mobile).
 * @param showDownload - When true, renders the PDF download control.
 * @param className - Optional extra classes for the header element.
 */
export function Navbar({
  topic,
  showDownload = false,
  className,
}: {
  topic?: string;
  showDownload?: boolean;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "no-print flex h-14 items-center justify-between border-b border-border bg-background px-4 sm:px-8",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href="/"
          className="shrink-0 text-[12px] font-medium tracking-[3px] text-text-primary uppercase transition-opacity hover:opacity-70"
        >
          DEEP DIVE
        </Link>
        {topic ? (
          <>
            <span
              aria-hidden="true"
              className="hidden h-4 w-px bg-border-strong sm:block"
            />
            <p className="hidden min-w-0 truncate text-sm text-text-secondary sm:block">
              {truncateText(topic, 64)}
            </p>
          </>
        ) : null}
      </div>

      {showDownload ? (
        <Button
          type="button"
          variant="outline"
          className="h-11 min-h-11 gap-2 rounded-md border-border-strong bg-transparent px-3 text-sm text-text-primary hover:bg-chip-bg"
          onClick={() => window.print()}
          aria-label="Download report as PDF"
        >
          <Download className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Download report as PDF</span>
          <span className="sm:hidden">PDF</span>
        </Button>
      ) : (
        <p className="shrink-0 text-xs text-text-secondary">Research agent</p>
      )}
    </header>
  );
}
