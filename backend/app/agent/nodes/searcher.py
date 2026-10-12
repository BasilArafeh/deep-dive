"""Searcher node: finds web and arXiv sources for each sub-question."""

import asyncio
import logging

import arxiv
from langsmith import traceable
from tavily import TavilyClient

from app.agent.state import AgentState, SearchResult
from app.config import settings
from app.prompts.system_prompts import SEARCHER_PROMPT
from app.services.openai_client import openai_client
from app.services.retry import with_retry

logger = logging.getLogger("deep_dive")


# LangSmith span — visible in smith.langchain.com under the deep-dive project
@traceable(name="optimize_query")
# Retried on transient OpenAI failures (rate limit, timeout, connection error)
@with_retry(max_attempts=3, base_delay=1.0)
async def optimize_query(sub_question: str) -> str:
    """Turn a sub-question into a tighter search query with GPT-4o."""
    response = await openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": SEARCHER_PROMPT},
            {"role": "user", "content": sub_question},
        ],
    )
    return response.choices[0].message.content.strip()


# LangSmith span — visible in smith.langchain.com under the deep-dive project
@traceable(name="search_tavily")
async def search_tavily(query: str) -> list[SearchResult]:
    """Search the web with Tavily and return the top 5 results."""
    client = TavilyClient(api_key=settings.tavily_api_key)
    response = client.search(query=query, max_results=5)
    return [
        SearchResult(
            url=result["url"],
            title=result["title"],
            snippet=result.get("content", ""),
            source_type="web",
        )
        for result in response.get("results", [])
    ]


# LangSmith span — visible in smith.langchain.com under the deep-dive project
@traceable(name="search_arxiv")
async def search_arxiv(query: str) -> list[SearchResult]:
    """Search arXiv and return the top 3 papers."""
    client = arxiv.Client()
    search = arxiv.Search(
        query=query,
        max_results=3,
        sort_by=arxiv.SortCriterion.Relevance,
    )
    results: list[SearchResult] = []
    for paper in client.results(search):
        results.append(
            SearchResult(
                url=paper.entry_id,
                title=paper.title,
                snippet=paper.summary,
                source_type="arxiv",
            )
        )
    return results


async def search_sub_question(sub_question: str) -> list[SearchResult]:
    """Optimize one sub-question and run Tavily + arXiv searches for it."""
    try:
        # 20s — query optimization is a small completion and should be fast.
        query = await asyncio.wait_for(optimize_query(sub_question), timeout=20)
    except asyncio.TimeoutError:
        logger.warning(
            "Query optimization timed out after 20s — skipping this sub-question"
        )
        return []

    async def _tavily() -> list[SearchResult]:
        try:
            # 15s — a single Tavily search should return quickly or be skipped.
            return await asyncio.wait_for(search_tavily(query), timeout=15)
        except asyncio.TimeoutError:
            logger.warning("Tavily search timed out after 15s — skipping web results")
            return []

    async def _arxiv() -> list[SearchResult]:
        try:
            # 15s — arXiv lookups are usually fast; skip if the index stalls.
            return await asyncio.wait_for(search_arxiv(query), timeout=15)
        except asyncio.TimeoutError:
            logger.warning(
                "arXiv search timed out after 15s — skipping academic results"
            )
            return []

    web_results, arxiv_results = await asyncio.gather(_tavily(), _arxiv())
    return [*web_results, *arxiv_results]


# LangSmith span — visible in smith.langchain.com under the deep-dive project
@traceable(name="searcher")
async def searcher_node(state: AgentState) -> dict:
    """Run web + arXiv search for every sub-question concurrently and update state."""
    sub_questions = state["sub_questions"]
    if not sub_questions:
        return {"search_results": []}

    # Independent sub-questions search in parallel — same pattern as scraper/summarizer.
    per_question = await asyncio.gather(
        *[search_sub_question(question) for question in sub_questions]
    )

    all_results: list[SearchResult] = []
    for results in per_question:
        all_results.extend(results)

    return {"search_results": all_results}
