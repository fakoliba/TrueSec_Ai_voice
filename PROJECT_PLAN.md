# AI Support Agent Backend - Project Plan

## Executive Summary

This document outlines the comprehensive plan to transform the current appointment scheduling backend into a full-featured AI Support Agent platform for small businesses. The system will support voice interactions, multi-calendar integrations, customer intake workflows, and a business owner dashboard.

---

## Current State Analysis

### Existing Features ✅
- Basic user authentication (JWT)
- Google Calendar OAuth integration
- Appointment CRUD operations
- Google Calendar sync
- Basic voice command processing (simplified)

### Gaps to Address ❌
- Multi-tenant architecture (businesses vs. individual users)
- Multiple calendar provider support (Outlook, Apple)
- AI voice agent capabilities
- Customer intake system
- Business configuration management
- Admin dashboard backend
- Subscription/plan management
- Analytics and reporting
- Call handling and routing
- Real-time availability checking

---

## Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Admin Portal)                    │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│              FastAPI Backend (This Project)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Auth API   │  │  Business    │  │   AI Agent   │     │
│  │              │  │  Management  │  │   Service    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Appointments│  │   Intake     │  │  Analytics   │     │
│  │   Service   │  │   Service    │  │   Service    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└──────────┬──────────────┬──────────────┬──────────────────┘
           │              │              │
    ┌──────▼──────┐ ┌─────▼─────┐ ┌─────▼─────┐
    │   Database  │ │  OpenAI   │ │ Calendar  │
    │  (PostgreSQL)│ │   API     │ │ Providers │
    └─────────────┘ └───────────┘ └───────────┘
```

### Technology Stack

**Backend:**
- FastAPI (existing)
- PostgreSQL (upgrade from SQLite)
- SQLAlchemy ORM
- Redis (caching, session management)
- Celery (background tasks for reminders, sync)

**AI/ML:**
- OpenAI GPT-4 (conversational AI)
- LangChain (orchestration)
- Text-to-Speech (TTS) - ElevenLabs / Google TTS
- Speech-to-Text (STT) - Whisper / Google Speech-to-Text

**Integrations:**
- Google Calendar API (existing)
- Microsoft Graph API (Outlook)
- Apple Calendar (CalDAV)
- Twilio / Vonage (voice calls)

**Infrastructure:**
- Docker & Docker Compose
- Nginx (reverse proxy)
- Gunicorn + Uvicorn workers

---

## Database Schema Design

### New Models Required

#### 1. Business (Multi-tenant)
```python
- id
- name
- business_type (dental, medical, mechanic, other)
- email
- phone
- address
- timezone
- subscription_plan (free, basic, premium)
- subscription_status (active, suspended, cancelled)
- created_at
- updated_at
```

#### 2. BusinessUser (Admin/Staff)
```python
- id
- business_id (FK)
- user_id (FK to User)
- role (owner, admin, staff)
- permissions (JSON)
- created_at
```

#### 3. BusinessSettings
```python
- id
- business_id (FK)
- ai_voice_settings (JSON):
  - voice_id
  - tone
  - gender
  - language
  - accent
- business_hours (JSON):
  - monday: {open, close, breaks}
  - tuesday: ...
  - ...
