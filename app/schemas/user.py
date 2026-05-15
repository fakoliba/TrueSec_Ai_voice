from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr


class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    """Fields the user is allowed to update on their own profile."""

    email: Optional[EmailStr] = None
    full_name: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class SetUserRoleRequest(BaseModel):
    """Admin only: set another user's platform role."""

    role: str  # super_admin, admin, owner, staff, customer


class PlatformUserResponse(BaseModel):
    """Response schema for GET /users and PATCH /users/{id}/role. Separate from User to avoid FastAPI resolving to ORM User."""

    id: int
    email: EmailStr
    full_name: Optional[str] = None
    role: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserInDBBase(UserBase):
    id: int
    role: Optional[str] = None  # super_admin, admin, owner, staff, customer
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class User(UserInDBBase):
    pass


class UserInDB(UserInDBBase):
    hashed_password: str


class UserResponse(BaseModel):
    id: int
    email: EmailStr
    full_name: Optional[str] = None
    is_active: bool
    google_connected: bool

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    email: Optional[str] = None