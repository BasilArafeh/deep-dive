/**
 * Vertical timeline of the five research agent stages.
 * Dot fill/size convey status in addition to color; container uses role="status".
 */

"use client";

import { cn } from "@/lib/utils";
import type { TimelineStep } from "@/lib/types";

/**
 * @param steps - Ordered timeline steps with pending/active/done status.
 * @param isReconnecting - Shows a subtle reconnect hint under the active step.
 * @param className - Optional wrapper classes.
 */
export function AgentTimeline({
  steps,
  isReconnecting = false,
  className,
}: {
  steps: TimelineStep[];
  isReconnecting?: boolean;
  className?: string;
}) {
  return (
    <ol
      role="status"
      aria-live="polite"
      aria-relevant="text"
      className={cn("w-full max-w-md", className)}
    >
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const isActive = step.status === "active";
        const isDone = step.status === "done";
        const isPending = step.status === "pending";

        return (
          <li key={step.id} className="relative flex gap-4 pb-4 last:pb-0">
            {!isLast ? (
              <span
                aria-hidden="true"
                className="absolute left-[7px] top-4 h-[calc(100%-0.25rem)] w-px bg-connector"
              />
            ) : null}

            <span className="relative z-10 mt-1 flex shrink-0 items-center justify-center">
              <span
                aria-hidden="true"
                className={cn(
                  "inline-block size-3.5 shrink-0 rounded-full border-2",
                  isPending && "border-border-strong bg-transparent",
                  // Active: solid #1A1A1A — pulse via .timeline-active-dot keyframes
                  isActive &&
                    "timeline-active-dot border-[#1A1A1A] bg-[#1A1A1A]",
                  // Green is only for completed steps
                  isDone && "border-success bg-success",
                )}
              />
              <span className="sr-only">
                {isDone ? "Completed" : isActive ? "In progress" : "Pending"}
              </span>
            </span>

            <div className="min-w-0 pt-0.5">
              <p
                className={cn(
                  "text-base leading-snug",
                  isPending && "font-normal text-text-muted",
                  (isActive || isDone) && "font-medium text-text-primary",
                )}
              >
                {step.label}
              </p>
              {step.detail ? (
                <p className="mt-1 text-sm text-text-secondary">{step.detail}</p>
              ) : null}
              {isActive && isReconnecting ? (
                <p className="mt-1 text-xs text-text-muted">
                  Reconnecting…
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