- availability_rules (JSON)
- auto_confirm_appointments (bool)
- reminder_settings (JSON)
- created_at
- updated_at
```

#### 4. Service
```python
- id
- business_id (FK)
- name
- description
- duration_minutes
- price
- is_active
- created_at
```

#### 5. Customer
```python
- id
- business_id (FK)
- first_name
- last_name
- email
- phone
- date_of_birth (optional, for medical)
- address (optional)
- notes (JSON)
- created_at
- updated_at
```

#### 6. IntakeForm
```python
- id
- business_id (FK)
- name
- form_type (new_patient, appointment, general)
- questions (JSON array)
- is_active
- created_at
- updated_at
```

#### 7. IntakeSubmission
```python
- id
- business_id (FK)
- customer_id (FK, nullable)
- intake_form_id (FK)
- responses (JSON)
- status (pending, reviewed, archived)
- submitted_at
- reviewed_at
```

#### 8. CalendarIntegration
```python
- id
- business_id (FK)
- provider (google, outlook, apple)
- provider_account_id
- access_token
- refresh_token
- token_expiry
- calendar_id
- is_primary
- sync_enabled
- created_at
- updated_at
```

#### 9. CallLog
```python
- id
- business_id (FK)
- customer_id (FK, nullable)
- phone_number
- direction (inbound, outbound)
- status (completed, missed, voicemail)
- duration_seconds
- transcript (JSON)
- ai_summary
- recording_url (optional)
- created_at
```

#### 10. Conversation
```python
- id
- business_id (FK)
- customer_id (FK, nullable)
- call_log_id (FK, nullable)
- channel (voice, chat, sms)
- messages (JSON array)
- intent (appointment, inquiry, intake, other)
- resolved (bool)
- created_at
- updated_at
```

#### 11. Subscription
```python
- id
- business_id (FK)
- plan_name
- features (JSON)
- monthly_price
- usage_limits (JSON)
- current_usage (JSON)
- billing_cycle_start
- billing_cycle_end
- status
- created_at
```

### Updated Models

#### User (Enhanced)
- Add `phone_number`
- Add `role` (customer, business_owner, staff)
- Keep existing fields

#### Appointment (Enhanced)
- Add `business_id` (FK)
- Add `customer_id` (FK)
- Add `service_id` (FK, nullable)
- Add `status` (scheduled, confirmed, cancelled, completed)
- Add `reminder_sent` (bool)
- Add `source` (voice, web, admin)
- Keep existing fields

---

## Implementation Phases

### Phase 1: Foundation & Multi-Tenancy (Weeks 1-2)
**Goal:** Establish multi-tenant architecture and core business management

**Tasks:**
1. Database Migration
   - [ ] Set up PostgreSQL database
   - [ ] Create Alembic migration scripts
   - [ ] Migrate existing data
   - [ ] Create all new models

2. Multi-Tenant Architecture
   - [ ] Implement business model and relationships
   - [ ] Add business context middleware
   - [ ] Update all endpoints to be business-scoped
   - [ ] Add business user roles and permissions

3. Business Management API
   - [ ] `POST /api/businesses` - Create business
   - [ ] `GET /api/businesses/{id}` - Get business details
   - [ ] `PUT /api/businesses/{id}` - Update business
   - [ ] `GET /api/businesses/{id}/users` - List business users
   - [ ] `POST /api/businesses/{id}/users` - Add user to business

**Deliverables:**
- Multi-tenant database schema
- Business CRUD endpoints
- Updated authentication to support business context

---

### Phase 2: Enhanced Calendar Integration (Weeks 3-4)
**Goal:** Support multiple calendar providers and real-time availability

**Tasks:**
1. Calendar Provider Abstraction
   - [ ] Create calendar provider interface
   - [ ] Implement Google Calendar provider (refactor existing)
   - [ ] Implement Microsoft Outlook provider
   - [ ] Implement Apple Calendar (CalDAV) provider
   - [ ] Add provider selection/switching

2. Availability Management
   - [ ] `GET /api/availability` - Check real-time availability
   - [ ] Business hours configuration
   - [ ] Blocked time slots management
   - [ ] Recurring availability rules

3. Multi-Calendar Sync
   - [ ] Sync appointments across multiple calendars
   - [ ] Handle conflicts and duplicates
   - [ ] Background sync jobs (Celery)

**Deliverables:**
- Multi-provider calendar integration
- Real-time availability API
- Background sync system

---

### Phase 3: AI Voice Agent Core (Weeks 5-7)
**Goal:** Build intelligent conversational AI for customer interactions

**Tasks:**
1. AI Service Architecture
   - [ ] OpenAI GPT-4 integration
   - [ ] LangChain orchestration
   - [ ] Context management
   - [ ] Conversation memory

2. Voice Processing
   - [ ] Speech-to-Text integration (Whisper/Google STT)
   - [ ] Text-to-Speech integration (ElevenLabs/Google TTS)
   - [ ] Voice call handling (Twilio/Vonage)
   - [ ] Real-time transcription

3. AI Agent Capabilities
   - [ ] Intent recognition
   - [ ] Business information retrieval (hours, services, pricing)
   - [ ] Appointment scheduling via conversation
   - [ ] Natural language understanding
   - [ ] Context-aware responses

4. Conversation Management
   - [ ] `POST /api/conversations` - Start conversation
   - [ ] `POST /api/conversations/{id}/messages` - Send message
   - [ ] `GET /api/conversations/{id}` - Get conversation
   - [ ] Conversation logging and storage

**Deliverables:**
- AI conversation service
- Voice call handling
- Intent recognition system
- Conversation API endpoints

---

### Phase 4: Customer Intake System (Weeks 8-9)
**Goal:** Flexible intake forms and data collection

**Tasks:**
1. Intake Form Builder
   - [ ] `POST /api/intake-forms` - Create intake form
   - [ ] `GET /api/intake-forms` - List forms
   - [ ] `PUT /api/intake-forms/{id}` - Update form
   - [ ] Form question types (text, select, date, file upload)
   - [ ] Conditional logic support

2. Intake Submission
   - [ ] `POST /api/intake-submissions` - Submit intake
   - [ ] `GET /api/intake-submissions` - List submissions
   - [ ] `PUT /api/intake-submissions/{id}/status` - Update status
   - [ ] File attachment handling
   - [ ] Data validation

3. Integration with AI Agent
   - [ ] Voice-based intake collection
   - [ ] AI-guided form completion
   - [ ] Automatic customer creation from intake

**Deliverables:**
- Intake form management API
- Submission handling
- AI-integrated intake flow

---

### Phase 5: Business Configuration & Settings (Weeks 10-11)
**Goal:** Allow businesses to customize AI agent and operations

**Tasks:**
1. AI Voice Configuration
   - [ ] `PUT /api/businesses/{id}/settings/voice` - Configure AI voice
   - [ ] Voice selection (tone, gender, accent)
   - [ ] Language settings
   - [ ] Custom prompts and responses

2. Business Operations
   - [ ] `PUT /api/businesses/{id}/settings/hours` - Set business hours
   - [ ] `PUT /api/businesses/{id}/settings/availability` - Availability rules
   - [ ] Service management API
   - [ ] Pricing configuration

3. Notification Settings
   - [ ] Email/SMS notification preferences
   - [ ] Reminder configuration
   - [ ] Auto-confirmation settings

**Deliverables:**
- Business settings API
- AI voice configuration
- Operational settings management

---

### Phase 6: Analytics & Reporting (Weeks 12-13)
**Goal:** Provide insights and metrics to business owners

**Tasks:**
1. Analytics Data Collection
   - [ ] Call volume tracking
   - [ ] Appointment metrics
   - [ ] Customer interaction logging
   - [ ] AI performance metrics

2. Reporting API
   - [ ] `GET /api/analytics/overview` - Dashboard overview
   - [ ] `GET /api/analytics/appointments` - Appointment analytics
   - [ ] `GET /api/analytics/calls` - Call analytics
   - [ ] `GET /api/analytics/customers` - Customer insights
   - [ ] Date range filtering
   - [ ] Export capabilities (CSV, PDF)

3. Real-time Metrics
   - [ ] WebSocket support for live updates
   - [ ] Real-time dashboard data

**Deliverables:**
- Analytics API endpoints
- Reporting system
- Dashboard data aggregation

---

### Phase 7: Subscription & Billing (Weeks 14-15)
**Goal:** Implement subscription plans and usage tracking

**Tasks:**
1. Subscription Management
   - [ ] `GET /api/subscriptions/plans` - List available plans
   - [ ] `POST /api/subscriptions` - Subscribe to plan
   - [ ] `PUT /api/subscriptions/{id}` - Upgrade/downgrade
   - [ ] Usage tracking and limits
   - [ ] Billing cycle management

2. Feature Gating
   - [ ] Middleware for feature access control
   - [ ] Plan-based feature availability
   - [ ] Usage limit enforcement

3. Payment Integration (Future)
   - [ ] Stripe integration (optional)
   - [ ] Invoice generation
   - [ ] Payment webhooks

**Deliverables:**
- Subscription management API
- Usage tracking system
- Feature gating middleware

---

### Phase 8: Advanced Features & Polish (Weeks 16-18)
**Goal:** Enhancements, optimizations, and production readiness

**Tasks:**
1. Advanced Appointment Features
   - [ ] Recurring appointments
   - [ ] Waitlist management
   - [ ] Appointment reminders (SMS, Email, Voice)
   - [ ] Cancellation policies

2. Customer Management
   - [ ] Customer search and filtering
   - [ ] Customer history view
   - [ ] Notes and tags
   - [ ] Communication preferences

3. Performance & Scalability
   - [ ] Database query optimization
   - [ ] Caching layer (Redis)
   - [ ] Background job processing (Celery)
   - [ ] API rate limiting

4. Security & Compliance
   - [ ] HIPAA compliance considerations (for medical)
   - [ ] Data encryption at rest
   - [ ] Audit logging
   - [ ] GDPR compliance features

5. Testing & Documentation
   - [ ] Unit tests (pytest)
   - [ ] Integration tests
   - [ ] API documentation updates
   - [ ] Deployment guides

**Deliverables:**
- Production-ready system
- Comprehensive test suite
- Complete documentation

---

## API Endpoint Summary

### Authentication & Users
- `POST /api/auth/register` - Register user
- `POST /api/auth/token` - Login
- `GET /api/auth/users/me` - Get current user
- `POST /api/auth/google/login` - Google OAuth
- `GET /api/auth/google/callback` - OAuth callback

### Businesses
- `POST /api/businesses` - Create business
- `GET /api/businesses/{id}` - Get business
- `PUT /api/businesses/{id}` - Update business
- `GET /api/businesses/{id}/users` - List users
- `POST /api/businesses/{id}/users` - Add user

### Business Settings
- `GET /api/businesses/{id}/settings` - Get settings
- `PUT /api/businesses/{id}/settings/voice` - Update voice config
- `PUT /api/businesses/{id}/settings/hours` - Update hours
- `PUT /api/businesses/{id}/settings/availability` - Update availability

### Services
- `GET /api/businesses/{id}/services` - List services
- `POST /api/businesses/{id}/services` - Create service
- `PUT /api/businesses/{id}/services/{service_id}` - Update service
- `DELETE /api/businesses/{id}/services/{service_id}` - Delete service

### Appointments
- `GET /api/businesses/{id}/appointments` - List appointments
- `POST /api/businesses/{id}/appointments` - Create appointment
- `GET /api/businesses/{id}/appointments/{appointment_id}` - Get appointment
- `PUT /api/businesses/{id}/appointments/{appointment_id}` - Update appointment
- `DELETE /api/businesses/{id}/appointments/{appointment_id}` - Delete appointment
- `POST /api/businesses/{id}/appointments/{appointment_id}/confirm` - Confirm
- `POST /api/businesses/{id}/appointments/{appointment_id}/cancel` - Cancel

### Availability
- `GET /api/businesses/{id}/availability` - Check availability
- `GET /api/businesses/{id}/availability/slots` - Get available slots

### Calendar Integration
- `GET /api/businesses/{id}/calendars` - List integrations
- `POST /api/businesses/{id}/calendars` - Add calendar
- `PUT /api/businesses/{id}/calendars/{calendar_id}` - Update calendar
- `DELETE /api/businesses/{id}/calendars/{calendar_id}` - Remove calendar
- `GET /api/businesses/{id}/calendars/events` - List events

### Customers
- `GET /api/businesses/{id}/customers` - List customers
- `POST /api/businesses/{id}/customers` - Create customer
- `GET /api/businesses/{id}/customers/{customer_id}` - Get customer
- `PUT /api/businesses/{id}/customers/{customer_id}` - Update customer
- `GET /api/businesses/{id}/customers/{customer_id}/history` - Get history

### Intake Forms
- `GET /api/businesses/{id}/intake-forms` - List forms
- `POST /api/businesses/{id}/intake-forms` - Create form
- `GET /api/businesses/{id}/intake-forms/{form_id}` - Get form
- `PUT /api/businesses/{id}/intake-forms/{form_id}` - Update form
- `DELETE /api/businesses/{id}/intake-forms/{form_id}` - Delete form

### Intake Submissions
- `GET /api/businesses/{id}/intake-submissions` - List submissions
- `POST /api/businesses/{id}/intake-submissions` - Submit intake
- `GET /api/businesses/{id}/intake-submissions/{submission_id}` - Get submission
- `PUT /api/businesses/{id}/intake-submissions/{submission_id}/status` - Update status

### Conversations & AI
- `POST /api/businesses/{id}/conversations` - Start conversation
- `POST /api/businesses/{id}/conversations/{conversation_id}/messages` - Send message
- `GET /api/businesses/{id}/conversations/{conversation_id}` - Get conversation
- `GET /api/businesses/{id}/conversations` - List conversations
- `POST /api/businesses/{id}/conversations/{conversation_id}/end` - End conversation

### Calls
- `POST /api/businesses/{id}/calls/inbound` - Handle inbound call (webhook)
- `GET /api/businesses/{id}/calls` - List calls
- `GET /api/businesses/{id}/calls/{call_id}` - Get call details
- `GET /api/businesses/{id}/calls/{call_id}/transcript` - Get transcript

### Analytics
- `GET /api/businesses/{id}/analytics/overview` - Dashboard overview
- `GET /api/businesses/{id}/analytics/appointments` - Appointment metrics
- `GET /api/businesses/{id}/analytics/calls` - Call metrics
- `GET /api/businesses/{id}/analytics/customers` - Customer metrics
- `GET /api/businesses/{id}/analytics/export` - Export data

### Subscriptions
- `GET /api/subscriptions/plans` - List plans
- `GET /api/businesses/{id}/subscription` - Get current subscription
- `POST /api/businesses/{id}/subscription` - Subscribe
- `PUT /api/businesses/{id}/subscription` - Update subscription
- `GET /api/businesses/{id}/subscription/usage` - Get usage

---

## Technical Considerations

### Security
- Multi-tenant data isolation (row-level security)
- API rate limiting per business
- Secure token storage and rotation
- Input validation and sanitization
- SQL injection prevention (SQLAlchemy ORM)
- XSS protection
- CORS configuration

### Performance
- Database indexing strategy
- Query optimization
- Caching layer (Redis)
- Background job processing (Celery)
- Connection pooling
- CDN for static assets (future)

### Scalability
- Horizontal scaling with load balancer
- Database read replicas
- Message queue for async tasks
- Microservices consideration (future)

### Compliance
- HIPAA (for medical businesses)
- GDPR (data privacy)
- PCI-DSS (if handling payments)
- Data retention policies
- Audit trails

### Monitoring & Logging
- Application logging (structured logs)
- Error tracking (Sentry)
- Performance monitoring (APM)
- Health checks
- Metrics collection (Prometheus)

---

## Dependencies to Add

```python
# Database
psycopg2-binary==2.9.9  # PostgreSQL driver
alembic==1.12.1  # Already have

