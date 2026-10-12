"""Reject oversized request bodies before they reach endpoints.

Payload size limits stop attackers from sending huge bodies that waste memory
and CPU. Our API only needs short topics and questions, so a small cap is enough.
"""

import logging

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("deep_dive")

# 10KB is far above any legitimate topic/question while still small enough to
# block abusive multi-megabyte payloads early.
MAX_REQUEST_SIZE_BYTES = 10_240  # 10KB — generous for any real topic or question

# Docs and health probes are public and may not send Content-Length the same way.
PUBLIC_PATHS = {"/health", "/docs", "/openapi.json", "/redoc", "/metrics"}


class RequestSizeMiddleware(BaseHTTPMiddleware):
    """Reject requests whose Content-Length exceeds MAX_REQUEST_SIZE_BYTES."""

    async def dispatch(self, request: Request, call_next):
        if request.url.path in PUBLIC_PATHS:
            return await call_next(request)

        content_length_header = request.headers.get("content-length")
        # Missing Content-Length is allowed — many clients omit it (chunked
        # bodies, some proxies). We only enforce the limit when size is known.
        if content_length_header is None:
            return await call_next(request)

        try:
            content_length = int(content_length_header)
        except ValueError:
            return await call_next(request)

        if content_length > MAX_REQUEST_SIZE_BYTES:
            client_ip = request.client.host if request.client else "unknown"
            request_id = getattr(request.state, "request_id", "unknown")
            logger.warning(
                "Request rejected — payload too large | size=%s bytes | "
                "limit=%s bytes | ip=%s | request_id=%s",
                content_length,
                MAX_REQUEST_SIZE_BYTES,
                client_ip,
                request_id,
            )
            return JSONResponse(
                status_code=413,
                content={
                    "error": "payload_too_large",
                    "message": (
                        "Your request body is too large. The maximum allowed size "
                        "is 10KB. A valid research topic or question should be well "
                        "under this limit."
                    ),
                    "limit": "10KB",
                    "received": f"{content_length} bytes",
                },
            )

        return await call_next(request)
