import base64
from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.api.dependencies import get_business_membership, get_business_or_404
from app.db.session import get_db
from app.models.business import Business, BusinessUser, BusinessSettings
from app.models.calendar_integration import CalendarIntegration
from app.models.service import Service as ServiceModel
from app.models.user import User
from app.models.appointment import Appointment as AppointmentModel
from app.services.voice_entitlements import build_voice_options, validate_ai_voice_settings
from app.services.voice_presets import resolve_preset_voice_ref
from app.services.voice_service import synthesize_for_preview
from app.schemas.appointment import Appointment as AppointmentSchema, AppointmentCreate, AppointmentUpdate
from app.schemas.user import UserCreate
from app.schemas.business import (
    Business as BusinessSchema,
    BusinessCreate,
    BusinessUpdate,
    BusinessUser as BusinessUserSchema,
    BusinessUserCreateByEmail,
    BusinessUserUpdate,
    BusinessUserWithUser,
    AppleCalendarConnectRequest,
    CalendarConnectResponse,
    CalendarIntegrationResponse,
    BusinessSettingsResponse,
    BusinessSettingsUpdate,
    DashboardTheme,
    VoiceOptionsApiResponse,
    VoicePreviewRequest,
    VoicePreviewResponse,
    AvailabilitySlot,
    AvailabilityCheckResponse,
    ServiceCreate,
    ServiceResponse,
    ServiceUpdate,
)
from app.core.config import settings as app_settings
from app.services.auth import create_user as create_user_service, get_current_user, get_user
from app.services.calendar import get_provider
from app.services.calendar_service import GoogleCalendarService
from app.services.availability_service import get_available_slots_async, is_slot_available, get_calendar_conflicts
from app.services.ai_agent_service import get_internal_help_reply
from app.models.call_log import CallLog as CallLogModel
from app.models.conversation import Conversation as ConversationModel
from app.schemas.call_log import CallLogResponse
from app.schemas.conversation import ConversationCreate, ConversationReply, Conversation as ConversationSchema
from app.models.intake import IntakeForm as IntakeFormModel, IntakeSubmission as IntakeSubmissionModel
from app.schemas.intake import (
    IntakeForm as IntakeFormSchema,
    IntakeFormCreate,
    IntakeFormUpdate,
    IntakeSubmission as IntakeSubmissionSchema,
    IntakeSubmissionCreate,
    IntakeSubmissionUpdate,
    IntakeSubmissionWithForm,
)

router = APIRouter()


# ---- Business CRUD ----


@router.post("/", response_model=BusinessSchema)
def create_business(
    payload: BusinessCreate,
      db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a business; current user becomes owner. Only admin or owner role can create businesses."""
    if current_user.role == "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super admins cannot be business owners. Use POST /api/platform/businesses/onboard to add a business and owner.",
        )
    if current_user.role not in ("admin", "owner"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and owners can create a new business. Contact your administrator.",
        )
    business = Business(
        name=payload.name,
        business_type=payload.business_type,
        email=payload.email,
        phone=payload.phone,
        address=payload.address,
        timezone=payload.timezone,
    )
    db.add(business)
    db.flush()  # get business.id
    bu = BusinessUser(business_id=business.id, user_id=current_user.id, role="owner")
    db.add(bu)
    db.commit()
    db.refresh(business)
    return business


@router.get("/", response_model=List[BusinessSchema])
def list_my_businesses(
      db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List businesses the current user is a member of."""
    businesses = (
        db.query(Business)
        .join(BusinessUser, BusinessUser.business_id == Business.id)
        .filter(BusinessUser.user_id == current_user.id)
        .all()
    )
    return businesses


@router.get("/{business_id}", response_model=BusinessSchema)
def get_business(
    business_id: int,
    business: Business = Depends(get_business_or_404),
):
    """Get a business by id (must be a member)."""
    return business


@router.put("/{business_id}", response_model=BusinessSchema)
def update_business(
    business_id: int,
    payload: BusinessUpdate,
      db: Session = Depends(get_db),
    business: Business = Depends(get_business_or_404),
):
    """Update a business (members can update; restrict to owner/admin in future)."""
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(business, k, v)
    db.commit()
    db.refresh(business)
    return business


@router.delete("/{business_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_business(
    business_id: int,
      db: Session = Depends(get_db),
    business: Business = Depends(get_business_or_404),
    current_user: User = Depends(get_current_user),
):
    """Delete a business (only owner should be allowed; check role)."""
    bu = (
        db.query(BusinessUser)
        .filter(
            BusinessUser.business_id == business_id,
            BusinessUser.user_id == current_user.id,
        )
        .first()
    )
    if bu and bu.role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the business owner can delete the business",
        )
    db.delete(business)
    db.commit()
    return None


# ---- BusinessUser (members) ----


@router.get("/{business_id}/users", response_model=List[BusinessUserWithUser])
def list_business_users(
    business_id: int,
    db: Session = Depends(get_db),
    business: Business = Depends(get_business_or_404),
    _: User = Depends(get_current_user),
):
    """List users (members) of a business."""
    members = (
        db.query(BusinessUser, User.email, User.full_name)
        .join(User, User.id == BusinessUser.user_id)
        .filter(BusinessUser.business_id == business_id)
        .all()
    )
    return [
        BusinessUserWithUser(
            id=bu.id,
            business_id=bu.business_id,
            user_id=bu.user_id,
            role=bu.role,
            permissions=bu.permissions,
            created_at=bu.created_at,
            user_email=email,
            user_full_name=full_name,
        )
        for bu, email, full_name in members
    ]


