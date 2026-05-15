"""
Tests for calendar integration API endpoints.
Run with: pytest tests/test_calendar_integration_api.py -v
Requires: PostgreSQL up, DATABASE_URL set, and (for connect/callback) optional GOOGLE_CLIENT_ID/SECRET.
"""
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch, MagicMock

import pytest

from app.db.session import get_db
from app.models.calendar_integration import CalendarIntegration


# ---- List calendars ----


def test_list_calendars_unauthorized(client, test_business_id):
    """Without token, list calendars returns 401."""
    r = client.get(f"/api/businesses/{test_business_id}/calendars")
    assert r.status_code == 401


def test_list_calendars_empty(client, auth_headers, test_business_id):
    """With no integrations, list returns 200 and empty list."""
    r = client.get(
        f"/api/businesses/{test_business_id}/calendars",
        headers=auth_headers,
    )
    assert r.status_code == 200
    assert r.json() == []


def test_list_calendars_returns_integration_without_tokens(client, auth_headers, test_business_id):
    """When an integration exists, list returns it but no access_token/refresh_token."""
    db = next(get_db())
    try:
        integration = CalendarIntegration(
            business_id=test_business_id,
            provider="google",
            access_token="secret",
            refresh_token="secret_refresh",
            calendar_id="primary",
            is_primary=True,
            sync_enabled=True,
        )
        db.add(integration)
        db.commit()
        db.refresh(integration)
        integ_id = integration.id
    finally:
        db.close()

    r = client.get(
        f"/api/businesses/{test_business_id}/calendars",
        headers=auth_headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert len(data) >= 1
    first = next((x for x in data if x["id"] == integ_id), data[0])
    assert first["provider"] == "google"
    assert first["business_id"] == test_business_id
    assert "access_token" not in first
    assert "refresh_token" not in first

    # Cleanup
    db = next(get_db())
    try:
        db.query(CalendarIntegration).filter(CalendarIntegration.id == integ_id).delete()
        db.commit()
    finally:
        db.close()


# ---- Connect Google (returns URL) ----


def test_connect_google_calendar_unauthorized(client, test_business_id):
    """Without token, connect returns 401."""
    r = client.get(f"/api/businesses/{test_business_id}/calendars/google/connect")
    assert r.status_code == 401


@patch("app.api.endpoints.businesses.get_provider")
def test_connect_google_calendar_returns_url(mock_get_provider, client, auth_headers, test_business_id):
    """Connect returns 200 and an authorization_url when provider is configured."""
    mock_provider = MagicMock()
    mock_provider.get_authorization_url.return_value = "https://accounts.google.com/o/oauth2/auth?client_id=..."
    mock_get_provider.return_value = mock_provider

    r = client.get(
        f"/api/businesses/{test_business_id}/calendars/google/connect",
        headers=auth_headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert "authorization_url" in data
    assert data["authorization_url"].startswith("https://")
    mock_provider.get_authorization_url.assert_called_once()
    call_kw = mock_provider.get_authorization_url.call_args[1]
    assert "redirect_uri" in call_kw
    assert str(test_business_id) in call_kw.get("redirect_uri", "") or str(test_business_id) in call_kw.get("state", "")


@patch("app.api.endpoints.businesses.get_provider")
def test_connect_google_calendar_not_configured(mock_get_provider, client, auth_headers, test_business_id):
    """When Google provider is not configured, connect returns 501."""
    mock_get_provider.return_value = None

    r = client.get(
        f"/api/businesses/{test_business_id}/calendars/google/connect",
        headers=auth_headers,
    )
    assert r.status_code == 501
    assert "not configured" in r.json().get("detail", "").lower()


# ---- List events (requires connected calendar) ----


def test_list_calendar_events_no_calendar(client, auth_headers, test_business_id):
    """When no calendar is connected, list events returns 400."""
    r = client.get(
        f"/api/businesses/{test_business_id}/calendars/events",
        headers=auth_headers,
    )
    assert r.status_code == 400
    assert "calendar" in r.json().get("detail", "").lower()


# ---- Callback (OAuth) - mock exchange ----


@patch("app.api.endpoints.businesses.get_provider")
def test_google_callback_creates_integration(mock_get_provider, client, auth_headers, test_business_id):
    """Callback with mocked token exchange creates CalendarIntegration and redirects."""
    future_expiry = datetime.utcnow() + timedelta(hours=1)
    mock_provider = MagicMock()
    mock_provider.exchange_code_for_tokens = AsyncMock(return_value={
        "access_token": "at",
        "refresh_token": "rt",
        "expiry": future_expiry.isoformat(),
        "calendar_id": "primary",
    })
    mock_get_provider.return_value = mock_provider

    r = client.get(
        f"/api/businesses/{test_business_id}/calendars/google/callback",
        params={"code": "fake_code"},
        headers=auth_headers,
        follow_redirects=False,
    )
    assert r.status_code == 302
    assert "Location" in r.headers

    # Integration should exist in DB
    db = next(get_db())
    try:
        integration = (
            db.query(CalendarIntegration)
            .filter(
                CalendarIntegration.business_id == test_business_id,
                CalendarIntegration.provider == "google",
            )
            .first()
        )
        assert integration is not None
        assert integration.access_token == "at"
        integ_id = integration.id
    finally:
        db.close()

    # Cleanup for other tests
    db = next(get_db())
    try:
        db.query(CalendarIntegration).filter(CalendarIntegration.id == integ_id).delete()
        db.commit()
    finally:
        db.close()


# ---- Disconnect ----


def test_disconnect_calendar_unauthorized(client, test_business_id):
    """Without token, disconnect returns 401."""
    r = client.delete(f"/api/businesses/{test_business_id}/calendars/99999")
    assert r.status_code == 401


def test_disconnect_calendar_not_found(client, auth_headers, test_business_id):
    """Disconnect with non-existent integration id returns 404."""
    r = client.delete(
        f"/api/businesses/{test_business_id}/calendars/99999",
        headers=auth_headers,
    )
    assert r.status_code == 404


def test_disconnect_calendar_success(client, auth_headers, test_business_id):
    """Disconnect removes the integration and returns 204."""
    db = next(get_db())
    try:
        integration = CalendarIntegration(
            business_id=test_business_id,
            provider="google",
            access_token="x",
            refresh_token="y",
            calendar_id="primary",
            is_primary=True,
            sync_enabled=True,
        )
        db.add(integration)
        db.commit()
        db.refresh(integration)
        integ_id = integration.id
    finally:
        db.close()

    r = client.delete(
        f"/api/businesses/{test_business_id}/calendars/{integ_id}",
        headers=auth_headers,
    )
    assert r.status_code == 204

    db = next(get_db())
    try:
        gone = db.query(CalendarIntegration).filter(CalendarIntegration.id == integ_id).first()
        assert gone is None
    finally:
        db.close()
