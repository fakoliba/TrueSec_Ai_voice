"""Shared dependencies for API (business context, permissions)."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Optional

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.business import Business, BusinessUser
from app.models.user import User
from app.services.auth import get_current_user


def is_super_admin(user: User) -> bool:
    """True if this user is a platform super admin."""
    return getattr(user, "role", None) == "super_admin"


@dataclass
class SuperAdminMembership:
    """
    Synthetic BusinessUser for super_admin accessing any business without a real membership row.
    Treated as owner so owner/admin checks pass for platform support.
    """

    id: int
    business_id: int
    user_id: int
    role: str
    permissions: Optional[Any]
    created_at: Optional[datetime]


def get_user_business_ids(db: Session, user_id: int) -> list[int]:
    """Return list of business IDs the user is a member of."""
    rows = db.query(BusinessUser.business_id).filter(BusinessUser.user_id == user_id).all()
    return [r[0] for r in rows]


def get_business_or_404(
    business_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Business:
    """Return Business if current user is a member, or super_admin (any business). Else 404."""
    business = db.query(Business).filter(Business.id == business_id).first()
    if not business:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")

    if is_super_admin(current_user):
        return business

    membership = (
        db.query(BusinessUser)
        .filter(BusinessUser.business_id == business_id, BusinessUser.user_id == current_user.id)
        .first()
    )
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business not found or you do not have access",
        )
    return business


def get_business_membership(
    business_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BusinessUser:
    """Return BusinessUser for current user; super_admin gets a synthetic owner membership."""
    bu = (
        db.query(BusinessUser)
        .filter(
            BusinessUser.business_id == business_id,
            BusinessUser.user_id == current_user.id,
        )
        .first()
    )
    if bu:
        return bu

    if is_super_admin(current_user):
        business = db.query(Business).filter(Business.id == business_id).first()
        if not business:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
        return SuperAdminMembership(
            id=0,
            business_id=business_id,
            user_id=current_user.id,
            role="owner",
            permissions=None,
            created_at=None,
        )  # type: ignore[return-value]

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Business not found or you do not have access",
    )
