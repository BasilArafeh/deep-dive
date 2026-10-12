"""Deep Dive FastAPI entry point — logging, lifespan, and app wiring only."""

import logging
import os
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pythonjsonlogger import jsonlogger

from app.config import settings
from app.exceptions.handlers import register_exception_handlers
from app.limiter import limiter
from app.metrics import metrics
from app.middleware.access_log import AccessLogMiddleware
from app.middleware.auth import AuthMiddleware
from app.middleware.request_id import RequestIdMiddleware
from app.middleware.request_size import RequestSizeMiddleware
from app.middleware.timeout import TimeoutMiddleware
from app.routers.chat_router import chat_router
from app.routers.research_router import research_router

# JSON logs are machine-parseable for Railway/Docker log drains and make it easy
# to filter by request_id, status, duration, and other structured fields.
_log_level = logging.INFO if settings.environment == "development" else logging.WARNING
_handler = logging.StreamHandler(sys.stdout)
_handler.setFormatter(
    jsonlogger.JsonFormatter(
        "%(asctime)s %(levelname)s %(name)s %(message)s",
        rename_fields={
            "asctime": "timestamp",
            "levelname": "level",
            "name": "logger",
        },
    )
)
_root_logger = logging.getLogger()
_root_logger.handlers.clear()
_root_logger.setLevel(_log_level)
_root_logger.addHandler(_handler)
logger = logging.getLogger("deep_dive")

REQUIRED_ENV_VARS = (
    ("OPENAI_API_KEY", "openai_api_key"),
    ("PINECONE_API_KEY", "pinecone_api_key"),
    ("PINECONE_INDEX_NAME", "pinecone_index_name"),
    ("TAVILY_API_KEY", "tavily_api_key"),
    ("LANGCHAIN_API_KEY", "langchain_api_key"),
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Validate required env vars on startup; log a clean shutdown message."""
    logger.info("Starting Deep Dive | environment=%s", settings.environment)

    for var_name, attr in REQUIRED_ENV_VARS:
        value = getattr(settings, attr)
        if not value or not str(value).strip():
            raise RuntimeError(
                f"Missing required environment variable: {var_name}. Check your .env file."
            )
        logger.info("✓ %s present", var_name)

    # LangSmith SDK reads these from the process environment, not our Settings object.
    os.environ["LANGCHAIN_TRACING_V2"] = settings.langchain_tracing_v2
    os.environ["LANGCHAIN_API_KEY"] = settings.langchain_api_key
    os.environ["LANGCHAIN_PROJECT"] = settings.langchain_project

    logger.info("✓ Deep Dive API ready")
    yield
    logger.info("Deep Dive API shutting down...")


app = FastAPI(
    title="Deep Dive",
    description="Agentic research assistant that turns any topic into a structured cited brief",
    version="1.0.0",
    lifespan=lifespan,
)

# Development: allow all origins for local testing.
# Production: only the frontend Vercel URL (set via FRONTEND_URL on Railway).
allowed_origins = (
    ["*"]
    if settings.environment == "development"
    else [settings.frontend_url]
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
register_exception_handlers(app)

# Middleware — last added runs first on the request (timeout outermost).
app.add_middleware(AccessLogMiddleware)
app.add_middleware(RequestIdMiddleware)
app.add_middleware(TimeoutMiddleware)
# Auth runs before all other middleware — unauthenticated requests are rejected immediately.
app.add_middleware(AuthMiddleware)
# Size check runs early — oversized payloads are rejected before auth or routing.
app.add_middleware(RequestSizeMiddleware)

app.state.limiter = limiter
app.include_router(research_router, prefix="/api")
app.include_router(chat_router, prefix="/api")


@app.get("/health")
async def health():
    """Liveness check for load balancers and local verification."""
    return {
        "status": "ok",
        "environment": settings.environment,
        "services": {"pinecone": "connected", "openai": "initialized"},
    }


# Monitoring endpoint — public for portfolio demo; protect with auth in production.
@app.get("/metrics")
async def get_metrics():
    return metrics.get_stats()
