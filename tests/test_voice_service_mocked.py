"""
Mocked HTTP / provider tests for app.services.voice_service (no real OpenAI or ElevenLabs calls).
"""
from unittest.mock import MagicMock

import pytest

from app.services import voice_service as vs
from app.services.voice.providers import elevenlabs_provider as elp


@pytest.fixture
def mock_httpx_client_for_stt(monkeypatch):
    """Return a fake httpx.Client whose post() returns ElevenLabs STT JSON."""

    def factory(*args, **kwargs):
        client = MagicMock()

        def post(url, **kw):
            resp = MagicMock()
            resp.status_code = 200
            resp.json = lambda: {"text": "hello from elevenlabs"}
            return resp

        client.__enter__ = lambda s: client
        client.__exit__ = lambda *a: None
        client.post = post
        return client

    monkeypatch.setattr(elp.httpx, "Client", factory)
    return factory


@pytest.fixture
def mock_httpx_client_for_tts(monkeypatch):
    """Return a fake httpx.Client whose post() returns MP3 bytes."""

    def factory(*args, **kwargs):
        client = MagicMock()

        def post(url, **kw):
            resp = MagicMock()
            resp.status_code = 200
            resp.content = b"\xff\xfb\x90\x00"  # minimal MP3-ish bytes
            resp.text = ""
            return resp

        client.__enter__ = lambda s: client
        client.__exit__ = lambda *a: None
        client.post = post
        return client

    monkeypatch.setattr(elp.httpx, "Client", factory)
    return factory


def test_transcribe_audio_elevenlabs_stack_uses_elevenlabs_when_http_ok(
    monkeypatch, mock_httpx_client_for_stt
):
    monkeypatch.setattr(vs.settings, "ELEVENLABS_API_KEY", "xi-test-key")
    monkeypatch.setattr(vs.settings, "ELEVENLABS_STT_MODEL_ID", "scribe_v1")

    text, provider = vs.transcribe_audio(b"\x00\x01", "rec.mp3", stack="elevenlabs")
    assert text == "hello from elevenlabs"
    assert provider == "elevenlabs"


def test_transcribe_audio_elevenlabs_falls_back_to_openai(monkeypatch):
    monkeypatch.setattr(vs.settings, "ELEVENLABS_API_KEY", "xi-test-key")
    monkeypatch.setattr(vs, "_elevenlabs_transcribe", lambda *a, **k: None)
    monkeypatch.setattr(vs, "_openai_transcribe", lambda *a, **k: "whisper text")

    text, provider = vs.transcribe_audio(b"audio", stack="elevenlabs")
    assert text == "whisper text"
    assert provider == "openai"


def test_transcribe_audio_openai_stack_only_calls_openai(monkeypatch):
    monkeypatch.setattr(vs, "_openai_transcribe", lambda *a, **k: "only openai")
    el_calls = {"n": 0}
    monkeypatch.setattr(
        vs,
        "_elevenlabs_transcribe",
        lambda *a, **k: el_calls.__setitem__("n", el_calls["n"] + 1) or None,
    )

    text, provider = vs.transcribe_audio(b"x", stack="openai")
    assert text == "only openai"
    assert provider == "openai"
    assert el_calls["n"] == 0


def test_text_to_speech_elevenlabs_stack_uses_elevenlabs_when_http_ok(
    monkeypatch, mock_httpx_client_for_tts
):
    monkeypatch.setattr(vs.settings, "ELEVENLABS_API_KEY", "xi-test-key")
    monkeypatch.setattr(vs.settings, "ELEVENLABS_DEFAULT_VOICE_ID", "voice-id-1")
    monkeypatch.setattr(vs.settings, "ELEVENLABS_TTS_MODEL_ID", "eleven_multilingual_v2")

    audio, provider = vs.text_to_speech(
        "Say this",
        stack="elevenlabs",
        elevenlabs_voice_id="voice-id-1",
    )
    assert audio == b"\xff\xfb\x90\x00"
    assert provider == "elevenlabs"


def test_text_to_speech_elevenlabs_falls_back_to_openai(monkeypatch):
    monkeypatch.setattr(vs.settings, "ELEVENLABS_API_KEY", "xi-test-key")
    monkeypatch.setattr(vs, "_elevenlabs_tts", lambda *a, **k: None)
    monkeypatch.setattr(vs, "_openai_tts", lambda *a, **k: b"openai-mp3")

    audio, provider = vs.text_to_speech("hi", stack="elevenlabs", elevenlabs_voice_id="v1")
    assert audio == b"openai-mp3"
    assert provider == "openai"


def test_text_to_speech_openai_stack(monkeypatch):
    monkeypatch.setattr(vs, "_openai_tts", lambda *a, **k: b"oaudio")
    monkeypatch.setattr(
        vs,
        "_elevenlabs_tts",
        lambda *a, **k: (_ for _ in ()).throw(AssertionError("should not call ElevenLabs")),
    )

    audio, provider = vs.text_to_speech("hi", stack="openai")
    assert audio == b"oaudio"
    assert provider == "openai"
