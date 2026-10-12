/**
 * Scrollable research report: executive summary, findings, academic context,
 * open questions, and collapsible sources.
 */

"use client";

import { FindingItem } from "@/components/report/FindingItem";
import { SourceList } from "@/components/report/SourceList";
import { cn } from "@/lib/utils";
import { normalizeReport, type Report } from "@/lib/types";

function ProseParagraphs({ text }: { text: string }) {
  const paragraphs = text
    .split(/\n\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <>
      {paragraphs.map((paragraph, index) => (
        <p
          key={index}
          className={cn(
            "text-base leading-relaxed text-text-primary",
            index > 0 && "mt-4",
          )}
        >
          {paragraph}
        </p>
      ))}
    </>
  );
}

/**
 * @param report - Structured report payload from the research agent.
 * @param className - Optional wrapper classes.
 */
export function ReportPanel({
  report,
  className,
}: {
  report: Report;
  className?: string;
}) {
  const safe = normalizeReport(report);
  const background = safe.background ?? "";
  const currentState = safe.current_state ?? "";
  const analysis = safe.analysis ?? "";
  const academicContext = safe.academic_context ?? "";
  const implications = safe.implications ?? "";

  return (
    <article
      className={cn(
        "print-report h-full overflow-y-auto bg-surface",
        className,
      )}
    >
      <div className="mx-auto max-w-3xl px-5 py-8 sm:px-10 sm:py-12">
        <header className="print-section mb-10">
          <h1 className="text-3xl font-bold tracking-[-0.3px] text-text-primary sm:text-4xl">
            {safe.title}
          </h1>
          <div
            aria-hidden="true"
            className="mt-5 h-[2px] w-9 bg-text-primary"
          />
        </header>

        <section className="print-section mb-10 border-l-2 border-text-primary bg-summary py-5 pl-5 pr-5">
          <h2 className="mb-3 text-[10px] font-medium uppercase tracking-[1px] text-text-muted">
            Executive summary
          </h2>
          <p className="text-lg leading-relaxed text-text-primary">
            {safe.executive_summary}
          </p>
        </section>

        {background.trim() ? (
          <section className="print-section mb-10">
            <h2 className="mb-4 text-[10px] font-medium uppercase tracking-[1px] text-text-muted">
              Background
            </h2>
            <ProseParagraphs text={background} />
          </section>
        ) : null}

        {currentState.trim() ? (
          <section className="print-section mb-10">
            <h2 className="mb-4 text-[10px] font-medium uppercase tracking-[1px] text-text-muted">
              Current state
            </h2>
            <ProseParagraphs text={currentState} />
          </section>
        ) : null}

        {analysis.trim() ? (
          <section className="print-section mb-10 border-y border-border py-8">
            <h2 className="mb-5 text-[10px] font-medium uppercase tracking-[1px] text-text-muted">
              Analysis
            </h2>
            <div className="text-[1.05rem] leading-[1.75] [&_p]:text-[1.05rem] [&_p]:leading-[1.75]">
              <ProseParagraphs text={analysis} />
            </div>
          </section>
        ) : null}

        <section className="print-section mb-10">
          <h2 className="mb-5 text-[10px] font-medium uppercase tracking-[1px] text-text-muted">
            Key findings
          </h2>
          <ol className="space-y-5">
            {safe.key_findings.map((finding, index) => (
              <FindingItem
                key={`${finding.citation_url}-${index}`}
                finding={finding}
                index={index + 1}
              />
            ))}
          </ol>
        </section>

        {academicContext.trim() ? (
          <section className="print-section mb-10">
            <h2 className="mb-4 text-[10px] font-medium uppercase tracking-[1px] text-text-muted">
              Academic context
            </h2>
            <ProseParagraphs text={academicContext} />
          </section>
        ) : null}

        {implications.trim() ? (
          <section className="print-section mb-10">
            <h2 className="mb-4 text-[10px] font-medium uppercase tracking-[1px] text-text-muted">
              Implications
            </h2>
            <ProseParagraphs text={implications} />
          </section>
        ) : null}

        <section className="print-section mb-10">
          <h2 className="mb-4 text-[10px] font-medium uppercase tracking-[1px] text-text-muted">
            Open questions
          </h2>
          <ul className="space-y-3">
            {safe.open_questions.map((question) => (
              <li
                key={question}
                className="flex gap-3 text-base leading-relaxed text-text-primary"
              >
                <span aria-hidden="true" className="text-text-muted">
                  —
                </span>
                <span>{question}</span>
              </li>
            ))}
          </ul>
        </section>

        <div className="print-section">
          <SourceList sources={safe.sources} />
        </div>
      </div>
    </article>
  );
}
