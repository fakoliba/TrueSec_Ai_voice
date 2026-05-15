from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import HTTPException, status
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

from app.core.config import settings
from app.services.calendar.base import BaseCalendarProvider


class GoogleCalendarProvider(BaseCalendarProvider):
    name = "google"

    SCOPES = settings.google_calendar_scopes_list

    def _get_flow(self, redirect_uri: Optional[str] = None):
        return Flow.from_client_config(
            {
                "web": {
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                }
            },
            scopes=self.SCOPES,
            redirect_uri=redirect_uri or settings.GOOGLE_REDIRECT_URI,
        )

    def _credentials_from_token_data(self, token_data: Dict[str, Any]) -> Credentials:
        return Credentials(
            token=token_data.get("access_token"),
            refresh_token=token_data.get("refresh_token"),
            token_uri=token_data.get("token_uri", "https://oauth2.googleapis.com/token"),
            client_id=token_data.get("client_id") or settings.GOOGLE_CLIENT_ID,
            client_secret=settings.GOOGLE_CLIENT_SECRET,
            scopes=token_data.get("scopes") or self.SCOPES,
        )

    def _maybe_refresh(self, credentials: Credentials, token_data: Dict[str, Any]) -> Dict[str, Any]:
        """Refresh if expired; return updated token_data for persisting."""
        if credentials.expired and credentials.refresh_token:
            credentials.refresh(Request())
            return {
                **token_data,
                "access_token": credentials.token,
                "token_expiry": credentials.expiry.isoformat() if credentials.expiry else None,
            }
        return token_data

    def get_authorization_url(self, redirect_uri: Optional[str] = None, state: Optional[str] = None) -> str:
        flow = self._get_flow(redirect_uri=redirect_uri)
        url, _ = flow.authorization_url(
            access_type="offline",
            prompt="consent",
            include_granted_scopes="true",
            state=state,
        )
        return url

    async def exchange_code_for_tokens(self, code: str, redirect_uri: Optional[str] = None) -> Dict[str, Any]:
        flow = self._get_flow(redirect_uri=redirect_uri)
        flow.fetch_token(code=code)
        creds = flow.credentials
        return {
            "access_token": creds.token,
            "refresh_token": creds.refresh_token,
            "token_uri": creds.token_uri,
            "client_id": creds.client_id,
            "scopes": list(creds.scopes) if creds.scopes else self.SCOPES,
            "expiry": creds.expiry.isoformat() if creds.expiry else None,
        }

    async def create_event(
        self,
        token_data: Dict[str, Any],
        summary: str,
        start_time: datetime,
        end_time: datetime,
        description: Optional[str] = None,
        calendar_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        creds = self._credentials_from_token_data(token_data)
        self._maybe_refresh(creds, token_data)
        cal_id = calendar_id or token_data.get("calendar_id") or "primary"
        service = build("calendar", "v3", credentials=creds)
        event = {
            "summary": summary,
            "description": description or "",
            "start": {"dateTime": start_time.isoformat(), "timeZone": "UTC"},
            "end": {"dateTime": end_time.isoformat(), "timeZone": "UTC"},
        }
        try:
            return service.events().insert(calendarId=cal_id, body=event).execute()
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    async def list_events(
        self,
        token_data: Dict[str, Any],
        time_min: Optional[datetime] = None,
        time_max: Optional[datetime] = None,
        max_results: int = 10,
        calendar_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        creds = self._credentials_from_token_data(token_data)
        self._maybe_refresh(creds, token_data)
        cal_id = calendar_id or token_data.get("calendar_id") or "primary"
        service = build("calendar", "v3", credentials=creds)
        now = datetime.utcnow()
        time_min = time_min or now
        time_max = time_max or (now + timedelta(days=30))
        try:
            result = service.events().list(
                calendarId=cal_id,
                timeMin=time_min.isoformat() + "Z",
                timeMax=time_max.isoformat() + "Z",
                maxResults=max_results,
                singleEvents=True,
                orderBy="startTime",
            ).execute()
            return result.get("items", [])
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

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
        creds = self._credentials_from_token_data(token_data)
        self._maybe_refresh(creds, token_data)
        cal_id = calendar_id or token_data.get("calendar_id") or "primary"
        service = build("calendar", "v3", credentials=creds)
        event = service.events().get(calendarId=cal_id, eventId=event_id).execute()
        if summary is not None:
            event["summary"] = summary
        if description is not None:
            event["description"] = description
        if start_time is not None:
            event["start"] = {"dateTime": start_time.isoformat(), "timeZone": "UTC"}
        if end_time is not None:
            event["end"] = {"dateTime": end_time.isoformat(), "timeZone": "UTC"}
        try:
            return service.events().update(calendarId=cal_id, eventId=event_id, body=event).execute()
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    async def delete_event(
        self,
        token_data: Dict[str, Any],
        event_id: str,
        calendar_id: Optional[str] = None,
    ) -> None:
        creds = self._credentials_from_token_data(token_data)
        self._maybe_refresh(creds, token_data)
        cal_id = calendar_id or token_data.get("calendar_id") or "primary"
        service = build("calendar", "v3", credentials=creds)
        try:
            service.events().delete(calendarId=cal_id, eventId=event_id).execute()
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
