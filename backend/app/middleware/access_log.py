"""Log method, path, status, duration, IP, and request ID after each response."""

import logging
import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.metrics import metrics

logger = logging.getLogger("deep_dive")

SLOW_REQUEST_THRESHOLD_MS = 1000


class AccessLogMiddleware(BaseHTTPMiddleware):
    """Log method, path, status, duration, IP, and request ID after each response."""

    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000

        request_id = getattr(request.state, "request_id", "unknown")
        client_ip = request.client.host if request.client else "unknown"
        extra = {
            "method": request.method,
            "path": str(request.url.path),
            "status": response.status_code,
            "duration_ms": round(duration_ms),
            "ip": client_ip,
            "request_id": request_id,
        }

        # Flag slow requests so they stand out in production logs.
        if duration_ms > SLOW_REQUEST_THRESHOLD_MS:
            logger.warning("request completed", extra=extra)
        else:
            logger.info("request completed", extra=extra)

        metrics.record_request(duration_ms=duration_ms, status_code=response.status_code)
        return response
