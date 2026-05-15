"""
Apple iCloud / CalDAV calendar provider.
Uses username + app-specific password (no OAuth). Supports event CRUD.
"""
import asyncio
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

import caldav
from icalendar import Calendar as ICalendar, Event as ICalendarEvent
from fastapi import HTTPException, status

from app.core.config import settings
from app.services.calendar.base import BaseCalendarProvider


def _client_and_calendar(token_data: Dict[str, Any], calendar_id: Optional[str] = None):
    """Sync helper: get CalDAV client and calendar object."""
    url = getattr(settings, "CALDAV_SERVER_URL", "https://caldav.icloud.com").rstrip("/")
    username = token_data.get("username") or token_data.get("provider_account_id")
    password = token_data.get("access_token")
    if not username or not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CalDAV requires username and password (app-specific password)",
        )
    client = caldav.DAVClient(url=url, username=username, password=password)
    principal = client.principal()
    calendars = principal.calendars()
    if not calendars:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No calendars found for this account",
        )
    if calendar_id:
        for cal in calendars:
            if cal.id == calendar_id or (getattr(cal, "url", "") and calendar_id in cal.url):
                return client, cal
    return client, calendars[0]


def _dt_to_ical(dt: datetime) -> str:
    return dt.strftime("%Y%m%dT%H%M%SZ")


def _make_ical_event(summary: str, start_time: datetime, end_time: datetime, description: Optional[str] = None, uid: Optional[str] = None) -> str:
    from datetime import timezone
    cal = ICalendar()
    cal.add("prodid", "-//AI Support Agent//CalDAV//EN")
    cal.add("version", "2.0")
    event = ICalendarEvent()
    event.add("uid", uid or str(uuid.uuid4()))
    event.add("dtstamp", datetime.now(timezone.utc))
    event.add("dtstart", start_time)
    event.add("dtend", end_time)
    event.add("summary", summary)
    if description:
        event.add("description", description)
    cal.add_component(event)
    return cal.to_ical().decode("utf-8")


class CalDAVCalendarProvider(BaseCalendarProvider):
    """Apple iCloud or any CalDAV server. Auth via username + app-specific password."""

    name = "apple"

    def get_authorization_url(self, redirect_uri: Optional[str] = None, state: Optional[str] = None) -> str:
        """CalDAV does not use OAuth; user connects with username + app-specific password."""
        return ""

    async def exchange_code_for_tokens(self, code: str, redirect_uri: Optional[str] = None) -> Dict[str, Any]:
        """CalDAV uses connect_with_credentials instead of OAuth code exchange."""
        raise NotImplementedError("Use connect_with_credentials for CalDAV/Apple")

    @staticmethod
    def connect_with_credentials(username: str, password: str) -> Dict[str, Any]:
        """
        Verify credentials and return token_data for storing in CalendarIntegration.
        Store username in provider_account_id and password in access_token.
        """
        url = getattr(settings, "CALDAV_SERVER_URL", "https://caldav.icloud.com").rstrip("/")
        client = caldav.DAVClient(url=url, username=username, password=password)
        principal = client.principal()
        calendars = principal.calendars()
        if not calendars:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No calendars found for this account",
            )
        cal_id = getattr(calendars[0], "id", None) or (calendars[0].url or "")
        return {
            "access_token": password,
            "refresh_token": None,
            "expiry": None,
            "calendar_id": cal_id,
            "username": username,
        }

    def token_data_from_integration(self, integration: Any) -> Dict[str, Any]:
        """Include username (provider_account_id) for CalDAV."""
        data = super().token_data_from_integration(integration)
        data["username"] = integration.provider_account_id
        data["provider_account_id"] = integration.provider_account_id
        return data

    async def create_event(
        self,
        token_data: Dict[str, Any],
        summary: str,
        start_time: datetime,
        end_time: datetime,
        description: Optional[str] = None,
        calendar_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        def _sync():
            _, cal = _client_and_calendar(token_data, calendar_id)
            ical = _make_ical_event(summary, start_time, end_time, description)
            ev = cal.save_event(ical)
            return {"id": getattr(ev, "id", None) or getattr(ev, "url", ""), "summary": summary}

        return await asyncio.to_thread(_sync)

    async def list_events(
        self,
        token_data: Dict[str, Any],
        time_min: Optional[datetime] = None,
        time_max: Optional[datetime] = None,
        max_results: int = 10,
        calendar_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        def _sync():
            _, cal = _client_and_calendar(token_data, calendar_id)
            if time_min and time_max:
                events = cal.date_search(start=time_min, end=time_max)
            else:
                events = list(cal.events())
            out = []
            for ev in events[:max_results]:
                try:
                    ical = ev.icalendar_component
                    if ical is None:
                        continue
                    summary = ical.get("summary", "")
                    start = ical.get("dtstart")
                    end = ical.get("dtend")
                    uid = ical.get("uid", "")
                    out.append({
                        "id": str(uid) if uid else getattr(ev, "url", ""),
                        "summary": str(summary) if summary else "",
                        "start": start.dt.isoformat() if start and hasattr(start, "dt") else None,
                        "end": end.dt.isoformat() if end and hasattr(end, "dt") else None,
                    })
                except Exception:
                    continue
            return out

        return await asyncio.to_thread(_sync)

    async def update_event(
        self,
        token_data: Dict[str, Any],
        event_id: str,
        summary: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        description: Optional[str] = None,
        calendar_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        def _sync():
            _, cal = _client_and_calendar(token_data, calendar_id)
            events = list(cal.events())
            target = None
            for ev in events:
                ical = ev.icalendar_component
                uid = ical.get("uid") if ical else None
                uid_str = (uid.to_ical().decode("utf-8") if hasattr(uid, "to_ical") else str(uid)) if uid else ""
                if uid_str and event_id in uid_str or (uid_str and uid_str == event_id):
                    target = ev
                    break
                if getattr(ev, "url", "") and event_id in str(getattr(ev, "url", "")):
                    target = ev
                    break
            if target is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
            ev = target
            ical = ev.icalendar_component
            if ical:
                s = ical.get("summary") or ""
                start = ical.get("dtstart")
                end = ical.get("dtend")
                start_dt = start.dt if start and hasattr(start, "dt") else start_time
                end_dt = end.dt if end and hasattr(end, "dt") else end_time
                from datetime import timezone
                uid_val = ical.get("uid")
                uid_str = uid_val.to_ical().decode("utf-8") if uid_val and hasattr(uid_val, "to_ical") else str(uid_val or "")
                new_ical = _make_ical_event(
                    summary if summary is not None else str(s),
                    start_time or start_dt or datetime.now(timezone.utc),
                    end_time or end_dt or datetime.now(timezone.utc),
                    description,
                    uid=uid_str or None,
                )
                ev.data = new_ical
                ev.save()
            return {"id": event_id, "summary": summary or ""}

        return await asyncio.to_thread(_sync)

    async def delete_event(
        self,
        token_data: Dict[str, Any],
        event_id: str,
        calendar_id: Optional[str] = None,
    ) -> None:
        def _sync():
            _, cal = _client_and_calendar(token_data, calendar_id)
            events = list(cal.events())
            for ev in events:
                uid = getattr(ev.icalendar_component, "get", lambda x: None)("uid") if ev.icalendar_component else None
                if uid and str(uid) == event_id:
                    ev.delete()
                    return
                if getattr(ev, "url", "") and event_id in str(getattr(ev, "url", "")):
                    ev.delete()
                    return
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

        await asyncio.to_thread(_sync)
