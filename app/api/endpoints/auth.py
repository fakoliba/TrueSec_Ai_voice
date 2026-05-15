import logging
from datetime import timedelta
from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.user import User as UserModel
from app.schemas.user import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    PlatformUserResponse,
    ResetPasswordRequest,
    SetUserRoleRequest,
    Token,
    User,
    UserCreate,
    UserUpdate,
)
from app.services.auth import (
    authenticate_user,
    change_user_password,
    create_access_token,
    create_reset_token,
    create_user as create_user_service,
    get_current_user,
    get_user,
    get_user_by_id,
    reset_password_by_token,
    set_user_role as set_user_role_service,
    update_user_profile,
)

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/token", response_model=Token)
async def login_for_access_token(
    db: Session = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends()
):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/register", response_model=User)
def register_user(
    user: UserCreate,
    db: Session = Depends(get_db)
):
    if not settings.ALLOW_PUBLIC_REGISTRATION:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Registration is disabled. Contact your administrator for an account.",
        )
    try:
        db_user = get_user(db, email=user.email)
        if db_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        return create_user_service(db=db, user=user)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Registration failed: %s", e)
        # Include error in response so we can debug (remove in production if needed)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration failed: {type(e).__name__}: {e}",
        ) from e

@router.get("/users/me", response_model=User)
async def read_users_me(current_user: UserModel = Depends(get_current_user)):
    return current_user


@router.patch("/users/me", response_model=User)
def update_users_me(
    update: UserUpdate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    # If user is trying to change email, ensure it's not already taken by another user.
    if update.email and update.email != current_user.email:
        existing = get_user(db, email=update.email)
        if existing and existing.id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered",
            )

    updated_user = update_user_profile(db=db, db_user=current_user, update=update)
    return updated_user


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    change_user_password(
        db=db,
        db_user=current_user,
        current_password=payload.current_password,
        new_password=payload.new_password,
    )
    return {"detail": "Password updated successfully"}


@router.post("/forgot-password")
def forgot_password(
    payload: ForgotPasswordRequest,
    db: Session = Depends(get_db),
):
    """Request a password reset. If the email is registered, returns a one-time reset token (valid 1 hour). Use it on the reset-password page. For production, configure email and send the link instead of returning the token."""
    token = create_reset_token(db, payload.email)
    if token:
        return {"message": "If an account exists with that email, you can set a new password.", "reset_token": token}
    return {"message": "If an account exists with that email, you can set a new password."}


@router.post("/reset-password")
def reset_password(
    payload: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    """Set a new password using a token from forgot-password. Token is single-use and expires after 1 hour."""
    if len(payload.new_password) < 6:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password must be at least 6 characters")
    if reset_password_by_token(db, payload.token, payload.new_password):
        return {"detail": "Password has been reset. You can sign in with your new password."}
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Invalid or expired reset link. Please request a new one.",
    )


def _require_platform_admin(current_user: Any) -> Any:
    """Dependency: require current user to be platform admin (super_admin or admin). Avoid UserModel here so FastAPI does not try to use ORM as Pydantic type."""
    if getattr(current_user, "role", None) not in ("super_admin", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only platform admins can perform this action",
        )
    return current_user


def _check_platform_admin(current_user: Any) -> None:
    """Raise 403 if current user is not platform admin. Call inside route to avoid dependency return type issues."""
    if getattr(current_user, "role", None) not in ("super_admin", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only platform admins can perform this action",
        )


@router.get("/users", response_model=List[PlatformUserResponse])
def list_users(
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    """List all platform users (admin/super_admin only). Used to manage roles."""
    _check_platform_admin(current_user)
    users = db.query(UserModel).order_by(UserModel.email).all()
    return users


@router.patch("/users/{user_id}/role", response_model=PlatformUserResponse)
def set_user_role_endpoint(
    user_id: int,
    payload: SetUserRoleRequest,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    """Set a user's platform role (admin/super_admin only)."""
    _check_platform_admin(current_user)
    if payload.role == "super_admin" and current_user.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only a super admin can assign the super_admin role",
        )
    return set_user_role_service(db, user_id, payload.role)
