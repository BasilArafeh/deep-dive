/**
 * Report + chat screen. Loads the report from sessionStorage for the session.
 */

"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";

import { ChatPanel } from "@/components/chat/ChatPanel";
import { Navbar } from "@/components/layout/Navbar";
import { ReportPanel } from "@/components/report/ReportPanel";
import { ReportSkeleton } from "@/components/report/ReportSkeleton";
import { useChat } from "@/hooks/useChat";
import { normalizeReport, type Report } from "@/lib/types";
import { cn, reportStorageKey, topicStorageKey } from "@/lib/utils";

type MobileTab = "report" | "chat";

/**
 * @param params - Promise resolving to the dynamic session_id segment.
 */
export default function ReportPage({
  params,
}: {
  params: Promise<{ session_id: string }>;
}) {
  const { session_id: sessionId } = use(params);
  const [report, setReport] = useState<Report | null>(null);
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("report");
  const [showChatBadge, setShowChatBadge] = useState(false);

  const { messages, isLoading, sendMessage, hasNewMessage, clearNewMessage } =
    useChat(sessionId);

  useEffect(() => {
    let found: Report | null = null;
    let storedTopic = "";

    try {
      const raw = sessionStorage.getItem(reportStorageKey(sessionId));
      if (raw) {
        found = normalizeReport(JSON.parse(raw) as Report);
      }
      storedTopic = sessionStorage.getItem(topicStorageKey(sessionId)) ?? "";
    } catch {
      found = null;
    }

    if (!found) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setReport(found);
    setTopic(storedTopic || found.title);
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    if (report) {
      document.title = `${report.title} — Deep Dive`;
    }
  }, [report]);

  useEffect(() => {
    if (hasNewMessage && mobileTab === "report") {
      setShowChatBadge(true);
    }
  }, [hasNewMessage, mobileTab]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Navbar showDownload={false} />
        <div className="flex-1 bg-surface">
          <ReportSkeleton />
        </div>
      </div>
    );
  }

  if (notFound || !report) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Navbar />
        <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 py-16">
          <h1 className="text-2xl font-bold text-text-primary">
            Report not found
          </h1>
          <div aria-hidden="true" className="mt-5 h-0.5 w-10 bg-text-primary" />
          <p className="mt-6 text-base leading-relaxed text-text-secondary">
            This report isn&apos;t available in this browser session. Run the
            research again to generate a new one.
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
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <Navbar topic={topic} showDownload />

      <div className="no-print flex border-b border-border bg-background md:hidden">
        <button
          type="button"
          onClick={() => setMobileTab("report")}
          className={cn(
            "relative flex min-h-11 flex-1 items-center justify-center text-[13px]",
            mobileTab === "report"
              ? "font-semibold text-text-primary"
              : "font-normal text-[#8A8A82]",
          )}
        >
          Report
          {mobileTab === "report" ? (
            <span
              aria-hidden="true"
              className="absolute inset-x-6 bottom-0 h-0.5 bg-text-primary"
            />
          ) : null}
        </button>
        <button
          type="button"
          onClick={() => {
            setMobileTab("chat");
            setShowChatBadge(false);
            clearNewMessage();
          }}
          className={cn(
            "relative flex min-h-11 flex-1 items-center justify-center gap-2 text-[13px]",
            mobileTab === "chat"
              ? "font-semibold text-text-primary"
              : "font-normal text-[#8A8A82]",
          )}
        >
          Chat
          {showChatBadge && mobileTab !== "chat" ? (
            <span
              aria-label="New messages"
              className="size-[6px] rounded-full bg-[#1A1A1A]"
            />
          ) : null}
          {mobileTab === "chat" ? (
            <span
              aria-hidden="true"
              className="absolute inset-x-6 bottom-0 h-0.5 bg-text-primary"
            />
          ) : null}
        </button>
      </div>

      <div className="flex min-h-0 flex-1 bg-background">
        <div
          className={cn(
            "min-h-0 w-full bg-surface md:w-[60%] md:border-r md:border-border",
            mobileTab === "chat" ? "hidden md:block" : "block",
          )}
        >
          <ReportPanel report={report} className="h-full" />
        </div>
        <div
          className={cn(
            "no-print min-h-0 w-full bg-background md:w-[40%]",
            mobileTab === "report" ? "hidden md:block" : "block",
          )}
        >
          <ChatPanel
            messages={messages}
            isLoading={isLoading}
            onSend={sendMessage}
            className="h-full"
          />
        </div>
      </div>
    </div>
  );
}
