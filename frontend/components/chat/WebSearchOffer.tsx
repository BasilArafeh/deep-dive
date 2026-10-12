/**
 * Prompt shown when the answer is not found in the report.
 * Offers to retry the same question with live web search.
 */

"use client";

import { Globe } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * @param message - Explanation that the answer is outside the report.
 * @param onSearchWeb - Called when the user accepts web search.
 * @param disabled - Disables the action while another reply is streaming.
 */
export function WebSearchOffer({
  message,
  onSearchWeb,
  disabled = false,
}: {
  message: string;
  onSearchWeb: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-offer px-4 py-4">
      <p className="text-sm leading-relaxed text-text-primary">{message}</p>
      <Button
        type="button"
        disabled={disabled}
        onClick={onSearchWeb}
        className="mt-3 h-11 min-h-11 gap-2 rounded-md bg-text-primary px-4 text-sm text-white hover:opacity-90"
      >
        <Globe className="size-4" aria-hidden="true" />
        Search the web
      </Button>
    </div>
  );
}