@router.post("/{business_id}/users", response_model=BusinessUserWithUser)
def add_business_user_by_email(
    business_id: int,
    payload: BusinessUserCreateByEmail,
    db: Session = Depends(get_db),
    business: Business = Depends(get_business_or_404),
    bu: BusinessUser = Depends(get_business_membership),
):
    """Add a user to the business by email (must be owner or admin). If user does not exist and
    password is provided, create the user then add them to the business."""
    if bu.role not in ("owner", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owner or admin can add users",
        )
    user = get_user(db, payload.email)
    if not user:
        if not payload.password or len(payload.password) < 6:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No user found with this email. Provide full_name and password to create a new user (password at least 6 characters).",
            )
        user = create_user_service(
            db,
            UserCreate(
                email=payload.email,
                full_name=payload.full_name or None,
                password=payload.password,
            ),
        )
    if getattr(user, "role", None) == "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super admins cannot be members of a business.",
        )
    existing = (
        db.query(BusinessUser)
        .filter(
            BusinessUser.business_id == business_id,
            BusinessUser.user_id == user.id,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a member of this business",
        )
    new_bu = BusinessUser(
        business_id=business_id,
        user_id=user.id,
        role=payload.role,
        permissions=payload.permissions,
    )
    db.add(new_bu)
    db.commit()
    db.refresh(new_bu)
    db.refresh(user)
    return BusinessUserWithUser(
        id=new_bu.id,
        business_id=new_bu.business_id,
        user_id=new_bu.user_id,
        role=new_bu.role,
        permissions=new_bu.permissions,
        created_at=new_bu.created_at,
        user_email=user.email,
        user_full_name=user.full_name,
    )


@router.put("/{business_id}/users/{user_id}", response_model=BusinessUserSchema)
def update_business_user_role(
    business_id: int,
    user_id: int,
    payload: BusinessUserUpdate,
    db: Session = Depends(get_db),
    business: Business = Depends(get_business_or_404),
    bu: BusinessUser = Depends(get_business_membership),
):
    """Update a member's role (owner or admin only)."""
    if bu.role not in ("owner", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owner or admin can update roles",
        )
    target = (
        db.query(BusinessUser)
        .filter(
            BusinessUser.business_id == business_id,
            BusinessUser.user_id == user_id,
        )
        .first()
    )
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User is not a member of this business",
        )
    if payload.role is not None:
        target.role = payload.role
    if payload.permissions is not None:
        target.permissions = payload.permissions
    db.commit()
    db.refresh(target)
    return target


@router.delete("/{business_id}/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_business_user(
    business_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    business: Business = Depends(get_business_or_404),
    current_user: User = Depends(get_current_user),
    bu: BusinessUser = Depends(get_business_membership),
):
    """Remove a user from the business (owner or admin, or self-remove)."""
    target = (
        db.query(BusinessUser)
        .filter(
            BusinessUser.business_id == business_id,
            BusinessUser.user_id == user_id,
        )
        .first()
    )
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User is not a member of this business",
        )
    if current_user.id != user_id:
        if bu.role not in ("owner", "admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only owner or admin can remove other users",
            )
        if target.role == "owner":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot remove the owner",
            )
    db.delete(target)
    db.commit()
    return None


# ---- Calendar integrations ----


@router.get("/{business_id}/calendars", response_model=List[CalendarIntegrationResponse])
def list_business_calendars(
    business_id: int,
    db: Session = Depends(get_db),
    business: Business = Depends(get_business_or_404),
    _: User = Depends(get_business_membership),
):
    """List calendar integrations for this business (no tokens returned)."""
    integrations = (
        db.query(CalendarIntegration)
        .filter(CalendarIntegration.business_id == business_id)
        .order_by(CalendarIntegration.is_primary.desc(), CalendarIntegration.id)
        .all()
    )
    return integrations


@router.get("/{business_id}/calendars/google/connect", response_model=CalendarConnectResponse)
def connect_google_calendar(
    business_id: int,
    request: Request,
    db: Session = Depends(get_db),
    business: Business = Depends(get_business_or_404),
    current_user: User = Depends(get_business_membership),
):
    """Get Google OAuth URL to connect a calendar to this business. Redirect user to authorization_url."""
    provider = get_provider("google")
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Google calendar provider not configured",
        )
    base_url = str(request.base_url).rstrip("/")
    redirect_uri = f"{base_url}/api/businesses/{business_id}/calendars/google/callback"
    url = provider.get_authorization_url(redirect_uri=redirect_uri, state=str(business_id))
    return CalendarConnectResponse(authorization_url=url)


