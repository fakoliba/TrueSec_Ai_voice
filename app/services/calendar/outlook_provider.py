"""
Microsoft Outlook / Microsoft Graph API calendar provider.
OAuth2 auth, token refresh, and calendar event CRUD.
"""
import asyncio
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from urllib.parse import urlencode, quote

import httpx
from fastapi import HTTPException, status

from app.core.config import settings
from app.services.calendar.base import BaseCalendarProvider

GRAPH_BASE = "https://graph.microsoft.com/v1.0"
AUTHORITY = "https://login.microsoftonline.com"
DEFAULT_SCOPES = "https://graph.microsoft.com/Calendars.ReadWrite offline_access"


class OutlookCalendarProvider(BaseCalendarProvider):
    name = "outlook"

    def _token_url(self) -> str:
        tenant = getattr(settings, "MICROSOFT_TENANT_ID", "common")
        return f"{AUTHORITY}/{tenant}/oauth2/v2.0/token"

    def _auth_url_base(self) -> str:
        tenant = getattr(settings, "MICROSOFT_TENANT_ID", "common")
        return f"{AUTHORITY}/{tenant}/oauth2/v2.0/authorize"

    def get_authorization_url(self, redirect_uri: Optional[str] = None, state: Optional[str] = None) -> str:
        params = {
            "client_id": settings.MICROSOFT_CLIENT_ID,
            "response_type": "code",
            "redirect_uri": redirect_uri or "",
            "response_mode": "query",
            "scope": getattr(settings, "MICROSOFT_GRAPH_SCOPES", DEFAULT_SCOPES),
        }
        if state:
            params["state"] = state
        return f"{self._auth_url_base()}?{urlencode(params)}"

    async def exchange_code_for_tokens(self, code: str, redirect_uri: Optional[str] = None) -> Dict[str, Any]:
        data = {
            "client_id": settings.MICROSOFT_CLIENT_ID,
            "client_secret": settings.MICROSOFT_CLIENT_SECRET,
            "code": code,
            "redirect_uri": redirect_uri or "",
            "grant_type": "authorization_code",
        }
        async with httpx.AsyncClient() as client:
            r = await client.post(
                self._token_url(),
                data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
        if r.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=r.text or "Failed to exchange code for tokens",
            )
        body = r.json()
        expiry = body.get("expires_in")
        expiry_dt = None
        if expiry is not None:
            from datetime import timezone
            expiry_dt = datetime.now(timezone.utc) + timedelta(seconds=int(expiry))
        return {
            "access_token": body.get("access_token"),
            "refresh_token": body.get("refresh_token"),
            "expiry": expiry_dt.isoformat() if expiry_dt else None,
            "calendar_id": None,
        }

    def _maybe_refresh(self, token_data: Dict[str, Any]) -> Dict[str, Any]:
        """Refresh access token if expired; return updated token_data."""
        from datetime import timezone
        expiry = token_data.get("token_expiry") or token_data.get("expiry")
        if isinstance(expiry, str):
            expiry = datetime.fromisoformat(expiry.replace("Z", "+00:00"))
        if expiry:
            if expiry.tzinfo is None:
                expiry = expiry.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) < expiry:
                return token_data
        refresh = token_data.get("refresh_token")
        if not refresh:
            return token_data
        data = {
            "client_id": settings.MICROSOFT_CLIENT_ID,
            "client_secret": settings.MICROSOFT_CLIENT_SECRET,
            "refresh_token": refresh,
            "grant_type": "refresh_token",
        }
        with httpx.Client() as client:
            r = client.post(
                self._token_url(),
                data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
        if r.status_code != 200:
            return token_data
        body = r.json()
        exp_sec = body.get("expires_in")
        new_expiry = None
        if exp_sec is not None:
            from datetime import timezone
            new_expiry = datetime.now(timezone.utc) + timedelta(seconds=int(exp_sec))
        return {
            **token_data,
            "access_token": body.get("access_token"),
            "token_expiry": new_expiry,
            "expiry": new_expiry.isoformat() if new_expiry else None,
        }

    def _utc_now_iso(self) -> str:
        from datetime import timezone
        return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    async def _get_token_data(self, token_data: Dict[str, Any]) -> Dict[str, Any]:
        """Run blocking token refresh in thread so async endpoints don't block."""
        return await asyncio.to_thread(self._maybe_refresh, token_data)

    async def create_event(
        self,
        token_data: Dict[str, Any],
        summary: str,
        start_time: datetime,
        end_time: datetime,
        description: Optional[str] = None,
        calendar_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        token_data = await self._get_token_data(token_data)
        url = f"{GRAPH_BASE}/me/calendar/events"
        body = {
            "subject": summary,
            "body": {"contentType": "text", "content": description or ""},
            "start": {
                "dateTime": start_time.isoformat(),
                "timeZone": "UTC",
            },
            "end": {
                "dateTime": end_time.isoformat(),
                "timeZone": "UTC",
            },
        }
        async with httpx.AsyncClient() as client:
            r = await client.post(
                url,
                json=body,
                headers={"Authorization": f"Bearer {token_data['access_token']}"},
            )
        if r.status_code not in (200, 201):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=r.text)
        return r.json()

    async def list_events(
        self,
        token_data: Dict[str, Any],
        time_min: Optional[datetime] = None,
        time_max: Optional[datetime] = None,
        max_results: int = 10,
        calendar_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        token_data = await self._get_token_data(token_data)
        now = datetime.utcnow()
        time_min = time_min or now
        time_max = time_max or (now + timedelta(days=30))
        start_str = time_min.strftime("%Y-%m-%dT%H:%M:%SZ")
        end_str = time_max.strftime("%Y-%m-%dT%H:%M:%SZ")
        filter_q = f"start/dateTime ge '{start_str}' and end/dateTime le '{end_str}'"
        url = f"{GRAPH_BASE}/me/calendar/events?$filter={quote(filter_q)}&$top={max_results}&$orderby=start/dateTime"
        async with httpx.AsyncClient() as client:
            r = await client.get(
                url,
                headers={"Authorization": f"Bearer {token_data['access_token']}"},
            )
        if r.status_code != 200:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=r.text)
        return r.json().get("value", [])

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
        token_data = await self._get_token_data(token_data)
        url = f"{GRAPH_BASE}/me/calendar/events/{event_id}"
        body = {}
        if summary is not None:
            body["subject"] = summary
        if description is not None:
            body["body"] = {"contentType": "text", "content": description}
        if start_time is not None:
            body["start"] = {"dateTime": start_time.isoformat(), "timeZone": "UTC"}
        if end_time is not None:
            body["end"] = {"dateTime": end_time.isoformat(), "timeZone": "UTC"}
        if not body:
            async with httpx.AsyncClient() as client:
                r = await client.get(url, headers={"Authorization": f"Bearer {token_data['access_token']}"})
            if r.status_code != 200:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=r.text)
            return r.json()
        async with httpx.AsyncClient() as client:
            r = await client.patch(
                url,
                json=body,
                headers={"Authorization": f"Bearer {token_data['access_token']}"},
            )
        if r.status_code != 200:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=r.text)
        return r.json()

    async def delete_event(
        self,
        token_data: Dict[str, Any],
        event_id: str,
        calendar_id: Optional[str] = None,
    ) -> None:
        token_data = await self._get_token_data(token_data)
        url = f"{GRAPH_BASE}/me/calendar/events/{event_id}"
        async with httpx.AsyncClient() as client:
            r = await client.delete(
                url,
                headers={"Authorization": f"Bearer {token_data['access_token']}"},
            )
        if r.status_code not in (200, 204):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=r.text or "Delete failed")
