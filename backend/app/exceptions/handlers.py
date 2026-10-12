"""Centralized exception handlers for consistent JSON API errors."""

import logging
import traceback

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from starlette.exceptions import HTTPException as StarletteHTTPException


logger = logging.getLogger("deep_dive")


async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    """Always return our custom rate-limit payload — never SlowAPI's default."""
    return JSONResponse(
        status_code=429,
        content={
            "error": "rate_limit_exceeded",
            "message": (
                "You've made too many requests. "
                "Please wait a moment before trying again."
            ),
            "retry_after": "60 seconds",
        },
    )


async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    if exc.status_code == 404:
        return JSONResponse(
            status_code=404,
            content={
                "error": "not_found",
                "message": "The endpoint you requested does not exist.",
            },
        )
    if exc.status_code == 405:
        return JSONResponse(
            status_code=405,
            content={
                "error": "method_not_allowed",
                "message": "HTTP method not allowed on this endpoint.",
            },
        )
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": "http_error", "message": str(exc.detail)},
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "error": "validation_error",
            "message": "Invalid request. Please check your input.",
            "details": jsonable_encoder(exc.errors()),
        },
    )


async def unhandled_exception_handler(request: Request, exc: Exception):
    """Log the full traceback internally; return a safe message to the client."""
    request_id = getattr(request.state, "request_id", "unknown")
    logger.error(
        "unhandled server error",
        extra={
            "request_id": request_id,
            "traceback": traceback.format_exc(),
        },
    )
    return JSONResponse(
        status_code=500,
        content={
            "error": "internal_error",
            "message": "Something went wrong on our end. Please try again.",
            "request_id": request_id,
        },
    )


def register_exception_handlers(app: FastAPI) -> None:
    """Register all API exception handlers on the FastAPI app."""
    app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
