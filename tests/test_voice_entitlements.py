"""Tests for subscription-aware voice stack resolution."""

from app.services import voice_entitlements as ve


def test_free_plan_always_openai(monkeypatch):
    monkeypatch.setattr(ve.settings, "ELEVENLABS_API_KEY", "sk-test")
    assert (
        ve.resolve_voice_stack("free", "active", {"voice_stack": "elevenlabs"}) == "openai"
    )
    assert ve.resolve_voice_stack("free", "active", {}) == "openai"


def test_basic_plan_elevenlabs_when_configured(monkeypatch):
    monkeypatch.setattr(ve.settings, "ELEVENLABS_API_KEY", "sk-test")
    assert ve.resolve_voice_stack("basic", "active", {}) == "elevenlabs"
    assert ve.resolve_voice_stack("basic", "active", {"voice_stack": "openai"}) == "openai"


def test_basic_defaults_openai_without_api_key(monkeypatch):
    monkeypatch.setattr(ve.settings, "ELEVENLABS_API_KEY", None)
    assert ve.resolve_voice_stack("basic", "active", {}) == "openai"


def test_inactive_subscription_uses_openai(monkeypatch):
    monkeypatch.setattr(ve.settings, "ELEVENLABS_API_KEY", "sk-test")
    assert ve.resolve_voice_stack("premium", "suspended", {}) == "openai"


def test_allowed_voices_basic_single_default(monkeypatch):
    monkeypatch.setattr(ve.settings, "ELEVENLABS_DEFAULT_VOICE_ID", "voice-a")
    assert ve.allowed_elevenlabs_voice_ids("basic") == ["voice-a"]


def test_allowed_voices_premium_includes_extras(monkeypatch):
    monkeypatch.setattr(ve.settings, "ELEVENLABS_DEFAULT_VOICE_ID", "voice-a")
    monkeypatch.setattr(ve.settings, "ELEVENLABS_PREMIUM_VOICE_IDS", "voice-b,voice-c")
    ids = ve.allowed_elevenlabs_voice_ids("premium")
    assert ids == ["voice-a", "voice-b", "voice-c"]


def test_validate_strips_elevenlabs_for_free(monkeypatch):
    monkeypatch.setattr(ve.settings, "ELEVENLABS_API_KEY", "sk-test")
    out = ve.validate_ai_voice_settings(
        "free",
        {"voice_stack": "elevenlabs", "elevenlabs_voice_id": "x"},
    )
    assert out.get("voice_stack") == "openai"
    assert "elevenlabs_voice_id" not in out


def test_validate_keeps_voice_for_premium(monkeypatch):
    monkeypatch.setattr(ve.settings, "ELEVENLABS_API_KEY", "sk-test")
    monkeypatch.setattr(ve.settings, "ELEVENLABS_DEFAULT_VOICE_ID", "vid1")
    monkeypatch.setattr(ve.settings, "ELEVENLABS_PREMIUM_VOICE_IDS", "vid2")
    out = ve.validate_ai_voice_settings(
        "premium",
        {"voice_stack": "elevenlabs", "elevenlabs_voice_id": "vid2"},
    )
    assert out["voice_stack"] == "elevenlabs"
    assert out["elevenlabs_voice_id"] == "vid2"


def test_build_voice_options_premium_lists_allowed_ids(monkeypatch):
    monkeypatch.setattr(ve.settings, "ELEVENLABS_API_KEY", "sk-test")
    monkeypatch.setattr(ve.settings, "ELEVENLABS_DEFAULT_VOICE_ID", "vid1")
    monkeypatch.setattr(ve.settings, "ELEVENLABS_PREMIUM_VOICE_IDS", "vid2")
    opts = ve.build_voice_options("premium", "active", {})
    assert opts["can_use_elevenlabs"] is True
    assert opts["allowed_voice_ids"] == ["vid1", "vid2"]
    assert opts["stack"] == "elevenlabs"


def test_build_voice_options_free_cannot_use_elevenlabs(monkeypatch):
    monkeypatch.setattr(ve.settings, "ELEVENLABS_API_KEY", "sk-test")
    opts = ve.build_voice_options("free", "active", {})
    assert opts["can_use_elevenlabs"] is False
    assert opts["allowed_voice_ids"] == []
    assert opts["stack"] == "openai"
