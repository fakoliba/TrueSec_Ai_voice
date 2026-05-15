from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


class DashboardTheme(str, Enum):
    """Per-business dashboard palette (Settings)."""

    gold = "gold"
    emerald = "emerald"


class BusinessBase(BaseModel):
    name: str = Field(..., max_length=255)
    business_type: Optional[str] = Field(None, max_length=50)  # dental, medical, mechanic, other
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=20)
    address: Optional[str] = None
    timezone: str = Field(default="UTC", max_length=50)


class BusinessCreate(BusinessBase):
    # Require address for billing; keep optional on base for legacy rows
    address: str = Field(..., max_length=500)


class BusinessUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    business_type: Optional[str] = Field(None, max_length=50)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=20)
    address: Optional[str] = None
    timezone: Optional[str] = Field(None, max_length=50)


class Business(BusinessBase):
    id: int
    subscription_plan: str = "free"
    subscription_status: str = "active"
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# BusinessUser schemas
class BusinessUserBase(BaseModel):
    role: str = Field(..., max_length=50)  # owner, admin, staff
    permissions: Optional[dict[str, Any]] = None


class BusinessUserCreate(BusinessUserBase):
    user_id: int


class BusinessUserCreateByEmail(BaseModel):
    email: EmailStr
    role: str = Field(default="staff", max_length=50)
    permissions: Optional[dict[str, Any]] = None
    # If user does not exist and these are provided, create the user then add to business
    full_name: Optional[str] = Field(None, max_length=255)
    password: Optional[str] = None


class BusinessUserUpdate(BaseModel):
    role: Optional[str] = Field(None, max_length=50)
    permissions: Optional[dict[str, Any]] = None


class BusinessUser(BaseModel):
    id: int
    business_id: int
    user_id: int
    role: str
    permissions: Optional[dict[str, Any]] = None
    created_at: datetime

    class Config:
        from_attributes = True


class BusinessUserWithUser(BusinessUser):
    """BusinessUser plus user email/name for list responses."""

    user_email: Optional[str] = None
    user_full_name: Optional[str] = None


# Calendar integration (no tokens in response)
class CalendarIntegrationResponse(BaseModel):
    id: int
    business_id: int
    provider: str
    provider_account_id: Optional[str] = None
    calendar_id: Optional[str] = None
    is_primary: bool
    sync_enabled: bool
    created_at: datetime

    class Config:
        from_attributes = True


class CalendarConnectResponse(BaseModel):
    """URL to send the user to for OAuth."""
    authorization_url: str


class AppleCalendarConnectRequest(BaseModel):
    """Credentials for Apple iCloud CalDAV (app-specific password)."""
    username: str  # Apple ID email
    app_specific_password: str


# Business settings (hours, availability, etc.)
class BusinessSettingsResponse(BaseModel):
    id: int
    business_id: int
    business_hours: Optional[dict[str, Any]] = None
    availability_rules: Optional[dict[str, Any]] = None
    auto_confirm_appointments: bool = False
    require_confirmation: bool = True
    # handoff_phone, handoff_voicemail_only, voice_stack (openai|elevenlabs), elevenlabs_voice_id
    ai_voice_settings: Optional[dict[str, Any]] = None
    default_intake_form_id: Optional[int] = None
    ai_intake_enabled: bool = True
    dashboard_theme: DashboardTheme = DashboardTheme.gold
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BusinessSettingsUpdate(BaseModel):
    business_hours: Optional[dict[str, Any]] = None
    availability_rules: Optional[dict[str, Any]] = None
    auto_confirm_appointments: Optional[bool] = None
    require_confirmation: Optional[bool] = None
    ai_voice_settings: Optional[dict[str, Any]] = None  # + voice_stack, elevenlabs_voice_id (plan-gated)
    default_intake_form_id: Optional[int] = None
    ai_intake_enabled: Optional[bool] = None
    dashboard_theme: Optional[DashboardTheme] = None


class VoicePresetItem(BaseModel):
    """Human-friendly voice option (no raw provider IDs in UI)."""

    id: str
    label: str
    subtitle: str
    provider: str
    recommended: bool = False


class VoiceOptionsApiResponse(BaseModel):
    """Subscription-aware ElevenLabs vs OpenAI options for the voice settings UI."""

    stack: str
    subscription_plan: str
    subscription_active: bool
    elevenlabs_configured: bool
    can_use_elevenlabs: bool
    allowed_voice_ids: list[str]
    default_voice_id: str
    selected_voice_id: str
    presets: list[VoicePresetItem] = Field(default_factory=list)
    preview_sample_text: str = "Hi, thanks for calling {business_name}, how can I help you today?"
    selected_preset_id: str = ""


class VoicePreviewRequest(BaseModel):
    """TTS preview for dashboard (short samples only)."""

    text: Optional[str] = None
    preset_id: Optional[str] = None
    speed: Optional[float] = Field(None, ge=0.75, le=1.35)


class VoicePreviewResponse(BaseModel):
    audio_base64: str
    media_type: str = "audio/mpeg"
    provider_used: str


# Availability
class AvailabilitySlot(BaseModel):
    start: str  # ISO datetime
    end: str  # ISO datetime


class AvailabilityCheckResponse(BaseModel):
    available: bool


# Services (offered by the business)
class ServiceBase(BaseModel):
    name: str = Field(..., max_length=255)
    description: Optional[str] = None
    duration_minutes: int = Field(..., ge=1, le=480)
    price: Optional[float] = None
    is_active: bool = True


class ServiceCreate(ServiceBase):
    pass


class ServiceUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    duration_minutes: Optional[int] = Field(None, ge=1, le=480)
    price: Optional[float] = None
    is_active: Optional[bool] = None


class ServiceResponse(ServiceBase):
    id: int
    business_id: int
    created_at: datetime
    updated_at: datetime

    @field_validator("price", mode="before")
    @classmethod
    def coerce_price(cls, v: Any) -> Optional[float]:
        if v is None:
            return None
        if isinstance(v, Decimal):
            return float(v)
        return v

    class Config:
        from_attributes = True
