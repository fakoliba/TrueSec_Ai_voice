# Voice help-desk phases (internal reference)

Short corpus for operators and future RAG/snippets. **Not** customer-facing copy.

## Phase 2 — Manage appointments

- **Cancel:** Caller phone → match `Customer.phone` → list upcoming `Appointment` (scheduled/confirmed, future) → disambiguate → verbal yes/no → `status=cancelled`.
- **Reschedule:** Same resolution → collect new **date** + **time** → preserve duration → `get_calendar_conflicts` excluding self → update `start_time` / `end_time`.
- **Customer directory:** Dashboard **Customers** page + API (`GET/POST /api/businesses/{id}/customers`, `POST .../customers/import` CSV). Voice booking **creates or links** `Customer` by caller phone + spoken name (`find_or_create_customer_for_voice`).
- **Booking phone:** Each voice-created appointment stores `booking_phone` (Twilio `From`). Cancel/reschedule **merge** appointments found via `customer_id` **and** via `booking_phone`, so legacy rows without `customer_id` still resolve; when the caller matches a **single** `Customer`, unlinked rows get `customer_id` backfilled automatically.

## Phase 3 — New vs returning

- Keywords set `customer_route` on the call state (`new` | `returning`) for analytics.
- **Intake:** Still driven by `intake_conversation_service` + `wants_start_intake` on **voice** only.

## Phase 4 — Observability

- Structured log line on each `/api/voice/recording` turn: `voice_intent`, `manage_kind`, `manage_outcome`, `customer_route`.
- Optional later: LLM intent only when keywords are ambiguous (not required in hot path).

## RAG (later, low priority)

- Index this doc + product FAQs for **dashboard** “Team help” only; voice stays keyword-first unless you add a classifier.
