"""Shared state models for the LangGraph research agent.

AgentState is the object every node reads and updates as research progresses.
It is the core of the agent: the graph passes this state from planner through
search, scrape, summarize, and synthesize until a final report is produced.
"""

from dataclasses import dataclass
from typing import TypedDict


@dataclass
class SearchResult:
    """A single hit from web or arXiv search before scraping."""

    url: str
    title: str
    snippet: str
    source_type: str  # "web" or "arxiv"


@dataclass
class ScrapedSource:
    """Full text fetched from a search result URL."""

    url: str
    title: str
    source_type: str
    full_text: str


@dataclass
class SourceSummary:
    """Condensed summary of one scraped source."""

    url: str
    title: str
    source_type: str
    summary: str


@dataclass
class Finding:
    """One key finding with its citation."""

    point: str
    citation_url: str
    citation_title: str


@dataclass
class Report:
    """Final research report assembled by the synthesizer."""

    # Concise report title
    title: str
    # 1 punchy paragraph summarizing the whole report
    executive_summary: str
    # 2-3 paragraphs of context, history, and foundational concepts
    background: str
    # 2-3 paragraphs on what is happening right now, latest news and developments
    current_state: str
    # 3-4 paragraphs of deep synthesis — the centrepiece of the report
    analysis: str
    # 6-10 atomic cited findings
    key_findings: list[Finding]
    # 2 paragraphs synthesizing academic sources only, empty string if none
    academic_context: str
    # 2 paragraphs on what the findings mean going forward
    implications: str
    # 4-6 unresolved or debated questions
    open_questions: list[str]
    # All sources used
    sources: list[SourceSummary]


class AgentState(TypedDict):
    """Shared graph state passed through every LangGraph node."""

    topic: str
    sub_questions: list[str]
    search_results: list[SearchResult]
    scraped_sources: list[ScrapedSource]
    summaries: list[SourceSummary]
    report: Report
    session_id: str
