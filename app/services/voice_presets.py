"""
Human-friendly voice presets for the dashboard (no raw provider IDs in UI).

Each preset maps to OpenAI voice name or ElevenLabs voice_id from allowlist at runtime.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

from app.core.config import settings

StackHint = Literal["openai", "elevenlabs"]


@dataclass(frozen=True)
class VoicePresetDefinition:
    id: str
    label: str
    subtitle: str
    stack: StackHint
    # For openai: voice name (alloy, nova, ...). For elevenlabs: must match allowed ID at runtime.
    voice_ref: str
    recommended: bool = False


# Catalog: OpenAI-first presets work on all plans; ElevenLabs presets need plan + API key.
PRESET_DEFINITIONS: tuple[VoicePresetDefinition, ...] = (
    VoicePresetDefinition(
        id="openai_professional",
        label="Professional (balanced)",
        subtitle="Clear, neutral tone — works on every plan",
        stack="openai",
        voice_ref="alloy",
        recommended=True,
    ),
    VoicePresetDefinition(
        id="openai_warm",
        label="Warm & friendly",
        subtitle="Softer delivery for hospitality and care",
        stack="openai",
        voice_ref="nova",
    ),
    VoicePresetDefinition(
        id="openai_energetic",
        label="Energetic assistant",
        subtitle="Upbeat for sales and promotions",
        stack="openai",
        voice_ref="shimmer",
    ),
    VoicePresetDefinition(
        id="elevenlabs_default",
        label="Premium natural voice",
        subtitle="ElevenLabs — best when your plan includes it",
        stack="elevenlabs",
        voice_ref="",  # resolved to default_voice_id at runtime
        recommended=True,
    ),
)


def _default_elevenlabs_id() -> str:
    return (settings.ELEVENLABS_DEFAULT_VOICE_ID or "").strip() or "21m00Tcm4TlvDq8ikWAM"


def resolve_preset_voice_ref(
    preset_id: str,
    *,
    allowed_elevenlabs_ids: list[str],
    default_elevenlabs_id: str,
) -> tuple[StackHint, str]:
    """
    Return (stack, voice_ref) for TTS. voice_ref is OpenAI voice name or ElevenLabs voice ID.
    """
    for p in PRESET_DEFINITIONS:
        if p.id == preset_id:
            if p.stack == "elevenlabs":
                if not p.voice_ref.strip():
                    vid = default_elevenlabs_id
                    if allowed_elevenlabs_ids and vid not in allowed_elevenlabs_ids:
                        vid = allowed_elevenlabs_ids[0]
                    return "elevenlabs", vid
                raw = p.voice_ref.strip()
                if allowed_elevenlabs_ids and raw in allowed_elevenlabs_ids:
                    return "elevenlabs", raw
                return "elevenlabs", default_elevenlabs_id
            return "openai", p.voice_ref.strip() or "alloy"
    # Unknown preset → OpenAI alloy
    return "openai", "alloy"


def build_preset_list_for_api(
    *,
    can_use_elevenlabs: bool,
    allowed_elevenlabs_ids: list[str],
) -> list[dict[str, Any]]:
    """Presets for GET /voice/options (labels only; voice_ref is opaque to clients)."""
    out: list[dict[str, Any]] = []
    for p in PRESET_DEFINITIONS:
        if p.stack == "elevenlabs" and not can_use_elevenlabs:
            continue
        out.append(
            {
                "id": p.id,
                "label": p.label,
                "subtitle": p.subtitle,
                "provider": p.stack,
                "recommended": p.recommended,
            }
        )
    return out
