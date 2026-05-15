"""ElevenLabs STT + TTS provider."""
from __future__ import annotations

import json
import logging
from typing import Any, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class ElevenLabsVoiceProvider:
    """ElevenLabs speech-to-text and text-to-speech."""

    def transcribe(self, audio_bytes: bytes, filename: str = "audio.mp3") -> Optional[str]:
        key = getattr(settings, "ELEVENLABS_API_KEY", None) or ""
        if not key.strip():
            return None
        model_id = (getattr(settings, "ELEVENLABS_STT_MODEL_ID", None) or "scribe_v1").strip()
        url = "https://api.elevenlabs.io/v1/speech-to-text"
        headers = {"xi-api-key": key.strip()}
        try:
            with httpx.Client(timeout=60.0) as client:
                files = {"file": (filename, audio_bytes, "application/octet-stream")}
                data = {"model_id": model_id}
                r = client.post(url, headers=headers, files=files, data=data)
                if r.status_code != 200:
                    logger.warning(
                        "ElevenLabs STT failed status=%s body=%s",
                        r.status_code,
                        r.text[:500],
                    )
                    return None
                payload = r.json()
        except Exception as e:
            logger.warning("ElevenLabs STT request failed: %s", e)
            return None

        if isinstance(payload, dict):
            if "text" in payload and isinstance(payload["text"], str):
                return payload["text"].strip()
            tscripts = payload.get("transcripts")
            if isinstance(tscripts, list) and tscripts:
                first = tscripts[0]
                if isinstance(first, dict) and isinstance(first.get("text"), str):
                    return first["text"].strip()
        return None

    def synthesize(
        self,
        text: str,
        voice_id: str,
        *,
        model_id: Optional[str] = None,
        voice_settings: Optional[dict[str, Any]] = None,
    ) -> Optional[bytes]:
        key = getattr(settings, "ELEVENLABS_API_KEY", None) or ""
        if not key.strip():
            return None
        if not (text or "").strip():
            return None
        vid = (voice_id or "").strip() or (settings.ELEVENLABS_DEFAULT_VOICE_ID or "").strip()
        mid = (model_id or getattr(settings, "ELEVENLABS_TTS_MODEL_ID", None) or "eleven_multilingual_v2").strip()
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{vid}"
        headers = {
            "xi-api-key": key.strip(),
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        }
        body: dict[str, Any] = {
            "text": text[:4096],
            "model_id": mid,
        }
        if voice_settings:
            body["voice_settings"] = voice_settings
        try:
            with httpx.Client(timeout=120.0) as client:
                r = client.post(url, headers=headers, content=json.dumps(body))
                if r.status_code != 200:
                    logger.warning(
                        "ElevenLabs TTS failed status=%s body=%s",
                        r.status_code,
                        r.text[:500],
                    )
                    return None
                return r.content
        except Exception as e:
            logger.warning("ElevenLabs TTS request failed: %s", e)
            return None
