# Voice (Twilio) & AI Agent – Current State and What to Build

## 1. What We Have Now

### Backend – Voice endpoints (no auth; Twilio calls these)

| Endpoint | Method | Purpose |
|----------|--------|--------|
| `/api/voice/incoming` | POST | **Twilio “A Call Comes In” webhook.** Query: `business_id`. Returns TwiML: answer, say greeting, start `<Record>`. |
| `/api/voice/recording` | POST | **Twilio recording callback.** Form: `CallSid`, `RecordingUrl`. We transcribe (Whisper), get AI reply, TTS, return TwiML: `<Play>` TTS URL then `<Redirect>` to next. |
| `/api/voice/audio/{token}` | GET | Serve cached TTS audio for Twilio `<Play>`. |
| `/api/voice/next` | GET/POST | After play: next `<Record>` (up to 10 turns) or `<Hangup>`. |

### Backend – Config & helpers

- **`GET /api/businesses/{business_id}/voice/webhook-url`** (auth required)  
  Returns `{ "webhook_url": "https://YOUR-BASE/api/voice/incoming?business_id=1" }` so the dashboard (or Twilio) can show the exact URL to configure.
- **Env:** `VOICE_WEBHOOK_BASE_URL`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `OPENAI_API_KEY`.
- **Call state:** In-memory (`voice_call_state.py`): CallSid → business_id, conversation_id, messages, turn_count. TTS audio cached by token. For production, replace with Redis.
- **Persistence:** `CallLog` created on incoming; `Conversation` (channel=`voice`) updated each turn with messages and intent.

### AI agent (shared with chat)

- **`get_ai_reply()`** in `ai_agent_service.py`: business context (hours, services, address), optional availability slots, LLM reply, simple intent (appointment / hours / inquiry / other).
- **Voice-specific:** Shorter replies, “ask for name when scheduling”; same context and slot-filling idea as chat.

### Frontend

- Dashboard **“AI voice (Twilio)”** → **Set up** opens a page with the webhook URL (copy) and step-by-step Twilio configuration.

---

## 2. Testing and measuring latency

To see if the current flow is optimal, run real calls and check backend logs for timing.

**What is logged**

- **`/incoming`**  
  One line per call: `voice_incoming call_sid=... business_id=... elapsed_ms=...`  
  This is the time to validate business, init state, and return TwiML. Expect tens to low hundreds of ms.

- **`/recording`**  
  One line per user turn (after they speak):  
  `voice_recording call_sid=... fetch_ms=... transcribe_ms=... llm_ms=... tts_ms=... total_ms=...`  
  - **fetch_ms** – GET recording from Twilio  
  - **transcribe_ms** – Whisper  
  - **llm_ms** – `get_ai_reply()` (context + LLM)  
  - **tts_ms** – OpenAI TTS  
  - **total_ms** – full handler time (what the caller waits before hearing the reply)

**How to test**

1. Deploy the backend (or run locally with tunnel) and configure Twilio with the webhook URL.
2. Make a test call; say something short (e.g. “What are your hours?”).
3. In **Cloud Run** (or your server logs), filter for `voice_incoming` and `voice_recording` and note the numbers.
4. Repeat a few times (different phrases, different length) to see variance.

**What to look for**

- **total_ms** on `/recording` is the main “silence” the caller hears after speaking. Target roughly 3–6 s; if it’s often >8 s, focus on the largest of fetch/transcribe/llm/tts.
- If **transcribe_ms** is high: shorter `<Record>` or faster STT (e.g. model/settings).
- If **llm_ms** is high: smaller/faster model, fewer tokens, or less context.
- If **tts_ms** is high: shorter replies or faster TTS model.

Use these numbers to decide if the current solution is good enough or if you need optimizations (e.g. hold message, different models, or streaming later).

---

## 3. How the Call Redirect Flow Works (Twilio → App)

```
Caller dials Twilio number
        ↓
Twilio receives call
        ↓
Twilio sends HTTP POST to the "A Call Comes In" webhook URL
        ↓
Our URL:  https://YOUR-BACKEND/api/voice/incoming?business_id=1
        ↓
Backend returns TwiML: <Say> greeting </Say> <Record action=".../recording" />
        ↓
Twilio speaks greeting, records caller
        ↓
Twilio POSTs to action URL (/api/voice/recording) with CallSid, RecordingUrl
        ↓
Backend: fetch recording → Whisper → AI reply → TTS → TwiML <Play> + <Redirect> to /next
        ↓
Twilio plays TTS, then GETs /next → more <Record> or <Hangup>
```

