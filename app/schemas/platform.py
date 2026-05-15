"""Platform (super admin) API schemas."""
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class PlatformBusinessOnboard(BaseModel):
    """Create a business and assign a new owner user (super admin is never linked)."""

    business_name: str = Field(..., min_length=1, max_length=255)
    business_type: Optional[str] = Field(None, max_length=50)
    email: EmailStr
    phone: Optional[str] = Field(None, max_length=20)
    address: str = Field(..., min_length=1, max_length=500)
    timezone: str = Field(default="UTC", max_length=50)
    owner_first_name: Optional[str] = Field(None, max_length=255)
    owner_last_name: Optional[str] = Field(None, max_length=255)
    password: str = Field(..., min_length=6, max_length=128)

    def owner_full_name(self) -> Optional[str]:
        a = (self.owner_first_name or "").strip()
        b = (self.owner_last_name or "").strip()
        parts = [p for p in (a, b) if p]
        return " ".join(parts) if parts else None


class AdminCreateUserRequest(BaseModel):
    """Create a platform user (super_admin only)."""

    email: EmailStr
    full_name: Optional[str] = None
    password: str = Field(..., min_length=6, max_length=128)
    role: str = Field(default="customer", description="Platform role, e.g. super_admin, customer")
