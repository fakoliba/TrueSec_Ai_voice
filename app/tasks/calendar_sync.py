"""
Celery tasks: sync calendar events from connected calendars into cache.
"""
import asyncio
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.celery_app import celery_app
from app.db.session import SessionLocal
from app.models.calendar_integration import CalendarIntegration
from app.models.calendar_event_cache import CalendarEventCache
from app.services.calendar import get_provider


def _parse_event_time(ev: Dict[str, Any], key: str) -> Optional[datetime]:
    """Extract start or end datetime from provider event (Google, Outlook, or CalDAV format)."""
    val = ev.get(key)
    if val is None:
        return None
    if isinstance(val, datetime):
        return val
    if isinstance(val, str):
        try:
            return datetime.fromisoformat(val.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            return None
    if isinstance(val, dict):
        dt_str = val.get("dateTime") or val.get("date")
        if dt_str:
            try:
                return datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
            except (ValueError, TypeError):
                pass
    return None


def _events_to_cache_rows(
    business_id: int,
    integration_id: Optional[int],
    events: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Convert provider event list to cache row dicts."""
    rows = []
    for ev in events:
        start = _parse_event_time(ev, "start")
        end = _parse_event_time(ev, "end")
        if not start or not end:
            continue
        event_id = ev.get("id") or ev.get("uid") or str(ev.get("url", ""))
        if not event_id:
            continue
        summary = ev.get("summary") or ev.get("subject") or ""
        if isinstance(summary, dict):
            summary = summary.get("content", "") or str(summary)
        rows.append({
            "business_id": business_id,
            "calendar_integration_id": integration_id,
            "provider_event_id": str(event_id)[:255],
            "start_time": start,
            "end_time": end,
            "summary": (str(summary) or None)[:500] if summary else None,
        })
    return rows


async def _fetch_events_for_business(db: Session, business_id: int) -> List[Dict[str, Any]]:
    """Fetch calendar events for a business's primary integration (async)."""
    from app.services.calendar_service import get_any_primary_integration_for_business
    integration = get_any_primary_integration_for_business(db, business_id)
    if not integration:
        return []
    provider = get_provider(integration.provider)
    if not provider:
        return []
    token_data = provider.token_data_from_integration(integration)
    time_min = datetime.utcnow()
    time_max = time_min + timedelta(days=30)
    try:
        events = await provider.list_events(
            token_data,
            time_min=time_min,
            time_max=time_max,
            max_results=500,
            calendar_id=integration.calendar_id or "primary",
        )
        return events or []
    except Exception:
        return []


@celery_app.task(name="app.tasks.calendar_sync.sync_business_calendar")
def sync_business_calendar(business_id: int) -> int:
    """
    Sync calendar events for one business into CalendarEventCache.
    Returns number of events cached.
    """
    db: Session = SessionLocal()
    try:
        events = asyncio.run(_fetch_events_for_business(db, business_id))
        integration = (
            db.query(CalendarIntegration)
            .filter(
                CalendarIntegration.business_id == business_id,
                CalendarIntegration.sync_enabled == True,
            )
            .order_by(CalendarIntegration.is_primary.desc())
            .first()
        )
        integration_id = integration.id if integration else None
        # Remove old cache for this business
        db.query(CalendarEventCache).filter(CalendarEventCache.business_id == business_id).delete()
        rows = _events_to_cache_rows(business_id, integration_id, events)
        for r in rows:
            db.add(CalendarEventCache(**r))
        db.commit()
        return len(rows)
    except Exception:
        db.rollback()
        return 0
    finally:
        db.close()


@celery_app.task(name="app.tasks.calendar_sync.sync_all_calendars")
def sync_all_calendars() -> int:
    """
    Sync all businesses that have a calendar integration with sync_enabled.
    Returns total number of events cached across all businesses.
    """
    db: Session = SessionLocal()
    try:
        business_ids = (
            db.query(CalendarIntegration.business_id)
            .filter(CalendarIntegration.sync_enabled == True)
            .distinct()
            .all()
        )
        db.close()
        total = 0
        for (bid,) in business_ids:
            total += sync_business_calendar(bid)
        return total
    finally:
        try:
            db.close()
        except Exception:
            pass
