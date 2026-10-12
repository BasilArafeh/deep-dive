"""Shared AsyncOpenAI client used across the backend."""

from openai import AsyncOpenAI

from app.config import settings

openai_client = AsyncOpenAI(api_key=settings.openai_api_key)
