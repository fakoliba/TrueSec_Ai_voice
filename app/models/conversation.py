"""Conversation model for AI agent chat/voice history."""
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.types import JSON

from app.db.base import Base


class Conversation(Base):
    """Stores conversation history (chat, voice, or SMS) with the AI agent."""

    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="SET NULL"), nullable=True)
    intake_submission_id = Column(
        Integer,
        ForeignKey("intake_submissions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    channel = Column(String(50), nullable=False, default="chat")  # 'voice', 'chat', 'sms'

    # Messages: [{"role": "user"|"assistant", "content": "...", "timestamp": "ISO"}, ...]
    messages = Column(JSON, nullable=False, default=list)

    intent = Column(String(50), nullable=True)  # 'appointment', 'inquiry', 'hours', 'other'
    resolved = Column(Boolean, default=False, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    business = relationship("Business", back_populates="conversations")
    customer = relationship("Customer", back_populates="conversations")
    intake_submission = relationship("IntakeSubmission", foreign_keys=[intake_submission_id])
    call_logs = relationship("CallLog", back_populates="conversation")
