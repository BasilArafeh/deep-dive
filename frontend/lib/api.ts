/**
 * Client-side API helpers. Calls same-origin Next.js proxy routes so the
 * backend API key never ships to the browser.
 */

import type { AgentEvent, ChatEvent } from "@/lib/types";

/** HTTP failure from a proxy route, with status for toast mapping. */
export class ApiHttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiHttpError";
    this.status = status;
  }
}

async function consumeSseStream(
  response: Response,
  onEvent: (payload: unknown) => void,
  signal: AbortSignal,
): Promise<void> {
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { message?: string; error?: string };
      if (body.message) message = body.message;
      else if (body.error) message = body.error;
    } catch {
      // keep default message
    }
    throw new ApiHttpError(response.status, message);
  }

  if (!response.body) {
    throw new Error("No response body from server");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (!signal.aborted) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        for (const line of part.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const jsonText = trimmed.slice(5).trim();
          if (!jsonText) continue;
          try {
            onEvent(JSON.parse(jsonText) as unknown);
          } catch {
            // Skip malformed SSE payloads rather than crashing the stream.
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Start a research SSE stream via the Next.js proxy.
 * @returns Cleanup function that aborts the in-flight request.
 */
export function startResearch(
  topic: string,
  onEvent: (event: AgentEvent) => void,
): () => void {
  const controller = new AbortController();

  void (async () => {
    let sawTerminal = false;

    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
        signal: controller.signal,
      });

      await consumeSseStream(
        response,
        (payload) => {
          const event = payload as AgentEvent;
          if (
            event.type === "done" ||
            event.type === "report" ||
            event.type === "error"
          ) {
            sawTerminal = true;
          }
          onEvent(event);
        },
        controller.signal,
      );

      if (!controller.signal.aborted && !sawTerminal) {
        onEvent({ type: "error", message: "NETWORK_ERROR" });
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof ApiHttpError) {
        onEvent({ type: "error", message: `HTTP_${error.status}` });
        return;
      }
      onEvent({ type: "error", message: "NETWORK_ERROR" });
    }
  })();

  return () => controller.abort();
}

export type ChatRequestExtras = {
  report_topic?: string | null;
};

/**
 * Stream a chat answer via the Next.js proxy.
 * @returns Cleanup function that aborts the in-flight request.
 */
export function sendChatMessage(
  sessionId: string,
  question: string,
  searchWeb: boolean,
  onEvent: (event: ChatEvent) => void,
  extras: ChatRequestExtras = {},
): () => void {
  const controller = new AbortController();

  void (async () => {
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          question,
          search_web: searchWeb,
          report_topic: extras.report_topic ?? undefined,
        }),
        signal: controller.signal,
      });

      await consumeSseStream(
        response,
        (payload) => onEvent(payload as ChatEvent),
        controller.signal,
      );
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof ApiHttpError) {
        onEvent({ type: "error", message: `HTTP_${error.status}` });
        return;
      }
      onEvent({ type: "error", message: "NETWORK_ERROR" });
    }
  })();

  return () => controller.abort();
}
