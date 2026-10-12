/**
 * Single chat bubble for user or agent messages, including citation badges,
 * streaming cursor, and optional web-search offer.
 */

"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { CitationBadge } from "@/components/report/CitationBadge";
import { OutOfDomainCard } from "@/components/chat/OutOfDomainCard";
import { WebSearchOffer } from "@/components/chat/WebSearchOffer";
import { cn } from "@/lib/utils";
import type { ChatMessage as ChatMessageType } from "@/lib/types";

const SCAN_LINE_WIDTHS = [140, 180, 110] as const;

const IRRELEVANT_PHRASE = "I'm here to help you understand this report";

/** Agent-style bubble with scanning placeholder lines while waiting for tokens. */
export function ThinkingBubble() {
  return (
    <div className="flex justify-start">
      <div
        role="status"
        aria-label="Reading the report"
        aria-live="polite"
        className="max-w-[92%] rounded-md border border-border bg-surface px-3.5 py-3 text-sm leading-relaxed text-text-primary"
      >
        <div className="flex flex-col gap-2">
          {SCAN_LINE_WIDTHS.map((width) => (
            <div
              key={width}
              className="relative h-[10px] overflow-hidden rounded-[3px] bg-[#EDE9E2]"
              style={{ width }}
            >
              <div
                aria-hidden="true"
                className="absolute inset-0 animate-chat-scan bg-gradient-to-r from-transparent via-[#FDFCF9]/90 to-transparent"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * @param message - Chat message model.
 * @param isStreaming - When true, shows a cursor on an in-progress agent reply.
 * @param onSearchWeb - Handler for the not_in_report offer.
 * @param searchDisabled - Disables the offer button while loading.
 */
export function ChatMessage({
  message,
  isStreaming = false,
  onSearchWeb,
  searchDisabled = false,
}: {
  message: ChatMessageType;
  isStreaming?: boolean;
  onSearchWeb?: () => void;
  searchDisabled?: boolean;
}) {
  const isUser = message.role === "user";
  const isIrrelevant =
    !isUser &&
    !message.out_of_domain &&
    !message.not_in_report &&
    message.content.includes(IRRELEVANT_PHRASE);

  // Out-of-domain takes precedence over the web-search offer card.
  if (message.out_of_domain) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[92%]">
          <OutOfDomainCard message={message.content} />
        </div>
      </div>
    );
  }

  if (message.not_in_report) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[92%]">
          <WebSearchOffer
            message={message.content}
            onSearchWeb={() => onSearchWeb?.()}
            disabled={searchDisabled}
          />
        </div>
      </div>
    );
  }

  // Empty agent shell before first token — reuse the scanning bubble.
  if (!isUser && !message.content && isStreaming) {
    return <ThinkingBubble />;
  }

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[92%] rounded-md px-3.5 py-3 text-sm leading-relaxed",
          isUser
            ? "bg-text-primary text-white"
            : "border border-border bg-surface text-text-primary",
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : isIrrelevant ? (
          <p className="text-[13px] italic leading-[1.6] text-[#8A8A82]">
            {message.content}
          </p>
        ) : (
          <div className="text-[13px] leading-[1.6] text-text-primary sm:text-sm">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => (
                  <p className="mb-3 last:mb-0 leading-[1.6] text-text-primary">
                    {children}
                  </p>
                ),
                strong: ({ children }) => (
                  <strong className="font-semibold text-text-primary">
                    {children}
                  </strong>
                ),
                ul: ({ children }) => (
                  <ul className="my-2 list-disc space-y-1 pl-4 text-text-primary last:mb-0">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="my-2 list-decimal space-y-1 pl-4 text-text-primary last:mb-0">
                    {children}
                  </ol>
                ),
                li: ({ children }) => (
                  <li className="leading-[1.6] text-text-primary">{children}</li>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
            {isStreaming ? (
              <span
                aria-hidden="true"
                className="ml-0.5 inline-block h-4 w-px translate-y-0.5 animate-pulse bg-text-primary"
              />
            ) : null}
          </div>
        )}

        {!isUser &&
        !isIrrelevant &&
        message.citations &&
        message.citations.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {message.citations.map((citation, index) => (
              <CitationBadge
                key={`${citation.url}-${index}`}
                url={citation.url}
                title={citation.title}
                index={index + 1}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
