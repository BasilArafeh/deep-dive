"""Turns text into embeddings via OpenAI text-embedding-3-small.

Centralizing this here means callers share one model choice and API pattern
instead of each file calling OpenAI embeddings on its own.
"""

from app.services.openai_client import openai_client

MODEL = "text-embedding-3-small"


async def embed_text(text: str) -> list[float]:
    """Embed a single string and return its vector."""
    response = await openai_client.embeddings.create(model=MODEL, input=text)
    return response.data[0].embedding


async def embed_batch(texts: list[str]) -> list[list[float]]:
    """Embed multiple strings and return a list of vectors."""
    response = await openai_client.embeddings.create(model=MODEL, input=texts)
    return [item.embedding for item in response.data]
