"""Research API router with Server-Sent Events (SSE) streaming.

Accepts a research topic, runs the LangGraph agent, and streams progress
events to the frontend as SSE. Each event is a `data: {...}\\n\\n` line that
the client can parse as it arrives, instead of waiting for the full report.
"""

import json
import logging
import uuid
from dataclasses import asdict

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse

from app.agent.graph import research_graph
from app.agent.state import AgentState, Report
from app.limiter import limiter
from app.metrics import metrics
from app.schemas import ResearchRequest
from app.security import validate_topic
from app.services.embedder import embed_text
from app.services.pinecone_client import cleanup_session, pinecone_index

research_router = APIRouter()
logger = logging.getLogger("deep_dive")

# ~750 tokens — keeps embedding inputs under the model limit while preserving context.
MAX_CHUNK_CHARS = 3000


def format_sse(data: dict) -> str:
    """Format a dict as a single SSE `data:` message."""
    return f"data: {json.dumps(data)}\n\n"


def _chunk_prose(section: str, text: str) -> list[tuple[str, str]]:
    """Split a prose section into embeddable chunks under MAX_CHUNK_CHARS."""
    text = text.strip()
    if not text:
        return []

    if len(text) <= MAX_CHUNK_CHARS:
        return [(section, text)]

    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks: list[tuple[str, str]] = []
    current = ""

    def flush() -> None:
        nonlocal current
        if current.strip():
            chunks.append((section, current.strip()))
            current = ""

    for paragraph in paragraphs:
        if len(paragraph) > MAX_CHUNK_CHARS:
            flush()
            for start in range(0, len(paragraph), MAX_CHUNK_CHARS):
                chunks.append((section, paragraph[start : start + MAX_CHUNK_CHARS]))
            continue

        candidate = f"{current}\n\n{paragraph}".strip() if current else paragraph
        if len(candidate) > MAX_CHUNK_CHARS:
            flush()
            current = paragraph
        else:
            current = candidate

    flush()
    return chunks or [(section, text[:MAX_CHUNK_CHARS])]


async def embed_report(report: Report, session_id: str) -> None:
    """Chunk the report, embed it, and upsert vectors for chat RAG. Never raises."""
    try:
        chunks: list[tuple[str, str]] = []

        prose_sections = (
            ("executive_summary", report.executive_summary),
            ("background", report.background),
            ("current_state", report.current_state),
            ("analysis", report.analysis),
            ("academic_context", report.academic_context),
            ("implications", report.implications),
        )
        for section, text in prose_sections:
            chunks.extend(_chunk_prose(section, text))

        for index, finding in enumerate(report.key_findings):
            point = finding.point.strip()
            if point:
                chunks.append((f"key_finding_{index}", point))

        open_questions = [q.strip() for q in report.open_questions if q.strip()]
        if open_questions:
            chunks.extend(_chunk_prose("open_questions", "\n".join(open_questions)))

        vectors: list[dict] = []
        for index, (section, text) in enumerate(chunks):
            embedding = await embed_text(text)
            vectors.append(
                {
                    "id": f"{session_id}-{section}-{index}",
                    "values": embedding,
                    "metadata": {
                        "session_id": session_id,
                        "section": section,
                        "text": text,
                    },
                }
            )

        if vectors:
            # Namespace by session so chat retrieval stays isolated per research run.
            pinecone_index.upsert(vectors=vectors, namespace=session_id)

        logger.info(
            "Report embedded into Pinecone | session_id=%s | chunks=%s",
            session_id,
            len(vectors),
        )
    except Exception as error:
        logger.warning(
            "Report embedding failed | session_id=%s | error=%s",
            session_id,
            error,
        )


async def event_generator(topic: str, session_id: str):
    """Yield SSE events as each research graph node completes."""
    metrics.increment_sessions()
    try:
        # Tell the client its session id before any research work starts.
        yield format_sse({"type": "session_created", "session_id": session_id})

        state: AgentState = {
            "topic": topic,
            "session_id": session_id,
            "sub_questions": [],
            "search_results": [],
            "scraped_sources": [],
            "summaries": [],
            "report": Report(
                title="",
                executive_summary="",
                background="",
                current_state="",
                analysis="",
                key_findings=[],
                academic_context="",
                implications="",
                open_questions=[],
                sources=[],
            ),
        }

        # astream yields per-node updates; keys tell us which node just finished.
        config = {
            "run_name": f"research-{session_id[:8]}",
            "tags": ["deep-dive", "research"],
            "metadata": {
                "session_id": session_id,
                "topic": topic,
            },
        }
        async for update in research_graph.astream(
            state, config=config, stream_mode="updates"
        ):
            if "planner" in update:
                yield format_sse(
                    {
                        "type": "planning",
                        "message": "Breaking topic into research questions...",
                    }
                )
            elif "searcher" in update:
                yield format_sse(
                    {
                        "type": "searching",
                        "message": "Searching web and academic sources...",
                    }
                )
            elif "scraper" in update:
                yield format_sse(
                    {
                        "type": "reading",
                        "message": "Reading and extracting source content...",
                    }
                )
            elif "summarizer" in update:
                yield format_sse(
                    {
                        "type": "summarizing",
                        "message": "Summarizing findings...",
                    }
                )
            elif "synthesizer" in update:
                report = update["synthesizer"]["report"]
                # Embed before delivering the report so chat RAG is ready immediately.
                await embed_report(report, session_id)
                yield format_sse(
                    {
                        "type": "report",
                        "data": asdict(report),
                    }
                )

        yield format_sse({"type": "done"})
    except Exception as e:
        yield format_sse({"type": "error", "message": str(e)})
    finally:
        # Keep Pinecone vectors for chat until the frontend DELETE cleanup runs.
        metrics.decrement_sessions()


@research_router.post("/research")
@limiter.limit("10/minute")
async def research(request: Request, request_body: ResearchRequest):
    """Start a research run and stream progress via SSE."""
    try:
        topic = validate_topic(request_body.topic)
    except ValueError as e:
        return JSONResponse(
            status_code=400,
            content={"error": "invalid_input", "message": str(e)},
        )
    session_id = str(uuid.uuid4())

    return StreamingResponse(
        event_generator(topic, session_id),
        media_type="text/event-stream",
        headers={
            # Prevent intermediaries from caching the event stream.
            "Cache-Control": "no-cache",
            # Disable nginx-style response buffering so events flush immediately.
            "X-Accel-Buffering": "no",
        },
    )


@research_router.delete("/research/{session_id}")
async def delete_research_session(session_id: str):
    """Let the frontend explicitly clean up when the user navigates away."""
    await cleanup_session(session_id)
    return {"status": "cleaned", "session_id": session_id}
