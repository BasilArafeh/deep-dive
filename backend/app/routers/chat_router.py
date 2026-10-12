"""Chat API router — multi-route orchestrator for report Q&A.

Classifies each user message (specific / broad / out_of_report / out_of_domain /
irrelevant) then routes to RAG, full-report synthesis, web-search offer,
domain redirect, or a gentle redirect back to the report.
"""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse
from langsmith import traceable
from tavily import TavilyClient

from app.config import settings
from app.limiter import limiter
from app.prompts.system_prompts import CHAT_PROMPT, CLASSIFY_PROMPT
from app.schemas import ChatRequest
from app.security import validate_question
from app.services.embedder import embed_text
from app.services.openai_client import openai_client
from app.services.pinecone_client import pinecone_index
from app.services.retry import with_retry

chat_router = APIRouter()
logger = logging.getLogger("deep_dive")

# Broad questions naturally score lower than keyword-tight ones but are still
# answerable from the report. 0.5 catches those without raising hallucination
# risk — answers remain grounded in retrieved chunks.
SIMILARITY_THRESHOLD = 0.5

INTENT_LABELS = frozenset(
    {"specific", "broad", "out_of_report", "out_of_domain", "irrelevant"}
)

REWRITE_PROMPT = (
    "You are a search query optimizer. Rewrite the user's question into a "
    "dense keyword-rich search query that will retrieve relevant chunks from "
    "a research report vector store. Output only the rewritten query, nothing "
    "else. Remove filler words, expand abbreviations, and use specific domain terms."
)

# Phrase heuristics — skip the LLM classifier for obvious broad questions.
BROAD_PRECLASSIFY_PHRASES = (
    "key points",
    "summarize",
    "summary",
    "overview",
    "what did you find",
    "tell me about the report",
    "what is in the report",
    "key findings",
    "main points",
    "what does the report say",
    "give me an overview",
)

# Ordered section keys used when reassembling Pinecone chunks for broad answers.
REPORT_SECTION_ORDER = (
    "executive_summary",
    "background",
    "current_state",
    "analysis",
    "key_findings",
    "academic_context",
    "implications",
    "open_questions",
)

REPORT_SECTION_HEADINGS = {
    "executive_summary": "Executive summary",
    "background": "Background",
    "current_state": "Current state",
    "analysis": "Analysis",
    "key_findings": "Key findings",
    "academic_context": "Academic context",
    "implications": "Implications",
    "open_questions": "Open questions",
}


def format_sse(data: dict) -> str:
    """Format a dict as a single SSE `data:` message."""
    return f"data: {json.dumps(data)}\n\n"


def _normalize_section_key(section: str) -> str:
    """Map stored section metadata onto canonical report section names."""
    if section.startswith("key_finding"):
        return "key_findings"
    return section


async def fetch_full_report_context(session_id: str) -> str:
    """List + fetch all Pinecone chunks for a session and reassemble by section."""
    try:
        # Collect every vector id in this session namespace (not a similarity search).
        all_ids: list[str] = []
        for id_batch in pinecone_index.list(namespace=session_id):
            if isinstance(id_batch, str):
                all_ids.append(id_batch)
            else:
                all_ids.extend(list(id_batch))

        if not all_ids:
            logger.warning(
                "Fetched full report context | session_id=%s | chunks=0",
                session_id[:8],
            )
            return ""

        # Fetch in batches — Pinecone fetch has a per-request id limit.
        section_texts: dict[str, list[str]] = {
            key: [] for key in REPORT_SECTION_ORDER
        }
        batch_size = 100
        fetched_count = 0
        for start in range(0, len(all_ids), batch_size):
            batch = all_ids[start : start + batch_size]
            response = pinecone_index.fetch(ids=batch, namespace=session_id)
            vectors = getattr(response, "vectors", None) or response.get("vectors") or {}
            for _vid, vector in vectors.items():
                metadata = getattr(vector, "metadata", None) or {}
                if not isinstance(metadata, dict):
                    metadata = {}
                section = _normalize_section_key(str(metadata.get("section") or ""))
                text = str(metadata.get("text") or "").strip()
                if text and section in section_texts:
                    section_texts[section].append(text)
                    fetched_count += 1

        parts: list[str] = []
        for section in REPORT_SECTION_ORDER:
            texts = section_texts[section]
            if not texts:
                continue
            heading = REPORT_SECTION_HEADINGS[section]
            body = "\n\n".join(texts)
            parts.append(f"## {heading}\n{body}")

        assembled = "\n\n".join(parts)
        logger.info(
            "Fetched full report context | session_id=%s | chunks=%s",
            session_id[:8],
            fetched_count,
        )
        return assembled
    except Exception as error:
        logger.warning(
            "Fetched full report context failed | session_id=%s | error=%s",
            session_id[:8],
            error,
        )
        return ""


