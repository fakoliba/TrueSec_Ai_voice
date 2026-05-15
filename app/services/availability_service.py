"""
Availability checking and slot calculation.
Uses business hours (BusinessSettings.business_hours), appointments, optional calendar events, and blocked times.
"""
from datetime import date, datetime, timedelta, time
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models.appointment import Appointment
from app.models.business import Business, BusinessSettings
from app.models.calendar_event_cache import CalendarEventCache

# Default: Mon–Fri 09:00–17:00, Sat–Sun closed
DEFAULT_BUSINESS_HOURS = {
    "monday": {"open": "09:00", "close": "17:00", "breaks": []},
    "tuesday": {"open": "09:00", "close": "17:00", "breaks": []},
    "wednesday": {"open": "09:00", "close": "17:00", "breaks": []},
    "thursday": {"open": "09:00", "close": "17:00", "breaks": []},
    "friday": {"open": "09:00", "close": "17:00", "breaks": []},
    "saturday": None,
    "sunday": None,
}

WEEKDAY_NAMES = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


def get_business_settings(db: Session, business_id: int) -> Optional[BusinessSettings]:
    """Return BusinessSettings for the business, or None."""
    return db.query(BusinessSettings).filter(BusinessSettings.business_id == business_id).first()


def get_business_hours(db: Session, business_id: int) -> Dict[str, Any]:
    """
    Return business hours dict (day -> {open, close, breaks} or None for closed).
    Merges stored settings with defaults; stored values take precedence.
    """
    settings = get_business_settings(db, business_id)
    raw = (settings and settings.business_hours) or {}
    result = dict(DEFAULT_BUSINESS_HOURS)
    for day in WEEKDAY_NAMES:
        if day in raw and raw[day] is not None:
            result[day] = raw[day]
    return result


def get_blocked_ranges(db: Session, business_id: int, date_start: date, date_end: date) -> List[Tuple[datetime, datetime]]:
    """
    Return list of (start, end) UTC datetimes for blocked time from availability_rules.
    availability_rules can be: {"blocked_times": [{"start": "ISO", "end": "ISO"}, ...]}.
    """
    settings = get_business_settings(db, business_id)
    rules = (settings and settings.availability_rules) or {}
    blocked = rules.get("blocked_times") or []
    out = []
    for item in blocked:
        try:
            s = item.get("start")
            e = item.get("end")
            if s and e:
                start_dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
                end_dt = datetime.fromisoformat(e.replace("Z", "+00:00"))
                if end_dt > date_start and start_dt < date_end:
                    out.append((start_dt, end_dt))
        except (TypeError, ValueError):
            continue
    return out


def get_busy_ranges_from_appointments(
    db: Session,
    business_id: int,
    date_start: datetime,
    date_end: datetime,
) -> List[Tuple[datetime, datetime]]:
    """Return (start, end) UTC ranges for appointments that are not cancelled."""
    appointments = (
        db.query(Appointment)
        .filter(
            Appointment.business_id == business_id,
            Appointment.start_time < date_end,
            Appointment.end_time > date_start,
            Appointment.status != "cancelled",
        )
        .all()
    )
    return [(a.start_time, a.end_time) for a in appointments]


def _parse_time(s: str) -> time:
    """Parse 'HH:MM' or 'HH:MM:SS' to time."""
    parts = s.strip().split(":")
    h = int(parts[0])
    m = int(parts[1]) if len(parts) > 1 else 0
    return time(hour=h, minute=m, second=0)


def _local_open_close_to_utc_simple(day: date, open_str: str, close_str: str, timezone_name: str) -> Tuple[datetime, datetime]:
    """Convert local open/close to UTC; use zoneinfo or fallback to UTC."""
    from datetime import timezone
    try:
        import zoneinfo
        tz = zoneinfo.ZoneInfo(timezone_name)
    except Exception:
        tz = timezone.utc
    open_t = _parse_time(open_str)
    close_t = _parse_time(close_str)
    local_open = datetime.combine(day, open_t, tzinfo=tz)
    local_close = datetime.combine(day, close_t, tzinfo=tz)
    if local_close <= local_open:
        local_close += timedelta(days=1)
    return local_open.astimezone(timezone.utc), local_close.astimezone(timezone.utc)


