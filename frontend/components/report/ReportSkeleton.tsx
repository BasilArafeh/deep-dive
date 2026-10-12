/**
 * Pulsing placeholder that mirrors the report layout while sessionStorage loads.
 */

"use client";

import { cn } from "@/lib/utils";

/**
 * @param className - Optional wrapper classes.
 */
export function ReportSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse space-y-8 p-6 sm:p-10", className)}
      aria-busy="true"
      aria-label="Loading report"
    >
      <div className="space-y-4">
        <div className="h-9 w-3/4 rounded-md bg-chip-bg" />
        <div className="h-0.5 w-10 bg-border-strong" />
      </div>
      <div className="space-y-3 rounded-md bg-summary p-5">
        <div className="h-4 w-full rounded bg-chip-bg" />
        <div className="h-4 w-11/12 rounded bg-chip-bg" />
        <div className="h-4 w-4/5 rounded bg-chip-bg" />
      </div>
      <div className="space-y-3">
        <div className="h-3 w-24 rounded bg-chip-bg" />
        <div className="h-4 w-full rounded bg-chip-bg" />
        <div className="h-4 w-5/6 rounded bg-chip-bg" />
        <div className="h-4 w-4/6 rounded bg-chip-bg" />
      </div>
      <div className="space-y-3">
        <div className="h-3 w-28 rounded bg-chip-bg" />
        <div className="h-4 w-full rounded bg-chip-bg" />
        <div className="h-4 w-11/12 rounded bg-chip-bg" />
        <div className="h-4 w-3/4 rounded bg-chip-bg" />
      </div>
      <div className="space-y-3 border-y border-border py-6">
        <div className="h-3 w-20 rounded bg-chip-bg" />
        <div className="h-4 w-full rounded bg-chip-bg" />
        <div className="h-4 w-full rounded bg-chip-bg" />
        <div className="h-4 w-5/6 rounded bg-chip-bg" />
        <div className="h-4 w-4/5 rounded bg-chip-bg" />
      </div>
      <div className="space-y-3">
        <div className="h-3 w-28 rounded bg-chip-bg" />
        <div className="h-4 w-full rounded bg-chip-bg" />
        <div className="h-4 w-5/6 rounded bg-chip-bg" />
        <div className="h-4 w-4/6 rounded bg-chip-bg" />
      </div>
      <div className="space-y-3">
        <div className="h-3 w-36 rounded bg-chip-bg" />
        <div className="h-4 w-full rounded bg-chip-bg" />
        <div className="h-4 w-3/4 rounded bg-chip-bg" />
      </div>
      <div className="space-y-3">
        <div className="h-3 w-28 rounded bg-chip-bg" />
        <div className="h-4 w-full rounded bg-chip-bg" />
        <div className="h-4 w-5/6 rounded bg-chip-bg" />
      </div>
      <div className="space-y-3">
        <div className="h-3 w-32 rounded bg-chip-bg" />
        <div className="h-4 w-full rounded bg-chip-bg" />
        <div className="h-4 w-4/5 rounded bg-chip-bg" />
      </div>
    </div>
  );
}
