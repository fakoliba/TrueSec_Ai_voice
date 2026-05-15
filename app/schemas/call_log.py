"""Schemas for call log API."""
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel


class CallLogResponse(BaseModel):
    id: int
    business_id: int
    customer_id: Optional[int] = None
    phone_number: str
    direction: str
    status: str
    duration_seconds: int = 0
    transcript: Optional[list[Any]] = None
    ai_summary: Optional[str] = None
    intent: Optional[str] = None
    recording_url: Optional[str] = None
    twilio_call_sid: Optional[str] = None
    conversation_id: Optional[int] = None
    voice_providers: Optional[dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
