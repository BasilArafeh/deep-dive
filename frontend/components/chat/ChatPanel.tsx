/**
 * Full-height chat column: header, scrollable message log, and underline input.
 */

"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { ArrowUp } from "lucide-react";

import { ChatMessage, ThinkingBubble } from "@/components/chat/ChatMessage";
import { cn } from "@/lib/utils";
import type { ChatMessage as ChatMessageType } from "@/lib/types";

/**
 * @param messages - Ordered chat transcript.
 * @param isLoading - True while an agent reply is streaming.
 * @param onSend - Sends a user question (or web-search follow-up).
 * @param className - Optional wrapper classes.
 */
export function ChatPanel({
  messages,
  isLoading,
  onSend,
  className,
}: {
  messages: ChatMessageType[];
  isLoading: boolean;
  onSend: (question: string, searchWeb?: boolean) => void;
  className?: string;
}) {
  const [value, setValue] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const wasLoadingRef = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (wasLoadingRef.current && !isLoading) {
      inputRef.current?.focus();
    }
    wasLoadingRef.current = isLoading;
  }, [isLoading]);

  const submit = () => {
    const question = value.trim();
    if (!question || isLoading) return;
    onSend(question, false);
    setValue("");
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  const lastAgentId =
    [...messages]
      .reverse()
      .find(
        (message) =>
          message.role === "agent" &&
          !message.not_in_report &&
          !message.out_of_domain,
      )?.id ?? null;

  // Show scanning bubble only before the first streamed token arrives.
  // If an empty agent shell already exists, ChatMessage renders the scanner.
  const hasStreamingStarted = messages.some(
    (message) =>
      message.role === "agent" &&
      !message.not_in_report &&
      message.content.length > 0,
  );
  const hasAgentShell = Boolean(lastAgentId);
  const showThinking = isLoading && !hasStreamingStarted && !hasAgentShell;

  return (
    <section
      className={cn("flex h-full min-h-0 flex-col bg-background", className)}
    >
      <header className="border-b border-border px-5 py-4">
        <h2 className="text-sm font-medium text-text-primary">Ask the report</h2>
        <p className="mt-1 text-xs text-text-secondary">
          Interrogate findings, citations, and open questions.
        </p>
      </header>

      <div
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5"
      >
        {messages.length === 0 && !showThinking ? (
          <div className="flex h-full min-h-48 items-center justify-center px-4 text-center">
            <p className="max-w-xs text-sm leading-relaxed text-text-secondary">
              Ask a question about this report — clarifications, sources, or
              what remains uncertain.
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              isStreaming={
                isLoading &&
                message.role === "agent" &&
                message.id === lastAgentId &&
                !message.not_in_report
              }
              searchDisabled={isLoading}
              onSearchWeb={() => {
                const priorUser = [...messages]
                  .reverse()
                  .find((item) => item.role === "user");
                if (priorUser) onSend(priorUser.content, true);
              }}
            />
          ))
        )}
        {showThinking ? <ThinkingBubble /> : null}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="border-t border-border px-4 py-4"
      >
        <div
          className={cn(
            "flex items-end gap-3 border-b-[1.5px] bg-transparent pb-2 transition-colors",
            value.trim() ? "border-text-primary" : "border-border-strong",
          )}
        >
          <label htmlFor="chat-question" className="sr-only">
            Ask a question about the report
          </label>
          <input
            ref={inputRef}
            id="chat-question"
            type="text"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder="Ask about this report…"
            aria-label="Ask a question about the report"
            className="min-h-11 w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted disabled:cursor-not-allowed disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={isLoading || !value.trim()}
            aria-label="Send message"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-text-primary text-white transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowUp className="size-4" aria-hidden="true" />
          </button>
        </div>
      </form>
    </section>
  );
}
