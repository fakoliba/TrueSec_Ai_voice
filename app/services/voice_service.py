"""
Voice processing: Speech-to-Text and Text-to-Speech for Twilio.

Uses pluggable providers (OpenAI, ElevenLabs) — see app.services.voice.providers.
"""
from __future__ import annotations

import logging
from typing import Any, Literal, Optional

from app.core.config import settings
from app.services.voice.providers.elevenlabs_provider import ElevenLabsVoiceProvider
from app.services.voice.providers.openai_provider import OpenAIVoiceProvider

logger = logging.getLogger(__name__)

VoiceProviderUsed = Literal["openai", "elevenlabs"]

_openai_provider = OpenAIVoiceProvider()
_elevenlabs_provider = ElevenLabsVoiceProvider()


def _openai_transcribe(audio_bytes: bytes, filename: str = "audio.mp3") -> Optional[str]:
    return _openai_provider.transcribe(audio_bytes, filename)


def _elevenlabs_transcribe(audio_bytes: bytes, filename: str = "audio.mp3") -> Optional[str]:
    return _elevenlabs_provider.transcribe(audio_bytes, filename)


def _openai_tts(
    text: str,
    voice: str = "alloy",
    model: str = "tts-1",
    speed: Optional[float] = None,
) -> Optional[bytes]:
    return _openai_provider.synthesize(text, voice=voice, model=model, speed=speed)


def _elevenlabs_tts(
    text: str,
    voice_id: str,
    *,
    voice_settings: Optional[dict[str, Any]] = None,
) -> Optional[bytes]:
    return _elevenlabs_provider.synthesize(
        text,
        voice_id,
        voice_settings=voice_settings,
    )


def transcribe_audio(
    audio_bytes: bytes,
    filename: str = "audio.mp3",
    *,
    stack: Literal["openai", "elevenlabs"] = "openai",
) -> tuple[Optional[str], VoiceProviderUsed]:
    """
    Transcribe audio to text. Returns (text, provider_used).
    ElevenLabs first when stack is elevenlabs; falls back to OpenAI on failure.
    """
    if stack == "elevenlabs":
        text = _elevenlabs_transcribe(audio_bytes, filename)
        if text:
            return text, "elevenlabs"
        text = _openai_transcribe(audio_bytes, filename)
        return text, "openai"
    text = _openai_transcribe(audio_bytes, filename)
    return text, "openai"


def text_to_speech(
    text: str,
    *,
    stack: Literal["openai", "elevenlabs"] = "openai",
    openai_voice: str = "alloy",
    openai_model: str = "tts-1",
    elevenlabs_voice_id: Optional[str] = None,
    speed: Optional[float] = None,
    elevenlabs_voice_settings: Optional[dict[str, Any]] = None,
) -> tuple[Optional[bytes], VoiceProviderUsed]:
    """
    Convert text to speech (MP3). Returns (audio_bytes, provider_used).
    ``speed`` applies to OpenAI TTS when set (0.25–4.0); optional for ElevenLabs via voice_settings.
    """
    if stack == "elevenlabs":
        vid = (elevenlabs_voice_id or settings.ELEVENLABS_DEFAULT_VOICE_ID or "").strip()
        audio = _elevenlabs_tts(
            text,
            vid,
            voice_settings=elevenlabs_voice_settings,
        )
        if audio:
            return audio, "elevenlabs"
        audio = _openai_tts(text, openai_voice, openai_model, speed=speed)
        return audio, "openai"
    audio = _openai_tts(text, openai_voice, openai_model, speed=speed)
    return audio, "openai"


def synthesize_for_preview(
    *,
    stack: Literal["openai", "elevenlabs"],
    text: str,
    openai_voice: str = "alloy",
    elevenlabs_voice_id: Optional[str] = None,
    speed: Optional[float] = None,
) -> tuple[Optional[bytes], VoiceProviderUsed]:
    """
    TTS for dashboard preview; same rules as live calls but exposed for /voice/preview.
    """
    return text_to_speech(
        text,
        stack=stack,
        openai_voice=openai_voice,
        elevenlabs_voice_id=elevenlabs_voice_id,
        speed=speed,
    )