**One webhook URL per business:** The same backend serves all businesses; `business_id` in the URL tells us which business (and thus which name, hours, services, calendar) to use. Each Twilio number should be configured with the same base URL but its own `business_id` (e.g. number A → `?business_id=1`, number B → `?business_id=2`).

**Twilio configuration (to polish in UI):**

1. Twilio Console → Phone Numbers → Manage → Active Numbers → select number.
2. Voice → “A call comes in” → **Webhook**.
3. URL: `https://YOUR-BACKEND-URL/api/voice/incoming?business_id=X` (X = this business’s ID).
4. HTTP: **POST**.
5. Save.

So “redirect” here means: Twilio **redirects the call** to our app by **calling our webhook**; we don’t do an HTTP redirect for the caller – we return TwiML that tells Twilio what to do (answer, say, record, play, hang up).

---

## 4. What We Need to Build / Polish

### A. Polish the call redirect flow (done or small fixes)

- [x] **Greeting uses business name** – Replace placeholder “X” in the greeting with the actual business name (e.g. “Thank you for calling **Acme Dental**. How can I help you today?”).
- [ ] **Frontend: webhook URL + instructions** – On the business dashboard (or a “Voice” / “Phone” section), show:
  - The webhook URL for this business (from `GET .../voice/webhook-url`) with a **Copy** button.
  - Short steps: “In Twilio: Phone Numbers → [number] → Voice → A call comes in → Webhook → paste URL → POST → Save.”
- [ ] **Optional: Twilio signature validation** – Validate that POSTs to `/incoming` and `/recording` come from Twilio using `X-Twilio-Signature` and `TWILIO_AUTH_TOKEN` so only Twilio can trigger the flow.

### B. Agent integration (slot-filling and handoff done)

- **Slot-filling:** Intent "appointment" triggers collection of customer_name, date, time; when complete, appointment is created (with conflict check) and confirmation is played. Configured in `app/services/slot_filling.py` and voice endpoint.
- **Handoff:** Intent "handoff" (e.g. "speak to a person", "operator") uses `BusinessSettings.ai_voice_settings`: `handoff_phone` (E.164) and `handoff_voicemail_only`. If phone set and not voicemail-only, TwiML `<Dial>`; else `<Record>` for voicemail. Set via `PUT /api/businesses/{id}/settings` with `ai_voice_settings: { "handoff_phone": "+15551234567", "handoff_voicemail_only": false }`.
- **Improve later:** Richer date/time parsing, optional LLM slot extraction, configurable greeting per business.

### C. Production readiness (Redis done)

- **Call state in Redis** – **Done.** When `REDIS_URL` is set, `voice_call_state.py` uses Redis for call state and TTS cache; otherwise falls back to in-memory. Set `REDIS_URL` in Cloud Run (e.g. same as `CELERY_BROKER_URL` or a dedicated DB) for multi-instance and persistence.
- **Observability** – Log call lifecycle (start, each turn, end); optional status callback to update `CallLog` (duration, status=completed).

### D. Multi-number / multi-business

- Today: one Twilio number per business (or multiple numbers all pointing to the same URL with the same `business_id`). If you want one number to route to many businesses (e.g. by DID), we’d need a lookup (e.g. DID → business_id) and optionally a small IVR (“Press 1 for X, 2 for Y”) or caller-id routing – not built yet.

---

## 5. Quick reference – Env and URLs

**Backend (Cloud Run) env:**

- `VOICE_WEBHOOK_BASE_URL=https://backend-api-xxxx.run.app` (no trailing slash).
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`.
- `OPENAI_API_KEY` (Whisper + TTS + LLM).
- **`REDIS_URL`** (optional): Set to your Redis connection string (e.g. `redis://host:6379/0` or Cloud Memorystore / Upstash URL) so voice call state and TTS cache use Redis (multi-instance, survives restarts). If unset, the app uses in-memory state. You can use the same Redis as Celery (`CELERY_BROKER_URL`) if you have one.

**Twilio webhook URL for business 1:**

- `https://YOUR-BACKEND-URL/api/voice/incoming?business_id=1`

**Getting the URL in the app:**

- `GET /api/businesses/{id}/voice/webhook-url` (with auth) → `{ "webhook_url": "..." }`.

---

*This doc is the single place for: what exists, how the Twilio→app redirect works, and what’s left to build or polish.*
