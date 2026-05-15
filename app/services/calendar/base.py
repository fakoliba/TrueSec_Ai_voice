from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any, Dict, List, Optional


class BaseCalendarProvider(ABC):
    """Abstract interface for calendar providers (Google, Outlook, Apple)."""

    name: str = "base"

    @abstractmethod
    def get_authorization_url(self, redirect_uri: Optional[str] = None, state: Optional[str] = None) -> str:
        """Return the OAuth URL to send the user to."""
        ...

    @abstractmethod
    async def exchange_code_for_tokens(self, code: str, redirect_uri: Optional[str] = None) -> Dict[str, Any]:
        """Exchange authorization code for access/refresh tokens. Returns dict with access_token, refresh_token, expiry, etc."""
        ...

    @abstractmethod
    async def create_event(
        self,
        token_data: Dict[str, Any],
        summary: str,
        start_time: datetime,
        end_time: datetime,
        description: Optional[str] = None,
        calendar_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Create a calendar event. Returns provider event dict (with id, etc.)."""
        ...

    @abstractmethod
    async def list_events(
        self,
        token_data: Dict[str, Any],
        time_min: Optional[datetime] = None,
        time_max: Optional[datetime] = None,
        max_results: int = 10,
        calendar_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """List events in the given time range."""
        ...

    @abstractmethod
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
        """Update an existing event."""
        ...

    @abstractmethod
    async def delete_event(
        self,
        token_data: Dict[str, Any],
        event_id: str,
        calendar_id: Optional[str] = None,
    ) -> None:
        """Delete an event."""
        ...

    def token_data_from_integration(self, integration: Any) -> Dict[str, Any]:
        """Build token_data dict from a CalendarIntegration model instance."""
        return {
            "access_token": integration.access_token,
            "refresh_token": integration.refresh_token,
            "token_expiry": integration.token_expiry,
            "calendar_id": integration.calendar_id or "primary",
        }
