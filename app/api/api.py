from fastapi import APIRouter

from app.api.endpoints import auth, appointments, businesses, customers, google_oauth, platform, voice

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(platform.router, prefix="/platform", tags=["platform"])
api_router.include_router(google_oauth.router, prefix="/auth/google", tags=["google-oauth"])
api_router.include_router(businesses.router, prefix="/businesses", tags=["businesses"])
api_router.include_router(customers.router, prefix="/businesses", tags=["customers"])
api_router.include_router(appointments.router, prefix="", tags=["appointments"])
api_router.include_router(voice.router, prefix="/voice", tags=["voice"])