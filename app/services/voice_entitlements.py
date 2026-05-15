"""
Subscription-aware voice stack (OpenAI vs ElevenLabs) for Twilio voice calls.

Plans (Business.subscription_plan):
- free: OpenAI Whisper + OpenAI TTS only
- basic, premium: ElevenLabs STT + TTS when ELEVENLABS_API_KEY is set and subscription is active

ai_voice_settings JSON may include:
- voice_stack: "openai" | "elevenlabs" (optional; must match plan entitlements)
- elevenlabs_voice_id: str (optional; must be in allowed list for the plan)
- voice_profiles: optional dict with "default" (and later "after_hours") containing
  preset_id, tone, speed, expressive — synced to voice_stack / elevenlabs_voice_id on save
"""
from __future__ import annotations

from typing import Any, Literal, TypedDict

from app.core.config import settings
from app.services.voice_presets import resolve_preset_voice_ref

VoiceStack = Literal["openai", "elevenlabs"]


class VoiceOptionsResponse(TypedDict, total=False):
    """Payload for GET .../voice/options (settings UI)."""

    stack: VoiceStack
    subscription_plan: str
    subscription_active: bool
    elevenlabs_configured: bool
    can_use_elevenlabs: bool
    allowed_voice_ids: list[str]
    default_voice_id: str
    selected_voice_id: str
    presets: list[dict[str, Any]]
    preview_sample_text: str
    selected_preset_id: str


def _plan_key(plan: str | None) -> str:
    return (plan or "free").strip().lower()


def plan_allows_elevenlabs(plan: str | None) -> bool:
    """Whether this tier may use ElevenLabs (still requires API key + active sub)."""
    return _plan_key(plan) in ("basic", "premium")


def subscription_is_active(status: str | None) -> bool:
    return (status or "active").strip().lower() == "active"


def elevenlabs_api_configured() -> bool:
    return bool(getattr(settings, "ELEVENLABS_API_KEY", None) and settings.ELEVENLABS_API_KEY.strip())


def premium_voice_ids_list() -> list[str]:
    raw = (getattr(settings, "ELEVENLABS_PREMIUM_VOICE_IDS", "") or "").strip()
    if not raw:
        return []
    return [x.strip() for x in raw.split(",") if x.strip()]


def allowed_elevenlabs_voice_ids(plan: str | None) -> list[str]:
    """
    Voice IDs the business may select in settings for this plan.
    basic: default only
    premium: default + ELEVENLABS_PREMIUM_VOICE_IDS
    """
    default_vid = (settings.ELEVENLABS_DEFAULT_VOICE_ID or "").strip() or "21m00Tcm4TlvDq8ikWAM"
    pk = _plan_key(plan)
    if pk == "premium":
        extras = premium_voice_ids_list()
        out: list[str] = [default_vid]
        for e in extras:
            if e not in out:
                out.append(e)
        return out
    if pk == "basic":
        return [default_vid]
    return []


def resolve_voice_stack(
    subscription_plan: str | None,
    subscription_status: str | None,
    ai_voice: dict[str, Any] | None,
) -> VoiceStack:
    """
    Effective STT/TTS stack for this call.
    """
    ai_voice = ai_voice or {}
    if not elevenlabs_api_configured():
        return "openai"
    if not subscription_is_active(subscription_status):
        return "openai"
    if not plan_allows_elevenlabs(subscription_plan):
        return "openai"

    requested = (ai_voice.get("voice_stack") or "").strip().lower()
    if requested == "openai":
        return "openai"
    if requested == "elevenlabs":
        return "elevenlabs"
    # Default for entitled plans: ElevenLabs when configured
    return "elevenlabs"


def resolve_elevenlabs_voice_id(subscription_plan: str | None, ai_voice: dict[str, Any] | None) -> str:
    """Pick ElevenLabs voice ID from settings, validated against plan allowlist."""
    ai_voice = ai_voice or {}
    allowed = allowed_elevenlabs_voice_ids(subscription_plan)
    default_vid = (settings.ELEVENLABS_DEFAULT_VOICE_ID or "").strip() or "21m00Tcm4TlvDq8ikWAM"
    if not allowed:
        return default_vid
    raw = (ai_voice.get("elevenlabs_voice_id") or "").strip()
    if raw and raw in allowed:
        return raw
    return allowed[0]


def _sanitize_voice_profiles(out: dict[str, Any]) -> None:
    """Keep only known keys on voice_profiles.default / after_hours."""
    vp = out.get("voice_profiles")
    if not isinstance(vp, dict):
        if vp is not None and not isinstance(vp, dict):
            out.pop("voice_profiles", None)
        return
    clean: dict[str, Any] = {}
    for slot in ("default", "after_hours"):
        raw = vp.get(slot)
        if not isinstance(raw, dict):
            continue
        slot_out: dict[str, Any] = {}
        pid = str(raw.get("preset_id") or "").strip()
        if pid:
            slot_out["preset_id"] = pid[:128]
        tone = str(raw.get("tone") or "").strip().lower()
        if tone in ("friendly", "professional", "energetic"):
            slot_out["tone"] = tone
        try:
            sp = float(raw.get("speed"))
            if 0.75 <= sp <= 1.35:
                slot_out["speed"] = sp
        except (TypeError, ValueError):
            pass
        if "expressive" in raw:
            slot_out["expressive"] = bool(raw.get("expressive"))
        if slot_out:
            clean[slot] = slot_out
    if clean:
        out["voice_profiles"] = clean
    else:
        out.pop("voice_profiles", None)


