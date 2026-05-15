from typing import Dict, Optional, Type

from app.services.calendar.base import BaseCalendarProvider
from app.services.calendar.google_provider import GoogleCalendarProvider
from app.services.calendar.outlook_provider import OutlookCalendarProvider

_PROVIDERS: Dict[str, Type[BaseCalendarProvider]] = {
    "google": GoogleCalendarProvider,
    "outlook": OutlookCalendarProvider,
}

try:
    from app.services.calendar.caldav_provider import CalDAVCalendarProvider
    _PROVIDERS["apple"] = CalDAVCalendarProvider
except ImportError:
    pass  # caldav/icalendar not installed; Apple calendar disabled


def get_provider(name: str) -> Optional[BaseCalendarProvider]:
    """Return a calendar provider instance by name (e.g. 'google', 'outlook', 'apple'), or None if unknown."""
    name = (name or "").lower()
    if name not in _PROVIDERS:
        return None
    return _PROVIDERS[name]()


def register_provider(name: str, provider_class: Type[BaseCalendarProvider]) -> None:
    """Register a calendar provider (for Outlook, Apple later)."""
    _PROVIDERS[name.lower()] = provider_class
