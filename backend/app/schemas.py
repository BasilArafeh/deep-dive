"""API request and response schemas for the FastAPI layer. """

from pydantic import BaseModel, Field


# Research endpoint
class ResearchRequest(BaseModel):
    topic: str = Field(..., min_length=3, max_length=300)


class ResearchResponse(BaseModel):
    session_id: str = Field(..., min_length=1)


# Chat endpoint
class ChatRequest(BaseModel):
    session_id: str = Field(..., min_length=1)
    question: str = Field(..., min_length=1, max_length=500)
    search_web: bool = False
    # Original research topic — used for domain validation in the classifier.
    report_topic: str | None = None


class ChatResponse(BaseModel):
    answer: str
    search_web: bool
