"""
Pytest fixtures for API tests.
Uses the real app and database; ensure PostgreSQL is running and DATABASE_URL is set.
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="module")
def client():
    """FastAPI test client."""
    return TestClient(app)


@pytest.fixture(scope="module")
def test_user_credentials():
    """Unique test user email/password for this test run."""
    return {
        "email": "test_calendar_user@example.com",
        "password": "test_password_123",
        "full_name": "Test Calendar User",
    }


@pytest.fixture(scope="module")
def auth_headers(client, test_user_credentials):
    """
    Register (if needed), login, and return headers with Bearer token.
    Uses the same DB as the app so the user persists across requests.
    """
    # Register
    r = client.post(
        "/api/auth/register",
        json={
            "email": test_user_credentials["email"],
            "password": test_user_credentials["password"],
            "full_name": test_user_credentials["full_name"],
        },
    )
    # 200 = created, 400 = already exists
    if r.status_code not in (200, 400):
        pytest.fail(f"Register failed: {r.status_code} {r.text}")

    # Login
    r = client.post(
        "/api/auth/token",
        data={
            "username": test_user_credentials["email"],
            "password": test_user_credentials["password"],
        },
    )
    if r.status_code != 200:
        pytest.fail(f"Login failed: {r.status_code} {r.text}")
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def test_business_id(client, auth_headers):
    """Create a business owned by the test user and return its id."""
    r = client.post(
        "/api/businesses/",
        json={
            "name": "Test Business for Calendars",
            "business_type": "other",
            "timezone": "UTC",
        },
        headers=auth_headers,
    )
    if r.status_code != 200:
        pytest.fail(f"Create business failed: {r.status_code} {r.text}")
    return r.json()["id"]