def get_open_ranges_for_date(
    day: date,
    business_hours: Dict[str, Any],
    timezone_name: str,
) -> List[Tuple[datetime, datetime]]:
    """
    Return list of (start_utc, end_utc) for when the business is open on the given date.
    Respects breaks (each break is {start, end} in "HH:MM").
    """
    weekday = day.weekday()  # 0 = Monday
    day_name = WEEKDAY_NAMES[weekday]
    day_config = business_hours.get(day_name)
    if not day_config or not day_config.get("open") or not day_config.get("close"):
        return []
    open_str = day_config["open"]
    close_str = day_config["close"]
    utc_open, utc_close = _local_open_close_to_utc_simple(day, open_str, close_str, timezone_name)
    breaks = day_config.get("breaks") or []
    if not breaks:
        return [(utc_open, utc_close)]
    # Subtract breaks
    out = []
    current_start = utc_open
    for b in breaks:
        bs, be = b.get("start"), b.get("end")
        if not bs or not be:
            continue
        try:
            break_start, break_end = _local_open_close_to_utc_simple(day, bs, be, timezone_name)
            if break_start > current_start:
                out.append((current_start, min(break_start, utc_close)))
            current_start = max(current_start, break_end)
            if current_start >= utc_close:
                break
        except Exception:
            continue
    if current_start < utc_close:
        out.append((current_start, utc_close))
    return out if out else [(utc_open, utc_close)]


def merge_busy_ranges(ranges: List[Tuple[datetime, datetime]]) -> List[Tuple[datetime, datetime]]:
    """Merge overlapping busy ranges."""
    if not ranges:
        return []
    sorted_r = sorted(ranges, key=lambda x: x[0])
    merged = [sorted_r[0]]
    for start, end in sorted_r[1:]:
        if start <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], end))
        else:
            merged.append((start, end))
    return merged


def slot_overlaps_busy(slot_start: datetime, slot_end: datetime, busy: List[Tuple[datetime, datetime]]) -> bool:
    """True if [slot_start, slot_end) overlaps any busy range."""
    for s, e in busy:
        if slot_start < e and slot_end > s:
            return True
    return False


def get_available_slots(
    db: Session,
    business_id: int,
    business: Business,
    from_date: date,
    to_date: Optional[date] = None,
    slot_minutes: int = 30,
    include_calendar: bool = True,
) -> List[Dict[str, Any]]:
    """
    Return list of available slot windows: [{"start": datetime, "end": datetime}, ...].
    Slots are in UTC. from_date/to_date are inclusive; if to_date is None, single day.
    """
    if to_date is None:
        to_date = from_date
    business_hours = get_business_hours(db, business_id)
    tz_name = business.timezone or "UTC"
    slot_delta = timedelta(minutes=slot_minutes)
    all_busy: List[Tuple[datetime, datetime]] = []
    day = from_date
    while day <= to_date:
        open_ranges = get_open_ranges_for_date(day, business_hours, tz_name)
        day_start = datetime.combine(day, time.min)
        day_end = datetime.combine(day, time.max)
        if day_start.tzinfo is None:
            from datetime import timezone
            day_start = day_start.replace(tzinfo=timezone.utc)
            day_end = day_end.replace(tzinfo=timezone.utc)
        appt_busy = get_busy_ranges_from_appointments(db, business_id, day_start, day_end)
        blocked = get_blocked_ranges(db, business_id, day_start.date(), day_end.date())
        all_busy.extend(appt_busy)
        all_busy.extend(blocked)
        day += timedelta(days=1)
    # Calendar events are merged in get_available_slots_async; sync version uses only DB appointments + blocked
    all_busy = merge_busy_ranges(all_busy)
    slots = []
    day = from_date
    while day <= to_date:
        open_ranges = get_open_ranges_for_date(day, business_hours, tz_name)
        for start_utc, end_utc in open_ranges:
            slot_start = start_utc
            while slot_start + slot_delta <= end_utc:
                slot_end = slot_start + slot_delta
                if not slot_overlaps_busy(slot_start, slot_end, all_busy):
                    slots.append({"start": slot_start.isoformat(), "end": slot_end.isoformat()})
                slot_start = slot_end
        day += timedelta(days=1)
    return slots


