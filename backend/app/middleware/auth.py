"""API key authentication middleware for protected routes."""

import hmac
import logging

from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.config import settings

logger = logging.getLogger("deep_dive")

# Public paths stay unauthenticated: health checks for uptime probes, and
# OpenAPI docs so the API can be explored without a key.
PUBLIC_PATHS = {"/health", "/docs", "/openapi.json", "/redoc", "/metrics"}


class AuthMiddleware(BaseHTTPMiddleware):
    """Require a valid X-API-Key header on all non-public routes."""

    async def dispatch(self, request: Request, call_next):
        if request.url.path in PUBLIC_PATHS:
            return await call_next(request)

        api_key = request.headers.get("X-API-Key")
        if not api_key:
            return JSONResponse(
                status_code=401,
                content={
                    "error": "unauthorized",
                    "message": (
                        "Missing API key. Include your API key in the X-API-Key header."
                    ),
                },
            )

        # hmac.compare_digest is constant-time, so attackers cannot learn the
        # key length/content via response-timing differences (== can leak that).
        if not hmac.compare_digest(api_key, settings.api_key):
            client_ip = request.client.host if request.client else "unknown"
            request_id = getattr(request.state, "request_id", "unknown")
            logger.warning(
                "Invalid API key attempt | ip=%s | request_id=%s",
                client_ip,
                request_id,
            )
            return JSONResponse(
                status_code=401,
                content={
                    "error": "unauthorized",
                    "message": "Invalid API key.",
                },
            )

        return await call_next(request)
