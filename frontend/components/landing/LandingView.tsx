/**
 * Client landing composition: headline, search, and example chips.
 * Navigates to /research with the topic query param on submit.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { ExampleChips } from "@/components/landing/ExampleChips";
import {
  SearchInput,
  type SearchInputHandle,
} from "@/components/landing/SearchInput";
import { Navbar } from "@/components/layout/Navbar";

export function LandingView() {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);
  const searchRef = useRef<SearchInputHandle>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const startResearch = (topic: string) => {
    if (isStarting) return;
    setIsStarting(true);
    router.push(`/research?topic=${encodeURIComponent(topic)}`);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar className="border-transparent px-12" />
      <main className="flex w-full max-w-[640px] flex-1 flex-col px-12 pb-20 pt-20">
        <h1 className="text-[40px] font-extrabold leading-none tracking-[-2px] text-text-primary lg:text-[80px]">
          <span className="block font-extrabold">Research,</span>
          <span className="block font-normal italic text-text-secondary">
            clarified.
          </span>
        </h1>

        <div
          aria-hidden="true"
          className="mt-5 mb-5 h-[2px] w-10 bg-text-primary"
        />

        <p className="max-w-[420px] text-[15px] leading-[1.6] text-text-secondary">
          Type a topic. The agent searches, reads, and synthesizes the web into
          a structured brief — then lets you ask anything.
        </p>

        <SearchInput
          ref={searchRef}
          onSubmit={startResearch}
          disabled={isStarting}
          className="mt-8 max-w-[440px]"
        />

        <ExampleChips
          onSelect={(topic) => searchRef.current?.fillAndSubmit(topic)}
          disabled={isStarting}
          className="mt-4 max-w-[580px]"
        />
      </main>
    </div>
  );
}
