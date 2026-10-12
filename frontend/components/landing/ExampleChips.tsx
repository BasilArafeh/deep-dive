/**
 * Example research topics shown as clickable chips under the landing search.
 * Selecting a chip fills the search input and submits immediately.
 */

"use client";

import { cn } from "@/lib/utils";

const EXAMPLES = [
  "AI in healthcare",
  "Transformer architecture",
  "Quantum computing",
] as const;

/**
 * @param onSelect - Invoked with the chip label when clicked.
 * @param disabled - Prevents interaction while research is starting.
 * @param className - Optional wrapper classes.
 */
export function ExampleChips({
  onSelect,
  disabled = false,
  className,
}: {
  onSelect: (topic: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {EXAMPLES.map((example) => (
        <button
          key={example}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(example)}
          className="rounded-[20px] border border-border-strong bg-transparent px-4 py-[6px] text-left text-[12px] leading-snug text-text-secondary transition-colors hover:border-text-primary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {example}
        </button>
      ))}
    </div>
  );
}