async def fetch_report_context(session_id: str) -> str:
    """Fetch executive-summary chunks for the intent classifier (lightweight)."""
    try:
        embedding = await embed_text("executive summary overview")
        results = pinecone_index.query(
            vector=embedding,
            top_k=2,
            namespace=session_id,
            include_metadata=True,
            filter={"section": {"$eq": "executive_summary"}},
        )
        matches = getattr(results, "matches", None) or results.get("matches") or []
        texts: list[str] = []
        for match in matches:
            metadata = getattr(match, "metadata", None) or match.get("metadata") or {}
            text = metadata.get("text") if isinstance(metadata, dict) else None
            if text:
                texts.append(str(text).strip())
        return "\n\n".join(t for t in texts if t)
    except Exception:
        return ""


@with_retry(max_attempts=3, base_delay=1.0)
async def rewrite_query(question: str) -> str:
    """Rewrite a user question into a denser Pinecone search query via GPT-4o."""
    try:
        response = await openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": REWRITE_PROMPT},
                {"role": "user", "content": question},
            ],
        )
        rewritten = (response.choices[0].message.content or "").strip()
        if not rewritten:
            return question

        logger.info(
            "Query rewrite | original='%s' → rewritten='%s'",
            question[:50],
            rewritten[:50],
        )
        return rewritten
    except Exception:
        # Fall back to the original question so chat RAG still works.
        return question


@with_retry(max_attempts=3, base_delay=1.0)
async def _classify_intent_llm(
    question: str,
    report_topic: str,
    report_context: str,
) -> str:
    """Call GPT-4o to classify chat intent into one of five route labels."""
    user_message = f"""<research_topic>
{report_topic or "unknown"}
</research_topic>

<report_context>
{report_context or "No report context provided."}
</report_context>

<question>
{question}
</question>"""

    response = await openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": CLASSIFY_PROMPT},
            {"role": "user", "content": user_message},
        ],
    )
    raw = (response.choices[0].message.content or "").strip().lower()
    # Take first token in case the model adds stray punctuation.
    label = raw.split()[0].strip(".,:;\"'`") if raw else "specific"
    if label not in INTENT_LABELS:
        label = "specific"
    return label


def _is_obviously_broad(question: str) -> bool:
    """Fast keyword check for obvious broad questions — no LLM needed."""
    trimmed = question.strip()
    lower = trimmed.lower()
    return any(phrase in lower for phrase in BROAD_PRECLASSIFY_PHRASES)


async def classify_intent(
    question: str,
    report_topic: str,
    report_context: str,
) -> str:
    """Classify chat intent into one of five route labels. Falls back to specific."""
    # Catch obvious broad questions before burning a GPT-4o call.
    if _is_obviously_broad(question):
        logger.info(
            "Intent classified | question='%s' → broad (pre-classify)",
            question[:50],
        )
        return "broad"

    try:
        label = await _classify_intent_llm(question, report_topic, report_context)
        logger.info(
            "Intent classified | question='%s' → %s",
            question[:50],
            label,
        )
        return label
    except Exception:
        logger.warning(
            "Intent classification failed — falling back to specific | question='%s'",
            question[:50],
        )
        return "specific"


async def search_report(question: str, session_id: str) -> tuple[list[str], float]:
    """Find report chunks for this session and return texts + top score."""
    # Rewrite for retrieval only — answer generation still uses the original question.
    try:
        search_query = await rewrite_query(question)
    except Exception:
        search_query = question
    embedding = await embed_text(search_query)

    logger.info(
        "Pinecone query | session_id='%s' | query='%s'",
        session_id,
        search_query[:50],
    )

    # Scope retrieval to this research session's namespace.
    results = pinecone_index.query(
        vector=embedding,
        top_k=5,
        namespace=session_id,
        include_metadata=True,
    )

    matches = getattr(results, "matches", None) or results.get("matches") or []
    logger.info(
        "Pinecone results | count=%s | top_score=%s",
        len(matches),
        (
            float(getattr(matches[0], "score", None) or matches[0].get("score") or 0.0)
            if matches
            else 0
        ),
    )
    chunks: list[str] = []
    for match in matches:
        metadata = getattr(match, "metadata", None) or match.get("metadata") or {}
        text = metadata.get("text") if isinstance(metadata, dict) else None
        if text:
            chunks.append(text)

    if not matches:
        return chunks, 0.0

    first = matches[0]
    top_score = float(getattr(first, "score", None) or first.get("score") or 0.0)
    return chunks, top_score


async def search_web_for_answer(question: str) -> str:
    """Search the web with Tavily; return top result content or empty on failure."""
    try:
        client = TavilyClient(api_key=settings.tavily_api_key)
        response = client.search(query=question, max_results=3)
        results = response.get("results") or []
        if not results:
            return ""
        return "\n\n".join(
            (result.get("content") or "").strip()
            for result in results
            if result.get("content")
        )
    except Exception:
        # Web search is a fallback path — never crash the chat stream on failure.
        return ""


