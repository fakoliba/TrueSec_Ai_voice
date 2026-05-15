"""Intake form and submission models for customer intake."""
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.types import JSON

from app.db.base import Base


class IntakeForm(Base):
    """Customizable intake forms per business."""

    __tablename__ = "intake_forms"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    form_type = Column(String(50), nullable=True)  # 'new_patient', 'appointment', 'general'

    # Questions: [{"id": 1, "type": "text", "label": "Name", "required": true, ...}, ...]
    questions = Column(JSON, nullable=False)

    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    business = relationship("Business", back_populates="intake_forms")
    submissions = relationship("IntakeSubmission", back_populates="intake_form")


class IntakeSubmission(Base):
    """Submitted intake form data."""

    __tablename__ = "intake_submissions"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="SET NULL"), nullable=True)
    intake_form_id = Column(Integer, ForeignKey("intake_forms.id", ondelete="CASCADE"), nullable=False)

    # Responses: {"question_id": "answer", ...}
    responses = Column(JSON, nullable=False)

    # draft = AI collecting; pending = submitted for staff review; reviewed/archived = processed
    status = Column(String(50), default="pending", nullable=False)
    submitted_at = Column(DateTime, default=datetime.utcnow)
    reviewed_at = Column(DateTime, nullable=True)
    reviewed_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    business = relationship("Business", back_populates="intake_submissions")
    customer = relationship("Customer", back_populates="intake_submissions")
    intake_form = relationship("IntakeForm", back_populates="submissions")
