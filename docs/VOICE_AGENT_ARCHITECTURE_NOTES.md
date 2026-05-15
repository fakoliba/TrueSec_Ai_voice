## Voice Agent & Call Flow – Reference Notes

This file captures high-level ideas for structuring our AI voice agent and call handling, inspired by platforms like ConnexAI’s Athena (`https://connex.ai`) and CallSara (`https://www.callsara.ai`), without copying their exact implementations.

### 1. High-Level Product Goals

- **24/7 AI receptionist**: Answer all inbound calls, handle basic enquiries, and drive scheduling/intake, especially for healthcare and service SMBs.
- **Human-like, low-friction experience**: Minimize “IVR feel” (menus, beeps, long pauses) and make the call flow feel like talking to a human receptionist.
- **Tight integration with business systems**: Calendars, practice management / CRM, and our own backend for business configuration and analytics.

### 2. Call Routing & Onboarding Flow

- **Per-business phone numbers / entry points**
  - Each business has one or more Twilio numbers (or forwarded numbers) mapped to a `business_id` in our system.
  - Webhook URL pattern: `/api/voice/incoming?business_id={id}` (as we already do) or a Twilio “Friendly Name” → business lookup.

- **Business profile drives the script**
  - Greeting, tone, supported intents (hours, new appointment, reschedule, cancel, intake, general questions) come from `BusinessSettings` in our backend.
  - This matches how competitors let customers configure flows in a UI, but we can start with a simple JSON “playbook” per business.

- **Tiered routing**
  - **Tier 1 (AI agent)**: Answer, attempt to fully handle standard flows.
  - **Tier 2 (warm transfer / voicemail)**: If intent is “urgent” or user requests human, transfer to on-call human or record structured voicemail/intake.

### 3. Conversational Flow Design

- **Initial greeting**
  - Example: “Thank you for calling {BusinessName}. How can I help you today?”
  - Avoid IVR-style prompts; instead, infer intent from free speech (“I want to schedule a cleaning next week”).

- **Turn-by-turn loop**
  - 1) Capture caller audio (Twilio media stream / <Record>/<Gather> phase).
  - 2) Transcribe via STT.
  - 3) Pass transcript + conversation history + business context to LLM.
  - 4) LLM returns:
    - `reply_text` (what to say)
    - `intent` (e.g. `schedule_appointment`, `reschedule`, `hours`, `cancel`, `intake`, `handoff`)
    - Optional `slots` (e.g. `name`, `date`, `time`, `service_type`, `reason_for_visit`).
  - 5) If intent requires an API action (e.g. create appointment), call our backend services, then confirm back to caller.
  - 6) Repeat until conversation is “done” (appointment confirmed, info provided, or call handed off).

- **Slot-filling strategy (similar to CallSara/ConnexAI)**
  - For `schedule_appointment`, drive a short, structured sequence:
    - Get caller full name (first, last).
    - Get reason for visit / service type.
    - Get preferred date & time window.
    - Confirm contact phone/email if needed.
  - Persist partial data to a `Conversation` / `Lead` record so that if the call drops, staff still see what was captured.

### 4. Integration with Business Data

- **Availability & scheduling**
  - Always consult our calendar providers layer before confirming a slot (Google, Outlook, CalDAV).
  - Respect:
    - Business hours
    - Provider-specific availability (dentist, hygienist, mechanic bay, etc.)
    - Blocked times / existing appointments.
  - For ambiguous requests (e.g. “sometime next week”), offer 2–3 concrete options instead of an open question.

- **Business rules**
  - Per-business configuration for:
    - Which services can be booked by AI (vs. human-only).
    - Min/max lead time before appointments.
    - Allowed duration per service.
    - Whether to send SMS/email confirmation automatically.

- **Intake & CRM**
  - After a successful booking, create or update a `Customer` record linked to the business.
  - Store intake answers as structured fields (e.g. for healthcare, basic demographics + reason for visit).

### 5. Architecture Components

- **Voice edge / telephony adapter**
  - Twilio webhooks handle:
    - Incoming call start
    - Media streaming or record+playback loop
    - Call end / status callbacks
  - This layer should remain thin and delegate business logic to our AI core.

- **AI conversation core**
  - Central service responsible for:
    - Managing conversation state (history, intent, slots).
    - Calling LLMs with the appropriate system prompt and context.
    - Routing to scheduling/intake/business services based on intent.
  - Could expose HTTP endpoints used by both voice and web chat (shared logic).

- **Orchestration / background jobs**
  - Use Celery (already set up) for:
    - Long-running operations (e.g. syncing calendars, refreshing access tokens).
    - Post-call tasks (e.g. summary generation, analytics, CRM updates).

- **Observability**
  - Log:
    - Per-call trace (audio transcript, intents, actions taken).
    - Error/timeout events (e.g. telephony issues, LLM failures).
  - Aggregate metrics:
    - Calls handled
    - Appointments booked
    - Handoffs to human
    - Conversion rates per business.

### 6. Product & UX Ideas (Taking Inspiration, Not Copying)

- **Vertical presets**
  - Similar to CallSara’s focus on healthcare, offer pre-configured “vertical templates”:
    - Dental/medical
    - Auto repair
    - Beauty/wellness
  - Each template tunes:
    - Default call script
    - Intake questions
    - Typical services and durations.

- **Configurable AI “persona”**
  - Let businesses choose a few pre-defined voice “styles” (calm, upbeat, professional, friendly), echoing ConnexAI’s approach to personas.
  - This influences:
    - Prompting style
    - Choice of TTS voice
    - Level of verbosity / empathy.

- **Self-serve onboarding**
  - Frontend wizard where new customers:
    - Create account & business.
    - Connect their primary calendar.
    - Define business hours & basic services.
    - Get a Twilio forwarding number and webhook instructions.
  - Goal: Similar “fast go-live” as competitors, but streamlined for small teams.

### 7. Next Implementation Steps (Backend & Frontend)

- **Backend**
  - Formalize a `Conversation` model that:
    - Links calls to businesses, customers, and appointments.
    - Stores transcript, intents, and outcome (booked, info-only, hangup, transfer).
  - Refine voice endpoint(s) to:
    - Use a more natural, multi-turn loop (no obvious “record after beep” in the long term).
    - Delegate most logic to an AI core service layer (so web chat can reuse it).
  - Expand business configuration:
    - Service catalog (name, duration, bookable-by-AI flag).
    - Intake templates per business type.

- **Frontend (owner dashboard)**
  - Improve business onboarding form:
    - Structured billing address (street, city, state, ZIP, country).
    - Default timezone detection from browser, with manual override.
    - Clear separation between “business profile”, “hours & availability”, and “AI voice settings”.
  - Add basic “Call analytics” page:
    - List of recent calls (from `Conversation` model) with outcome, duration, and notes.

These notes are meant as a living reference as we evolve the AI voice agent and call flows. We can refine them as we learn from real users and specific verticals.

