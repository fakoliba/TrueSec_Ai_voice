from datetime import datetime
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.types import JSON
from sqlalchemy.orm import relationship

from app.db.base import Base


class Business(Base):
    """Multi-tenant root entity. Each business is isolated."""

    __tablename__ = "businesses"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    business_type = Column(String(50), nullable=True)  # 'dental', 'medical', 'mechanic', 'other'
    email = Column(String(255), unique=True, index=True, nullable=True)
    phone = Column(String(20), nullable=True)
    address = Column(Text, nullable=True)
    timezone = Column(String(50), default="UTC", nullable=False)

    # Subscription
    subscription_plan = Column(String(50), default="free", nullable=False)  # 'free', 'basic', 'premium'
    subscription_status = Column(String(50), default="active", nullable=False)  # 'active', 'suspended', 'cancelled'

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    users = relationship("BusinessUser", back_populates="business")
    customers = relationship("Customer", back_populates="business")
    appointments = relationship("Appointment", back_populates="business")
    services = relationship("Service", back_populates="business")
    settings = relationship("BusinessSettings", back_populates="business", uselist=False)
    calendar_integrations = relationship("CalendarIntegration", back_populates="business")
    conversations = relationship("Conversation", back_populates="business")
    intake_forms = relationship("IntakeForm", back_populates="business")
    intake_submissions = relationship("IntakeSubmission", back_populates="business")
    call_logs = relationship("CallLog", back_populates="business")


class BusinessUser(Base):
    """Links users to businesses with roles and permissions."""

    __tablename__ = "business_users"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(50), nullable=False)  # 'owner', 'admin', 'staff'
    permissions = Column(JSON, nullable=True)  # Custom permissions

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    business = relationship("Business", back_populates="users")
    user = relationship("User", back_populates="business_users")

    __table_args__ = (UniqueConstraint("business_id", "user_id", name="uq_business_user"),)


class BusinessSettings(Base):
    """Stores all business configuration and preferences."""

    __tablename__ = "business_settings"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), unique=True, nullable=False)

    # AI Voice Settings (JSON)
    ai_voice_settings = Column(JSON, nullable=True)  # default set in app if needed
    # Business Hours (JSON): {"monday": {"open": "09:00", "close": "17:00", "breaks": []}, ...}
    business_hours = Column(JSON, nullable=True)
    availability_rules = Column(JSON, nullable=True)

    # Appointment Settings
    auto_confirm_appointments = Column(Boolean, default=False)
    require_confirmation = Column(Boolean, default=True)

    # Reminder Settings (JSON)
    reminder_settings = Column(JSON, nullable=True)
    notification_preferences = Column(JSON, nullable=True)

    # AI-guided intake: default form for new-customer registration flow
    default_intake_form_id = Column(Integer, ForeignKey("intake_forms.id", ondelete="SET NULL"), nullable=True, index=True)
    ai_intake_enabled = Column(Boolean, default=True, nullable=False)

    # Dashboard UI: gold | emerald (owner-selectable in Settings)
    dashboard_theme = Column(String(32), nullable=False, default="gold")

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    business = relationship("Business", back_populates="settings")
    default_intake_form = relationship("IntakeForm", foreign_keys=[default_intake_form_id])