@router.get("/{business_id}/calendars/google/callback")
async def google_calendar_callback(
    request: Request,
    business_id: int,
    code: str,
    state: str | None = None,
    db: Session = Depends(get_db),
    business: Business = Depends(get_business_or_404),
    current_user: User = Depends(get_business_membership),
):
    """OAuth callback: exchange code for tokens and create/update CalendarIntegration. Redirects to success URL."""
    provider = get_provider("google")
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Google calendar provider not configured",
        )
    base_url = str(request.base_url).rstrip("/")
    redirect_uri = f"{base_url}/api/businesses/{business_id}/calendars/google/callback"
    token_data = await provider.exchange_code_for_tokens(code=code, redirect_uri=redirect_uri)
    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to exchange code for tokens",
        )
    # Create or update CalendarIntegration for this business
    existing = (
        db.query(CalendarIntegration)
        .filter(
            CalendarIntegration.business_id == business_id,
            CalendarIntegration.provider == "google",
        )
        .first()
    )
    expiry = token_data.get("expiry")
    token_expiry_dt = None
    if expiry:
        token_expiry_dt = datetime.fromisoformat(expiry.replace("Z", "+00:00")) if isinstance(expiry, str) else expiry

    if existing:
        existing.access_token = token_data.get("access_token")
        existing.refresh_token = token_data.get("refresh_token")
        existing.token_expiry = token_expiry_dt
        existing.sync_enabled = True
        integration = existing
    else:
        is_primary = (
            db.query(CalendarIntegration)
            .filter(CalendarIntegration.business_id == business_id)
            .first()
        ) is None
        integration = CalendarIntegration(
            business_id=business_id,
            provider="google",
            access_token=token_data.get("access_token"),
            refresh_token=token_data.get("refresh_token"),
            token_expiry=token_expiry_dt,
            calendar_id=token_data.get("calendar_id"),
            is_primary=is_primary,
            sync_enabled=True,
        )
        db.add(integration)
    db.commit()
    db.refresh(integration)
    # Redirect to frontend: use FRONTEND_URL + /dashboard/{id}/calendars so user lands on calendars page
    if app_settings.FRONTEND_URL:
        base = app_settings.FRONTEND_URL.rstrip("/")
        success_url = f"{base}/dashboard/{business_id}/calendars"
    else:
        import os
        success_url = os.getenv("CALENDAR_CONNECT_SUCCESS_URL", f"{base_url}/docs")
    return RedirectResponse(url=success_url, status_code=status.HTTP_302_FOUND)


# ---- Outlook (Microsoft) calendar ----
@router.get("/{business_id}/calendars/outlook/connect", response_model=CalendarConnectResponse)
def connect_outlook_calendar(
    business_id: int,
    request: Request,
    db: Session = Depends(get_db),
    business: Business = Depends(get_business_or_404),
    current_user: User = Depends(get_business_membership),
):
    """Get Microsoft OAuth URL to connect an Outlook calendar to this business."""
    provider = get_provider("outlook")
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Outlook calendar provider not configured",
        )
    from app.core.config import settings
    if not getattr(settings, "MICROSOFT_CLIENT_ID", None) or not getattr(settings, "MICROSOFT_CLIENT_SECRET", None):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Outlook integration is not configured (MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET)",
        )
    base_url = str(request.base_url).rstrip("/")
    redirect_uri = f"{base_url}/api/businesses/{business_id}/calendars/outlook/callback"
    url = provider.get_authorization_url(redirect_uri=redirect_uri, state=str(business_id))
    return CalendarConnectResponse(authorization_url=url)


@router.get("/{business_id}/calendars/outlook/callback")
async def outlook_calendar_callback(
    request: Request,
    business_id: int,
    code: str,
    state: str | None = None,
    db: Session = Depends(get_db),
    business: Business = Depends(get_business_or_404),
    current_user: User = Depends(get_business_membership),
):
    """OAuth callback: exchange code for tokens and create/update CalendarIntegration for Outlook."""
    provider = get_provider("outlook")
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Outlook calendar provider not configured",
        )
    base_url = str(request.base_url).rstrip("/")
    redirect_uri = f"{base_url}/api/businesses/{business_id}/calendars/outlook/callback"
    token_data = await provider.exchange_code_for_tokens(code=code, redirect_uri=redirect_uri)
    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to exchange code for tokens",
        )
    existing = (
        db.query(CalendarIntegration)
        .filter(
            CalendarIntegration.business_id == business_id,
            CalendarIntegration.provider == "outlook",
        )
        .first()
    )
    expiry = token_data.get("expiry")
    token_expiry_dt = None
    if expiry:
        token_expiry_dt = datetime.fromisoformat(expiry.replace("Z", "+00:00")) if isinstance(expiry, str) else expiry
    if existing:
        existing.access_token = token_data.get("access_token")
        existing.refresh_token = token_data.get("refresh_token")
        existing.token_expiry = token_expiry_dt
        existing.sync_enabled = True
    else:
        is_primary = (
            db.query(CalendarIntegration)
            .filter(CalendarIntegration.business_id == business_id)
            .first()
        ) is None
        integration = CalendarIntegration(
            business_id=business_id,
            provider="outlook",
            access_token=token_data.get("access_token"),
            refresh_token=token_data.get("refresh_token"),
            token_expiry=token_expiry_dt,
            calendar_id=token_data.get("calendar_id"),
            is_primary=is_primary,
            sync_enabled=True,
        )
        db.add(integration)
    db.commit()
    if app_settings.FRONTEND_URL:
        base = app_settings.FRONTEND_URL.rstrip("/")
        success_url = f"{base}/dashboard/{business_id}/calendars"
    else:
        import os
        success_url = os.getenv("CALENDAR_CONNECT_SUCCESS_URL", f"{base_url}/docs")
    return RedirectResponse(url=success_url, status_code=status.HTTP_302_FOUND)


