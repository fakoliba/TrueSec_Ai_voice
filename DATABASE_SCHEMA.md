# Database Schema Reference

## Entity Relationship Overview

```
Business (1) ──< (N) BusinessUser
Business (1) ──< (N) Customer
Business (1) ──< (N) Appointment
Business (1) ──< (N) Service
Business (1) ──< (N) IntakeForm
Business (1) ──< (N) CalendarIntegration
Business (1) ──< (N) CallLog
Business (1) ──< (N) Conversation
Business (1) ──< (1) BusinessSettings
Business (1) ──< (1) Subscription

User (1) ──< (N) BusinessUser
User (1) ──< (N) OAuthToken

Customer (1) ──< (N) Appointment
Customer (1) ──< (N) IntakeSubmission
Customer (1) ──< (N) CallLog
Customer (1) ──< (N) Conversation

Service (1) ──< (N) Appointment

IntakeForm (1) ──< (N) IntakeSubmission

CallLog (1) ──< (N) Conversation
```

## Detailed Models

### Business
**Purpose:** Multi-tenant root entity. Each business is isolated.

```python
class Business(Base):
    __tablename__ = "businesses"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    business_type = Column(String(50))  # 'dental', 'medical', 'mechanic', 'other'
    email = Column(String(255), unique=True, index=True)
    phone = Column(String(20))
    address = Column(Text)
    timezone = Column(String(50), default='UTC')
    
    # Subscription
    subscription_plan = Column(String(50), default='free')  # 'free', 'basic', 'premium'
    subscription_status = Column(String(50), default='active')  # 'active', 'suspended', 'cancelled'
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    users = relationship("BusinessUser", back_populates="business")
    customers = relationship("Customer", back_populates="business")
    appointments = relationship("Appointment", back_populates="business")
    services = relationship("Service", back_populates="business")
    intake_forms = relationship("IntakeForm", back_populates="business")
    calendar_integrations = relationship("CalendarIntegration", back_populates="business")
    call_logs = relationship("CallLog", back_populates="business")
    conversations = relationship("Conversation", back_populates="business")
    settings = relationship("BusinessSettings", back_populates="business", uselist=False)
    subscription = relationship("Subscription", back_populates="business", uselist=False)
```

### BusinessUser
**Purpose:** Links users to businesses with roles and permissions.

```python
class BusinessUser(Base):
    __tablename__ = "business_users"
    
    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role = Column(String(50), nullable=False)  # 'owner', 'admin', 'staff'
    permissions = Column(JSON)  # Custom permissions JSON
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    business = relationship("Business", back_populates="users")
    user = relationship("User", back_populates="business_users")
    
    # Unique constraint
    __table_args__ = (UniqueConstraint('business_id', 'user_id'),)
```

### BusinessSettings
**Purpose:** Stores all business configuration and preferences.

```python
class BusinessSettings(Base):
    __tablename__ = "business_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), unique=True, nullable=False)
    
    # AI Voice Settings (JSON)
    ai_voice_settings = Column(JSON, default={
        "voice_id": "default",
        "tone": "professional",
        "gender": "neutral",
        "language": "en",
        "accent": "us"
    })
    
    # Business Hours (JSON)
    # Format: {"monday": {"open": "09:00", "close": "17:00", "breaks": []}, ...}
    business_hours = Column(JSON)
    
    # Availability Rules (JSON)
    availability_rules = Column(JSON)
    
    # Appointment Settings
    auto_confirm_appointments = Column(Boolean, default=False)
    require_confirmation = Column(Boolean, default=True)
    
    # Reminder Settings (JSON)
    reminder_settings = Column(JSON, default={
        "email_enabled": True,
        "sms_enabled": False,
        "voice_enabled": False,
        "advance_hours": 24
    })
    
    # Notification Settings
    notification_preferences = Column(JSON)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    business = relationship("Business", back_populates="settings")
```

### Service
**Purpose:** Services offered by the business (e.g., "Teeth Cleaning", "Oil Change").

```python
class Service(Base):
    __tablename__ = "services"
    
    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    duration_minutes = Column(Integer, nullable=False)  # Duration in minutes
    price = Column(Numeric(10, 2))  # Optional price
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    business = relationship("Business", back_populates="services")
    appointments = relationship("Appointment", back_populates="service")
```

