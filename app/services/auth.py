import secrets
from datetime import datetime, timedelta
from typing import Any, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.user import User
from app.models.password_reset_token import PasswordResetToken
from app.schemas.user import TokenData, UserCreate, UserInDB, UserUpdate

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    # bcrypt limit is 72 bytes
    p = plain_password.encode("utf-8")[:72].decode("utf-8", errors="ignore") or " "
    return pwd_context.verify(p, hashed_password)


def get_password_hash(password: str) -> str:
    # bcrypt limit is 72 bytes; truncate to avoid ValueError
    p = password.encode("utf-8")[:72].decode("utf-8", errors="ignore") or " "
    return pwd_context.hash(p)


def normalize_email(email: Optional[str]) -> str:
    """Lowercase + strip for consistent lookup (RFC 5321 local-part can be case-sensitive, but in practice matching is case-insensitive for most providers)."""
    if not email:
        return ""
    return email.strip().lower()


def get_user(db: Session, email: str) -> Optional[User]:
    """Look up user by email (case-insensitive)."""
    normalized = normalize_email(email)
    if not normalized:
        return None
    return db.query(User).filter(func.lower(User.email) == normalized).first()


def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()


def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    user = get_user(db, email)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


async def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme),
) -> Any:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        token_data = TokenData(email=email)
    except JWTError:
        raise credentials_exception

    user = get_user(db, email=token_data.email)
    if user is None:
        raise credentials_exception
    return user


def initial_platform_role_for_new_user(db: Session) -> str:
    """First platform account becomes admin; everyone else customer. Call before INSERT."""
    return "admin" if db.query(User).count() == 0 else "customer"


def create_user(db: Session, user: UserCreate) -> User:
    hashed_password = get_password_hash(user.password)
    db_user = User(
        email=normalize_email(user.email) or user.email,
        hashed_password=hashed_password,
        full_name=user.full_name,
        is_active=True,
        role=initial_platform_role_for_new_user(db),
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def create_user_with_role(db: Session, user: UserCreate, role: str) -> User:
    """Create user with explicit platform role. Caller must enforce permissions and duplicate checks."""
    hashed_password = get_password_hash(user.password)
    db_user = User(
        email=normalize_email(user.email) or user.email,
        hashed_password=hashed_password,
        full_name=user.full_name,
        is_active=True,
        role=role,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def update_user_profile(db: Session, db_user: User, update: UserUpdate) -> User:
    """Update the current user's own profile fields (email, full_name)."""
    if update.email is not None:
        db_user.email = normalize_email(update.email) or update.email
    if update.full_name is not None:
        db_user.full_name = update.full_name

    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def change_user_password(
    db: Session,
    db_user: User,
    current_password: str,
    new_password: str,
) -> None:
    """Change the current user's password after verifying the existing one."""
    if not verify_password(current_password, db_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    db_user.hashed_password = get_password_hash(new_password)
    db.add(db_user)
    db.commit()


RESET_TOKEN_EXPIRE_HOURS = 1


def create_reset_token(db: Session, email: str) -> Optional[str]:
    """Create a one-time password reset token for the user with this email. Returns token or None if user not found."""
    user = get_user(db, email=email)
    if not user:
        return None
    # Invalidate any existing tokens for this user
    db.query(PasswordResetToken).filter(PasswordResetToken.user_id == user.id).delete()
    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(hours=RESET_TOKEN_EXPIRE_HOURS)
    row = PasswordResetToken(user_id=user.id, token=token, expires_at=expires_at)
    db.add(row)
    db.commit()
    return token


def reset_password_by_token(db: Session, token: str, new_password: str) -> bool:
    """If token is valid and not expired, set user's new password and delete token. Returns True on success."""
    row = (
        db.query(PasswordResetToken)
        .filter(PasswordResetToken.token == token, PasswordResetToken.expires_at > datetime.utcnow())
        .first()
    )
    if not row:
        return False
    user = get_user_by_id(db, row.user_id)
    if not user:
        db.delete(row)
        db.commit()
        return False
    user.hashed_password = get_password_hash(new_password)
    db.delete(row)
    db.add(user)
    db.commit()
    return True


def set_user_role(db: Session, user_id: int, new_role: str) -> User:
    """Set a user's platform role. Caller must be admin/super_admin (enforced in endpoint)."""
    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    allowed = ("super_admin", "admin", "owner", "staff", "customer")
    if new_role not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role must be one of: {', '.join(allowed)}",
        )
    user.role = new_role
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
