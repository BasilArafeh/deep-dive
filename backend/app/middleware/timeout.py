"""Fail long-running requests instead of hanging the client forever."""

import asyncio
import logging

from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request


logger = logging.getLogger("deep_dive")

REQUEST_TIMEOUT_SECONDS = 180


class TimeoutMiddleware(BaseHTTPMiddleware):
    """Fail long-running requests instead of hanging the client forever."""

    async def dispatch(self, request: Request, call_next):
        try:
            return await asyncio.wait_for(call_next(request), timeout=REQUEST_TIMEOUT_SECONDS)
        except asyncio.TimeoutError:
            logger.warning(
                "request timed out",
                extra={
                    "method": request.method,
                    "path": str(request.url.path),
                    "request_id": getattr(request.state, "request_id", "unknown"),
                    "timeout_seconds": REQUEST_TIMEOUT_SECONDS,
                },
            )
            return JSONResponse(
                status_code=504,
                content={
                    "error": "timeout",
                    "message": (
                        "The request took too long. "
                        "Please try a simpler topic or try again."
                    ),
                },
            )
