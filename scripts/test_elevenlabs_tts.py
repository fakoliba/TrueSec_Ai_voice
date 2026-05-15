#!/usr/bin/env python3
"""
Local smoke test for ElevenLabs TTS (same URL/body as app/services/voice/providers/elevenlabs_provider.py).

Usage (from repo root, with venv activated):

  export ELEVENLABS_API_KEY=sk_...
  # optional:
  # export ELEVENLABS_DEFAULT_VOICE_ID=21m00Tcm4TlvDq8ikWAM
  ./venv/bin/python scripts/test_elevenlabs_tts.py

Or load .env automatically if python-dotenv is installed:

  ./venv/bin/python scripts/test_elevenlabs_tts.py

Writes /tmp/elevenlabs_test.mp3 on success.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:
    pass

import httpx

DEFAULT_VOICE = os.getenv("ELEVENLABS_DEFAULT_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")
MODEL_ID = os.getenv("ELEVENLABS_TTS_MODEL_ID", "eleven_multilingual_v2")
KEY = (os.getenv("ELEVENLABS_API_KEY") or "").strip()

TEXT = "Hi, thanks for calling our business, how can I help you today?"


def main() -> int:
    if not KEY:
        print("ERROR: Set ELEVENLABS_API_KEY in the environment or in .env", file=sys.stderr)
        return 1

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{DEFAULT_VOICE}"
    headers = {
        "xi-api-key": KEY,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
    }
    body = {"text": TEXT[:4096], "model_id": MODEL_ID}

    print("POST", url)
    print("model_id:", MODEL_ID)
    print("voice_id:", DEFAULT_VOICE)

    try:
        with httpx.Client(timeout=120.0) as client:
            r = client.post(url, headers=headers, content=json.dumps(body))
    except Exception as e:
        print("REQUEST FAILED:", e, file=sys.stderr)
        return 1

    print("HTTP status:", r.status_code)
    if r.status_code != 200:
        print("Body:", r.text[:2000], file=sys.stderr)
        return 1

    out = Path("/tmp/elevenlabs_test.mp3")
    out.write_bytes(r.content)
    print("OK: wrote", out, "size", len(r.content), "bytes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
