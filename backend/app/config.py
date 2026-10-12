"""Loads .env once and exports a shared settings object for the rest of the app."""

from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parent.parent / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # OpenAI
    openai_api_key: str

    # Pinecone
    pinecone_api_key: str
    pinecone_index_name: str

    # Tavily
    tavily_api_key: str

    # LangSmith
    langchain_tracing_v2: str
    langchain_api_key: str
    langchain_project: str

    # App
    environment: str = "development"
    frontend_url: str = "http://localhost:3000"
    api_key: str

    # Catch production misconfiguration before any request is served.
    @model_validator(mode="after")
    def validate_production_settings(self) -> "Settings":
        if self.environment == "production":
            if self.frontend_url == "http://localhost:3000":
                raise ValueError(
                    "FRONTEND_URL must be set to your Vercel URL in production"
                )
            if len(self.api_key) < 32:
                raise ValueError(
                    "API_KEY must be at least 32 characters in production"
                )
        return self


settings = Settings()
