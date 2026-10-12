"""Retry helpers with exponential backoff for transient OpenAI failures.

Usage:

    @with_retry(max_attempts=3, base_delay=1.0)
    async def call_openai():
        return await openai_client.chat.completions.create(...)
"""

import asyncio
import functools
import logging
import random

from openai import APIConnectionError, APITimeoutError, RateLimitError

logger = logging.getLogger("deep_dive.retry")

# Only retry transient failures. Auth errors, bad requests, and other
# non-retryable failures would fail again the same way — retrying them wastes
# time and can amplify rate-limit pressure.
RETRYABLE_EXCEPTIONS = (RateLimitError, APITimeoutError, APIConnectionError)


def with_retry(
    max_attempts: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 30.0,
    backoff_factor: float = 2.0,
):
    """Async-only decorator: retry OpenAI calls with exponential backoff + jitter."""

    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            last_error: Exception | None = None

            for attempt in range(max_attempts):
                try:
                    return await func(*args, **kwargs)
                except RETRYABLE_EXCEPTIONS as error:
                    last_error = error
                    if attempt >= max_attempts - 1:
                        logger.error(
                            "OpenAI call failed after %s attempts: %s",
                            max_attempts,
                            error,
                        )
                        raise

                    delay = min(base_delay * (backoff_factor**attempt), max_delay)
                    # Jitter spreads retries so concurrent failures don't all
                    # wake up and hit the API at the same instant (thundering herd).
                    jitter = delay * random.uniform(-0.2, 0.2)
                    delay = max(0.0, delay + jitter)

                    logger.warning(
                        "OpenAI call failed (attempt %s/%s): %s — retrying in %.1fs",
                        attempt + 1,
                        max_attempts,
                        error,
                        delay,
                    )
                    await asyncio.sleep(delay)

            assert last_error is not None
            raise last_error

        return wrapper

    return decorator
