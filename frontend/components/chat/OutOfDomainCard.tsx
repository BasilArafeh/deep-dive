/**
 * Out-of-domain chat card.
 *
 * Shown when the user asks something unrelated to the current research topic.
 * Explains the mismatch and offers a path back to start a new research run.
 */

"use client";

import { useRouter } from "next/navigation";

/**
 * @param message - Explanation from the chat router that the question is out of scope.
 */
export function OutOfDomainCard({ message }: { message: string }) {
  const router = useRouter();

  return (
    <div className="rounded-lg border border-[#F0E0C0] bg-[#FFF8F0] px-[14px] py-3">
      <p className="text-[13px] leading-relaxed text-[#8B6914]">{message}</p>
      <button
        type="button"
        onClick={() => router.push("/")}
        className="mt-3 inline-flex h-9 items-center rounded-md border border-border-strong bg-white px-3 text-[13px] text-[#3A3A3A] transition-colors hover:border-text-primary"
      >
        Start new research
      </button>
    </div>
  );
}
