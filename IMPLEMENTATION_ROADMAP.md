# Implementation Roadmap - Quick Reference

**Last updated:** 2026-03-30 — Intake form dashboard UX (visual editor + industry presets), collapsible business nav, production DB migration `004_ai_intake` + Cloud Run `DATABASE_URL` alignment. See **Recent implementations (March 2026)** below.

## Recent implementations (March 2026)

### Dashboard & intake (frontend)

- **Intake forms (new + edit):** Replaced raw JSON textareas with a **visual question editor** (`IntakeQuestionsEditor`): label, type, field ID, required, placeholder, select options, reorder, add/remove.
- **Industry / intake type:** Dropdown stores `form_type` (`general`, `healthcare`, `it`, `retail`, `professional_services`) with **starter question templates** per vertical; edit page includes **Apply starter questions** (with confirm).
- **Advanced:** Collapsible **“Advanced: edit as JSON”** for power users (optional).
- **Shared code:** `frontend/src/lib/intakeFormConstants.ts`, `intakeQuestionsHelpers.ts`, `IntakeQuestion` type in `frontend/src/lib/api.ts`.
- **Docs:** `docs/plans/intake-questions-ui-builder.md` (plan + implemented notes).

### Dashboard navigation (frontend)

- **Business sidebar (desktop):** **Collapsible** rail — toggle narrows to icon-only links; preference in `localStorage` (`dashboard-business-nav-collapsed`). Mobile drawer unchanged.

### Production / operations (no app feature code)

- **Schema:** Cloud SQL was missing `business_settings.default_intake_form_id` (and related `004` columns) — fixed by running Alembic **`004_ai_intake`** on `ai_support_db` after **`alembic stamp 003_call_conv`** (DB had tables from `create_all` without Alembic history).
- **Secrets:** Postgres password was rotated; **Cloud Run `DATABASE_URL`** had to be updated to match — resolves `password authentication failed` and API **500**s.
- **Tooling:** Cloud SQL Auth Proxy for local migrations; clarify **instance name** vs **database name** (`ai_support_db`).

---

## Recent implementations (pre-push recap)

- **Platform user management:** GET/PATCH users/role (admin only); frontend Account → Manage platform users.
- **Registration:** Disabled by default (`ALLOW_PUBLIC_REGISTRATION`); login/home show “Contact us” (truesecai@truesecai.com) instead of Create account.
- **Forgot / reset password:** Token-based flow; `/forgot-password`, `/reset-password` pages; PasswordResetToken model + migration.
- **Voice:** Slot-filling (name/date/time → create appointment), handoff (transfer or voicemail), Redis for call state when `REDIS_URL` set, timing logs, greeting with business name.
- **Dashboard:** Voice/handoff settings (transfer number, voicemail-only); Voice setup page (webhook URL + Twilio steps); Calendars page (Connect Google/Outlook).
- **Docs:** `docs/RECAP_AND_RECENT_IMPLEMENTATION.md`, TEAM_TESTING, VOICE_TWILIO_AND_AGENT, GOOGLE_CALENDAR_INTEGRATION_FLOW, TROUBLESHOOT_SERVICE_UNAVAILABLE.

---

## Timeline Overview

- Foundation & Multi-Tenancy
- Enhanced Calendar Integration  
- AI Voice Agent Core
- Customer Intake System
- Business Configuration
- Analytics & Reporting
- Subscription & Billing
- Advanced Features & Polish

## Phase 1: Foundation & Multi-Tenancy

### Database Setup
- [x] Set up PostgreSQL database
- [x] Install and configure Alembic
- [ ] Create initial migration for new models (run `alembic revision --autogenerate -m "initial"` then `alembic upgrade head`)
- [x] Design and create Business model
- [x] Design and create BusinessUser model
- [x] Design and create BusinessSettings model
- [x] Update User model (add phone, role)
- [x] Update Appointment model (add business_id, customer_id, service_id, status)
- [x] Create Customer model
- [x] Create Service model
- [x] Test database migrations (tables created via `Base.metadata.create_all`)

