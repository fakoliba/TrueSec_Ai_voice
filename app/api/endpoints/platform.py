"""Platform (super_admin) endpoints: all businesses, onboarding, etc."""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies import is_super_admin
from app.db.session import get_db
from app.models.business import Business, BusinessUser
from app.models.user import User as UserModel
from app.schemas.business import Business as BusinessSchema
from app.schemas.platform import AdminCreateUserRequest, PlatformBusinessOnboard
from app.schemas.user import UserCreate, User as UserSchema
from app.services.auth import create_user_with_role, get_current_user, get_user

router = APIRouter()


def _require_super_admin(current_user: UserModel = Depends(get_current_user)) -> UserModel:
    if not is_super_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super admins can access this resource",
        )
    return current_user


@router.get("/businesses", response_model=List[BusinessSchema])
def list_all_businesses(
    db: Session = Depends(get_db),
    _: UserModel = Depends(_require_super_admin),
):
    """List every business on the platform (super_admin only)."""
    return db.query(Business).order_by(Business.name).all()


@router.post("/businesses/onboard", response_model=BusinessSchema)
def onboard_business_and_owner(
    payload: PlatformBusinessOnboard,
    db: Session = Depends(get_db),
    _: UserModel = Depends(_require_super_admin),
):
    """
    Create a new business and a new owner user. Does not link the super admin to the business.
    """
    email_norm = (payload.email or "").strip().lower()
    if get_user(db, email_norm):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists",
        )

    full_name = payload.owner_full_name()
    if not full_name:
        full_name = email_norm.split("@")[0]

    owner = create_user_with_role(
        db,
        UserCreate(
            email=payload.email,
            full_name=full_name,
            password=payload.password,
        ),
        role="customer",
    )

    business = Business(
        name=payload.business_name,
        business_type=payload.business_type,
        email=payload.email,
        phone=payload.phone,
        address=payload.address,
        timezone=payload.timezone or "UTC",
    )
    db.add(business)
    db.flush()

    bu = BusinessUser(business_id=business.id, user_id=owner.id, role="owner")
    db.add(bu)
    db.commit()
    db.refresh(business)
    return business


@router.post("/users", response_model=UserSchema)
def create_platform_user(
    payload: AdminCreateUserRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(_require_super_admin),
):
    """
    Create a new platform user (e.g. another super_admin). Super admin only.
    """
    if get_user(db, payload.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )
    allowed = ("super_admin", "admin", "owner", "staff", "customer")
    if payload.role not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role must be one of: {', '.join(allowed)}",
        )
    return create_user_with_role(
        db,
        UserCreate(email=payload.email, full_name=payload.full_name, password=payload.password),
        role=payload.role,
    )
