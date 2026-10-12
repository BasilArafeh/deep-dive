"""Shared test infrastructure that pytest loads automatically before any test file runs."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.config import settings
from app.main import app


@pytest.fixture
async def async_client():
    """Authenticated HTTP client against the FastAPI app (no real network)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"X-API-Key": settings.api_key},
    ) as client:
        yield client


@pytest.fixture
def mock_openai():
    """Patch the OpenAI client used by agent nodes so tests never hit the API."""
    with patch("app.agent.nodes.planner.openai_client", new_callable=AsyncMock) as mock:
        mock.chat.completions.create = AsyncMock()
        yield mock


@pytest.fixture
def mock_pinecone():
    """Patch the Pinecone index so tests never hit the vector store."""
    with patch("app.services.pinecone_client.pinecone_index", new_callable=MagicMock) as mock:
        yield mock


@pytest.fixture
def mock_research_graph():
    """Patch the LangGraph run so endpoint tests do not execute the agent."""

    async def _empty_astream(*args, **kwargs):
        if False:  # pragma: no cover — makes this an async generator
            yield {}

    with patch("app.routers.research_router.research_graph") as mock_graph:
        mock_graph.astream = _empty_astream
        yield mock_graph