# ---- Apple (CalDAV) calendar ----
@router.post("/{business_id}/calendars/apple/connect", response_model=CalendarIntegrationResponse)
def connect_apple_calendar(
    business_id: int,
    payload: AppleCalendarConnectRequest,
    db: Session = Depends(get_db),
    business: Business = Depends(get_business_or_404),
    current_user: User = Depends(get_business_membership),
):
    """Connect an Apple iCloud calendar using Apple ID and app-specific password (CalDAV)."""
    provider = get_provider("apple")
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Apple calendar is not available (install caldav and icalendar packages)",
        )
    token_data = provider.connect_with_credentials(
        username=payload.username,
        password=payload.app_specific_password,
    )
    existing = (
        db.query(CalendarIntegration)
        .filter(
            CalendarIntegration.business_id == business_id,
            CalendarIntegration.provider == "apple",
        )
        .first()
    )
    if existing:
        existing.access_token = token_data.get("access_token")
        existing.provider_account_id = token_data.get("username")
        existing.calendar_id = token_data.get("calendar_id")
        existing.sync_enabled = True
        db.commit()
        db.refresh(existing)
        return existing
    is_primary = (
        db.query(CalendarIntegration)
        .filter(CalendarIntegration.business_id == business_id)
        .first()
    ) is None
    integration = CalendarIntegration(
        business_id=business_id,
        provider="apple",
        provider_account_id=token_data.get("username"),
        access_token=token_data.get("access_token"),
        refresh_token=token_data.get("refresh_token"),
        token_expiry=token_data.get("token_expiry"),
        calendar_id=token_data.get("calendar_id"),
        is_primary=is_primary,
        sync_enabled=True,
    )
    db.add(integration)
    db.commit()
    db.refresh(integration)
    return integration


@router.get("/{business_id}/calendars/events")
async def list_business_calendar_events(
    business_id: int,
    time_min: Optional[datetime] = None,
    time_max: Optional[datetime] = None,
    max_results: int = 50,
    db: Session = Depends(get_db),
    business: Business = Depends(get_business_or_404),
    _: User = Depends(get_business_membership),
):
    """List events from the business's primary calendar (e.g. Google). Requires a connected calendar."""
    return await GoogleCalendarService.list_calendar_events_for_business(
        business_id=business_id,
        time_min=time_min,
        time_max=time_max,
        max_results=max_results,
        db=db,
    )


@router.post("/{business_id}/calendars/sync", status_code=status.HTTP_200_OK)
def trigger_calendar_sync(
    business_id: int,
    db: Session = Depends(get_db),
    business: Business = Depends(get_business_or_404),
    _: User = Depends(get_business_membership),
):
    """Trigger a one-off calendar sync for this business (pulls events into cache for conflict detection). Requires Celery worker to be running."""
    try:
        from app.tasks.calendar_sync import sync_business_calendar
        count = sync_business_calendar(business_id)
        return {"synced": True, "events_cached": count}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Calendar sync failed: {e}",
        )


@router.delete("/{business_id}/calendars/{integration_id}", status_code=status.HTTP_204_NO_CONTENT)
def disconnect_calendar(
    business_id: int,
    integration_id: int,
    db: Session = Depends(get_db),
    business: Business = Depends(get_business_or_404),
    _: User = Depends(get_business_membership),
):
    """Remove a calendar integration from the business."""
    integration = (
        db.query(CalendarIntegration)
        .filter(
            CalendarIntegration.id == integration_id,
            CalendarIntegration.business_id == business_id,
        )
        .first()
    )
    if not integration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Calendar integration not found",
        )
    db.delete(integration)
    db.commit()
    return None


# ---- Business settings (hours, availability rules) ----
@router.get("/{business_id}/settings", response_model=BusinessSettingsResponse)
def get_business_settings(
    business_id: int,
    db: Session = Depends(get_db),
    business: Business = Depends(get_business_or_404),
    _: User = Depends(get_business_membership),
):
    """Get business settings (business hours, availability rules, etc.). Creates default if missing."""
    settings = db.query(BusinessSettings).filter(BusinessSettings.business_id == business_id).first()
    if not settings:
        settings = BusinessSettings(business_id=business_id)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


@router.put("/{business_id}/settings", response_model=BusinessSettingsResponse)
def update_business_settings(
    business_id: int,
    payload: BusinessSettingsUpdate,
    db: Session = Depends(get_db),
    business: Business = Depends(get_business_or_404),
    membership: BusinessUser = Depends(get_business_membership),
):
    """Update business settings (business hours, blocked times in availability_rules, etc.)."""
    settings = db.query(BusinessSettings).filter(BusinessSettings.business_id == business_id).first()
    if not settings:
        settings = BusinessSettings(business_id=business_id)
        db.add(settings)
        db.flush()
    data = payload.model_dump(exclude_unset=True)
    if "dashboard_theme" in data and data["dashboard_theme"] is not None:
        role = getattr(membership, "role", None)
        if role not in ("owner", "admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only business owners and admins can change the dashboard theme",
            )
    if "default_intake_form_id" in data and data["default_intake_form_id"] is not None:
        fid = data["default_intake_form_id"]
        form = (
            db.query(IntakeFormModel)
            .filter(IntakeFormModel.id == fid, IntakeFormModel.business_id == business_id)
            .first()
        )
        if not form:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="default_intake_form_id must belong to this business",
            )
    if "ai_voice_settings" in data and data["ai_voice_settings"] is not None:
        prev = (settings.ai_voice_settings or {}) if settings else {}
        merged = {**prev, **data["ai_voice_settings"]}
        data["ai_voice_settings"] = validate_ai_voice_settings(
            business.subscription_plan,
            merged,
        )
    for k, v in data.items():
        if k == "dashboard_theme" and v is not None:
            v = v.value if isinstance(v, DashboardTheme) else str(v)
        setattr(settings, k, v)
    db.commit()
    db.refresh(settings)
    return settings


