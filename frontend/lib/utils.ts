/** Shared class-name and text helpers used across the Deep Dive UI. */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import type { SourceSummary } from "@/lib/types";

/** Merge Tailwind class names without style conflicts. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Human-readable label for a source type badge. */
export function formatSourceType(sourceType: SourceSummary["source_type"]): string {
  return sourceType === "arxiv" ? "arXiv" : "Web";
}

/** Truncate long titles/URLs with an ellipsis. */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1))}…`;
}

export function reportStorageKey(sessionId: string): string {
  return `deep-dive-report-${sessionId}`;
}

export function topicStorageKey(sessionId: string): string {
  return `deep-dive-topic-${sessionId}`;
}

export function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
