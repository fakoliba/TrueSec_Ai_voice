"""Pydantic schemas for intake forms and submissions."""
from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, Field


# Question type for form builder (one item in questions array)
class IntakeQuestion(BaseModel):
    id: str = Field(..., description="Stable key for responses; derived from field label in the dashboard UI")
    type: str = Field(..., description="text, select, date, file, textarea, number")
    label: str
    required: bool = False
    placeholder: Optional[str] = None
    options: Optional[List[str]] = None  # for select
    default: Optional[Any] = None


# IntakeForm schemas
class IntakeFormBase(BaseModel):
    name: str = Field(..., max_length=255)
    form_type: Optional[str] = Field(None, max_length=50)
    questions: List[dict[str, Any]] = Field(..., description="List of question objects")
    is_active: bool = True


class IntakeFormCreate(IntakeFormBase):
    pass


class IntakeFormUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    form_type: Optional[str] = Field(None, max_length=50)
    questions: Optional[List[dict[str, Any]]] = None
    is_active: Optional[bool] = None


class IntakeForm(BaseModel):
    id: int
    business_id: int
    name: str
    form_type: Optional[str] = None
    questions: List[dict[str, Any]]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# IntakeSubmission schemas
class IntakeSubmissionCreate(BaseModel):
    intake_form_id: int
    customer_id: Optional[int] = None
    responses: dict[str, Any] = Field(..., description="Map of question_id to answer")


class IntakeSubmissionUpdate(BaseModel):
    status: Optional[str] = Field(None, description="pending, reviewed, archived")


class IntakeSubmission(BaseModel):
    id: int
    business_id: int
    customer_id: Optional[int] = None
    intake_form_id: int
    responses: dict[str, Any]
    status: str
    submitted_at: datetime
    reviewed_at: Optional[datetime] = None
    reviewed_by: Optional[int] = None

    class Config:
        from_attributes = True


class IntakeSubmissionWithForm(IntakeSubmission):
    """Submission with form name for list views."""
    form_name: Optional[str] = None
