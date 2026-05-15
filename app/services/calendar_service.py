"""
Calendar service: facade for backward compatibility and business-scoped calendar operations.
Uses CalendarIntegration (per business) when available; falls back to user OAuthToken for legacy.
"""
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.calendar_integration import CalendarIntegration
from app.models.user import OAuthToken
from app.services.calendar import get_provider
from app.services.calendar.base import BaseCalendarProvider
from app.core.config import settings


def _token_data_from_oauth_token(oauth_token: OAuthToken) -> Dict[str, Any]:
    return {
        "access_token": oauth_token.access_token,
        "refresh_token": oauth_token.refresh_token,
        "token_uri": "https://oauth2.googleapis.com/token",
        "client_id": settings.GOOGLE_CLIENT_ID,
        "scopes": settings.google_calendar_scopes_list,
        "token_expiry": oauth_token.token_expiry.isoformat() if oauth_token.token_expiry else None,
        "calendar_id": "primary",
    }


def get_primary_integration_for_business(db: Session, business_id: int, provider: Optional[str] = None) -> Optional[CalendarIntegration]:
    """Return the primary calendar integration for a business. If provider is set, filter by that provider; else return any primary."""
    q = (
        db.query(CalendarIntegration)
        .filter(
            CalendarIntegration.business_id == business_id,
            CalendarIntegration.sync_enabled == True,
        )
    )
    if provider:
        q = q.filter(CalendarIntegration.provider == provider)
    return q.order_by(CalendarIntegration.is_primary.desc(), CalendarIntegration.id).first()


def get_any_primary_integration_for_business(db: Session, business_id: int) -> Optional[CalendarIntegration]:
    """Return the business's primary calendar integration (any provider: Google, Outlook, Apple)."""
    return get_primary_integration_for_business(db, business_id, provider=None)


class GoogleCalendarService:
    """Legacy facade: keeps existing API (user_id + OAuthToken) and adds business-scoped helpers."""

    SCOPES = settings.google_calendar_scopes_list

    @classmethod
    def _provider(cls) -> BaseCalendarProvider:
        return get_provider("google")

    @classmethod
    def get_oauth_flow(cls):
        from google_auth_oauthlib.flow import Flow
        return Flow.from_client_config(
            {
                "web": {
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                }
            },
            scopes=cls.SCOPES,
            redirect_uri=settings.GOOGLE_REDIRECT_URI,
        )

    @classmethod
    def get_authorization_url(cls):
        return cls._provider().get_authorization_url()

    @classmethod
    async def get_tokens(cls, code: str):
        return await cls._provider().exchange_code_for_tokens(code)

    @classmethod
    def get_credentials(cls, token_data: dict):
        from google.oauth2.credentials import Credentials
        return Credentials(
            token=token_data.get("access_token"),
            refresh_token=token_data.get("refresh_token"),
            token_uri=token_data.get("token_uri", "https://oauth2.googleapis.com/token"),
            client_id=token_data.get("client_id", settings.GOOGLE_CLIENT_ID),
            client_secret=settings.GOOGLE_CLIENT_SECRET,
            scopes=token_data.get("scopes", cls.SCOPES),
        )

    @classmethod
    async def create_calendar_event(
        cls,
        user_id: int,
        summary: str,
        start_time: datetime,
        end_time: datetime,
        description: Optional[str] = None,
        db: Session = None,
    ) -> Dict[str, Any]:
        """Legacy: create event using user's OAuth token."""
        from app.db.session import get_db
        if db is None:
            db = next(get_db())
        oauth_token = db.query(OAuthToken).filter(
            OAuthToken.user_id == user_id,
            OAuthToken.provider == "google",
        ).first()
        if not oauth_token:
            from fastapi import HTTPException, status
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google account not connected")
        token_data = _token_data_from_oauth_token(oauth_token)
        event = await cls._provider().create_calendar_event(
            token_data, summary, start_time, end_time, description=description,
        )
        # Optionally refresh and persist token if provider did refresh
        return event

    @classmethod
    async def create_calendar_event_for_business(
        cls,
        business_id: int,
        summary: str,
        start_time: datetime,
        end_time: datetime,
        description: Optional[str] = None,
        db: Session = None,
    ) -> Dict[str, Any]:
        """Create event on the business's primary Google calendar integration."""
        from app.db.session import get_db
        if db is None:
            db = next(get_db())
        integration = get_primary_integration_for_business(db, business_id, "google")
        if not integration:
            from fastapi import HTTPException, status
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No Google calendar connected for this business",
            )
        token_data = cls._provider().token_data_from_integration(integration)
        return await cls._provider().create_calendar_event(
            token_data, summary, start_time, end_time, description=description,
            calendar_id=integration.calendar_id or "primary",
        )

    @classmethod
    async def list_calendar_events(
        cls,
        user_id: int,
        time_min: Optional[datetime] = None,
        time_max: Optional[datetime] = None,
        max_results: int = 10,
        db: Session = None,
    ) -> List[Dict[str, Any]]:
        """Legacy: list events using user's OAuth token."""
        from app.db.session import get_db
        if db is None:
            db = next(get_db())
        oauth_token = db.query(OAuthToken).filter(
            OAuthToken.user_id == user_id,
            OAuthToken.provider == "google",
        ).first()
        if not oauth_token:
            from fastapi import HTTPException, status
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google account not connected")
        token_data = _token_data_from_oauth_token(oauth_token)
        return await cls._provider().list_events(token_data, time_min=time_min, time_max=time_max, max_results=max_results)

    @classmethod
    async def list_calendar_events_for_business(
        cls,
        business_id: int,
        time_min: Optional[datetime] = None,
        time_max: Optional[datetime] = None,
        max_results: int = 10,
        db: Session = None,
    ) -> List[Dict[str, Any]]:
        """List events from the business's primary calendar (Google, Outlook, or Apple)."""
        from app.db.session import get_db
        if db is None:
            db = next(get_db())
        integration = get_any_primary_integration_for_business(db, business_id)
        if not integration:
            from fastapi import HTTPException, status
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No calendar connected for this business",
            )
        provider = get_provider(integration.provider)
        if not provider:
            from fastapi import HTTPException, status
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Calendar provider '{integration.provider}' is not available",
            )
        token_data = provider.token_data_from_integration(integration)
        return await provider.list_events(
            token_data,
            time_min=time_min,
            time_max=time_max,
            max_results=max_results,
            calendar_id=integration.calendar_id or "primary",
        )
