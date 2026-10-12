"""In-memory request and session metrics for the Deep Dive API.

For a single-instance portfolio deploy, a process-local collector is enough —
no Prometheus/StatsD needed. Multi-instance production would need a shared
metrics backend so each replica does not keep its own incomplete view.
"""

import collections
import threading
import time


class MetricsCollector:
    """Thread-safe in-process metrics store."""

    def __init__(self) -> None:
        self.requests_total = 0
        self.errors_total = 0
        self.active_sessions = 0
        # maxlen=1000 bounds memory; percentiles only need recent request samples.
        self.latencies: collections.deque[float] = collections.deque(maxlen=1000)
        self._lock = threading.Lock()

    def record_request(self, duration_ms: float, status_code: int) -> None:
        with self._lock:
            self.requests_total += 1
            self.latencies.append(duration_ms)
            if status_code >= 500:
                self.errors_total += 1

    def increment_sessions(self) -> None:
        with self._lock:
            self.active_sessions += 1

    def decrement_sessions(self) -> None:
        with self._lock:
            self.active_sessions -= 1

    def _percentile(self, ordered: list[float], percentile: float) -> float:
        if not ordered:
            return 0.0
        index = int(len(ordered) * percentile)
        if index >= len(ordered):
            index = len(ordered) - 1
        return float(ordered[index])

    def get_stats(self) -> dict:
        with self._lock:
            ordered = sorted(self.latencies)
            requests_total = self.requests_total
            errors_total = self.errors_total
            active_sessions = self.active_sessions

        error_rate = errors_total / requests_total if requests_total > 0 else 0.0
        return {
            "requests_total": requests_total,
            "errors_total": errors_total,
            "error_rate": error_rate,
            "active_sessions": active_sessions,
            "latency": {
                "p50_ms": self._percentile(ordered, 0.50),
                "p95_ms": self._percentile(ordered, 0.95),
                "p99_ms": self._percentile(ordered, 0.99),
            },
        }


metrics = MetricsCollector()
