"""Summarizer node for the research agent.

Reads `scraped_sources` and `topic` from AgentState, summarizes each source with
GPT-4o, then writes the results back as `summaries`.
"""

import asyncio
import logging

from langsmith import traceable

from app.agent.state import AgentState, ScrapedSource, SourceSummary
from app.prompts.system_prompts import SUMMARIZER_PROMPT
from app.services.openai_client import openai_client
from app.services.retry import with_retry

logger = logging.getLogger("deep_dive")


# LangSmith span — visible in smith.langchain.com under the deep-dive project
@traceable(name="summarize_source")
# Retried on transient OpenAI failures (rate limit, timeout, connection error)
@with_retry(max_attempts=3, base_delay=1.0)
async def summarize_source(source: ScrapedSource, topic: str) -> SourceSummary:
    """Summarize one scraped source into a SourceSummary via GPT-4o."""
    # Give the model topic + metadata + full text so the summary stays on-target.
    user_message = f"""<topic>
{topic}
</topic>

<source>
url: {source.url}
title: {source.title}
source_type: {source.source_type}
</source>

<full_text>
{source.full_text}
</full_text>"""

    try:
        # 30s per source — a single summary completion should finish well under this.
        response = await asyncio.wait_for(
            openai_client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": SUMMARIZER_PROMPT},
                    {"role": "user", "content": user_message},
                ],
            ),
            timeout=30,
        )
    except asyncio.TimeoutError:
        logger.warning(
            "Summarizer timed out after 30s for source '%s' — using fallback summary",
            source.url,
        )
        return SourceSummary(
            url=source.url,
            title=source.title,
            source_type=source.source_type,
            summary="Summary unavailable — source took too long to process",
        )

    summary = response.choices[0].message.content.strip()

    return SourceSummary(
        url=source.url,
        title=source.title,
        source_type=source.source_type,
        summary=summary,
    )


# LangSmith span — visible in smith.langchain.com under the deep-dive project
@traceable(name="summarizer")
async def summarizer_node(state: AgentState) -> dict:
    """Summarize all scraped sources concurrently and update summaries."""
    topic = state["topic"]
    scraped_sources: list[ScrapedSource] = state["scraped_sources"]

    try:
        # 120s overall — enough for several concurrent 30s per-source summaries.
        summaries = await asyncio.wait_for(
            asyncio.gather(
                *[summarize_source(source, topic) for source in scraped_sources]
            ),
            timeout=120,
        )
    except asyncio.TimeoutError as exc:
        raise TimeoutError("Summarizer timed out after 120s") from exc

    return {"summaries": list(summaries)}
