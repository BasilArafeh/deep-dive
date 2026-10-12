/**
 * Research mode — watches the agent timeline while the report is produced.
 */

"use client";

import { use, useEffect, useRef } from "react";
import Link from "next/link";

import { Navbar } from "@/components/layout/Navbar";
import { AgentTimeline } from "@/components/research/AgentTimeline";
import { useResearch } from "@/hooks/useResearch";

/**
 * @param searchParams - Promise resolving to the topic query string.
 */
export default function ResearchPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string | string[] }>;
}) {
  const params = use(searchParams);
  const rawTopic = params.topic;
  const topic = Array.isArray(rawTopic) ? (rawTopic[0] ?? "") : (rawTopic ?? "");
  const trimmedTopic = topic.trim();

  const { steps, error, isReconnecting, retry } = useResearch(trimmedTopic);
  const retryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (error) retryRef.current?.focus();
  }, [error]);

  if (!trimmedTopic) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Navbar className="border-transparent px-12" />
        <main className="flex w-full max-w-[640px] flex-1 flex-col px-12 py-16">
          <h1 className="text-[28px] font-semibold tracking-[-0.3px] text-text-primary">
            Missing research topic
          </h1>
          <div
            aria-hidden="true"
            className="mt-5 h-[2px] w-9 bg-text-primary"
          />
          <p className="mt-6 text-text-secondary">
            Start from the home page and enter a topic to research.
          </p>
          <Link
            href="/"
            className="mt-8 inline-flex min-h-11 items-center text-sm font-medium text-text-primary underline-offset-4 hover:underline"
          >
            Back to home
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar topic={trimmedTopic} className="border-transparent px-12" />
      {/* Left-aligned like landing — px-12 = 48px from the left edge. */}
      <main className="flex w-full max-w-[640px] flex-1 flex-col items-start px-12 pb-20 pt-16 text-left">
        <div className="w-full">
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.3px] text-text-primary">
            Researching your topic
          </h1>
          <div
            aria-hidden="true"
            className="mt-5 h-[2px] w-9 bg-text-primary"
          />
          <p className="mt-5 max-w-[420px] text-[15px] leading-[1.6] text-text-secondary">
            This usually takes one to two minutes. Stay on this page while the
            agent works.
          </p>
        </div>

        <AgentTimeline
          steps={steps}
          isReconnecting={isReconnecting}
          className="mt-10 w-full"
        />

        {error ? (
          <div className="mt-10 w-full max-w-[480px] rounded-md border border-border bg-surface px-5 py-5 text-left">
            <p className="text-sm leading-relaxed text-text-primary">{error}</p>
            <button
              ref={retryRef}
              type="button"
              onClick={retry}
              className="mt-4 inline-flex h-11 min-h-11 items-center rounded-md bg-text-primary px-5 text-sm text-white transition-opacity hover:opacity-90"
            >
              Retry
            </button>
          </div>
        ) : null}
      </main>
    </div>
  );
}
