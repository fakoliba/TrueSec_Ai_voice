"""
Slot-filling for voice: collect customer_name, date, time for schedule_appointment; create appointment when complete.
"""
import re
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models.appointment import Appointment
from app.models.business import Business
from app.services.availability_service import get_calendar_conflicts
from app.services.customer_service import find_or_create_customer_for_voice

REQUIRED_SLOTS_SCHEDULE = ["customer_name", "date", "time"]
DEFAULT_DURATION_MINUTES = 30


def get_missing_slots(slots: Dict[str, Any], intent: str) -> List[str]:
    if intent != "appointment":
        return []
    return [k for k in REQUIRED_SLOTS_SCHEDULE if not _slot_value(slots.get(k))]


def _slot_value(v: Any) -> Optional[str]:
    if v is None:
        return None
    s = (v if isinstance(v, str) else str(v)).strip()
    return s if s else None


def extract_slots_from_message(
    message: str,
    current_slots: Dict[str, Any],
    missing: List[str],
) -> Dict[str, Any]:
    """Update slots from user message. Simple heuristics; can be replaced with LLM extraction later."""
    updated = dict(current_slots)
    msg = (message or "").strip()
    if not msg:
        return updated

    # If we need customer_name and haven't set it, use the whole message (or first sentence) as name
    if "customer_name" in missing and not _slot_value(updated.get("customer_name")):
        # User often says "John Smith" or "My name is John Smith"
        name = msg
        if "my name is" in msg.lower():
            name = msg.lower().split("my name is", 1)[-1].strip()
        elif "i'm " in msg.lower() or "i am " in msg.lower():
            for sep in ["i'm ", "i am "]:
                if sep in msg.lower():
                    name = msg.lower().split(sep, 1)[-1].strip()
                    break
        if name and len(name) < 100:
            updated["customer_name"] = name.strip().title()

    # Simple date patterns
    if "date" in missing and not _slot_value(updated.get("date")):
        today = datetime.utcnow().date()
        lower = msg.lower()
        if "tomorrow" in lower:
            updated["date"] = (today + timedelta(days=1)).isoformat()
        elif "next monday" in lower or "monday" in lower:
            d = today
            while d.weekday() != 0:
                d += timedelta(days=1)
            if "next" in lower and "monday" in lower:
                d += timedelta(days=7)
            updated["date"] = d.isoformat()
        elif "next tuesday" in lower or "tuesday" in lower:
            d = today
            while d.weekday() != 1:
                d += timedelta(days=1)
            if "next" in lower: d += timedelta(days=7)
            updated["date"] = d.isoformat()
        elif "next week" in lower:
            updated["date"] = (today + timedelta(days=7)).isoformat()
        # ISO date pattern
        match = re.search(r"\b(20\d{2})-(\d{2})-(\d{2})\b", msg)
        if match:
            updated["date"] = match.group(0)

    # Time patterns: 2pm, 2:30pm, 14:00, 2 o'clock
    if "time" in missing and not _slot_value(updated.get("time")):
        time_match = re.search(
            r"\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b",
            msg.lower(),
            re.IGNORECASE,
        )
        if time_match:
            h = int(time_match.group(1))
            m = int(time_match.group(2) or 0)
            ampm = (time_match.group(3) or "").lower()
            if ampm == "pm" and h < 12:
                h += 12
            elif ampm == "am" and h == 12:
                h = 0
            elif not ampm and h <= 12:
                pass  # assume reasonable default
            if 0 <= h <= 23 and 0 <= m <= 59:
                updated["time"] = f"{h:02d}:{m:02d}"

    return updated


def slots_to_start_end(
    slots: Dict[str, Any],
    business: Business,
) -> Optional[Tuple[datetime, datetime]]:
    """Convert slots (date, time) to start_time and end_time in UTC."""
    date_str = _slot_value(slots.get("date"))
    time_str = _slot_value(slots.get("time"))
    if not date_str or not time_str:
        return None
    try:
        from zoneinfo import ZoneInfo
        tz_name = (business.timezone or "UTC").strip()
        try:
            tz = ZoneInfo(tz_name)
        except Exception:
            tz = ZoneInfo("UTC")
        # Parse date (YYYY-MM-DD) and time (HH:MM or H:MM)
        if "T" in date_str:
            date_str = date_str.split("T")[0]
        year, month, day = map(int, date_str.split("-"))
        time_part = time_str.replace(" ", "")
        if ":" in time_part:
            h, m = map(int, time_part.split(":")[:2])
        else:
            h = int(time_part[:2])
            m = int(time_part[2:4]) if len(time_part) >= 4 else 0
        start_local = datetime(year, month, day, h, m, 0, tzinfo=tz)
        start_utc = start_local.astimezone(ZoneInfo("UTC")).replace(tzinfo=None)
        end_utc = start_utc + timedelta(minutes=DEFAULT_DURATION_MINUTES)
        return start_utc, end_utc
    except Exception:
        return None


def create_voice_appointment(
    db: Session,
    business_id: int,
    title: str,
    start_time: datetime,
    end_time: datetime,
    customer_name: Optional[str] = None,
    caller_phone: Optional[str] = None,
    service_id: Optional[int] = None,
) -> Optional[Appointment]:
    """Create an appointment from voice flow. Links or creates a Customer when phone and/or name are provided."""
    conflicts = get_calendar_conflicts(db, business_id, start_time, end_time)
    if conflicts:
        return None
    customer_id = None
    if caller_phone or customer_name:
        cust = find_or_create_customer_for_voice(db, business_id, caller_phone, customer_name)
        if cust:
            customer_id = cust.id
    phone_stripped = (caller_phone or "").strip()[:20] if caller_phone else None
    apt = Appointment(
        business_id=business_id,
        title=title,
        description=f"Voice booking{f' for {customer_name}' if customer_name else ''}.",
        start_time=start_time,
        end_time=end_time,
        customer_id=customer_id,
        service_id=service_id,
        user_id=None,
        status="scheduled",
        source="voice",
        booking_phone=phone_stripped,
    )
    db.add(apt)
    db.commit()
    db.refresh(apt)
    return apt
