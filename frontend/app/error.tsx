/**
 * App-wide error boundary. Shows a friendly message and a retry control.
 * Does not expose technical details to the user.
 */

"use client";

import { useEffect, useRef } from "react";

import { Navbar } from "@/components/layout/Navbar";

/**
 * @param retry - Re-renders the failed segment (Next.js 16 recovery helper).
 */
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const retryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    console.error(error);
    retryRef.current?.focus();
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 py-16">
        <h1 className="text-3xl font-bold tracking-tight text-text-primary">
          Something went wrong
        </h1>
        <div aria-hidden="true" className="mt-5 h-0.5 w-10 bg-text-primary" />
        <p className="mt-6 text-base leading-relaxed text-text-secondary">
          We hit an unexpected problem. You can try again — your work should
          pick up where it left off.
        </p>
        <button
          ref={retryRef}
          type="button"
          onClick={() => retry()}
          className="mt-8 inline-flex h-11 min-h-11 w-fit items-center rounded-md bg-text-primary px-5 text-sm text-white transition-opacity hover:opacity-90"
        >
          Try again
        </button>
      </main>
    </div>
  );
}
