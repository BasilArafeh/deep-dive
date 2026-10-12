/**
 * Manages the full research SSE lifecycle: timeline steps, session/report
 * capture, exponential-backoff reconnect (max 3), and navigation on complete.
 *
 * Returns steps, sessionId, report, error, isComplete, isConnecting, isRunning,
 * isReconnecting, and retry().
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { startResearch } from "@/lib/api";
import {
  parseHttpErrorCode,
  toastForHttpStatus,
  TOAST_SERVER,
} from "@/lib/errors";
import { normalizeReport, type AgentEvent, type Report, type TimelineStep } from "@/lib/types";
import { reportStorageKey, topicStorageKey } from "@/lib/utils";

const MAX_RECONNECTS = 3;

const INITIAL_STEPS: TimelineStep[] = [
  { id: "planning", label: "Planning research questions", status: "pending" },
  { id: "searching", label: "Searching the web and papers", status: "pending" },
  { id: "reading", label: "Reading sources", status: "pending" },
  { id: "summarizing", label: "Summarizing findings", status: "pending" },
  { id: "synthesizing", label: "Synthesizing the report", status: "pending" },
];

const EVENT_TO_STEP: Record<string, number> = {
  planning: 0,
  searching: 1,
  reading: 2,
  summarizing: 3,
  synthesizing: 4,
};

function applyStepEvent(
  steps: TimelineStep[],
  eventType: string,
  detail?: string,
): TimelineStep[] {
  const index = EVENT_TO_STEP[eventType];
  if (index === undefined) return steps;

  return steps.map((step, i) => {
    if (i < index) {
      return { ...step, status: "done" as const };
    }
    if (i === index) {
      return {
        ...step,
        status: "active" as const,
        detail: detail ?? step.detail,
      };
    }
    return step;
  });
}

/**
 * Run research for `topic` and drive the agent timeline until the report lands.
 */
export function useResearch(topic: string) {
  const router = useRouter();
  const [steps, setSteps] = useState<TimelineStep[]>(() =>
    INITIAL_STEPS.map((s) => ({ ...s })),
  );
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  const cleanupRef = useRef<(() => void) | null>(null);
  const reconnectAttemptRef = useRef(0);
  const finishedRef = useRef(false);
  const runningRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const topicRef = useRef(topic);
  const reconnectTimerRef = useRef<number | null>(null);

  topicRef.current = topic;

  const clearConnection = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
  }, []);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const persistAndNavigate = useCallback(
    (id: string, data: Report) => {
      const safe = normalizeReport(data);
      try {
        sessionStorage.setItem(reportStorageKey(id), JSON.stringify(safe));
        sessionStorage.setItem(topicStorageKey(id), topicRef.current);
      } catch {
        // Private browsing may block sessionStorage; still navigate.
      }
      router.push(`/report/${id}`);
    },
    [router],
  );

  const startStream = useCallback(() => {
    const currentTopic = topicRef.current.trim();
    if (!currentTopic) {
      setError("A research topic is required.");
      setIsConnecting(false);
      return;
    }
    if (runningRef.current) return;

    runningRef.current = true;
    finishedRef.current = false;
    setIsRunning(true);
    setIsConnecting(true);
    setError(null);

    const cleanup = startResearch(currentTopic, (event: AgentEvent) => {
      setIsConnecting(false);

      switch (event.type) {
        case "session_created":
          sessionIdRef.current = event.session_id;
          setSessionId(event.session_id);
          reconnectAttemptRef.current = 0;
          setIsReconnecting(false);
          break;
        case "planning":
        case "searching":
        case "reading":
        case "synthesizing":
          setSteps((prev) => applyStepEvent(prev, event.type, event.message));
          break;
        case "summarizing":
          // Backend emits summarizing when that node finishes, then runs
          // synthesizer without a separate SSE event — advance both steps.
          setSteps((prev) =>
            applyStepEvent(
              applyStepEvent(prev, "summarizing", event.message),
              "synthesizing",
              "Composing the final report…",
            ),
          );
          break;
        case "report":
          setSteps((prev) =>
            prev.map((step) => ({ ...step, status: "done" as const })),
          );
          setReport(normalizeReport(event.data));
          setIsComplete(true);
          finishedRef.current = true;
          runningRef.current = false;
          setIsRunning(false);
          setIsReconnecting(false);
          clearConnection();
          if (sessionIdRef.current) {
            persistAndNavigate(sessionIdRef.current, event.data);
          }
          break;
        case "done":
          finishedRef.current = true;
          runningRef.current = false;
          setIsRunning(false);
          setIsReconnecting(false);
          break;
        case "error": {
          runningRef.current = false;
          setIsRunning(false);

          const status = parseHttpErrorCode(event.message);
          if (status !== null) {
            toastForHttpStatus(status);
            finishedRef.current = true;
            setIsReconnecting(false);
            setIsConnecting(false);
            setError(
              status === 429
                ? "Too many requests right now. Please try again in a moment."
                : "We couldn't start this research run. Please try again.",
            );
            return;
          }

          if (event.message === "NETWORK_ERROR") {
            if (finishedRef.current) return;

            if (reconnectAttemptRef.current < MAX_RECONNECTS) {
              const attempt = reconnectAttemptRef.current;
              reconnectAttemptRef.current += 1;
              const delay = 1000 * 2 ** attempt;
              setIsReconnecting(true);
              setIsConnecting(true);
              clearReconnectTimer();
              reconnectTimerRef.current = window.setTimeout(() => {
                if (finishedRef.current) return;
                startStream();
              }, delay);
              return;
            }

            setIsReconnecting(false);
            setIsConnecting(false);
            setError(
              "The connection dropped repeatedly. Check your network and try again.",
            );
            return;
          }

          toast.error(TOAST_SERVER);
          finishedRef.current = true;
          setIsReconnecting(false);
          setError("Something went wrong while researching. Please try again.");
          break;
        }
        default:
          break;
      }
    });

    cleanupRef.current = cleanup;
  }, [clearConnection, clearReconnectTimer, persistAndNavigate]);

  useEffect(() => {
    reconnectAttemptRef.current = 0;
    finishedRef.current = false;
    runningRef.current = false;
    sessionIdRef.current = null;
    setSteps(INITIAL_STEPS.map((s) => ({ ...s })));
    setSessionId(null);
    setReport(null);
    setIsComplete(false);
    setIsReconnecting(false);
    setError(null);

    startStream();

    return () => {
      clearReconnectTimer();
      clearConnection();
      runningRef.current = false;
    };
  }, [topic, startStream, clearConnection, clearReconnectTimer]);

  const retry = useCallback(() => {
    clearReconnectTimer();
    clearConnection();
    runningRef.current = false;
    finishedRef.current = false;
    reconnectAttemptRef.current = 0;
    setIsReconnecting(false);
    setError(null);
    setSteps(INITIAL_STEPS.map((s) => ({ ...s })));
    setSessionId(null);
    sessionIdRef.current = null;
    setReport(null);
    setIsComplete(false);
    startStream();
  }, [clearConnection, clearReconnectTimer, startStream]);

  return {
    steps,
    sessionId,
    report,
    error,
    isComplete,
    isConnecting,
    isRunning,
    isReconnecting,
    retry,
  };
}