@router.get("/{business_id}/voice/options", response_model=VoiceOptionsApiResponse)
def get_voice_options(
    business_id: int,
    db: Session = Depends(get_db),
    business: Business = Depends(get_business_or_404),
    _: User = Depends(get_business_membership),
):
    """Voice stack and allowed ElevenLabs voices for this business (subscription-aware)."""
    st = db.query(BusinessSettings).filter(BusinessSettings.business_id == business_id).first()
    ai_voice = (st and st.ai_voice_settings) or {}
    raw = build_voice_options(
        business.subscription_plan,
        business.subscription_status,
        ai_voice,
    )
    return VoiceOptionsApiResponse(**raw)


@router.post("/{business_id}/voice/preview", response_model=VoicePreviewResponse)
def post_voice_preview(
    business_id: int,
    payload: VoicePreviewRequest,
    db: Session = Depends(get_db),
    business: Business = Depends(get_business_or_404),
    _: User = Depends(get_business_membership),
    current_user: User = Depends(get_current_user),
):
    """
    Generate a short TTS sample for the dashboard (uses server API keys; rate-limited per user).
    """
    from app.services.voice_preview_rate_limit import check_voice_preview_allowed

    if not check_voice_preview_allowed(
        business_id,
        current_user.id,
        max_per_minute=app_settings.VOICE_PREVIEW_RATE_PER_MINUTE,
    ):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many preview requests. Try again in a minute.",
        )

    st = db.query(BusinessSettings).filter(BusinessSettings.business_id == business_id).first()
    ai_voice = (st and st.ai_voice_settings) or {}
    opts = build_voice_options(
        business.subscription_plan,
        business.subscription_status,
        ai_voice,
    )
    can_el = bool(opts.get("can_use_elevenlabs"))
    allowed = list(opts.get("allowed_voice_ids") or [])
    default_vid = str(opts.get("default_voice_id") or "")
    allow_list = allowed if allowed else [default_vid or "21m00Tcm4TlvDq8ikWAM"]

    preset_id = (payload.preset_id or "").strip()
    if not preset_id:
        vp = ai_voice.get("voice_profiles")
        if isinstance(vp, dict):
            d = vp.get("default")
            if isinstance(d, dict):
                preset_id = str(d.get("preset_id") or "").strip()
    if not preset_id:
        preset_id = str(opts.get("selected_preset_id") or "").strip() or "openai_professional"

    stack, voice_ref = resolve_preset_voice_ref(
        preset_id,
        allowed_elevenlabs_ids=allow_list,
        default_elevenlabs_id=allow_list[0],
    )
    if stack == "elevenlabs" and not can_el:
        stack, voice_ref = resolve_preset_voice_ref(
            "openai_professional",
            allowed_elevenlabs_ids=allow_list,
            default_elevenlabs_id=allow_list[0],
        )

    sample = (payload.text or "").strip()
    if not sample:
        tpl = str(
            opts.get("preview_sample_text")
            or "Hi, thanks for calling {business_name}, how can I help you today?"
        )
        sample = tpl.replace("{business_name}", business.name or "our business")
    if len(sample) > 600:
        sample = sample[:600]

    speed = payload.speed

    if stack == "openai":
        audio, prov = synthesize_for_preview(
            stack="openai",
            text=sample,
            openai_voice=voice_ref,
            elevenlabs_voice_id=None,
            speed=speed,
        )
    else:
        audio, prov = synthesize_for_preview(
            stack="elevenlabs",
            text=sample,
            openai_voice="alloy",
            elevenlabs_voice_id=voice_ref,
            speed=speed,
        )

    if not audio:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not generate audio. Check API keys and try again.",
        )

    b64 = base64.b64encode(audio).decode("ascii")
    return VoicePreviewResponse(audio_base64=b64, media_type="audio/mpeg", provider_used=prov)


# ---- Services ----
@router.get("/{business_id}/services", response_model=List[ServiceResponse])
def list_services(
    business_id: int,
    db: Session = Depends(get_db),
    business: Business = Depends(get_business_or_404),
    _: User = Depends(get_business_membership),
):
    """List services offered by this business."""
    services = (
        db.query(ServiceModel)
        .filter(ServiceModel.business_id == business_id)
        .order_by(ServiceModel.name)
        .all()
    )
    return services


@router.post("/{business_id}/services", response_model=ServiceResponse, status_code=status.HTTP_201_CREATED)
def create_service(
    business_id: int,
    payload: ServiceCreate,
    db: Session = Depends(get_db),
    business: Business = Depends(get_business_or_404),
    _: User = Depends(get_business_membership),
):
    """Add a service (owner or admin only in future)."""
    service = ServiceModel(
        business_id=business_id,
        name=payload.name,
        description=payload.description,
        duration_minutes=payload.duration_minutes,
        price=payload.price,
        is_active=payload.is_active,
    )
    db.add(service)
    db.commit()
    db.refresh(service)
    return service


@router.get("/{business_id}/services/{service_id}", response_model=ServiceResponse)
def get_service(
    business_id: int,
    service_id: int,
    db: Session = Depends(get_db),
    business: Business = Depends(get_business_or_404),
    _: User = Depends(get_business_membership),
):
    """Get one service."""
    service = (
        db.query(ServiceModel)
        .filter(
            ServiceModel.id == service_id,
            ServiceModel.business_id == business_id,
        )
        .first()
    )
    if not service:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")
    return service


