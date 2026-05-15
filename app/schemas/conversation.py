"""Schemas for conversation API."""
from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, Field


class ConversationMessage(BaseModel):
    role: str  # 'user' | 'assistant'
    content: str
    timestamp: Optional[str] = None


class ConversationCreate(BaseModel):
    """Start or continue a conversation on the business dashboard.

    Use ``channel="internal_help"`` for the staff product-help assistant (default). This route does not
    run customer intake; ``start_intake`` is ignored (intake is on the voice line).
    """

    message: str = Field(..., min_length=1, max_length=4000)
    conversation_id: Optional[int] = None
    channel: str = Field(default="internal_help", max_length=50)
    customer_id: Optional[int] = None
    start_intake: bool = False  # Ignored by POST .../conversations (staff chat only).


class ConversationReply(BaseModel):
    conversation_id: int
    reply: str
    intent: Optional[str] = None


class Conversation(BaseModel):
    id: int
    business_id: int
    customer_id: Optional[int] = None
    intake_submission_id: Optional[int] = None
    channel: str
    messages: List[Any] = []
    intent: Optional[str] = None
    resolved: bool = False
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
