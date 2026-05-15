"""
Tests for business settings and availability API.
Run with: python3 -m pytest tests/test_availability_api.py -v
"""
from datetime import date, datetime, timedelta

import pytest


def test_get_settings_unauthorized(client, test_business_id):
    """Without token, get settings returns 401."""
    r = client.get(f"/api/businesses/{test_business_id}/settings")
    assert r.status_code == 401


def test_get_settings_returns_defaults(client, auth_headers, test_business_id):
    """GET settings returns 200 and creates default settings if missing."""
    r = client.get(
        f"/api/businesses/{test_business_id}/settings",
        headers=auth_headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert "business_id" in data
    assert data["business_id"] == test_business_id
    assert "business_hours" in data or "auto_confirm_appointments" in data


def test_put_settings_business_hours(client, auth_headers, test_business_id):
    """PUT settings with business_hours updates and returns 200."""
    custom_hours = {
        "monday": {"open": "08:00", "close": "18:00", "breaks": []},
        "tuesday": {"open": "08:00", "close": "18:00", "breaks": []},
        "wednesday": None,
        "thursday": {"open": "09:00", "close": "17:00", "breaks": []},
        "friday": {"open": "09:00", "close": "17:00", "breaks": []},
        "saturday": None,
        "sunday": None,
    }
    r = client.put(
        f"/api/businesses/{test_business_id}/settings",
        json={"business_hours": custom_hours},
        headers=auth_headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert data.get("business_hours") == custom_hours

    r2 = client.get(f"/api/businesses/{test_business_id}/settings", headers=auth_headers)
    assert r2.status_code == 200
    assert r2.json().get("business_hours") == custom_hours


def test_availability_slots_unauthorized(client, test_business_id):
    """Without token, availability/slots returns 401."""
    r = client.get(
        f"/api/businesses/{test_business_id}/availability/slots",
        params={"date_from": "2025-01-27"},
        headers=None,
    )
    assert r.status_code == 401


def test_availability_slots_returns_list(client, auth_headers, test_business_id):
    """GET availability/slots returns 200 and list of slots (start/end)."""
    r = client.get(
        f"/api/businesses/{test_business_id}/availability/slots",
        params={"date_from": "2025-01-27", "slot_minutes": 30},
        headers=auth_headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    for slot in data[:3]:
        assert "start" in slot
        assert "end" in slot


def test_availability_slots_date_range(client, auth_headers, test_business_id):
    """GET availability/slots with date_to returns slots for range."""
    r = client.get(
        f"/api/businesses/{test_business_id}/availability/slots",
        params={"date_from": "2025-01-27", "date_to": "2025-01-28", "slot_minutes": 60},
        headers=auth_headers,
    )
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_availability_check_unauthorized(client, test_business_id):
    """Without token, availability/check returns 401."""
    start = "2025-01-27T10:00:00Z"
    end = "2025-01-27T10:30:00Z"
    r = client.get(
        f"/api/businesses/{test_business_id}/availability/check",
        params={"start": start, "end": end},
    )
    assert r.status_code == 401


def test_availability_check_returns_boolean(client, auth_headers, test_business_id):
    """GET availability/check returns 200 and { available: true/false }."""
    start = "2025-01-27T10:00:00Z"
    end = "2025-01-27T10:30:00Z"
    r = client.get(
        f"/api/businesses/{test_business_id}/availability/check",
        params={"start": start, "end": end},
        headers=auth_headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert "available" in data
    assert isinstance(data["available"], bool)
