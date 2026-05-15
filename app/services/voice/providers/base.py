"""Voice provider protocol for plug-and-play STT/TTS backends."""
from __future__ import annotations

from typing import Optional, Protocol


class VoiceSTTProvider(Protocol):
    """Speech-to-text for one backend."""

    def transcribe(self, audio_bytes: bytes, filename: str = "audio.mp3") -> Optional[str]:
        ...
