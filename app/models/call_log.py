"""Call log model for voice call tracking."""
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.types import JSON

from app.db.base import Base


class CallLog(Base):
    """Log of a voice call (inbound/outbound) for a business."""

    __tablename__ = "call_logs"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="SET NULL"), nullable=True)

    phone_number = Column(String(20), nullable=False)
    direction = Column(String(20), nullable=False)  # 'inbound', 'outbound'
    status = Column(String(50), nullable=False, default="in_progress")  # in_progress, completed, missed, failed

    duration_seconds = Column(Integer, default=0)
    # Optional: full transcript with timestamps
    transcript = Column(JSON, nullable=True)
    ai_summary = Column(Text, nullable=True)
    intent = Column(String(50), nullable=True)
    recording_url = Column(String(500), nullable=True)

    # Twilio
    twilio_call_sid = Column(String(100), nullable=True, index=True)

    # AI agent thread (e.g. voice turn-by-turn); set when Twilio flow persists Conversation
    conversation_id = Column(Integer, ForeignKey("conversations.id", ondelete="SET NULL"), nullable=True, index=True)

    # Last turn: which STT/TTS backend served audio (e.g. {"stt": "elevenlabs", "tts": "openai"})
    voice_providers = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    business = relationship("Business", back_populates="call_logs")
    customer = relationship("Customer", back_populates="call_logs")
    conversation = relationship("Conversation", back_populates="call_logs")
