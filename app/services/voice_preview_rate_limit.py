"""Simple in-memory rate limit for POST /voice/preview (per process)."""
from __future__ import annotations

import time
from collections import defaultdict
from threading import Lock

_lock = Lock()
# key -> list of monotonic timestamps in the last window
_buckets: dict[tuple[int, int], list[float]] = defaultdict(list)


def check_voice_preview_allowed(
    business_id: int,
    user_id: int,
    *,
    max_per_minute: int,
    window_seconds: float = 60.0,
) -> bool:
    """Return True if this request is allowed. Best-effort; resets on process restart."""
    now = time.monotonic()
    key = (business_id, user_id)
    with _lock:
        bucket = _buckets[key]
        cutoff = now - window_seconds
        while bucket and bucket[0] < cutoff:
            bucket.pop(0)
        if len(bucket) >= max_per_minute:
            return False
        bucket.append(now)
        return True
