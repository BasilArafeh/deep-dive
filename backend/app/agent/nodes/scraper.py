"""Scraper node for the research agent.

Reads `search_results` from AgentState, fetches and cleans full page text for
each URL, then writes successful results back as `scraped_sources`.
"""

import asyncio
import re

import httpx
from bs4 import BeautifulSoup
from langsmith import traceable

from app.agent.state import AgentState, ScrapedSource, SearchResult

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)
# Cap scraped text at 12k chars — richer source body for longer summaries and synthesis.
MAX_TEXT_LENGTH = 12000
# Cap before scraping so we never summarize sources the synthesizer will discard.
MAX_SOURCES = 15


def dedupe_and_cap_results(results: list[SearchResult]) -> list[SearchResult]:
    """Deduplicate by URL, prefer arXiv, then keep at most MAX_SOURCES."""
    seen_urls: set[str] = set()
    unique: list[SearchResult] = []
    for result in results:
        if result.url in seen_urls:
            continue
        seen_urls.add(result.url)
        unique.append(result)

    # Prioritize academic sources when trimming — they produce richer summaries.
    arxiv = [r for r in unique if r.source_type == "arxiv"]
    web = [r for r in unique if r.source_type != "arxiv"]
    return (arxiv + web)[:MAX_SOURCES]


def _resolve_arxiv_url(url: str) -> str:
    """Prefer arXiv HTML pages over PDFs/abstract-only URLs."""
    # Skip PDFs; use the HTML version when we can derive it from /abs/.
    if "/pdf/" in url:
        url = url.replace("/pdf/", "/abs/")
    if "/abs/" in url:
        return url.replace("/abs/", "/html/")
    return url


def _clean_text(text: str) -> str:
    """Collapse whitespace and blank lines into a single clean string."""
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


# LangSmith span — visible in smith.langchain.com under the deep-dive project
@traceable(name="scrape_url")
async def scrape_url(url: str, title: str, source_type: str) -> ScrapedSource | None:
    """Fetch one URL and return a ScrapedSource, or None if scraping fails."""
    fetch_url = _resolve_arxiv_url(url) if source_type == "arxiv" else url

    try:
        async with httpx.AsyncClient(
            timeout=10.0,
            follow_redirects=True,
            headers={"User-Agent": USER_AGENT},
        ) as client:
            response = await client.get(fetch_url)
            response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")
        paragraphs = [p.get_text(" ", strip=True) for p in soup.find_all("p")]
        full_text = _clean_text("\n\n".join(p for p in paragraphs if p))

        # Thin sources produce low-quality summaries that waste the synthesizer's context window.
        if len(full_text) < 500:
            return None

        # Cap length so scraped content stays within model token budgets later.
        full_text = full_text[:MAX_TEXT_LENGTH]

        if not full_text:
            return None

        return ScrapedSource(
            url=url,
            title=title,
            source_type=source_type,
            full_text=full_text,
        )
    except Exception:
        # Skip failed scrapes (timeouts, 404s, blocks) without crashing the agent.
        return None


# LangSmith span — visible in smith.langchain.com under the deep-dive project
@traceable(name="scraper")
async def scraper_node(state: AgentState) -> dict:
    """Scrape capped search results concurrently and update scraped_sources."""
    # Deduplicate and cap before any network fetch — between searcher and scrape work.
    search_results = dedupe_and_cap_results(state["search_results"])

    if not search_results:
        return {"search_results": [], "scraped_sources": []}

    try:
        # 60s overall — each URL already has a 10s httpx timeout; this caps the batch.
        scraped = await asyncio.wait_for(
            asyncio.gather(
                *[
                    scrape_url(result.url, result.title, result.source_type)
                    for result in search_results
                ]
            ),
            timeout=60,
        )
    except asyncio.TimeoutError as exc:
        raise TimeoutError("Scraper timed out after 60s") from exc

    scraped_sources = [source for source in scraped if source is not None]
    # Persist the capped list so downstream state matches what was actually scraped.
    return {"search_results": search_results, "scraped_sources": scraped_sources}
