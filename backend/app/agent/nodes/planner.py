"""Planner node for the research agent.

Reads `topic` from AgentState, asks GPT-4o to break it into focused
sub-questions, then writes them back as `sub_questions`.
"""

import asyncio
import re

from langsmith import traceable

from app.agent.state import AgentState
from app.prompts.system_prompts import PLANNER_PROMPT
from app.services.openai_client import openai_client
from app.services.retry import with_retry


# LangSmith span — visible in smith.langchain.com under the deep-dive project
@traceable(name="planner")
# Retried on transient OpenAI failures (rate limit, timeout, connection error)
@with_retry(max_attempts=3, base_delay=1.0)
async def planner_node(state: AgentState) -> dict:
    """Decompose the research topic into exactly 5 sub-questions."""
    topic = state["topic"]

    try:
        # 30s — planning is one short completion; longer usually means the model is stuck.
        response = await asyncio.wait_for(
            openai_client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": PLANNER_PROMPT},
                    {"role": "user", "content": topic},
                ],
            ),
            timeout=30,
        )
    except asyncio.TimeoutError as exc:
        raise TimeoutError(
            "Planner timed out after 30s — topic may be too complex"
        ) from exc

    content = response.choices[0].message.content
    if not content or not content.strip():
        return {"sub_questions": []}

    sub_questions: list[str] = []
    for line in content.splitlines():
        # Drop numbering like "1." / "1)" so we store only the question text.
        cleaned = re.sub(r"^\s*\d+[\.\)]\s*", "", line).strip()
        if cleaned:
            sub_questions.append(cleaned)

    # Hard cap at 5 — safety net in case the model returns more despite the prompt instruction
    sub_questions = sub_questions[:5]

    return {"sub_questions": sub_questions}
