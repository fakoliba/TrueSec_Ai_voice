# HIPAA-Oriented Security Review — trueSec.AI

This document summarizes security posture for the AI voice receptionist product. **It is not legal advice or a certification of HIPAA compliance.** Full compliance requires organizational policies, BAAs with vendors (Twilio, OpenAI, ElevenLabs, cloud host), risk analysis, workforce training, and ongoing audit.

## Scope reviewed

| Layer | Paths |
|-------|--------|
| Frontend | `frontend/src/app/**`, `frontend/src/lib/**`, `frontend/src/components/**` |
| Backend | `app/api/**`, `app/models/**`, `app/services/**` |
| Auth | JWT, OAuth, password reset, business scoping |

---

## PHI in this product

Data that may be PHI when used by covered entities:

- Customer: name, phone, email, date of birth, address, notes
- Call logs: phone, transcript, AI summary, recording URL
- Conversations: message content
- Intake submissions: form responses (may include clinical or demographic fields)
- Appointments: title, description, booking phone

---

## Implemented safeguards (code)

### Frontend

- **Centralized session** — `frontend/src/lib/auth-session.ts` (single place for access token; reset token in `sessionStorage`, not URL)
- **Auth gates** — `AuthGate` + `useRequireAuth` on dashboard/account layouts
- **PHI display** — `PhiReveal` (click-to-reveal masked phone/email on Customers & Call activity)
- **Intake table** — responses hidden by default; expand on demand (`IntakeResponsesCell`)
- **Security headers** — `next.config.ts` (X-Frame-Options, nosniff, Referrer-Policy)
- **Production** — `/theme-preview` blocked via `middleware.ts`; API URL hidden on home page outside dev
- **No console logging** of PHI in application source

### Backend

- **Password reset** — `reset_token` only returned when `DEBUG` or `EXPOSE_PASSWORD_RESET_TOKEN=true`
- Most business APIs require JWT + business membership
- bcrypt password hashing

---

## Page-by-page checklist

| Page | Auth | PHI displayed | Notes |
|------|------|---------------|--------|
| `/login`, `/register`, `/forgot-password`, `/reset-password` | Public | No | Reset token no longer in URL |
| `/dashboard`, `/dashboard/[id]/*` | Required | Yes (scoped) | Masked phone/email where noted |
| `/account` | Required | User PII | |
| `/platform/*` | Super admin | Aggregated | Log super-admin PHI access (backend TODO) |
| Voice webhooks | Twilio only | Caller phone, audio | **Validate Twilio signatures (TODO P0)** |

---

## Priority remediation roadmap

### P0 — Before production PHI

1. **Twilio webhook signature validation** (`app/api/endpoints/voice.py`) — bind `business_id` by called number, not query param
2. **httpOnly Secure session cookies** instead of JWT in `localStorage`
3. **BAAs** with Twilio, OpenAI, ElevenLabs, hosting/DB vendors
4. **Encrypt OAuth/calendar tokens** at rest (`calendar_integrations`, `oauth_tokens`)
5. **Strong `SECRET_KEY`** required at startup; shorten JWT lifetime + refresh tokens
6. **Audit log table** for PHI read/export (who, what, when, business_id)

### P1 — High

7. PostgreSQL / Redis encryption at rest; TLS everywhere
8. API rate limits on auth and voice endpoints
9. Remove JWT from Google OAuth redirect query (`google_oauth.py`)
10. CORS: restrict origins; no `*` with credentials
11. Signed short-TTL URLs for `/api/voice/audio/{token}`

### P2 — Medium

12. Role-based UI redaction (staff vs admin)
13. Session idle timeout (15–30 min) client + server
14. Data retention jobs (recordings, transcripts)
15. Consolidate duplicate auth modules (`core/security.py` vs `services/auth.py`)

---

## Developer configuration

| Variable | Purpose |
|----------|---------|
| `DEBUG=true` | Allows password `reset_token` in API response (dev only) |
| `EXPOSE_PASSWORD_RESET_TOKEN=true` | Explicit dev override for reset flow without email |
| `ALLOW_PUBLIC_REGISTRATION=false` | Keep registration closed (default) |
| `SECRET_KEY` | Must be strong in production |
| `BACKEND_CORS_ORIGINS` | Comma-separated frontend origins only |

---

## Refactor map (frontend)

```
lib/auth-session.ts     — token + reset token storage
hooks/useRequireAuth.ts — client auth redirect
components/security/    — AuthGate, PhiReveal
lib/phi-display.ts      — maskPhone, maskEmail, intake preview
lib/api.ts              — uses getAccessToken()
```

---

## Testing after changes

1. Sign in → dashboard loads; sign out clears session
2. Forgot password → lands on `/reset-password` without `?token=` in URL (dev with DEBUG)
3. Customers / Call activity → masked phone/email; click reveals
4. Intake submissions → “View N fields” expands JSON
5. `npm run build` in `frontend/` succeeds

---

Last updated: security refactor pass (overview KPIs + HIPAA hardening).
