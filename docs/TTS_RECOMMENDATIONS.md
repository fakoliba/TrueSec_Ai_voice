# TTS Recommendations: More Human-Like Voice with Tone / Gender / Language

The app currently uses **OpenAI TTS** (`tts-1`, voice `alloy`). It’s reliable but often sounds robotic. Below are alternatives that support more natural speech and the options you want (tone, gender, language).

---

## Recommended: **ElevenLabs**

**Best fit when:** You care most about **human-like, conversational** quality and are okay with a separate API/key.

- **Naturalness:** Generally rated highest for emotional expression and human-like sound.
- **Options:** 1,200+ voices; many with explicit **gender** and **language**; **stability** and **similarity** controls act like tone/consistency.
- **Formats:** MP3 (and others); works with Twilio `<Play>`.
- **API:** REST; simple `POST` with `text`, `voice_id`, `model_id`, optional `voice_settings` (stability, similarity).
- **Pricing:** Usage-based (e.g. ~$0.17–0.20 per 1K characters); free tier available for testing.
- **Latency:** ~300 ms typical; **ElevenLabs Turbo v2.5** is faster (~75 ms) if you need lower latency.

**Implementation outline:**  
Add `ELEVENLABS_API_KEY` and optional `ELEVENLABS_VOICE_ID` (default voice). In `voice_service.text_to_speech`, if ElevenLabs is configured, call their API and return MP3 bytes; else keep OpenAI as fallback. Store per-business `voice_id` (and optionally language) in `BusinessSettings.ai_voice_settings` and pass into TTS so each business can choose voice/gender/language.

---

## Alternative: **Google Cloud Text-to-Speech**

**Best fit when:** You want **many languages** (75+), enterprise support, or are already on GCP.

- **Naturalness:** Very good with **Chirp 3** / **Neural2** voices; often better than OpenAI, slightly below ElevenLabs in “human-like” surveys.
- **Options:** 380+ voices; **language** and **voice name** (gender implied by voice); SSML for **pitch/speed** (tone-like).
- **Formats:** MP3, etc.; works with Twilio.
- **API:** REST; `synthesize` with `languageCode`, `name` (voice), optional SSML.
- **Pricing:** e.g. $4–16/1M chars (standard/WaveNet); Chirp 3 HD ~$30/1M chars.
- **Latency:** ~200 ms.

**Implementation outline:**  
Use a service account and `GOOGLE_APPLICATION_CREDENTIALS` or ADC. Add a small module (e.g. `voice_service_google.py`) that takes `text`, `language_code`, `voice_name` and returns MP3 bytes. In `ai_voice_settings` store `tts_provider: "google"`, `language_code`, `voice_name`; in `text_to_speech` branch on provider and call Google when selected.

---

## Alternative: **OpenAI TTS (upgrade in place)**

If you prefer to **stay on OpenAI** and only improve quality:

- Use **`tts-1-hd`** or the newer **`gpt-4o-mini-tts`** model (if available in your region) for better quality.
- Use the **`voice`** parameter: `alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer` — different genders/tones.
- OpenAI does **not** expose full “tone” or “language” (e.g. accent) controls; you only get a fixed set of voices.

So you can get *less* robotic by switching model/voice, but not the full tone/gender/language control you want. For that, ElevenLabs or Google is a better fit.

---

## Summary

| Need | Suggested choice |
|------|-------------------|
| Most human-like + tone/gender/language | **ElevenLabs** |
| Many languages + enterprise/GCP | **Google Cloud TTS** (Chirp/Neural2) |
| Minimal change, slightly better | **OpenAI** `tts-1-hd` + different `voice` |

**Recommendation:** Use **ElevenLabs** as the primary TTS when you implement Phase 5 voice config: store `voice_id` (and optionally language) in `ai_voice_settings`, add `ELEVENLABS_API_KEY`, and keep OpenAI as fallback when ElevenLabs is not configured. That gives you human-like voice plus the options you wanted (tone/gender/language) for the roadmap.