### Multi-Tenant Architecture
- [x] Create business context (dependency: get_business_or_404, get_business_membership)
- [x] Update authentication to include business context (dependencies)
- [x] Implement business scoping for all queries (appointments scoped by business)
- [x] Create Business CRUD endpoints
- [x] Create BusinessUser management endpoints
- [x] Add role-based permissions (owner / admin / staff enforced in endpoints)
- [x] Update existing endpoints to be business-scoped
- [ ] Write tests for multi-tenant isolation

**Key Deliverables:**
- ✅ PostgreSQL database running
- ✅ All new models created and migrated
- ✅ Business management API functional
- ✅ Multi-tenant data isolation working (appointments and businesses scoped)

### Suggested next steps (Phase 1) — DONE

**1. Finish Database Setup**  
- [x] Create **BusinessSettings** model  
- [x] Create **Customer** model  
- [x] Create **Service** model  
- [x] Update **User** model: add `phone_number`, `role`  
- [x] Update **Appointment** model: add `business_id`, `customer_id`, `service_id`, `status`  
- [x] Install and configure **Alembic**; generate and run initial migration (user runs `alembic revision --autogenerate` then `alembic upgrade head`)  

**2. Business & BusinessUser API**  
- [x] Add **Business CRUD** endpoints (create, get, list, update, delete business)  
- [x] Add **BusinessUser** endpoints (list, add by email, update role, remove)  
- [x] Auth + business context via dependencies  

**3. Multi-Tenant Foundation**  
- [x] Add **business context** (get_business_or_404, get_business_membership)  
- [x] Scope **appointments** by `business_id` (legacy + `/api/businesses/{id}/appointments`)  

**4. Optional**  
- [x] Role-based permissions (owner / admin / staff) — enforced in endpoints  
- [ ] Tests for multi-tenant isolation  

---

## Phase 2: Enhanced Calendar Integration

### Calendar Provider Abstraction
- [x] Create CalendarProvider interface/abstract class
- [x] Refactor existing Google Calendar code to use interface
- [x] Implement Microsoft Outlook provider
  - [x] Set up Microsoft Graph API authentication
  - [x] Implement calendar event CRUD
  - [x] Handle token refresh
- [x] Implement Apple Calendar (CalDAV) provider
  - [x] Set up CalDAV authentication
  - [x] Implement calendar event CRUD
- [x] Create CalendarIntegration model
- [x] Build calendar provider factory/registry
- [x] Calendar API: list integrations, connect Google (OAuth), callback, list events, disconnect

### Availability & Sync
- [x] Create availability checking service
- [x] Implement business hours configuration
- [x] Build availability slot calculation
- [x] Create blocked time management (availability_rules.blocked_times)
- [x] Set up Celery for background jobs
- [x] Implement multi-calendar sync job
- [x] Handle calendar conflicts
- [x] Create availability API endpoints (slots, check, settings)

**Key Deliverables:**
- ✅ Multiple calendar providers supported
- ✅ Real-time availability checking
- ✅ Background sync system operational

---

## Phase 3: AI Voice Agent Core

### AI Service Foundation
- [x] Set up OpenAI GPT-4 integration (gpt-4o-mini via OpenAI API)
- [ ] Configure LangChain for orchestration (optional; direct OpenAI used for now)
- [x] Create conversation context manager (business context in system prompt)
- [x] Implement conversation memory system (Conversation model + messages JSON)
- [x] Build intent recognition system (keyword-based: appointment, hours, inquiry)
- [x] Create business knowledge base structure (hours, services, slots in context)
- [ ] Design conversation flow patterns (basic flow in place)

### Voice Processing
- [x] Integrate Speech-to-Text (OpenAI Whisper API)
- [x] Integrate Text-to-Speech (OpenAI TTS)
- [x] Set up Twilio for voice calls (config + webhook flow)
- [x] Create call handling webhook endpoints (incoming, recording, audio, next)
- [x] Implement transcription (Whisper on recorded segment)
- [x] Build voice call state machine (in-memory or Redis when REDIS_URL set; optional CallLog)
- [x] Slot-filling: collect name/date/time and create appointment from voice
- [x] Handoff: transfer to number or voicemail via ai_voice_settings
- [x] Voice timing logs (elapsed_ms, fetch/transcribe/llm/tts) for latency tuning
- [x] Greeting uses business name; dashboard page for webhook URL and Twilio steps

