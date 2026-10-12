"""Input sanitization and prompt-injection checks for user text.

Every topic and chat question is cleaned and screened here before it reaches
the agent. Untrusted input can otherwise carry HTML, control characters, or
prompt-injection attempts that try to override system instructions.
"""

import logging
import re

logger = logging.getLogger("deep_dive.security")

# Prompt injection tries to override the model’s system instructions (e.g. “ignore
# previous instructions”). These phrases are common attack markers and are
# rejected before any LLM call.
INJECTION_PATTERNS = [
    "ignore previous instructions",
    "ignore all instructions",
    "you are now",
    "disregard your",
    "forget your instructions",
    "system prompt",
    "reveal your prompt",
    "act as",
    "jailbreak",
    "dan mode",
    "pretend you are",
    "you have no restrictions",
    "ignore your training",
]

_HTML_TAG_RE = re.compile(r"<[^>]+>")
# Allow newlines (\n) and tabs (\t); strip other C0 controls and DEL.
_CONTROL_CHARS_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def sanitize_input(text: str) -> str:
    """Strip HTML, control chars, and excess whitespace from user text."""
    cleaned = _HTML_TAG_RE.sub("", text)
    cleaned = cleaned.replace("\x00", "")
    cleaned = _CONTROL_CHARS_RE.sub("", cleaned)
    # Normalize all whitespace runs (spaces, tabs, newlines) to a single space.
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned.strip()


def detect_prompt_injection(text: str) -> bool:
    """Return True if the text matches a known prompt-injection pattern."""
    lowered = text.lower()
    for pattern in INJECTION_PATTERNS:
        if pattern in lowered:
            preview = text[:50]
            logger.warning(
                "Prompt injection attempt detected | input='%s...'",
                preview,
            )
            return True
    return False


def validate_topic(topic: str) -> str:
    """Sanitize and screen a research topic; raise ValueError if unsafe/empty."""
    had_content = bool(topic.strip())
    sanitized = sanitize_input(topic)

    if detect_prompt_injection(sanitized):
        raise ValueError(
            "Your topic contains content that cannot be processed. "
            "Please enter a genuine research topic."
        )

    if not sanitized:
        if had_content:
            raise ValueError(
                "Your topic contained only markup or special characters that were "
                "removed during cleaning. Please enter a genuine research topic."
            )
        raise ValueError(
            "Topic cannot be empty. Please enter a valid research topic."
        )

    return sanitized


def validate_question(question: str) -> str:
    """Sanitize and screen a chat question; raise ValueError if unsafe/empty."""
    had_content = bool(question.strip())
    sanitized = sanitize_input(question)

    if detect_prompt_injection(sanitized):
        raise ValueError(
            "Your question contains content that cannot be processed. "
            "Please ask a genuine research question."
        )

    if not sanitized:
        if had_content:
            raise ValueError(
                "Your question contained only markup or special characters that were "
                "removed during cleaning. Please ask a genuine research question."
            )
        raise ValueError(
            "Question cannot be empty. Please enter a valid research question."
        )

    return sanitized