async def _stream_answer(
    question: str, context: str, search_web: bool
) -> AsyncIterator[str]:
    """Stream a GPT answer grounded in the provided context."""
    user_message = f"""<context>
{context}
</context>

<question>
{question}
</question>"""

    stream = await openai_client.chat.completions.create(
        model="gpt-4o",
        stream=True,
        messages=[
            {"role": "system", "content": CHAT_PROMPT},
            {"role": "user", "content": user_message},
        ],
    )

    async for chunk in stream:
        token = chunk.choices[0].delta.content
        if token:
            yield format_sse({"type": "chunk", "content": token})

    yield format_sse({"type": "done", "search_web": search_web})


async def handle_specific(
    question: str, session_id: str
) -> AsyncIterator[str]:
    """Route 1 — RAG over Pinecone. Low similarity falls through to Route 3."""
    chunks, top_score = await search_report(question, session_id)
    if top_score < SIMILARITY_THRESHOLD:
        async for event in handle_out_of_report(question, search_web=False):
            yield event
        return

    context = "\n\n".join(chunks)
    async for event in _stream_answer(question, context, search_web=False):
        yield event


async def handle_broad(question: str, session_id: str) -> AsyncIterator[str]:
    """Route 2 — answer from the full report reassembled from Pinecone."""
    context = await fetch_full_report_context(session_id)
    if not context.strip():
        # Empty fetch — fall back to Route 1 RAG.
        async for event in handle_specific(question, session_id):
            yield event
        return

    async for event in _stream_answer(question, context, search_web=False):
        yield event


async def handle_out_of_report(
    question: str, search_web: bool = False
) -> AsyncIterator[str]:
    """Route 3 — offer web search, or run it when the user already accepted."""
    if search_web:
        web_content = await search_web_for_answer(question)
        if not web_content:
            yield format_sse(
                {
                    "type": "error",
                    "message": "Web search returned no results. Try rephrasing your question.",
                }
            )
            return
        async for event in _stream_answer(question, web_content, search_web=True):
            yield event
        return

    yield format_sse(
        {
            "type": "not_in_report",
            "message": (
                "This isn't covered in the report. "
                "Would you like me to search the web for it?"
            ),
            "search_web": True,
        }
    )
    yield format_sse({"type": "done", "search_web": True})


async def handle_out_of_domain(
    question: str, report_topic: str
) -> AsyncIterator[str]:
    """Route 4 — question is unrelated to this report's topic."""
    topic = report_topic.strip() or "this topic"
    yield format_sse(
        {
            "type": "out_of_domain",
            "message": (
                f"This question is outside the scope of this report on '{topic}'. "
                "To explore this topic, start a new research."
            ),
        }
    )
    yield format_sse({"type": "done", "search_web": False})


async def handle_irrelevant() -> AsyncIterator[str]:
    """Route 5 — conversational / zero research intent."""
    yield format_sse(
        {
            "type": "irrelevant",
            "message": (
                "I'm here to help you understand this report. "
                "What would you like to know about it?"
            ),
        }
    )
    yield format_sse({"type": "done", "search_web": False})


@traceable(name="chat_router")
async def answer_generator(
    question: str,
    session_id: str,
    search_web: bool = False,
    report_topic: str | None = None,
) -> AsyncIterator[str]:
    """Orchestrate chat: classify intent, then dispatch to the matching route."""
    topic = (report_topic or "").strip()
    try:
        # Explicit web-search acceptance from the frontend — skip classification.
        if search_web:
            logger.info(
                "Chat route | label=out_of_report(web) | session_id=%s",
                session_id[:8],
            )
            async for event in handle_out_of_report(question, search_web=True):
                yield event
            return

        # Lightweight executive-summary fetch for the classifier (not full report).
        report_context = await fetch_report_context(session_id)
        logger.info(
            "Report context fetched for classifier | session_id=%s | length=%s",
            session_id[:8],
            len(report_context),
        )
        label = await classify_intent(question, topic, report_context=report_context)
        logger.info(
            "Chat route | label=%s | session_id=%s",
            label,
            session_id[:8],
        )

        if label == "specific":
            async for event in handle_specific(question, session_id):
                yield event
        elif label == "broad":
            async for event in handle_broad(question, session_id):
                yield event
        elif label == "out_of_report":
            async for event in handle_out_of_report(question, search_web=False):
                yield event
        elif label == "out_of_domain":
            async for event in handle_out_of_domain(question, topic):
                yield event
        else:
            async for event in handle_irrelevant():
                yield event
    except Exception as e:
        yield format_sse({"type": "error", "message": str(e)})


@chat_router.post("/chat")
@limiter.limit("20/minute")
async def chat(request: Request, request_body: ChatRequest):
    """Answer a question from the session report, streaming via SSE."""
    try:
        question = validate_question(request_body.question)
    except ValueError as e:
        return JSONResponse(
            status_code=400,
            content={"error": "invalid_input", "message": str(e)},
        )
    return StreamingResponse(
        answer_generator(
            question,
            request_body.session_id,
            search_web=request_body.search_web,
            report_topic=request_body.report_topic,
        ),
        media_type="text/event-stream",
        headers={
            # Prevent intermediaries from caching the event stream.
            "Cache-Control": "no-cache",
            # Disable nginx-style response buffering so events flush immediately.
            "X-Accel-Buffering": "no",
        },
    )
