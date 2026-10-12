/**
 * Manages report chat: message list, streaming agent replies, not_in_report
 * offers, loading state, and a mobile “new message” badge flag.
 *
 * @returns messages, isLoading, sendMessage, hasNewMessage, clearNewMessage
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { sendChatMessage } from "@/lib/api";
import {
  parseHttpErrorCode,
  toastForHttpStatus,
  TOAST_SERVER,
} from "@/lib/errors";
import { createId, reportStorageKey } from "@/lib/utils";
import {
  normalizeReport,
  type ChatEvent,
  type ChatMessage,
  type Report,
} from "@/lib/types";
import { toast } from "sonner";

/**
 * Load report_topic from the stored report title in sessionStorage.
 */
function loadReportTopic(sessionId: string): string {
  try {
    const raw = sessionStorage.getItem(reportStorageKey(sessionId));
    if (!raw) return "";
    const parsed = normalizeReport(JSON.parse(raw) as Report);
    return parsed.title?.trim() || "";
  } catch {
    return "";
  }
}

/**
 * Chat against an existing research session.
 * @param sessionId - Backend session id used for RAG / web search.
 * @param onAgentMessage - Optional callback when a new agent message arrives (for tab badges).
 */
export function useChat(sessionId: string, onAgentMessage?: () => void) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasNewMessage, setHasNewMessage] = useState(false);

  const cleanupRef = useRef<(() => void) | null>(null);
  const onAgentMessageRef = useRef(onAgentMessage);
  onAgentMessageRef.current = onAgentMessage;

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, []);

  const clearNewMessage = useCallback(() => {
    setHasNewMessage(false);
  }, []);

  const sendMessage = useCallback(
    (question: string, searchWeb = false) => {
      const trimmed = question.trim();
      if (trimmed.length < 1) return;
      if (!sessionId || isLoading) return;

      cleanupRef.current?.();

      const reportTopic = loadReportTopic(sessionId);

      const userMessage: ChatMessage = {
        id: createId("user"),
        role: "user",
        content: trimmed,
      };

      const agentId = createId("agent");
      let agentCreated = false;

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      const ensureAgentMessage = () => {
        if (agentCreated) return;
        agentCreated = true;
        setMessages((prev) => [
          ...prev,
          {
            id: agentId,
            role: "agent",
            content: "",
            citations: [],
          },
        ]);
      };

      const cleanup = sendChatMessage(
        sessionId,
        trimmed,
        searchWeb,
        (event: ChatEvent) => {
          switch (event.type) {
            case "chunk":
              ensureAgentMessage();
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === agentId
                    ? { ...msg, content: msg.content + event.content }
                    : msg,
                ),
              );
              break;
            case "citation":
              ensureAgentMessage();
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === agentId
                    ? {
                        ...msg,
                        citations: [
                          ...(msg.citations ?? []),
                          { url: event.url, title: event.title },
                        ],
                      }
                    : msg,
                ),
              );
              break;
            case "not_in_report":
              setMessages((prev) => [
                ...prev,
                {
                  id: createId("offer"),
                  role: "agent",
                  content: event.message,
                  not_in_report: true,
                  search_web: event.search_web,
                },
              ]);
              setHasNewMessage(true);
              onAgentMessageRef.current?.();
              break;
            case "out_of_domain":
              setMessages((prev) => [
                ...prev,
                {
                  id: createId("domain"),
                  role: "agent",
                  content: event.message,
                  not_in_report: true,
                  out_of_domain: true,
                },
              ]);
              setHasNewMessage(true);
              onAgentMessageRef.current?.();
              break;
            case "irrelevant":
              setMessages((prev) => [
                ...prev,
                {
                  id: createId("agent"),
                  role: "agent",
                  content: event.message,
                },
              ]);
              setHasNewMessage(true);
              onAgentMessageRef.current?.();
              break;
            case "done":
              setIsLoading(false);
              setHasNewMessage(true);
              onAgentMessageRef.current?.();
              cleanupRef.current = null;
              break;
            case "error": {
              setIsLoading(false);
              cleanupRef.current = null;
              const status = parseHttpErrorCode(event.message);
              if (status !== null) {
                toastForHttpStatus(status);
                break;
              }
              toast.error(TOAST_SERVER);
              break;
            }
            default:
              break;
          }
        },
        {
          report_topic: reportTopic,
        },
      );

      cleanupRef.current = cleanup;
    },
    [sessionId, isLoading],
  );

  return {
    messages,
    isLoading,
    sendMessage,
    hasNewMessage,
    clearNewMessage,
  };
}
