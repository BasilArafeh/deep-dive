"""Shared Pinecone index for storing and searching report embeddings in chat RAG."""

import logging

from pinecone import Pinecone

from app.config import settings

logger = logging.getLogger("deep_dive")

_pc = Pinecone(api_key=settings.pinecone_api_key)


class _LazyPineconeIndex:
    """Defer Index() until first use so app import/CI does not hit the network."""

    def __init__(self) -> None:
        self._index = None

    def _get(self):
        if self._index is None:
            self._index = _pc.Index(settings.pinecone_index_name)
        return self._index

    def __getattr__(self, name: str):
        return getattr(self._get(), name)


pinecone_index = _LazyPineconeIndex()


async def cleanup_session(session_id: str) -> None:
    """Delete all vectors for a research session. Never raises."""
    try:
        # Vectors are stored under a per-session namespace so chat RAG stays isolated
        # and cleanup can wipe one session without touching others.
        pinecone_index.delete(delete_all=True, namespace=session_id)
        logger.info("Pinecone cleanup complete | session_id=%s", session_id)
    except Exception as error:
        logger.warning(
            "Pinecone cleanup failed | session_id=%s | error=%s",
            session_id,
            error,
        )
