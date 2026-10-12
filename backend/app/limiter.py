"""Shared SlowAPI limiter used by routers and main exception handlers."""

from slowapi import Limiter
from slowapi.util import get_remote_address

# In-memory storage is fine for a single process; swap for Redis in multi-instance deploys.
limiter = Limiter(key_func=get_remote_address, storage_uri="memory://")
