from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
import re

from app import models
from app.db.session import get_db
from app.services.auth import get_current_user
from app.services.calendar_service import GoogleCalendarService
from app.schemas.appointment import Appointment, AppointmentCreate, AppointmentUpdate
from app.schemas import appointment as schemas
from pydantic import BaseModel

router = APIRouter()

class ProcessCommandRequest(BaseModel):
    text: str

class ProcessCommandResponse(BaseModel):
    action: str
    appointment: Optional[Dict[str, Any]] = None

@router.post("/appointments/", response_model=schemas.Appointment)
async def create_appointment(
    appointment: schemas.AppointmentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Create a new appointment. Prefer POST /api/businesses/{business_id}/appointments."""
    if not getattr(appointment, "business_id", None):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="business_id required. Use POST /api/businesses/{business_id}/appointments or include business_id in body.",
        )
    # Verify user is member of business
    bu = db.query(models.BusinessUser).filter(
        models.BusinessUser.business_id == appointment.business_id,
        models.BusinessUser.user_id == current_user.id,
    ).first()
    if not bu:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this business")
    db_appointment = models.Appointment(
        business_id=appointment.business_id,
        title=appointment.title,
        description=appointment.description,
        start_time=appointment.start_time,
        end_time=appointment.end_time,
        customer_id=appointment.customer_id,
        service_id=appointment.service_id,
        status=appointment.status,
        source=appointment.source,
        user_id=current_user.id,
    )
    
    try:
        # Add to Google Calendar if user has connected their account
        oauth_token = db.query(models.OAuthToken).filter(
            models.OAuthToken.user_id == current_user.id,
            models.OAuthToken.provider == 'google'
        ).first()
        
        if oauth_token:
            event = await GoogleCalendarService.create_calendar_event(
                user_id=current_user.id,
                summary=appointment.title,
                description=appointment.description,
                start_time=appointment.start_time,
                end_time=appointment.end_time,
                db=db
            )
            db_appointment.google_calendar_event_id = event.get('id')
        
        db.add(db_appointment)
        db.commit()
        db.refresh(db_appointment)
        return db_appointment
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.get("/appointments/", response_model=List[schemas.Appointment])
def list_appointments(
    skip: int = 0,
    limit: int = 100,
    business_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """List appointments: all for current user's businesses, or for one business if business_id given."""
    q = db.query(models.Appointment)
    if business_id is not None:
        # Ensure user is member of this business
        bu = db.query(models.BusinessUser).filter(
            models.BusinessUser.business_id == business_id,
            models.BusinessUser.user_id == current_user.id,
        ).first()
        if not bu:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this business")
        q = q.filter(models.Appointment.business_id == business_id)
    else:
        # Appointments in any of user's businesses
        biz_ids = [r[0] for r in db.query(models.BusinessUser.business_id).filter(models.BusinessUser.user_id == current_user.id).all()]
        if not biz_ids:
            return []
        q = q.filter(models.Appointment.business_id.in_(biz_ids))
    appointments = q.offset(skip).limit(limit).order_by(models.Appointment.start_time).all()
    return appointments

@router.get("/appointments/{appointment_id}", response_model=schemas.Appointment)
def get_appointment(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get a specific appointment by ID (must belong to a business you're a member of)."""
    appointment = db.query(models.Appointment).filter(models.Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    bu = db.query(models.BusinessUser).filter(
        models.BusinessUser.business_id == appointment.business_id,
        models.BusinessUser.user_id == current_user.id,
    ).first()
    if not bu:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    return appointment

@router.put("/appointments/{appointment_id}", response_model=schemas.Appointment)
async def update_appointment(
    appointment_id: int,
    appointment_update: schemas.AppointmentUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Update an existing appointment (must belong to a business you're a member of)."""
    db_appointment = db.query(models.Appointment).filter(models.Appointment.id == appointment_id).first()
    if not db_appointment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    bu = db.query(models.BusinessUser).filter(
        models.BusinessUser.business_id == db_appointment.business_id,
        models.BusinessUser.user_id == current_user.id,
    ).first()
    if not bu:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    
    # Update fields
    for field, value in appointment_update.model_dump(exclude_unset=True).items():
        setattr(db_appointment, field, value)
    
    try:
        # Update in Google Calendar if it was synced
        if db_appointment.google_calendar_event_id:
            oauth_token = db.query(models.OAuthToken).filter(
                models.OAuthToken.user_id == current_user.id,
                models.OAuthToken.provider == 'google'
            ).first()
            
            if oauth_token:
                event = {
                    'summary': db_appointment.title,
                    'description': db_appointment.description or '',
                    'start': {
                        'dateTime': db_appointment.start_time.isoformat(),
                        'timeZone': 'UTC',
                    },
                    'end': {
                        'dateTime': db_appointment.end_time.isoformat(),
                        'timeZone': 'UTC',
                    },
                }
                
                credentials = GoogleCalendarService.get_credentials({
                    'access_token': oauth_token.access_token,
                    'refresh_token': oauth_token.refresh_token,
                    'token_uri': 'https://oauth2.googleapis.com/token',
                    'client_id': GoogleCalendarService.get_oauth_flow().client_config['client_id'],
                    'scopes': GoogleCalendarService.SCOPES
                })
                
                if credentials.expired and credentials.refresh_token:
                    credentials.refresh(Request())
                    oauth_token.access_token = credentials.token
                    oauth_token.token_expiry = credentials.expiry
                
                service = build('calendar', 'v3', credentials=credentials)
                service.events().update(
                    calendarId='primary',
                    eventId=db_appointment.google_calendar_event_id,
                    body=event
                ).execute()
        
        db.commit()
        db.refresh(db_appointment)
        return db_appointment
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error updating appointment: {str(e)}"
        )

@router.delete("/appointments/{appointment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_appointment(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Delete an appointment (must belong to a business you're a member of)."""
    db_appointment = db.query(models.Appointment).filter(models.Appointment.id == appointment_id).first()
    if not db_appointment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    bu = db.query(models.BusinessUser).filter(
        models.BusinessUser.business_id == db_appointment.business_id,
        models.BusinessUser.user_id == current_user.id,
    ).first()
    if not bu:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    
    try:
        # Delete from Google Calendar if it was synced
        if db_appointment.google_calendar_event_id:
            oauth_token = db.query(models.OAuthToken).filter(
                models.OAuthToken.user_id == current_user.id,
                models.OAuthToken.provider == 'google'
            ).first()
            
            if oauth_token:
                credentials = GoogleCalendarService.get_credentials({
                    'access_token': oauth_token.access_token,
                    'refresh_token': oauth_token.refresh_token,
                    'token_uri': 'https://oauth2.googleapis.com/token',
                    'client_id': GoogleCalendarService.get_oauth_flow().client_config['client_id'],
                    'scopes': GoogleCalendarService.SCOPES
                })
                
                if credentials.expired and credentials.refresh_token:
                    credentials.refresh(Request())
                    oauth_token.access_token = credentials.token
                    oauth_token.token_expiry = credentials.expiry
                
                service = build('calendar', 'v3', credentials=credentials)
                service.events().delete(
                    calendarId='primary',
                    eventId=db_appointment.google_calendar_event_id
                ).execute()
        
        # Delete from database
        db.delete(db_appointment)
        db.commit()
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error deleting appointment: {str(e)}"
        )
    
    return {"ok": True}

@router.post("/process-command", response_model=ProcessCommandResponse)
async def process_command(
    request: ProcessCommandRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Process voice command and return appropriate action"""
    text = request.text.lower()
    
    # Check for create appointment command
    create_patterns = [
        r"schedule\s+(a\s+)?(meeting|appointment)(\s+for\s+)?(.*?)(?:\.|\?|$)",
        r"create\s+(a\s+)?(meeting|appointment)(\s+for\s+)?(.*?)(?:\.|\?|$)",
        r"book\s+(a\s+)?(meeting|appointment)(\s+for\s+)?(.*?)(?:\.|\?|$)",
    ]
    
    for pattern in create_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            # Extract appointment details (simplified - in a real app, you'd use NLP here)
            details = match.group(4) if match.group(4) else ""
            
            # Default values
            title = "Meeting"
            start_time = datetime.now() + timedelta(hours=1)
            end_time = start_time + timedelta(hours=1)
            
            # Try to extract time (simplified)
            time_match = re.search(r"(\d{1,2}(?::\d{2})?\s?(?:am|pm)?)", details, re.IGNORECASE)
            if time_match:
                time_str = time_match.group(1)
                # This is a simplified time parsing - in a real app, use a proper library
                try:
                    # This is a very basic time parser - consider using dateutil.parser in production
                    from datetime import time as dt_time
                    if 'am' in time_str.lower() or 'pm' in time_str.lower():
                        time_part = time_str.lower().replace('am', '').replace('pm', '').strip()
                        if ':' in time_part:
                            hours, minutes = map(int, time_part.split(':'))
                        else:
                            hours, minutes = int(time_part), 0
                        if 'pm' in time_str.lower() and hours < 12:
                            hours += 12
                        elif 'am' in time_str.lower() and hours == 12:
                            hours = 0
                        start_time = start_time.replace(hour=hours, minute=minutes)
                except Exception as e:
                    print(f"Error parsing time: {e}")
            
            # Set end time to 1 hour after start
            end_time = start_time + timedelta(hours=1)
            
            # Try to extract title (everything before time or after 'about')
            title_match = re.search(r"(?:about|for|re:|regarding|re)\s+(.*?)(?:\s+at\s+\d|\s+on\s+\w|$)", details, re.IGNORECASE)
            if title_match:
                title = title_match.group(1).strip()
            
            return ProcessCommandResponse(
                action="create_appointment",
                appointment={
                    "title": title,
                    "start_time": start_time.isoformat(),
                    "end_time": end_time.isoformat()
                }
            )
    
    # Default response for unrecognized commands
    return ProcessCommandResponse(
        action="unknown_command",
        appointment=None
    )

@router.get("/calendar/events/", response_model=List[Dict[str, Any]])
async def list_calendar_events(
    time_min: Optional[datetime] = None,
    time_max: Optional[datetime] = None,
    max_results: int = 10,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """List upcoming events from the user's Google Calendar"""
    try:
        events = await GoogleCalendarService.list_calendar_events(
            user_id=current_user.id,
            time_min=time_min,
            time_max=time_max,
            max_results=max_results,
            db=db
        )
        return events
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