### AI Agent Capabilities
- [x] Implement business info retrieval (hours, services, pricing in context)
- [x] Build appointment scheduling via conversation (AI suggests slots from availability)
- [x] Create natural language understanding for intents (simple keyword detection)
- [x] Implement context-aware responses (business context + optional slots)
- [x] Add conversation logging (Conversation.messages)
- [x] Create conversation API endpoints (POST send, GET list, GET one)
- [x] Build conversation history view (GET conversation with messages)

**Key Deliverables:**
- ✅ AI conversation service functional
- ✅ Voice calls working
- ✅ Intent recognition accurate
- ✅ Appointment scheduling via voice

---

## Phase 4: Customer Intake System

### Intake Form Builder
- [x] Create IntakeForm model
- [x] Create IntakeSubmission model
- [x] Build form question types (text, select, date, file, textarea, number via JSON)
- [x] Implement form builder API (CRUD: create, list, get, update, delete forms)
- [x] Dashboard form builder UI (visual editor; industry presets; optional JSON) — **not** conditional logic
- [ ] Add conditional logic support
- [x] Create form validation system (responses validated per submission)
- [x] Form configuration UI (create/edit intake forms in dashboard)

### Intake Submission & Integration
- [x] Create intake submission API (submit, list with filters, get one, PATCH status)
- [ ] Implement file upload handling
- [x] Build submission status workflow (pending, reviewed, archived; reviewed_at/reviewed_by)
- [x] Integrate intake with AI agent (guided intake flow; `intake_conversation_service`; default form in settings) — voice-specific polish TBD
- [ ] Create voice-based intake collection (dedicated flow / UX)
- [ ] Implement automatic customer creation
- [x] Build intake review interface (API: list submissions, get, update status)

**Key Deliverables:**
- ✅ Intake form management complete (API + dashboard builder UI)
- [ ] Voice-based intake working (full productization)
- ✅ Submission handling functional

---

## Phase 5: Business Configuration

### AI Voice Configuration
- [x] Voice handoff settings (transfer number, voicemail-only) via `ai_voice_settings` and dashboard UI
- [x] GET voice webhook URL and Twilio setup instructions in dashboard
- [ ] Voice selection (tone, gender, accent) — see `docs/TTS_RECOMMENDATIONS.md` (ElevenLabs recommended for human-like + options)
- [ ] Language settings / custom prompt management

### Business Operations Settings
- [x] Build business hours API (via GET/PUT `/businesses/{id}/settings` — business_hours)
- [x] Create availability rules API (via GET/PUT settings — availability_rules, blocked_times)
- [x] Service management API (CRUD at `/api/businesses/{id}/services`) and frontend Settings page
- [ ] Add pricing configuration
- [ ] Build notification preferences
- [ ] Create reminder settings
- [ ] Implement auto-confirmation settings

**Key Deliverables:**
- ✅ All business settings configurable via API (hours, services, ai_voice_settings)
- ✅ Voice handoff and webhook URL configurable from dashboard
- ✅ Operational settings complete

---

## Phase 6: Analytics & Reporting

### Data Collection & Storage
- [ ] Implement call volume tracking
- [ ] Create appointment metrics collection
- [ ] Build customer interaction logging
- [ ] Add AI performance metrics
- [ ] Design analytics data model
- [ ] Set up data aggregation jobs

### Reporting API
- [ ] Create dashboard overview endpoint
- [ ] Build appointment analytics endpoint
- [ ] Create call analytics endpoint
- [ ] Implement customer insights endpoint
- [ ] Add date range filtering
- [ ] Build export functionality (CSV, PDF)
- [ ] Create real-time metrics (WebSocket)

**Key Deliverables:**
- ✅ Analytics data collection working
- ✅ Reporting API complete
- ✅ Dashboard data available

---

## Phase 7: Subscription & Billing

### Subscription Management
- [ ] Create Subscription model
- [ ] Design subscription plans structure
- [ ] Build subscription API endpoints
- [ ] Implement plan upgrade/downgrade
- [ ] Create usage tracking system
- [ ] Build billing cycle management

