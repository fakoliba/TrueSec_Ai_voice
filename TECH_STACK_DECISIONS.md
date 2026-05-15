# Tech Stack Decisions Guide

## Decisions Required

### 1. Voice Call Provider ⚠️ **REQUIRED DECISION**

**Options:**

#### A. Twilio (Recommended for most use cases)
- **Pros:**
  - Most popular, well-documented
  - Excellent developer experience
  - Good voice quality
  - WebRTC support
  - SMS included
  - Good pricing for startups
- **Cons:**
  - Can be expensive at scale
  - Requires Twilio account setup
- **Cost:** ~$0.013/min for voice calls
- **Setup:** Medium complexity
- **Recommendation:** ✅ **Best for MVP and small businesses**

#### B. Vonage (formerly Nexmo)
- **Pros:**
  - Competitive pricing
  - Good international support
  - Voice API similar to Twilio
- **Cons:**
  - Less popular, smaller community
  - Documentation not as extensive
- **Cost:** ~$0.01/min
- **Setup:** Medium complexity

#### C. Custom SIP (Advanced)
- **Pros:**
  - Full control
  - Potentially lower cost at scale
- **Cons:**
  - High complexity
  - Requires SIP infrastructure
  - More development time
- **Cost:** Infrastructure dependent
- **Setup:** High complexity
- **Recommendation:** ❌ **Not recommended for MVP**

**Decision:** Choose Twilio for MVP, can migrate later if needed.

---

### 2. Text-to-Speech (TTS) Provider ⚠️ **REQUIRED DECISION**

**Options:**

#### A. ElevenLabs (Recommended for quality)
- **Pros:**
  - Best voice quality and naturalness
  - Many voice options
  - Good emotional range
  - Easy API
- **Cons:**
  - More expensive
  - Rate limits on free tier
- **Cost:** ~$0.30 per 1000 characters
- **Setup:** Easy
- **Recommendation:** ✅ **Best for production quality**

#### B. OpenAI TTS
- **Pros:**
  - Already using OpenAI
  - Good quality
  - Simple integration
  - Competitive pricing
- **Cons:**
  - Fewer voice options
  - Less natural than ElevenLabs
- **Cost:** ~$0.015 per 1000 characters
- **Setup:** Easy
- **Recommendation:** ✅ **Good balance of cost/quality**

#### C. Google Cloud TTS
- **Pros:**
  - Good quality
  - Many languages
  - Good pricing
- **Cons:**
  - Requires Google Cloud setup
  - Less natural than ElevenLabs
- **Cost:** ~$0.016 per 1000 characters
- **Setup:** Medium complexity

**Decision:** Start with OpenAI TTS (already integrated), upgrade to ElevenLabs if quality needs improve.

---

### 3. Speech-to-Text (STT) Provider ⚠️ **REQUIRED DECISION**

**Options:**

#### A. OpenAI Whisper API (Recommended)
- **Pros:**
  - Excellent accuracy
  - Already using OpenAI
  - Handles accents well
  - Simple API
- **Cons:**
  - Slightly slower (async)
  - More expensive than some options
- **Cost:** ~$0.006 per minute
- **Setup:** Easy
- **Recommendation:** ✅ **Best accuracy**

#### B. Google Cloud Speech-to-Text
- **Pros:**
  - Very accurate
  - Real-time streaming
  - Good pricing
- **Cons:**
  - Requires Google Cloud setup
  - More complex integration
- **Cost:** ~$0.006 per minute
- **Setup:** Medium complexity

#### C. AssemblyAI
- **Pros:**
  - Good accuracy
  - Real-time transcription
  - Good developer experience
- **Cons:**
  - Another service to manage
- **Cost:** ~$0.00025 per second (~$0.015/min)
- **Setup:** Easy

**Decision:** Use OpenAI Whisper API for consistency and accuracy.

---

### 4. Payment Processing (Future - Phase 7)

**Options:**

#### A. Stripe (Recommended)
- **Pros:**
  - Industry standard
  - Excellent documentation
  - Subscription management built-in
  - Good developer experience
- **Cons:**
  - Transaction fees (~2.9% + $0.30)
- **Cost:** 2.9% + $0.30 per transaction
- **Setup:** Easy
- **Recommendation:** ✅ **Best choice**

#### B. PayPal
- **Pros:**
  - Widely recognized
  - Good for international
- **Cons:**
  - Less developer-friendly
  - Higher fees
- **Cost:** ~3.5% per transaction

**Decision:** Use Stripe when implementing payments.

---

### 5. Deployment Platform ⚠️ **REQUIRED DECISION**

**Options:**

#### A. AWS (Recommended for scale)
- **Pros:**
  - Most services available
  - Good for enterprise
  - Scalable
- **Cons:**
  - Complex pricing
  - Steeper learning curve
- **Cost:** Pay-as-you-go
- **Setup:** Complex
- **Recommendation:** ✅ **Best for production scale**

#### B. Google Cloud Platform (GCP)
- **Pros:**
  - Good AI/ML services
  - Competitive pricing
  - Good documentation
