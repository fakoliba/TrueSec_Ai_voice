"""In-memory request latency samples for observability (dev / lightweight dashboards)."""

from __future__ import annotations

import math
import re
import threading
import time
from collections import deque
from typing import Any, Deque, Dict, List, Optional

from starlette.middleware.base import BaseHTTPMiddleware

MAX_SAMPLES = 500
_LOCK = threading.Lock()
_SAMPLES: Deque[Dict[str, Any]] = deque(maxlen=MAX_SAMPLES)

_BUSINESS_PATH_RE = re.compile(r"/api/businesses/(\d+)")


def extract_business_id(path: str) -> Optional[int]:
    m = _BUSINESS_PATH_RE.search(path)
    if m:
        return int(m.group(1))
    return None


def _record(
    *,
    duration_ms: float,
    path: str,
    method: str,
    status_code: int,
    business_id: Optional[int],
) -> None:
    entry = {
        "duration_ms": round(duration_ms, 3),
        "path": path,
        "method": method,
        "status_code": status_code,
        "business_id": business_id,
        "ts": time.time(),
    }
    with _LOCK:
        _SAMPLES.append(entry)


def _percentile(sorted_vals: List[float], p: float) -> Optional[float]:
    """Linear interpolation percentile, p in 0..100."""
    if not sorted_vals:
        return None
    if len(sorted_vals) == 1:
        return round(sorted_vals[0], 2)
    k = (len(sorted_vals) - 1) * (p / 100.0)
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return round(sorted_vals[int(k)], 2)
    return round(sorted_vals[f] * (c - k) + sorted_vals[c] * (k - f), 2)


def get_latency_metrics_for_business(business_id: int, limit: int = 120) -> Dict[str, Any]:
    """Return recent samples for this business (path-derived id) plus simple aggregates."""
    with _LOCK:
        relevant = [s for s in _SAMPLES if s.get("business_id") == business_id]
    relevant.sort(key=lambda x: x.get("ts", 0))
    cap = max(1, min(limit, 500))
    trimmed = relevant[-cap:] if len(relevant) > cap else relevant
    durations = sorted(s["duration_ms"] for s in relevant)

    avg = round(sum(durations) / len(durations), 2) if durations else None

    return {
        "samples": trimmed,
        "count": len(relevant),
        "avg_ms": avg,
        "p50_ms": _percentile(durations, 50),
        "p95_ms": _percentile(durations, 95),
    }


class RequestTimingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000.0
        path = request.url.path
        bid = extract_business_id(path)
        try:
            status_code = response.status_code
        except Exception:
            status_code = 0
        # Only store API traffic (keeps dashboard focused on backend latency).
        if path.startswith("/api"):
            _record(
                duration_ms=duration_ms,
                path=path,
                method=request.method,
                status_code=status_code,
                business_id=bid,
            )
        return response
