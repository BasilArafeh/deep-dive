/**
 * Dark filled research topic input with integrated arrow submit control.
 * Validates empty / short topics and exposes a disabled loading state.
 */

"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { ArrowRight, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

export type SearchInputHandle = {
  /** Programmatically set the topic and optionally submit. */
  fillAndSubmit: (topic: string) => void;
  focus: () => void;
};

/**
 * @param onSubmit - Called with a validated topic string.
 * @param disabled - Disables input and submit while research is starting.
 * @param className - Optional wrapper classes.
 */
export const SearchInput = forwardRef<
  SearchInputHandle,
  {
    onSubmit: (topic: string) => void;
    disabled?: boolean;
    className?: string;
  }
>(function SearchInput({ onSubmit, disabled = false, className }, ref) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue("");
    setError(null);
  }, []);

  const validateAndSubmit = (raw: string) => {
    const topic = raw.trim();
    if (!topic) {
      setError("Please enter a research topic.");
      return;
    }
    if (topic.length < 3) {
      setError("Topic must be at least 3 characters.");
      return;
    }
    setError(null);
    onSubmit(topic);
  };

  useImperativeHandle(ref, () => ({
    fillAndSubmit: (topic: string) => {
      setValue(topic);
      setError(null);
      validateAndSubmit(topic);
    },
    focus: () => inputRef.current?.focus(),
  }));

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (disabled) return;
    validateAndSubmit(value);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (!disabled) validateAndSubmit(value);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("w-full", className, "max-w-[680px]")}
    >
      <div
        className="flex h-14 w-full cursor-text items-stretch overflow-hidden rounded-lg bg-[#1A1A1A] shadow-none outline-none focus-within:outline focus-within:outline-1 focus-within:outline-[#444444]"
        onClick={() => inputRef.current?.focus()}
      >
        <label htmlFor="research-topic" className="sr-only">
          Research topic
        </label>
        <input
          ref={inputRef}
          id="research-topic"
          type="text"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            if (error) setError(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder="What do you want to understand?"
          disabled={disabled}
          autoComplete="off"
          className="h-full min-w-0 flex-1 border-0 bg-transparent py-0 pl-5 text-base leading-none text-white outline-none ring-0 placeholder:text-[#666666] focus:border-0 focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60"
        />
        <div
          aria-hidden="true"
          className="w-px shrink-0 self-stretch bg-[#2E2E2E]"
        />
        <button
          type="submit"
          disabled={disabled}
          aria-label={disabled ? "Starting research" : "Start research"}
          onClick={(event) => event.stopPropagation()}
          className="box-border flex size-14 shrink-0 items-center justify-center rounded-none rounded-r-lg border-0 !bg-[#1A1A1A] p-0 text-[#FFFFFF] shadow-none outline-none transition-colors hover:!bg-[#242424] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          {disabled ? (
            <Loader2
              className="size-4 animate-spin !text-[#FFFFFF]"
              stroke="#FFFFFF"
              aria-hidden="true"
            />
          ) : (
            <ArrowRight
              className="size-4 !text-[#FFFFFF]"
              stroke="#FFFFFF"
              aria-hidden="true"
            />
          )}
        </button>
      </div>
      {error ? (
        <p className="mt-2 text-sm text-[#b33a3a]" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
});