- **Cons:**
  - Less popular than AWS
- **Cost:** Pay-as-you-go
- **Setup:** Medium complexity

#### C. Railway / Render (Recommended for MVP)
- **Pros:**
  - Very easy deployment
  - Good for small scale
  - Simple pricing
  - PostgreSQL included
- **Cons:**
  - Less control
  - May need to migrate later
- **Cost:** ~$20-50/month
- **Setup:** Very easy
- **Recommendation:** ✅ **Best for MVP and small businesses**

#### D. Self-Hosted (VPS)
- **Pros:**
  - Full control
  - Lower cost at scale
- **Cons:**
  - Requires DevOps knowledge
  - Maintenance overhead
- **Cost:** $5-50/month
- **Setup:** Complex

**Decision:** Start with Railway/Render for MVP, plan AWS migration for scale.

---
**

#### B. API-Only (Current)
- **Pros:**
  - Simpler initially
  - Frontend can be built later
- **Cons:**
  - No UI for testing
  - Need separate frontend eventually
- **Recommendation:** ✅ **Current approach - continue**

**Decision:** Continue API-only, build separate frontend when ready.

---

### 7. Mobile App (Future Consideration)

**Options:**

#### A. Progressive Web App (PWA)
- **Pros:**
  - One codebase
  - Works on all platforms
  - Easier maintenance
- **Cons:**
  - Limited native features
- **Recommendation:** ✅ **Start here**

#### B. React Native
- **Pros:**
  - One codebase for iOS/Android
  - Native performance
- **Cons:**
  - More complex than PWA

#### C. Native Apps
- **Pros:**
  - Best performance
  - Full platform features
- **Cons:**
  - Two codebases
  - Higher development cost

**Decision:** Start with PWA, consider React Native if needed.

---

## Recommended Tech Stack (Based on Decisions)

### Core Backend
- ✅ **FastAPI** - Already using
- ✅ **PostgreSQL** - Upgrade from SQLite
- ✅ **SQLAlchemy** - Already using
- ✅ **Alembic** - Already using
- ✅ **Redis** - For caching and sessions
- ✅ **Celery** - For background jobs

### AI/ML
- ✅ **OpenAI GPT-4** - Conversational AI
- ✅ **OpenAI Whisper API** - Speech-to-Text
- ✅ **OpenAI TTS** - Text-to-Speech (start here)
- ✅ **LangChain** - AI orchestration (already have)

### Voice/Calls
- ✅ **Twilio** - Voice calls and SMS

### Calendar
- ✅ **Google Calendar API** - Already integrated
- ✅ **Microsoft Graph API** - Outlook
- ✅ **CalDAV** - Apple Calendar

### Payments (Future)
- ✅ **Stripe** - Subscription management

### Deployment
- ✅ **Railway/Render** - For MVP
- ✅ **Docker** - Containerization
- ✅ **Nginx** - Reverse proxy (production)

### Monitoring
- ✅ **Sentry** - Error tracking
- ✅ **Prometheus** - Metrics (optional)
- ✅ **Structured Logging** - JSON logs

---

## Environment Variables Needed

Add to `.env`:

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost/dbname

# Redis
REDIS_URL=redis://localhost:6379

# Twilio
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# OpenAI (already have)
OPENAI_API_KEY=your_key

# ElevenLabs (if using)
ELEVENLABS_API_KEY=your_key

# Stripe (future)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# Microsoft Graph (for Outlook)
MICROSOFT_CLIENT_ID=your_client_id
MICROSOFT_CLIENT_SECRET=your_client_secret
MICROSOFT_TENANT_ID=your_tenant_id

# Deployment
ENVIRONMENT=development  # or production
FRONTEND_URL=http://localhost:3000
```

---

## Cost Estimates (Monthly)

### Development/MVP Stage
- **Railway/Render:** $20-50
- **PostgreSQL:** Included or $10
- **Redis:** Included or $10
- **OpenAI API:** $50-200 (depending on usage)
- **Twilio:** $20-100 (depending on call volume)
- **Total:** ~$100-370/month

### Small Business (10 businesses, 1000 calls/month)
- **Hosting:** $50-100
- **OpenAI API:** $200-500
- **Twilio:** $100-300
- **Total:** ~$350-900/month

### Scale (100 businesses, 10,000 calls/month)
- **Hosting:** $200-500
- **OpenAI API:** $2000-5000
- **Twilio:** $1000-3000
- **Total:** ~$3200-8500/month

---

## Next Steps

1. **Make decisions** on voice provider, TTS, STT
2. **Set up accounts:**
   - Twilio account
   - OpenAI account (already have)
   - Railway/Render account
   - PostgreSQL database
3. **Update requirements.txt** with new dependencies
4. **Update .env.example** with new variables
5. **Begin Phase 1 implementation**

---

*Update this document as decisions are made.*
gcloud builds submit --config=cloudbuild-frontend.yaml .
gcloud builds submit --config=cloudbuild.yaml .