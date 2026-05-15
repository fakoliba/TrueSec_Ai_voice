"""OpenAI Whisper (STT) + TTS provider."""
from __future__ import annotations

import io
import logging
from typing import Optional

from openai import OpenAI

from app.core.config import settings

logger = logging.getLogger(__name__)


class OpenAIVoiceProvider:
    """OpenAI Whisper + audio speech API."""

    def transcribe(self, audio_bytes: bytes, filename: str = "audio.mp3") -> Optional[str]:
        if not getattr(settings, "OPENAI_API_KEY", None) or not settings.OPENAI_API_KEY:
            return None
        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        try:
            file_like = io.BytesIO(audio_bytes)
            file_like.name = filename
            resp = client.audio.transcriptions.create(
                model="whisper-1",
                file=file_like,
            )
            return (resp.text or "").strip() if resp else None
        except Exception as e:
            logger.warning("OpenAI Whisper transcription failed: %s", e)
            return None

    def synthesize(
        self,
        text: str,
        *,
        voice: str = "alloy",
        model: str = "tts-1",
        speed: Optional[float] = None,
    ) -> Optional[bytes]:
        if not getattr(settings, "OPENAI_API_KEY", None) or not settings.OPENAI_API_KEY:
            return None
        if not (text or "").strip():
            return None
        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        try:
            kwargs = {
                "model": model,
                "voice": voice,
                "input": text[:4096],
            }
            # OpenAI speech API supports speed on tts-1 and tts-1-hd (0.25–4.0)
            if speed is not None and 0.25 <= speed <= 4.0:
                kwargs["speed"] = speed
            response = client.audio.speech.create(**kwargs)
            return response.content
        except TypeError:
            # Older SDK without speed
            try:
                response = client.audio.speech.create(
                    model=model,
                    voice=voice,
                    input=text[:4096],
                )
                return response.content
            except Exception as e2:
                logger.warning("OpenAI TTS failed: %s", e2)
                return None
        except Exception as e:
            logger.warning("OpenAI TTS failed: %s", e)
            return None
