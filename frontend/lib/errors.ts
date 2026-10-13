/**
 * Maps internal/proxy error codes to user-facing toast copy.
 * Never surfaces raw backend or JavaScript error strings.
 */

import { toast } from "sonner";

export const TOAST_RATE_LIMIT =
  "Too many requests. Please wait a moment before trying again.";
export const TOAST_UNAUTHORIZED =
  "Authentication error. Please check your setup.";
export const TOAST_SERVER = "Something went wrong. Please try again.";

/**
 * Show a sonner toast for known HTTP status codes.
 * @returns true when a toast was shown for the status.
 */
export function toastForHttpStatus(status: number): boolean {
  if (status === 429) {
    toast.error(TOAST_RATE_LIMIT, { duration: 5000 });
    return true;
  }
  if (status === 401) {
    toast.error(TOAST_UNAUTHORIZED);
    return true;
  }
  if (status >= 500) {
    toast.error(TOAST_SERVER);
    return true;
  }
  return false;
}

/** Parse `HTTP_429`-style codes emitted by lib/api. */
export function parseHttpErrorCode(message: string): number | null {
  const match = /^HTTP_(\d{3})$/.exec(message);
  if (!match) return null;
  return Number(match[1]);
}
