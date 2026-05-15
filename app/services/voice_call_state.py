"""
Call state for Twilio voice flow.
Uses Redis when REDIS_URL is set (multi-instance, persistence); otherwise in-memory.
Maps CallSid -> business_id, conversation_id, messages, turn_count, call_log_id, slots (for slot-filling).
Also caches TTS audio by token for Twilio <Play> URL.
"""
import json
import logging
import time
import uuid
from typing import Any, Dict, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

_STATE_TTL_SEC = 3600
_AUDIO_TTL_SEC = 300
MAX_TURNS = 10

# In-memory fallback when Redis is not configured
_memory_state: Dict[str, Dict[str, Any]] = {}
_memory_audio: Dict[str, bytes] = {}
_memory_state_ts: Dict[str, float] = {}
_memory_audio_ts: Dict[str, float] = {}

_redis_client: Optional[Any] = None
_STATE_PREFIX = "voice:state:"
_AUDIO_PREFIX = "voice:audio:"


def _get_redis():
    global _redis_client
    if getattr(settings, "REDIS_URL", None) and settings.REDIS_URL:
        if _redis_client is None:
            try:
                import redis
                _redis_client = redis.Redis.from_url(
                    settings.REDIS_URL,
                    decode_responses=False,
                )
                _redis_client.ping()
            except Exception as e:
                logger.warning("Redis connection failed, using in-memory voice state: %s", e)
                _redis_client = False  # type: ignore
        return _redis_client if _redis_client is not False else None
    return None


def _clean_expired_memory(
    store: Dict[str, Any],
    timestamps: Dict[str, float],
    ttl: int,
) -> None:
    now = time.time()
    expired = [k for k, ts in timestamps.items() if now - ts > ttl]
    for k in expired:
        store.pop(k, None)
        timestamps.pop(k, None)


def get_call_state(call_sid: str) -> Optional[Dict[str, Any]]:
    r = _get_redis()
    if r is not None:
        try:
            raw = r.get(_STATE_PREFIX + call_sid)
            if raw:
                return json.loads(raw)
            return None
        except Exception as e:
            logger.warning("Redis get_call_state failed: %s", e)
            return None
    _clean_expired_memory(_memory_state, _memory_state_ts, _STATE_TTL_SEC)
    return _memory_state.get(call_sid)


def set_call_state(call_sid: str, state: Dict[str, Any]) -> None:
    r = _get_redis()
    if r is not None:
        try:
            key = _STATE_PREFIX + call_sid
            r.setex(key, _STATE_TTL_SEC, json.dumps(state, default=str))
            return
        except Exception as e:
            logger.warning("Redis set_call_state failed: %s", e)
    _memory_state[call_sid] = state
    _memory_state_ts[call_sid] = time.time()


def init_call_state(call_sid: str, business_id: int) -> Dict[str, Any]:
    state: Dict[str, Any] = {
        "business_id": business_id,
        "conversation_id": None,
        "call_log_id": None,
        "messages": [],
        "turn_count": 0,
        "phone_number": None,
        "slots": {},
        "slot_intent": None,
        # Cancel / reschedule (Phase 2)
        "manage_kind": None,
        "manage_step": None,
        "manage_appointment_ids": [],
        "manage_selected_appointment_id": None,
        "manage_slots": {},
        "manage_name_tried": None,
        # New vs returning (Phase 3) — used for analytics / future routing
        "customer_route": None,
    }
    set_call_state(call_sid, state)
    return state


def store_audio_token(token: str, audio_bytes: bytes) -> None:
    r = _get_redis()
    if r is not None:
        try:
            key = _AUDIO_PREFIX + token
            r.setex(key, _AUDIO_TTL_SEC, audio_bytes)
            return
        except Exception as e:
            logger.warning("Redis store_audio_token failed: %s", e)
    _memory_audio[token] = audio_bytes
    _memory_audio_ts[token] = time.time()


def get_audio_by_token(token: str) -> Optional[bytes]:
    r = _get_redis()
    if r is not None:
        try:
            raw = r.get(_AUDIO_PREFIX + token)
            return raw if raw else None
        except Exception as e:
            logger.warning("Redis get_audio_by_token failed: %s", e)
            return None
    _clean_expired_memory(_memory_audio, _memory_audio_ts, _AUDIO_TTL_SEC)  # type: ignore
    return _memory_audio.get(token)


def generate_audio_token() -> str:
    return str(uuid.uuid4())
