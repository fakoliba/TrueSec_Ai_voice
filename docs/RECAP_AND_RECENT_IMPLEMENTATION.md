# Recap: What We Have Implemented (Pre-Push Summary)

**Date:** Pre-push summary of current codebase state.

---

## 1. Platform & Authentication

### User roles and access
- **User roles (platform):** `super_admin`, `admin`, `owner`, `staff`, `customer`. Stored on `User.role`.
- **First user:** The first user to register (when registration was open) becomes `admin` automatically.
- **Create business:** Only users with role `super_admin`, `admin`, or `owner` can create a business. Enforced in `POST /api/businesses/` (403 otherwise). Frontend shows “Create business” only for those roles; others see “Contact your administrator to create a new business.”

### Platform user management (admin only)
- **Backend:** `GET /api/auth/users` (list all users), `PATCH /api/auth/users/{user_id}/role` (set role). Both require `super_admin` or `admin`. Responses use `PlatformUserResponse` (Pydantic) to avoid FastAPI/ORM conflicts.
- **Frontend:** Account page has “Manage platform users” (table + role dropdown) for admins; uses `listPlatformUsers()` and `setPlatformUserRole()`.

### Registration and login UX
- **Registration disabled by default:** `ALLOW_PUBLIC_REGISTRATION` (env) defaults to `false`. When false, `POST /api/auth/register` returns 403: “Registration is disabled. Contact your administrator for an account.”
- **No “Create account” in UI:** Login and home no longer link to `/register`. They show “Need an account? **Contact us**” with `mailto:truesecai@truesecai.com`.
- **First admin:** Create the first admin manually (DB, script, or temporarily set `ALLOW_PUBLIC_REGISTRATION=true`, register, then set back to `false`).

### Forgot password (when admin/user can’t log in)
- **Backend:** `PasswordResetToken` model; `POST /api/auth/forgot-password` (email → one-time token, 1h expiry); `POST /api/auth/reset-password` (token + new_password). Token is single-use.
- **Frontend:** Login has “Forgot password?” → `/forgot-password` (enter email) → redirect to `/reset-password?token=...` → set new password → redirect to login.
- **Migration:** `alembic/versions/002_password_reset_tokens.py` creates `password_reset_tokens` table.

---

## 2. Business Configuration & Calendar

### Business settings (hours & services)
- **Backend:** `GET/PUT /api/businesses/{id}/settings` (business_hours, availability_rules, ai_voice_settings). Services: `GET/POST/PUT/DELETE /api/businesses/{id}/services`.
- **Frontend:** Dashboard → business → “Business hours & services” → Settings page: business hours form, services list (add/edit/delete), and **Voice / handoff** section.

### Calendar connect flow
- **Backend:** Google/Outlook OAuth connect and callbacks; success redirect uses `FRONTEND_URL` → `{FRONTEND_URL}/dashboard/{business_id}/calendars`.
- **Frontend:** Dashboard → “Calendar” → “Connect” or “Manage” → `/dashboard/[id]/calendars` (list integrations, Connect Google / Connect Outlook). No longer links to business edit page.

### Voice (Twilio) setup in UI
- **Backend:** `GET /api/businesses/{id}/voice/webhook-url` returns Twilio webhook URL.
- **Frontend:** Dashboard → “AI voice (Twilio)” → “Set up” → `/dashboard/[id]/voice`: copy webhook URL and step-by-step Twilio instructions (Phone Numbers → Voice → Webhook, POST).

---

## 3. Voice & AI Agent

### In-call flow
- **Endpoints:** `POST /api/voice/incoming?business_id=X`, `POST /api/voice/recording`, `GET /api/voice/audio/{token}`, `GET/POST /api/voice/next`. Greeting uses business name.
- **Call state:** In-memory by default; when `REDIS_URL` is set, state and TTS cache use Redis (multi-instance, survives restarts). State includes `slots` and `slot_intent` for slot-filling.
- **Timing logs:** `voice_incoming` and `voice_recording` log `elapsed_ms` (and fetch/transcribe/llm/tts for recording) for latency debugging.

