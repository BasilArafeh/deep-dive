"""Assign a UUID to every request for correlation across logs and errors."""

import logging
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request


logger = logging.getLogger("deep_dive")


class RequestIdMiddleware(BaseHTTPMiddleware):
    """Assign a UUID to every request for correlation across logs and errors."""

    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        logger.info(
            "request received",
            extra={
                "method": request.method,
                "path": str(request.url.path),
                "request_id": request_id,
            },
        )

        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response
