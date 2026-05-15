from .base import BaseCalendarProvider
from .google_provider import GoogleCalendarProvider
from .outlook_provider import OutlookCalendarProvider
from .registry import get_provider

try:
    from .caldav_provider import CalDAVCalendarProvider
    _caldav_available = True
except ImportError:
    CalDAVCalendarProvider = None  # type: ignore
    _caldav_available = False

__all__ = [
    "BaseCalendarProvider",
    "GoogleCalendarProvider",
    "OutlookCalendarProvider",
    "get_provider",
]
if _caldav_available:
    __all__.append("CalDAVCalendarProvider")