@router.put("/{business_id}/services/{service_id}", response_model=ServiceResponse)
def update_service(
    business_id: int,
    service_id: int,
    payload: ServiceUpdate,
    db: Session = Depends(get_db),
    business: Business = Depends(get_business_or_404),
    _: User = Depends(get_business_membership),
):
    """Update a service."""
    service = (
        db.query(ServiceModel)
        .filter(
            ServiceModel.id == service_id,
            ServiceModel.business_id == business_id,
        )
        .first()
    )
    if not service:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(service, k, v)
    db.commit()
    db.refresh(service)
    return service


@router.delete("/{business_id}/services/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_service(
    business_id: int,
    service_id: int,
    db: Session = Depends(get_db),
    business: Business = Depends(get_business_or_404),
    _: User = Depends(get_business_membership),
):
    """Delete a service."""
    service = (
        db.query(ServiceModel)
        .filter(
            ServiceModel.id == service_id,
            ServiceModel.business_id == business_id,
        )
        .first()
    )
    if not service:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")
    db.delete(service)
    db.commit()
    return None


# ---- Availability (slots, check) ----
@router.get("/{business_id}/availability/slots", response_model=List[AvailabilitySlot])
async def get_availability_slots(
    business_id: int,
    date_from: date,
    date_to: Optional[date] = None,
    slot_minutes: int = 30,
    include_calendar: bool = True,
    db: Session = Depends(get_db),
    business: Business = Depends(get_business_or_404),
    _: User = Depends(get_business_membership),
):
    """
    Get available time slots for the business. Uses business hours, appointments, optional calendar, and blocked times.
    date_from: start date (inclusive). date_to: end date (inclusive); defaults to date_from.
    slot_minutes: duration of each slot (default 30).
    """
    slots = await get_available_slots_async(
        db=db,
        business_id=business_id,
        business=business,
        from_date=date_from,
        to_date=date_to,
        slot_minutes=slot_minutes,
        include_calendar=include_calendar,
    )
    return [AvailabilitySlot(start=s["start"], end=s["end"]) for s in slots]


@router.get("/{business_id}/availability/check", response_model=AvailabilityCheckResponse)
def check_availability(
    business_id: int,
    start: datetime,
    end: datetime,
    db: Session = Depends(get_db),
    business: Business = Depends(get_business_or_404),
    _: User = Depends(get_business_membership),
):
    """Check if a given time range is available (within business hours and not busy)."""
    available = is_slot_available(db=db, business_id=business_id, business=business, start=start, end=end)
    return AvailabilityCheckResponse(available=available)


# ---- Conversations (AI Agent) ----
@router.post("/{business_id}/conversations", response_model=ConversationReply)
async def send_message(
    business_id: int,
    payload: ConversationCreate,
    db: Session = Depends(get_db),
    business: Business = Depends(get_business_or_404),
    _: User = Depends(get_business_membership),
):
    """
    Send a message to the AI agent and get a reply. Creates a new conversation or continues an existing one.
    Set conversation_id to continue a thread; omit to start a new conversation.

    Authenticated dashboard chat is **internal staff help** only (product usage). Customer intake and
    booking use the **voice** line, not this endpoint. ``start_intake`` in the body is ignored.
    """
    from datetime import datetime, timezone

    now_iso = datetime.now(timezone.utc).isoformat()
    if payload.conversation_id:
        conv = (
            db.query(ConversationModel)
            .filter(
                ConversationModel.id == payload.conversation_id,
                ConversationModel.business_id == business_id,
            )
            .first()
        )
        if not conv:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
        messages = list(conv.messages or [])
    else:
        conv = ConversationModel(
            business_id=business_id,
            customer_id=payload.customer_id,
            channel=payload.channel,
            messages=[],
        )
        db.add(conv)
        db.flush()
        messages = []
    messages.append({"role": "user", "content": payload.message, "timestamp": now_iso})

    reply_text: Optional[str] = None
    intent = "other"

    reply_text, intent = await get_internal_help_reply(db=db, business=business, messages=messages)

    if reply_text is None:
        reply_text = "I'm sorry, the AI assistant is not available right now. Please try again later or contact the business directly."
        intent = "other"
    messages.append({"role": "assistant", "content": reply_text, "timestamp": now_iso})
    conv.messages = messages
    conv.intent = intent
    db.commit()
    db.refresh(conv)
    return ConversationReply(conversation_id=conv.id, reply=reply_text, intent=intent)