### Slot-filling (book via voice)
- **Flow:** Intent “appointment” starts `schedule_appointment`; we collect `customer_name`, `date`, `time` via prompts and `extract_slots_from_message`. When all are filled, we call `create_voice_appointment` (with conflict check) and play confirmation (or “that time is no longer available”).
- **Backend:** `app/services/slot_filling.py` (get_missing_slots, extract_slots_from_message, slots_to_start_end, create_voice_appointment). AI prompt includes “still need: X” when in slot-filling.

### Handoff (speak to a person / voicemail)
- **Intent:** “handoff” for phrases like “person”, “operator”, “speak to someone”.
- **Config:** `BusinessSettings.ai_voice_settings`: `handoff_phone` (E.164), `handoff_voicemail_only` (bool). Set via `PUT /api/businesses/{id}/settings`.
- **Behavior:** If handoff_phone set and not voicemail-only → TwiML `<Dial>`. Else → TwiML `<Record>` for voicemail.
- **Frontend:** Settings page “Voice / handoff”: transfer number input, “Voicemail only” checkbox, Save.

### Redis for voice state
- **Config:** `REDIS_URL` (optional). When set, `voice_call_state.py` uses Redis for call state and TTS cache; otherwise in-memory. Documented in `VOICE_TWILIO_AND_AGENT.md` and `cloud-run.env` comment.

---

## 4. Frontend Summary

- **Login:** Sign in, Forgot password?, Need an account? Contact us (truesecai@truesecai.com).
- **Home:** Sign in, Need an account? Contact us. (No Create account.)
- **Register page:** Still exists at `/register` but not linked; backend returns 403 when `ALLOW_PUBLIC_REGISTRATION` is false.
- **Dashboard:** My businesses; Create business (only for admin/owner); per-business: Calendar (Connect/Manage), Business hours & services (Settings), AI voice (Set up), Appointments, etc.
- **Account:** Profile, Change password, Manage platform users (admins only).
- **Business settings:** Hours, Services, Voice / handoff (transfer number, voicemail only).
- **Calendars:** List integrations, Connect Google, Connect Outlook.
- **Voice setup:** Copy webhook URL, Twilio steps.

---

## 5. Documentation

- **TEAM_TESTING_ADMIN_AND_BUSINESS.md** – How to create first admin, add admins, create businesses; API examples; troubleshooting.
- **GOOGLE_CALENDAR_INTEGRATION_FLOW.md** – OAuth flow, FRONTEND_URL, prerequisites.
- **VOICE_TWILIO_AND_AGENT.md** – Current voice endpoints, call redirect flow, slot-filling, handoff, Redis, testing/latency.
- **TROUBLESHOOT_SERVICE_UNAVAILABLE.md** – DATABASE_URL, logs, env vars, re-adding platform user management safely.
- **RECAP_AND_RECENT_IMPLEMENTATION.md** – This file.

---

## 6. Deployment & Config

- **Backend:** `cloudbuild.yaml`; `.gcloudignore` (excludes venv, frontend node_modules/.next, etc.; includes `alembic/`). Env: `ALLOW_PUBLIC_REGISTRATION`, `REDIS_URL`, `FRONTEND_URL`, `VOICE_WEBHOOK_BASE_URL`, etc.
- **Frontend:** `cloudbuild-frontend.yaml`; `E2_HIGHCPU_8` for build; Login uses Suspense for `useSearchParams`.
- **Migrations:** `002_password_reset_tokens.py` for forgot-password table. `Base.metadata.create_all` also creates new tables on startup if not using migrations.

---

*Use this recap before pushing to confirm scope; update IMPLEMENTATION_ROADMAP.md for completed and next items.*
