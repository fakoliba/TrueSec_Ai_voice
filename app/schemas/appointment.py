from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class AppointmentBase(BaseModel):
    title: str = Field(..., max_length=255)
    description: Optional[str] = Field(None, max_length=500)
    start_time: datetime
    end_time: datetime


class AppointmentCreate(AppointmentBase):
    business_id: Optional[int] = None  # required when using legacy POST /api/appointments/
    customer_id: Optional[int] = None
    service_id: Optional[int] = None
    status: str = Field(default="scheduled", max_length=50)
    source: Optional[str] = Field(None, max_length=50)


class AppointmentUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = Field(None, max_length=500)
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    customer_id: Optional[int] = None
    service_id: Optional[int] = None
    status: Optional[str] = Field(None, max_length=50)
    booking_phone: Optional[str] = Field(None, max_length=20)


class AppointmentInDBBase(AppointmentBase):
    id: int
    business_id: int
    customer_id: Optional[int] = None
    service_id: Optional[int] = None
    user_id: Optional[int] = None
    status: str = "scheduled"
    source: Optional[str] = None
    booking_phone: Optional[str] = None  # voice: Twilio From — fallback match for manage flows
    google_calendar_event_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class Appointment(AppointmentInDBBase):
    pass


class AppointmentInDB(AppointmentInDBBase):
    pass
