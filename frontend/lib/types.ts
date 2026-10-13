/** All shared TypeScript types for the Deep Dive frontend. */

export type AgentEvent =
  | { type: "session_created"; session_id: string }
  | { type: "planning"; message: string }
  | { type: "searching"; message: string }
  | { type: "reading"; message: string }
  | { type: "summarizing"; message: string }
  | { type: "synthesizing"; message: string }
  | { type: "report"; data: Report }
  | { type: "done" }
  | { type: "error"; message: string };

export type ChatEvent =
  | { type: "chunk"; content: string }
  | { type: "citation"; url: string; title: string }
  | { type: "not_in_report"; message: string; search_web: boolean }
  | { type: "out_of_domain"; message: string }
  | { type: "irrelevant"; message: string }
  | { type: "done"; search_web: boolean }
  | { type: "error"; message: string };

export interface Finding {
  point: string;
  citation_url: string;
  citation_title: string;
}

export interface SourceSummary {
  url: string;
  title: string;
  source_type: "web" | "arxiv";
  summary: string;
}

export interface Report {
  title: string;
  executive_summary: string;
  /** Present on long-form reports; absent on older sessionStorage payloads. */
  background?: string;
  current_state?: string;
  analysis?: string;
  key_findings: Finding[];
  academic_context?: string;
  implications?: string;
  open_questions: string[];
  sources: SourceSummary[];
}

/** Normalize a stored/parsed report so missing long-form fields never crash the UI. */
export function normalizeReport(report: Report): Report {
  return {
    ...report,
    background: report.background ?? "",
    current_state: report.current_state ?? "",
    analysis: report.analysis ?? "",
    academic_context: report.academic_context ?? "",
    implications: report.implications ?? "",
    key_findings: report.key_findings ?? [],
    open_questions: report.open_questions ?? [],
    sources: report.sources ?? [],
  };
}

export interface TimelineStep {
  id: string;
  label: string;
  detail?: string;
  status: "pending" | "active" | "done";
}

export interface ChatMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  citations?: { url: string; title: string }[];
  not_in_report?: boolean;
  out_of_domain?: boolean;
  search_web?: boolean;
}