### Feature Gating
- [ ] Create feature gating middleware
- [ ] Implement plan-based feature access
- [ ] Add usage limit enforcement
- [ ] Build subscription status checks
- [ ] Create usage dashboard API
- [ ] (Optional) Integrate Stripe for payments

**Key Deliverables:**
- ✅ Subscription system functional
- ✅ Feature gating working
- ✅ Usage tracking operational

---

## Phase 8: Advanced Features & Polish

### Advanced Appointment Features
- [ ] Implement recurring appointments
- [ ] Build waitlist management
- [ ] Create appointment reminder system (SMS, Email, Voice)
- [ ] Implement cancellation policies
- [ ] Add appointment notes and tags

### Customer Management & Performance
- [ ] Build advanced customer search
- [ ] Create customer history view
- [ ] Implement customer notes and tags
- [ ] Add communication preferences
- [ ] Optimize database queries
- [ ] Implement Redis caching
- [ ] Set up background job processing

### Security, Testing & Documentation
- [ ] Implement audit logging
- [ ] Add data encryption
- [ ] Create comprehensive test suite
- [ ] Write API documentation
- [ ] Create deployment guides
- [ ] Performance testing
- [ ] Security audit
- [ ] Final polish and bug fixes

**Key Deliverables:**
- ✅ Production-ready system
- ✅ Complete test coverage
- ✅ Full documentation

---

## Critical Path Items

These items block other work and should be prioritized:

1. **Multi-tenant architecture** (Phase 1) - Blocks everything else
2. **Calendar provider abstraction** (Phase 2) - Needed for availability
3. **AI service foundation** (Phase 3) - Core functionality
4. **Voice processing** (Phase 3) - Required for voice calls
5. **Database schema** (Phase 1) - Foundation for all features

### Production deploy checklist (recurring)

- Run **`alembic upgrade head`** against the **same** DB as Cloud Run (or stamp + upgrade if `create_all` predates Alembic).
- After **Cloud SQL password** changes, update **`DATABASE_URL`** on **Cloud Run** (and any secrets) so they stay in sync.
- Frontend: **`NEXT_PUBLIC_API_URL`** and backend **`BACKEND_CORS_ORIGINS`** must match deployed URLs at build/deploy time.

---

## Risk Mitigation

### High Risk Items
- **Voice call quality** - Test early with real calls
- **AI accuracy** - Iterate on prompts and fine-tuning
- **Calendar sync conflicts** - Implement robust conflict resolution
- **Multi-tenant data isolation** - Security critical, test thoroughly

### Dependencies
- External API availability (OpenAI, Twilio, Google, Microsoft)
- Third-party service reliability
- Rate limits and quotas

---

## Success Criteria by Phase

### Phase 1 ✅
- Can create multiple businesses
- Users can belong to businesses
- Data is properly isolated per business

### Phase 2 ✅
- Can connect multiple calendar providers
- Real-time availability checking works
- Appointments sync across calendars

### Phase 3 ✅
- AI can answer business questions
- Voice calls are handled correctly
- Appointments can be scheduled via voice

### Phase 4 ✅ (API + dashboard builder; AI-guided chat intake wired)
- Intake forms can be created and customized (UI + JSON advanced)
- Submissions are collected and stored
- AI-guided intake in chat supported; voice-specific intake collection still TBD

### Phase 5 ✅
- AI voice can be customized
- Business hours and settings are configurable
- All settings persist correctly

### Phase 6 ✅
- Analytics data is collected
- Reports are generated accurately
- Dashboard shows meaningful insights

### Phase 7 ✅
- Subscriptions can be managed
- Features are gated correctly
- Usage is tracked accurately

### Phase 8 ✅
- System is production-ready
- Tests pass
- Documentation is complete

---

## Quick Start Checklist

Before starting development:

- [ ] Set up PostgreSQL database
- [ ] Set up Redis server
- [ ] Configure environment variables
- [ ] Set up development Docker environment
- [ ] Create GitHub repository (if not exists)
- [ ] Set up CI/CD pipeline (optional)
- [ ] Create project board/task tracker

- [ ] Set up monitoring/logging (Sentry, etc.)

---

*Use this roadmap alongside PROJECT_PLAN.md for detailed specifications.*