### Customer
**Purpose:** Customers/patients of the business.

```python
class Customer(Base):
    __tablename__ = "customers"
    
    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255))
    phone = Column(String(20))
    date_of_birth = Column(Date)  # Optional, for medical businesses
    address = Column(Text)
    notes = Column(JSON)  # Additional notes/metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    business = relationship("Business", back_populates="customers")
    appointments = relationship("Appointment", back_populates="customer")
    intake_submissions = relationship("IntakeSubmission", back_populates="customer")
    call_logs = relationship("CallLog", back_populates="customer")
    conversations = relationship("Conversation", back_populates="customer")
```

### Appointment (Enhanced)
**Purpose:** Scheduled appointments.

```python
class Appointment(Base):
    __tablename__ = "appointments"
    
    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=True)
    
    title = Column(String(255), nullable=False)
    description = Column(Text)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    
    status = Column(String(50), default='scheduled')  # 'scheduled', 'confirmed', 'cancelled', 'completed'
    source = Column(String(50))  # 'voice', 'web', 'admin'
    
    google_calendar_event_id = Column(String(255))  # Keep for backward compatibility
    calendar_event_ids = Column(JSON)  # Multiple calendar IDs
    
    reminder_sent = Column(Boolean, default=False)
    reminder_sent_at = Column(DateTime)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    business = relationship("Business", back_populates="appointments")
    customer = relationship("Customer", back_populates="appointments")
    service = relationship("Service", back_populates="appointments")
    
    # Indexes
    __table_args__ = (
        Index('idx_business_start_time', 'business_id', 'start_time'),
        Index('idx_customer_id', 'customer_id'),
    )
```

### CalendarIntegration
**Purpose:** Stores calendar provider connections for each business.

```python
class CalendarIntegration(Base):
    __tablename__ = "calendar_integrations"
    
    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    provider = Column(String(50), nullable=False)  # 'google', 'outlook', 'apple'
    provider_account_id = Column(String(255))  # User's account ID with provider
    access_token = Column(Text, nullable=False)
    refresh_token = Column(Text)
    token_expiry = Column(DateTime)
    calendar_id = Column(String(255))  # Specific calendar ID
    is_primary = Column(Boolean, default=False)
    sync_enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    business = relationship("Business", back_populates="calendar_integrations")
```

### IntakeForm
**Purpose:** Customizable intake forms for businesses.

```python
class IntakeForm(Base):
    __tablename__ = "intake_forms"
    
    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    name = Column(String(255), nullable=False)
    form_type = Column(String(50))  # 'new_patient', 'appointment', 'general'
    
    # Questions structure (JSON)
    # Format: [{"id": 1, "type": "text", "label": "Name", "required": true, ...}, ...]
    questions = Column(JSON, nullable=False)
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    business = relationship("Business", back_populates="intake_forms")
    submissions = relationship("IntakeSubmission", back_populates="intake_form")
```

### IntakeSubmission
**Purpose:** Submitted intake form data.

```python
class IntakeSubmission(Base):
    __tablename__ = "intake_submissions"
    
    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)  # May be null if new customer
    intake_form_id = Column(Integer, ForeignKey("intake_forms.id"), nullable=False)
    
    # Responses structure (JSON)
    # Format: {"question_id": "answer", ...}
    responses = Column(JSON, nullable=False)
    
    status = Column(String(50), default='pending')  # 'pending', 'reviewed', 'archived'
    submitted_at = Column(DateTime, default=datetime.utcnow)
    reviewed_at = Column(DateTime)
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Relationships
    business = relationship("Business")
    customer = relationship("Customer", back_populates="intake_submissions")
    intake_form = relationship("IntakeForm", back_populates="submissions")
```

### CallLog
**Purpose:** Logs of all voice calls.

```python
class CallLog(Base):
    __tablename__ = "call_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    phone_number = Column(String(20), nullable=False)
    direction = Column(String(20), nullable=False)  # 'inbound', 'outbound'
    status = Column(String(50), nullable=False)  # 'completed', 'missed', 'voicemail', 'failed'
    duration_seconds = Column(Integer, default=0)
    
    # AI Processing
    transcript = Column(JSON)  # Full transcript with timestamps
    ai_summary = Column(Text)  # AI-generated summary
    intent = Column(String(50))  # Detected intent
    
    recording_url = Column(String(500))  # Optional call recording URL
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    business = relationship("Business", back_populates="call_logs")
    customer = relationship("Customer", back_populates="call_logs")
    conversations = relationship("Conversation", back_populates="call_log")
```

