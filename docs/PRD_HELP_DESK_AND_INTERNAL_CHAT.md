# PRD checklist: Help-desk voice + internal dashboard chat

**One-page reference.** Full behavior is implemented in phases; this doc tracks scope and done criteria.

---

## Product intent

| Item | Check |
|------|--------|
| **Voice (Twilio)** = customer-facing help desk for the **business** (book / update / cancel, new vs returning, **intake on phone only**) | Phase 2–3 |
| **Dashboard chat** = **internal** only (logged-in staff): how to use the product (e.g. add users, settings) | **Phase 1** |
| **No customer intake** in dashboard chat | **Phase 1** |
| Intent routing stays **keyword-first** unless we add optional classifier later | Ongoing |
| **No LangChain** required in hot path | Ongoing |

---

## Phase 1 — Internal chat only (dashboard)

- [x] `POST /api/businesses/{id}/conversations` uses **`get_internal_help_reply`** (staff prompt, **no** booking slots in context).
- [x] **Remove** intake branches from this endpoint (`start_intake`, `process_intake_turn`, `cancel_intake`).
- [x] UI sends `channel: "internal_help"`; schema default + docs: `start_intake` **ignored** on this route.
- [x] UI: relabel dock/panel (“Team help”); **remove** “Start registration (intake)” button.
- [x] Staff prompt states: **customers use the business phone** for booking and intake.
- [ ] (Optional) **In-repo help snippets** / FAQ injected into the internal prompt.

---

## Phase 2 — Voice: appointment update & cancel

- [x] **Reschedule/update** flow: resolve customer → pick appointment → new slot → validate → persist ([`voice_appointment_manage`](../app/services/voice_appointment_manage.py), [`voice.py`](../app/api/endpoints/voice.py)).
- [x] **Cancel** flow: resolve customer → confirm appointment → cancel/status update.
- [x] Extend **keywords / call state** for `manage_kind` `cancel` / `reschedule` vs `schedule_appointment` ([`detect_intent_simple`](../app/services/ai_agent_service.py)).

---

## Phase 3 — Voice: new vs returning + intake

- [x] Greeting lists **new customer** / **existing customer** + book / reschedule / cancel.
- [x] **Returning / new:** `customer_route` on call state; lookup uses **caller phone** and optional **name** ([`voice_appointment_manage`](../app/services/voice_appointment_manage.py)).
- [x] **Intake:** existing `intake_conversation_service` on voice; `wants_start_intake` includes **first visit** ([`intake_conversation_service`](../app/services/intake_conversation_service.py)).

---

## Phase 4 — Polish

- [x] Internal reference doc [`VOICE_HELP_PHASES.md`](VOICE_HELP_PHASES.md) (operator / future snippets).
- [ ] Optional: **LLM intent** only when keywords ambiguous (deferred).
- [x] **Metrics / logging:** voice turn log includes `voice_intent`, `manage_kind`, `manage_outcome`, `customer_route`.

---

## Dependencies

- `OPENAI_API_KEY` for both staff help and voice (existing).
- Voice unchanged in Phase 1 except any copy if needed.

---

*Implementation touchpoints:* [`app/services/ai_agent_service.py`](../app/services/ai_agent_service.py), [`app/api/endpoints/businesses.py`](../app/api/endpoints/businesses.py), [`app/schemas/conversation.py`](../app/schemas/conversation.py), [`frontend/.../AiChatPanel.tsx`](../frontend/src/components/business/AiChatPanel.tsx), [`frontend/.../BusinessChatDock.tsx`](../frontend/src/components/business/BusinessChatDock.tsx). **Do not** remove intake from [`voice`](../app/api/endpoints/voice.py).