def _sync_legacy_keys_from_preset(
    out: dict[str, Any],
    subscription_plan: str | None,
) -> None:
    """Apply voice_profiles.default.preset_id to voice_stack and elevenlabs_voice_id."""
    vp = out.get("voice_profiles")
    if not isinstance(vp, dict):
        return
    default = vp.get("default")
    if not isinstance(default, dict):
        return
    pid = str(default.get("preset_id") or "").strip()
    if not pid:
        return
    allowed = allowed_elevenlabs_voice_ids(subscription_plan)
    default_vid = (settings.ELEVENLABS_DEFAULT_VOICE_ID or "").strip() or "21m00Tcm4TlvDq8ikWAM"
    allow_list = allowed if allowed else [default_vid]
    stack, ref = resolve_preset_voice_ref(
        pid,
        allowed_elevenlabs_ids=allow_list,
        default_elevenlabs_id=allow_list[0],
    )
    can_el = plan_allows_elevenlabs(subscription_plan) and elevenlabs_api_configured()

    if stack == "elevenlabs" and not can_el:
        out["voice_stack"] = "openai"
        out.pop("elevenlabs_voice_id", None)
        return

    if stack == "elevenlabs":
        out["voice_stack"] = "elevenlabs"
        if ref in allow_list:
            out["elevenlabs_voice_id"] = ref
        elif allow_list:
            out["elevenlabs_voice_id"] = allow_list[0]
    else:
        out["voice_stack"] = "openai"
        out.pop("elevenlabs_voice_id", None)


def validate_ai_voice_settings(
    subscription_plan: str | None,
    ai_voice: dict[str, Any] | None,
) -> dict[str, Any]:
    """Sanitize ai_voice_settings: voice_stack and elevenlabs_voice_id must match plan."""
    out = dict(ai_voice or {})
    _sanitize_voice_profiles(out)
    vs = str(out.get("voice_stack") or "").strip().lower()
    if vs and vs not in ("openai", "elevenlabs"):
        out.pop("voice_stack", None)
    elif vs == "elevenlabs":
        if not plan_allows_elevenlabs(subscription_plan) or not elevenlabs_api_configured():
            out["voice_stack"] = "openai"
    vid = str(out.get("elevenlabs_voice_id") or "").strip()
    if vid:
        allowed = allowed_elevenlabs_voice_ids(subscription_plan)
        if not allowed or vid not in allowed:
            out.pop("elevenlabs_voice_id", None)
    _sync_legacy_keys_from_preset(out, subscription_plan)
    # Re-validate stack/id after preset sync
    vs2 = str(out.get("voice_stack") or "").strip().lower()
    if vs2 == "elevenlabs":
        if not plan_allows_elevenlabs(subscription_plan) or not elevenlabs_api_configured():
            out["voice_stack"] = "openai"
            out.pop("elevenlabs_voice_id", None)
    vid2 = str(out.get("elevenlabs_voice_id") or "").strip()
    if vid2:
        allowed = allowed_elevenlabs_voice_ids(subscription_plan)
        if not allowed or vid2 not in allowed:
            out.pop("elevenlabs_voice_id", None)
    return out


def build_voice_options(
    subscription_plan: str | None,
    subscription_status: str | None,
    ai_voice: dict[str, Any] | None,
) -> VoiceOptionsResponse:
    from app.services.voice_presets import build_preset_list_for_api

    ai_voice = ai_voice or {}
    pk = _plan_key(subscription_plan)
    active = subscription_is_active(subscription_status)
    elab = elevenlabs_api_configured()
    can_el = active and plan_allows_elevenlabs(subscription_plan) and elab
    allowed = allowed_elevenlabs_voice_ids(subscription_plan) if can_el else []
    default_vid = (settings.ELEVENLABS_DEFAULT_VOICE_ID or "").strip() or "21m00Tcm4TlvDq8ikWAM"
    sel = resolve_elevenlabs_voice_id(subscription_plan, ai_voice) if can_el else default_vid
    stack = resolve_voice_stack(subscription_plan, subscription_status, ai_voice)
    presets = build_preset_list_for_api(
        can_use_elevenlabs=can_el,
        allowed_elevenlabs_ids=allowed,
    )
    vp = ai_voice.get("voice_profiles") if isinstance(ai_voice.get("voice_profiles"), dict) else {}
    default_prof = vp.get("default") if isinstance(vp, dict) else {}
    selected_preset_id = ""
    if isinstance(default_prof, dict):
        selected_preset_id = str(default_prof.get("preset_id") or "").strip()
    if not selected_preset_id:
        # Derive from legacy stack
        selected_preset_id = (
            "elevenlabs_default" if stack == "elevenlabs" and can_el else "openai_professional"
        )
    preview_sample_text = (
        "Hi, thanks for calling {business_name}, how can I help you today?"
    )
    return {
        "stack": stack,
        "subscription_plan": pk,
        "subscription_active": active,
        "elevenlabs_configured": elab,
        "can_use_elevenlabs": can_el,
        "allowed_voice_ids": allowed,
        "default_voice_id": default_vid,
        "selected_voice_id": sel,
        "presets": presets,
        "preview_sample_text": preview_sample_text,
        "selected_preset_id": selected_preset_id,
    }