# Caching & Background Jobs
redis==5.0.1
celery==5.3.4

# AI/ML
openai==1.3.5  # Already have
langchain==0.0.350  # Already have
langchain-openai==0.0.2
elevenlabs==0.2.27  # TTS
openai-whisper  # STT (or use API)

# Voice/Calls
twilio==8.10.0  # Voice calls
# OR
vonage==3.14.0

# Calendar
caldav==1.3.7  # Apple Calendar
msal==1.25.0  # Microsoft authentication
requests-oauthlib==1.3.1

# Utilities
python-dateutil==2.8.2
pytz==2023.3
email-validator==2.1.0
python-multipart==0.0.6  # Already have

# Testing
pytest==7.4.3
pytest-asyncio==0.21.1
httpx==0.25.2  # For testing FastAPI

# Production
gunicorn==21.2.0
uvicorn[standard]==0.24.0  # Already have
```

---

## Next Steps

1. **Review & Approve Plan** - Review this document and prioritize phases
2. **Set Up Development Environment** - PostgreSQL, Redis, Docker
3. **Create Project Board** - Break down into tasks (GitHub Projects, Jira, etc.)
4. **Start Phase 1** - Begin with multi-tenant foundation
5. **Iterate** - Regular reviews and adjustments

---

## Questions to Resolve

1. **Voice Provider**: Twilio vs. Vonage vs. custom SIP?
2. **TTS Provider**: ElevenLabs vs. Google TTS vs. OpenAI TTS?
3. **STT Provider**: OpenAI Whisper API vs. Google Speech-to-Text?
4. **Payment Processing**: Stripe vs. other providers?
5. **Deployment**: AWS, GCP, Azure, or self-hosted?
6. **Frontend**: Separate frontend project or API-only?
7. **Mobile App**: Native apps or PWA?

---

## Success Metrics

- **Performance**: API response time < 200ms (p95)
- **Availability**: 99.9% uptime
- **Scalability**: Support 1000+ businesses
- **AI Quality**: >90% intent recognition accuracy
- **User Satisfaction**: Business owner NPS > 50

---

*Last Updated: [Current Date]*
*Version: 1.0*
