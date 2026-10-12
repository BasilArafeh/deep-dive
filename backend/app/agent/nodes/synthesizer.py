"""Synthesizer node for the research agent.

Reads `topic`, `sub_questions`, and `summaries` from AgentState, asks GPT-4o to
produce a structured JSON report, then writes the parsed Report back as `report`.
"""

import asyncio
import json
import logging
import re

from langsmith import traceable

from app.agent.state import AgentState, Finding, Report, SourceSummary
from app.prompts.system_prompts import SYNTHESIZER_PROMPT
from app.services.openai_client import openai_client
from app.services.retry import with_retry

logger = logging.getLogger("deep_dive")

SHORTER_SYNTHESIZER_PROMPT = (
    SYNTHESIZER_PROMPT
    + """

ADDITIONAL CONSTRAINT FOR THIS RETRY:
The previous attempt hit the output token limit. Produce a COMPLETE but SHORTER report:
- Aim for ~1200-1500 words of prose total (still cover every required field)
- executive_summary: 60-80 words
- background / current_state: 2 short paragraphs each
- analysis: 2-3 short paragraphs
- key_findings: exactly 6
- academic_context / implications: 1 short paragraph each (or "" if no academic sources)
- open_questions: exactly 4
Still return valid JSON only matching the Report schema — never truncate mid-JSON.
"""
)


async def build_synthesis_prompt(
    topic: str,
    sub_questions: list[str],
    summaries: list[SourceSummary],
) -> str:
    """Build the user message with topic, sub-questions, and source summaries."""
    # Take top 15 sources — richer long-form reports need broader evidence coverage
    summaries = summaries[:15]

    # Structure the context so the model can cite sources while synthesizing.
    questions_block = "\n".join(
        f"{i}. {question}" for i, question in enumerate(sub_questions, start=1)
    )

    summary_parts: list[str] = []
    for i, summary in enumerate(summaries, start=1):
        # Truncate each summary to 1000 chars — denser multi-paragraph summaries need more room
        summary_text = (
            summary.summary[:1000] + "..."
            if len(summary.summary) > 1000
            else summary.summary
        )
        summary_parts.append(
            f'<source number="{i}">\n'
            f"title: {summary.title}\n"
            f"url: {summary.url}\n"
            f"source_type: {summary.source_type}\n"
            f"summary: {summary_text}\n"
            f"</source>"
        )
    summaries_block = "\n\n".join(summary_parts)

    return f"""<topic>
{topic}
</topic>

<sub_questions>
{questions_block}
</sub_questions>

<source_summaries>
{summaries_block}
</source_summaries>"""


def _recover_truncated_json(raw: str) -> str | None:
    """Best-effort close truncated JSON objects/arrays so json.loads can succeed."""
    cleaned = raw.strip()
    fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", cleaned)
    if fence_match:
        cleaned = fence_match.group(1).strip()

    # If we already have valid JSON, nothing to recover.
    try:
        json.loads(cleaned)
        return cleaned
    except json.JSONDecodeError:
        pass

    # Drop a trailing incomplete string value if cut mid-quote.
    if cleaned.count('"') % 2 == 1:
        cleaned = cleaned.rsplit('"', 1)[0]

    # Close open braces/brackets in reverse order of appearance.
    stack: list[str] = []
    in_string = False
    escape = False
    for char in cleaned:
        if in_string:
            if escape:
                escape = False
            elif char == "\\":
                escape = True
            elif char == '"':
                in_string = False
            continue
        if char == '"':
            in_string = True
        elif char in "{[":
            stack.append("}" if char == "{" else "]")
        elif char in "}]":
            if stack and stack[-1] == char:
                stack.pop()

    # Trim trailing commas that would be invalid before closers.
    repaired = cleaned.rstrip().rstrip(",")
    repaired += "".join(reversed(stack))

    try:
        json.loads(repaired)
        return repaired
    except json.JSONDecodeError:
        return None


async def parse_report(raw_json: str) -> Report:
    """Parse GPT-4o JSON output into a Report dataclass."""
    cleaned = raw_json.strip()

    # Models sometimes wrap JSON in ```json fences — strip those before parsing.
    fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", cleaned)
    if fence_match:
        cleaned = fence_match.group(1).strip()

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        recovered = _recover_truncated_json(raw_json)
        if recovered is None:
            raise ValueError(
                "Synthesizer returned malformed JSON that could not be parsed"
            )
        data = json.loads(recovered)

    # Map nested dicts into Finding / SourceSummary dataclasses — tolerate partial items.
    key_findings = [
        Finding(
            point=item.get("point", ""),
            citation_url=item.get("citation_url", ""),
            citation_title=item.get("citation_title", ""),
        )
        for item in data.get("key_findings", [])
        if isinstance(item, dict) and item.get("point")
    ]
    sources = [
        SourceSummary(
            url=item.get("url", ""),
            title=item.get("title", ""),
            source_type=item.get("source_type", "web"),
            summary=item.get("summary", ""),
        )
        for item in data.get("sources", [])
        if isinstance(item, dict) and item.get("url")
    ]

    return Report(
        title=data.get("title", ""),
        executive_summary=data.get("executive_summary", ""),
        background=data.get("background", ""),
        current_state=data.get("current_state", ""),
        analysis=data.get("analysis", ""),
        key_findings=key_findings,
        academic_context=data.get("academic_context", ""),
        implications=data.get("implications", ""),
        open_questions=[
            q for q in data.get("open_questions", []) if isinstance(q, str) and q.strip()
        ],
        sources=sources,
    )


async def _call_synthesizer(
    system_prompt: str,
    user_message: str,
) -> tuple[str, str | None]:
    """Call GPT-4o for synthesis. Returns (content, finish_reason)."""
    response = await asyncio.wait_for(
        openai_client.chat.completions.create(
            model="gpt-4o",
            max_tokens=6000,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
        ),
        timeout=120,
    )
    choice = response.choices[0]
    return choice.message.content or "", choice.finish_reason


# LangSmith span — visible in smith.langchain.com under the deep-dive project
@traceable(name="synthesizer")
# Retried on transient OpenAI failures (rate limit, timeout, connection error)
@with_retry(max_attempts=3, base_delay=1.0)
async def synthesizer_node(state: AgentState) -> dict:
    """Synthesize all summaries into a final Report and update state."""
    topic = state["topic"]
    sub_questions = state["sub_questions"]
    summaries = state["summaries"]

    user_message = await build_synthesis_prompt(topic, sub_questions, summaries)

    try:
        # 120s — long-form report generation can legitimately take over a minute.
        # 6000 tokens — long-form report with multiple prose sections needs more output room
        raw_json, finish_reason = await _call_synthesizer(
            SYNTHESIZER_PROMPT, user_message
        )
    except asyncio.TimeoutError as exc:
        raise TimeoutError(
            "Synthesizer timed out after 120s — try a narrower topic"
        ) from exc

    if finish_reason == "length":
        logger.warning(
            "Synthesizer hit max_tokens (finish_reason=length) — attempting JSON recovery"
        )
        try:
            report = await parse_report(raw_json)
            return {"report": report}
        except ValueError:
            logger.warning(
                "Partial JSON recovery failed after length limit — retrying with shorter prompt"
            )
            try:
                raw_json, _ = await _call_synthesizer(
                    SHORTER_SYNTHESIZER_PROMPT, user_message
                )
            except asyncio.TimeoutError as exc:
                raise TimeoutError(
                    "Synthesizer retry timed out after 120s — try a narrower topic"
                ) from exc
            report = await parse_report(raw_json)
            return {"report": report}

    report = await parse_report(raw_json)
    return {"report": report}