async def get_available_slots_async(
    db: Session,
    business_id: int,
    business: Business,
    from_date: date,
    to_date: Optional[date] = None,
    slot_minutes: int = 30,
    include_calendar: bool = True,
) -> List[Dict[str, Any]]:
    """Async wrapper that fetches calendar events in async context."""
    if to_date is None:
        to_date = from_date
    business_hours = get_business_hours(db, business_id)
    tz_name = business.timezone or "UTC"
    slot_delta = timedelta(minutes=slot_minutes)
    all_busy: List[Tuple[datetime, datetime]] = []
    day = from_date
    while day <= to_date:
        day_start = datetime.combine(day, time.min)
        day_end = datetime.combine(day, time.max)
        from datetime import timezone
        if day_start.tzinfo is None:
            day_start = day_start.replace(tzinfo=timezone.utc)
            day_end = day_end.replace(tzinfo=timezone.utc)
        appt_busy = get_busy_ranges_from_appointments(db, business_id, day_start, day_end)
        blocked = get_blocked_ranges(db, business_id, day, day)
        all_busy.extend(appt_busy)
        all_busy.extend(blocked)
        day += timedelta(days=1)
    if include_calendar:
        try:
            from app.services.calendar_service import get_any_primary_integration_for_business
            from app.services.calendar import get_provider
            integration = get_any_primary_integration_for_business(db, business_id)
            if integration:
                provider = get_provider(integration.provider)
                if provider:
                    token_data = provider.token_data_from_integration(integration)
                    time_min = datetime.combine(from_date, time.min).replace(tzinfo=timezone.utc)
                    time_max = datetime.combine(to_date, time.max).replace(tzinfo=timezone.utc)
                    cal_events = await provider.list_events(
                        token_data,
                        time_min=time_min,
                        time_max=time_max,
                        max_results=500,
                    )
                    for ev in cal_events:
                        start = ev.get("start")
                        end = ev.get("end")
                        if isinstance(start, dict):
                            start = start.get("dateTime") or start.get("date")
                        if isinstance(end, dict):
                            end = end.get("dateTime") or end.get("date")
                        if start and end:
                            if isinstance(start, str):
                                start = datetime.fromisoformat(start.replace("Z", "+00:00"))
                            if isinstance(end, str):
                                end = datetime.fromisoformat(end.replace("Z", "+00:00"))
                            if start and end:
                                all_busy.append((start, end))
        except Exception:
            pass
    all_busy = merge_busy_ranges(all_busy)
    slots = []
    day = from_date
    while day <= to_date:
        open_ranges = get_open_ranges_for_date(day, business_hours, tz_name)
        for start_utc, end_utc in open_ranges:
            slot_start = start_utc
            while slot_start + slot_delta <= end_utc:
                slot_end = slot_start + slot_delta
                if not slot_overlaps_busy(slot_start, slot_end, all_busy):
                    slots.append({"start": slot_start.isoformat(), "end": slot_end.isoformat()})
                slot_start = slot_end
        day += timedelta(days=1)
    return slots


def get_calendar_conflicts(
    db: Session,
    business_id: int,
    start: datetime,
    end: datetime,
    exclude_appointment_id: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """
    Check for overlapping appointments and cached calendar events.
    Returns list of conflict descriptions (e.g. {"type": "appointment", "title": "...", "start": ..., "end": ...}).
    """
    from datetime import timezone
    from app.models.appointment import Appointment
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)
    conflicts = []
    q = (
        db.query(Appointment)
        .filter(
            Appointment.business_id == business_id,
            Appointment.start_time < end,
            Appointment.end_time > start,
            Appointment.status != "cancelled",
        )
    )
    if exclude_appointment_id is not None:
        q = q.filter(Appointment.id != exclude_appointment_id)
    for a in q.all():
        conflicts.append({
            "type": "appointment",
            "id": a.id,
            "title": a.title,
            "start": a.start_time.isoformat() if a.start_time else None,
            "end": a.end_time.isoformat() if a.end_time else None,
        })
    cached = (
        db.query(CalendarEventCache)
        .filter(
            CalendarEventCache.business_id == business_id,
            CalendarEventCache.start_time < end,
            CalendarEventCache.end_time > start,
        )
        .all()
    )
    for c in cached:
        conflicts.append({
            "type": "calendar",
            "summary": c.summary,
            "start": c.start_time.isoformat() if c.start_time else None,
            "end": c.end_time.isoformat() if c.end_time else None,
        })
    return conflicts


def is_slot_available(
    db: Session,
    business_id: int,
    business: Business,
    start: datetime,
    end: datetime,
) -> bool:
    """Return True if the given [start, end) is fully within business hours and not busy."""
    from datetime import timezone
    if start >= end:
        return False
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)
    day = start.date()
    business_hours = get_business_hours(db, business_id)
    tz_name = business.timezone or "UTC"
    open_ranges = get_open_ranges_for_date(day, business_hours, tz_name)
    in_hours = any(s <= start and end <= e for s, e in open_ranges)
    if not in_hours:
        return False
    busy = get_busy_ranges_from_appointments(db, business_id, start, end)
    blocked = get_blocked_ranges(db, business_id, day, day)
    if slot_overlaps_busy(start, end, busy + blocked):
        return False
    return True
