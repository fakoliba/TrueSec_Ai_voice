from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import RedirectResponse
from urllib.parse import urlencode
from sqlalchemy.orm import Session
from typing import Optional

from googleapiclient.discovery import build

from app.db.session import get_db
from app.models.user import User
from app.models.oauth_token import OAuthToken
from app.schemas.user import User as UserSchema, UserResponse
from app.services.calendar_service import GoogleCalendarService
from app.services.auth import get_password_hash, get_user, initial_platform_role_for_new_user, normalize_email
from app.core.security import get_current_user, create_access_token
from app.core.config import settings

router = APIRouter()

@router.get("/login")
async def login_google():
    """Initiate Google OAuth flow"""
    auth_url = GoogleCalendarService.get_authorization_url()
    return {"authorization_url": auth_url}

@router.get("/callback")
async def callback(
    code: Optional[str] = None,
    error: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Handle Google OAuth callback"""
    if error:
        return {"error": error}
    
    if not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Authorization code not provided"
        )
    
    try:
        # Exchange authorization code for tokens
        tokens = await GoogleCalendarService.get_tokens(code)
        
        # Get user info from Google
        credentials = GoogleCalendarService.get_credentials(tokens)
        service = build('oauth2', 'v2', credentials=credentials)
        user_info = service.userinfo().get().execute()
        
        # Find or create user (match email case-insensitively like password registration)
        email_norm = normalize_email(user_info["email"]) or user_info["email"]
        user = get_user(db, user_info["email"])
        if not user:
            # Create new user — same first-user admin rule as email/password signup
            user = User(
                email=email_norm,
                full_name=user_info.get("name", ""),
                hashed_password=get_password_hash(""),
                role=initial_platform_role_for_new_user(db),
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        
        # Save or update OAuth tokens
        oauth_token = db.query(OAuthToken).filter(
            OAuthToken.user_id == user.id,
            OAuthToken.provider == 'google'
        ).first()
        
        if not oauth_token:
            oauth_token = OAuthToken(
                user_id=user.id,
                provider='google',
                access_token=tokens['access_token'],
                refresh_token=tokens.get('refresh_token'),
                token_expiry=tokens.get('expiry')
            )
            db.add(oauth_token)
        else:
            oauth_token.access_token = tokens['access_token']
            if 'refresh_token' in tokens:
                oauth_token.refresh_token = tokens['refresh_token']
            oauth_token.token_expiry = tokens.get('expiry')
        
        db.commit()
        
        # Create JWT token for the user
        access_token = create_access_token(data={"sub": user.email})
        
        # Redirect to frontend with token
        frontend_url = settings.FRONTEND_URL or "http://localhost:3000"
        redirect_url = f"{frontend_url}/auth/callback?{urlencode({'token': access_token})}"
        
        return RedirectResponse(url=redirect_url)
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user info with OAuth status"""
    oauth_token = db.query(OAuthToken).filter(
        OAuthToken.user_id == current_user.id,
        OAuthToken.provider == 'google'
    ).first()
    
    user_dict = {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "is_active": current_user.is_active,
        "google_connected": oauth_token is not None
    }
    
    return user_dict