@router.get("/{business_id}/conversations", response_model=List[ConversationSchema])
def list_conversations(
    business_id: int,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    business: Business = Depends(get_business_or_404),
    _: User = Depends(get_business_membership),
):
    """List conversations for this business (newest first)."""
    convs = (
        db.query(ConversationModel)
        .filter(ConversationModel.business_id == business_id)
        .order_by(ConversationModel.updated_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return convs


@router.get("/{business_id}/call-logs", response_model=List[CallLogResponse])
def list_call_logs(
    business_id: int,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    business: Business = Depends(get_business_or_404),
    _: User = Depends(get_business_membership),
):
    """List voice call logs for this business (newest first)."""
    logs = (
        db.query(CallLogModel)
        .filter(CallLogModel.business_id == business_id)
        .order_by(CallLogModel.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return logs


@router.get("/{business_id}/conversations/{conversation_id}", response_model=ConversationSchema)
def get_conversation(
    business_id: int,
    conversation_id: int,
    db: Session = Depends(get_db),
    business: Business = Depends(get_business_or_404),
    _: User = Depends(get_business_membership),
):
    """Get a single conversation with full message history."""
    conv = (
        db.query(ConversationModel)
        .filter(
            ConversationModel.id == conversation_id,
            ConversationModel.business_id == business_id,
        )
        .first()
    )
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    return conv


# ---- Business-scoped Appointments ----


@router.get("/{business_id}/appointments", response_model=List[AppointmentSchema])
def list_business_appointments(
    business_id: int,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    business: Business = Depends(get_business_or_404),
    _: User = Depends(get_current_user),
):
    """List appointments for this business."""
    appointments = (
        db.query(AppointmentModel)
        .filter(AppointmentModel.business_id == business_id)
        .offset(skip)
        .limit(limit)
        .order_by(AppointmentModel.start_time)
        .all()
    )
    return appointments


@router.post("/{business_id}/appointments", response_model=AppointmentSchema)
def create_business_appointment(
    business_id: int,
    payload: AppointmentCreate,
    force: bool = False,
    db: Session = Depends(get_db),
    business: Business = Depends(get_business_or_404),
    current_user: User = Depends(get_current_user),
):
    """Create an appointment for this business. Returns 409 if the slot conflicts with existing appointments or calendar events (use ?force=true to create anyway)."""
    conflicts = get_calendar_conflicts(db, business_id, payload.start_time, payload.end_time)
    if conflicts and not force:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "The requested time conflicts with an existing appointment or calendar event.",
                "conflicts": conflicts,
            },
        )
    appointment = AppointmentModel(
        business_id=business_id,
        title=payload.title,
        description=payload.description,
        start_time=payload.start_time,
        end_time=payload.end_time,
        customer_id=payload.customer_id,
        service_id=payload.service_id,
        status=payload.status,
        source=payload.source,
        user_id=current_user.id,
    )
    db.add(appointment)
    db.commit()
    db.refresh(appointment)
    return appointment


@router.get("/{business_id}/appointments/{appointment_id}", response_model=AppointmentSchema)
def get_business_appointment(
    business_id: int,
    appointment_id: int,
    db: Session = Depends(get_db),
    business: Business = Depends(get_business_or_404),
    _: User = Depends(get_current_user),
):
    """Get an appointment by id (must belong to this business)."""
    appointment = (
        db.query(AppointmentModel)
        .filter(
            AppointmentModel.id == appointment_id,
            AppointmentModel.business_id == business_id,
        )
        .first()
    )
    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment not found",
        )
    return appointment


@router.put("/{business_id}/appointments/{appointment_id}", response_model=AppointmentSchema)
def update_business_appointment(
    business_id: int,
    appointment_id: int,
    payload: AppointmentUpdate,
    db: Session = Depends(get_db),
    business: Business = Depends(get_business_or_404),
    _: User = Depends(get_current_user),
):
    """Update an appointment (must belong to this business)."""
    appointment = (
        db.query(AppointmentModel)
        .filter(
            AppointmentModel.id == appointment_id,
            AppointmentModel.business_id == business_id,
        )
        .first()
    )
    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment not found",
        )
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(appointment, k, v)
    db.commit()
    db.refresh(appointment)
    return appointment


@router.delete("/{business_id}/appointments/{appointment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_business_appointment(
    business_id: int,
    appointment_id: int,
    db: Session = Depends(get_db),
    business: Business = Depends(get_business_or_404),
    _: User = Depends(get_current_user),
):
    """Delete an appointment (must belong to this business)."""
    appointment = (
        db.query(AppointmentModel)
        .filter(
            AppointmentModel.id == appointment_id,
            AppointmentModel.business_id == business_id,
        )
        .first()
    )
    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment not found",
        )
    db.delete(appointment)
    db.commit()
    return None


# ---- Voice (Twilio webhook URL for configuration) ----
@router.get("/{business_id}/voice/webhook-url")
def get_voice_webhook_url(
    business_id: int,
    business: Business = Depends(get_business_or_404),
    _: User = Depends(get_current_user),
):
    """Return the Twilio webhook URL for this business. Configure this in Twilio: A Call Comes In -> Webhook."""
    from app.core.config import settings
    base = (getattr(settings, "VOICE_WEBHOOK_BASE_URL", None) or "").rstrip("/") or "http://localhost:8000"
    url = f"{base}/api/voice/incoming?business_id={business_id}"
    return {"webhook_url": url}


# ---- Intake Forms ----
@router.post("/{business_id}/intake/forms", response_model=IntakeFormSchema)
def create_intake_form(
    business_id: int,
    payload: IntakeFormCreate,
    db: Session = Depends(get_db),
    business: Business = Depends(get_business_or_404),
    _: User = Depends(get_current_user),
):
    """Create an intake form for the business."""
    form = IntakeFormModel(
        business_id=business_id,
        name=payload.name,
        form_type=payload.form_type,
        questions=payload.questions,
        is_active=payload.is_active,
    )
    db.add(form)
    db.commit()
    db.refresh(form)
    return form


@router.get("/{business_id}/intake/forms", response_model=List[IntakeFormSchema])
def list_intake_forms(
    business_id: int,
    db: Session = Depends(get_db),
    business: Business = Depends(get_business_or_404),
    _: User = Depends(get_current_user),
):
    """List all intake forms for the business."""
    forms = db.query(IntakeFormModel).filter(IntakeFormModel.business_id == business_id).all()
    return forms