### Conversation
**Purpose:** Stores conversation history (voice, chat, SMS).

```python
class Conversation(Base):
    __tablename__ = "conversations"
    
    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    call_log_id = Column(Integer, ForeignKey("call_logs.id"), nullable=True)
    
    channel = Column(String(50), nullable=False)  # 'voice', 'chat', 'sms'
    
    # Messages structure (JSON array)
    # Format: [{"role": "user|assistant", "content": "...", "timestamp": "..."}, ...]
    messages = Column(JSON, nullable=False)
    
    intent = Column(String(50))  # 'appointment', 'inquiry', 'intake', 'other'
    resolved = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    business = relationship("Business", back_populates="conversations")
    customer = relationship("Customer", back_populates="conversations")
    call_log = relationship("CallLog", back_populates="conversations")
```

### Subscription
**Purpose:** Subscription and usage tracking.

```python
class Subscription(Base):
    __tablename__ = "subscriptions"
    
    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), unique=True, nullable=False)
    
    plan_name = Column(String(50), nullable=False)  # 'free', 'basic', 'premium'
    features = Column(JSON)  # Available features for this plan
    
    monthly_price = Column(Numeric(10, 2))
    
    # Usage limits (JSON)
    # Format: {"calls": 100, "appointments": 500, "storage_gb": 10, ...}
    usage_limits = Column(JSON)
    
    # Current usage (JSON)
    # Format: {"calls": 45, "appointments": 120, "storage_gb": 2.5, ...}
    current_usage = Column(JSON, default={})
    
    billing_cycle_start = Column(DateTime)
    billing_cycle_end = Column(DateTime)
    status = Column(String(50), default='active')  # 'active', 'suspended', 'cancelled'
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    business = relationship("Business", back_populates="subscription")
```

### Updated: User
**Purpose:** System users (can be business owners, staff, or customers).

```python
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    phone_number = Column(String(20))  # NEW
    role = Column(String(50), default='customer')  # NEW: 'customer', 'business_owner', 'staff'
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    appointments = relationship("Appointment", back_populates="user")  # Keep for backward compat
    oauth_tokens = relationship("OAuthToken", back_populates="user", uselist=False)
    business_users = relationship("BusinessUser", back_populates="user")  # NEW
```

### Keep: OAuthToken
**Purpose:** OAuth tokens for calendar integrations (unchanged structure, but now business-scoped).

---

## Indexes Strategy

### Critical Indexes
```sql
-- Business scoping (most queries filter by business_id)
CREATE INDEX idx_appointments_business_start ON appointments(business_id, start_time);
CREATE INDEX idx_customers_business ON customers(business_id);
CREATE INDEX idx_conversations_business ON conversations(business_id, created_at);
CREATE INDEX idx_call_logs_business ON call_logs(business_id, created_at);

-- Customer lookups
CREATE INDEX idx_customers_email ON customers(business_id, email);
CREATE INDEX idx_customers_phone ON customers(business_id, phone);

-- Calendar sync
CREATE INDEX idx_calendar_integrations_business ON calendar_integrations(business_id, provider);
```

---

## Migration Strategy

1. **Phase 1 Migration:**
   - Create new tables (Business, BusinessUser, BusinessSettings, etc.)
   - Add new columns to existing tables (User.phone_number, User.role, etc.)
   - Migrate existing users to a default business (or create individual businesses)

2. **Data Migration:**
   - Create a default business for each existing user
   - Link users to their default business
   - Migrate existing appointments to include business_id

3. **Backward Compatibility:**
   - Keep old endpoints working during transition
   - Gradually migrate to business-scoped endpoints

---

## Notes

- All business-scoped queries MUST include `business_id` filter
- Use soft deletes where appropriate (add `deleted_at` column)
- Consider adding `created_by` and `updated_by` audit fields
- Use JSON columns for flexible, schema-less data (voice settings, availability rules)
- Timestamps use UTC, convert to business timezone in API layer

---

*This schema supports the full AI Support Agent Backend requirements.*
