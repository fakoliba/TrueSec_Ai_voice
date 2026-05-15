"""Cached calendar events from sync job (for conflict detection and fast availability)."""
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db.base import Base


class CalendarEventCache(Base):
    """
    Stores calendar events fetched from connected calendars (Google, Outlook, Apple).
    Populated by the Celery sync job; used for conflict detection and availability.
    """

    __tablename__ = "calendar_event_cache"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    calendar_integration_id = Column(Integer, ForeignKey("calendar_integrations.id", ondelete="CASCADE"), nullable=True)

    provider_event_id = Column(String(255), nullable=False)  # ID from Google/Outlook/Apple
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    summary = Column(String(500), nullable=True)

    synced_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    business = relationship("Business", backref="calendar_event_cache")