@router.get("/{business_id}/intake/forms/{form_id}", response_model=IntakeFormSchema)
def get_intake_form(
    business_id: int,
    form_id: int,
    db: Session = Depends(get_db),
    business: Business = Depends(get_business_or_404),
    _: User = Depends(get_current_user),
):
    """Get a single intake form."""
    form = (
        db.query(IntakeFormModel)
        .filter(
            IntakeFormModel.id == form_id,
            IntakeFormModel.business_id == business_id,
        )
        .first()
    )
    if not form:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Intake form not found")
    return form


@router.put("/{business_id}/intake/forms/{form_id}", response_model=IntakeFormSchema)
def update_intake_form(
    business_id: int,
    form_id: int,
    payload: IntakeFormUpdate,
    db: Session = Depends(get_db),
    business: Business = Depends(get_business_or_404),
    _: User = Depends(get_current_user),
):
    """Update an intake form."""
    form = (
        db.query(IntakeFormModel)
        .filter(
            IntakeFormModel.id == form_id,
            IntakeFormModel.business_id == business_id,
        )
        .first()
    )
    if not form:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Intake form not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(form, k, v)
    db.commit()
    db.refresh(form)
    return form


@router.delete("/{business_id}/intake/forms/{form_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_intake_form(
    business_id: int,
    form_id: int,
    db: Session = Depends(get_db),
    business: Business = Depends(get_business_or_404),
    _: User = Depends(get_current_user),
):
    """Delete an intake form."""
    form = (
        db.query(IntakeFormModel)
        .filter(
            IntakeFormModel.id == form_id,
            IntakeFormModel.business_id == business_id,
        )
        .first()
    )
    if not form:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Intake form not found")
    db.delete(form)
    db.commit()
    return None


# ---- Intake Submissions ----
@router.post("/{business_id}/intake/submissions", response_model=IntakeSubmissionSchema)
def create_intake_submission(
    business_id: int,
    payload: IntakeSubmissionCreate,
    db: Session = Depends(get_db),
    business: Business = Depends(get_business_or_404),
    _: User = Depends(get_current_user),
):
    """Submit an intake form (customer_id optional for new customers)."""
    form = (
        db.query(IntakeFormModel)
        .filter(
            IntakeFormModel.id == payload.intake_form_id,
            IntakeFormModel.business_id == business_id,
        )
        .first()
    )
    if not form:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Intake form not found")
    submission = IntakeSubmissionModel(
        business_id=business_id,
        customer_id=payload.customer_id,
        intake_form_id=payload.intake_form_id,
        responses=payload.responses,
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)
    return submission


@router.get("/{business_id}/intake/submissions", response_model=List[IntakeSubmissionWithForm])
def list_intake_submissions(
    business_id: int,
    status_filter: Optional[str] = None,
    form_id: Optional[int] = None,
    db: Session = Depends(get_db),
    business: Business = Depends(get_business_or_404),
    _: User = Depends(get_current_user),
):
    """List intake submissions; optional status and form_id filters."""
    q = (
        db.query(IntakeSubmissionModel)
        .filter(IntakeSubmissionModel.business_id == business_id)
        .join(IntakeFormModel, IntakeSubmissionModel.intake_form_id == IntakeFormModel.id)
    )
    if status_filter:
        q = q.filter(IntakeSubmissionModel.status == status_filter)
    if form_id is not None:
        q = q.filter(IntakeSubmissionModel.intake_form_id == form_id)
    subs = q.order_by(IntakeSubmissionModel.submitted_at.desc()).all()
    out = []
    for s in subs:
        d = IntakeSubmissionWithForm.model_validate(s)
        d.form_name = s.intake_form.name
        out.append(d)
    return out


@router.get("/{business_id}/intake/submissions/{submission_id}", response_model=IntakeSubmissionSchema)
def get_intake_submission(
    business_id: int,
    submission_id: int,
    db: Session = Depends(get_db),
    business: Business = Depends(get_business_or_404),
    _: User = Depends(get_current_user),
):
    """Get a single intake submission."""
    sub = (
        db.query(IntakeSubmissionModel)
        .filter(
            IntakeSubmissionModel.id == submission_id,
            IntakeSubmissionModel.business_id == business_id,
        )
        .first()
    )
    if not sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Intake submission not found")
    return sub


@router.patch("/{business_id}/intake/submissions/{submission_id}", response_model=IntakeSubmissionSchema)
def update_intake_submission(
    business_id: int,
    submission_id: int,
    payload: IntakeSubmissionUpdate,
    db: Session = Depends(get_db),
    business: Business = Depends(get_business_or_404),
    current_user: User = Depends(get_current_user),
):
    """Update submission status (e.g. reviewed, archived); sets reviewed_at/reviewed_by when status=reviewed."""
    sub = (
        db.query(IntakeSubmissionModel)
        .filter(
            IntakeSubmissionModel.id == submission_id,
            IntakeSubmissionModel.business_id == business_id,
        )
        .first()
    )
    if not sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Intake submission not found")
    if payload.status is not None:
        sub.status = payload.status
        if payload.status == "reviewed":
            sub.reviewed_at = datetime.utcnow()
            sub.reviewed_by = current_user.id
    db.commit()
    db.refresh(sub)
    return sub


@router.get("/{business_id}/metrics/latency")
def get_business_latency_metrics(
    business_id: int,
    limit: int = 120,
    _: BusinessUser = Depends(get_business_membership),
):
    """Recent request durations for routes scoped to this business (from in-memory middleware samples)."""
    from app.middleware.request_timing import get_latency_metrics_for_business

    if limit < 1 or limit > 500:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="limit must be between 1 and 500",
        )
    return get_latency_metrics_for_business(business_id, limit=limit)
