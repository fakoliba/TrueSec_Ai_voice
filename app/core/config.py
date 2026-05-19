from pydantic_settings import BaseSettings
from pydantic import computed_field
from typing import Optional, List
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file (optional; Cloud Run uses env vars directly)
env_path = Path('.') / '.env'
if env_path.exists():
    load_dotenv(dotenv_path=env_path)


def _int_env(name: str, default: int) -> int:
    """Parse an integer env var safely (avoids crash on invalid value)."""
    try:
        return int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


class Settings(BaseSettings):
    # Application settings
    APP_NAME: str = "AI Voice Assistant"
    DEBUG: bool = os.getenv("DEBUG", "False").lower() in ("true", "1", "t")
    # When False, forgot-password never returns reset_token in JSON (use email link in production).
    EXPOSE_PASSWORD_RESET_TOKEN: bool = os.getenv("EXPOSE_PASSWORD_RESET_TOKEN", "").lower() in (
        "true",
        "1",
        "t",
    )
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-here")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = _int_env("ACCESS_TOKEN_EXPIRE_MINUTES", 10080)  # 7 days default
    
    # Google OAuth2 settings
    GOOGLE_CLIENT_ID: Optional[str] = os.getenv("GOOGLE_CLIENT_ID")
    GOOGLE_CLIENT_SECRET: Optional[str] = os.getenv("GOOGLE_CLIENT_SECRET")
    GOOGLE_REDIRECT_URI: str = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/auth/google/callback")
    
    # OpenAI settings
    OPENAI_API_KEY: Optional[str] = os.getenv("OPENAI_API_KEY")

    # ElevenLabs (voice STT/TTS for Twilio — optional; used when business plan allows)
    ELEVENLABS_API_KEY: Optional[str] = os.getenv("ELEVENLABS_API_KEY")
    # Default TTS voice (ElevenLabs voice ID, e.g. Rachel)
    ELEVENLABS_DEFAULT_VOICE_ID: str = os.getenv(
        "ELEVENLABS_DEFAULT_VOICE_ID", "21m00Tcm4TlvDq8ikWAM"
    )
    # Comma-separated extra voice IDs shown for premium plans (in addition to default)
    ELEVENLABS_PREMIUM_VOICE_IDS: str = os.getenv("ELEVENLABS_PREMIUM_VOICE_IDS", "")
    ELEVENLABS_STT_MODEL_ID: str = os.getenv("ELEVENLABS_STT_MODEL_ID", "scribe_v1")
    ELEVENLABS_TTS_MODEL_ID: str = os.getenv("ELEVENLABS_TTS_MODEL_ID", "eleven_multilingual_v2")

    # Twilio (voice calls)
    TWILIO_ACCOUNT_SID: Optional[str] = os.getenv("TWILIO_ACCOUNT_SID")
    TWILIO_AUTH_TOKEN: Optional[str] = os.getenv("TWILIO_AUTH_TOKEN")
    TWILIO_PHONE_NUMBER: Optional[str] = os.getenv("TWILIO_PHONE_NUMBER")
    # Base URL for voice webhooks (must be publicly reachable by Twilio), e.g. https://your-api.example.com
    VOICE_WEBHOOK_BASE_URL: str = os.getenv("VOICE_WEBHOOK_BASE_URL", "http://localhost:8000")
    
    # Database: PostgreSQL only (all data including users/logins stored here)
    # Use postgresql+psycopg:// for psycopg (v3); postgresql:// for psycopg2
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg://postgres:postgres@localhost:5432/ai_support_db",
    )
    
    # Google Calendar scopes (stored as comma-separated str so env is not JSON-parsed)
    GOOGLE_CALENDAR_SCOPES: str = "https://www.googleapis.com/auth/calendar,https://www.googleapis.com/auth/calendar.events"

    # Microsoft Outlook / Graph API
    MICROSOFT_CLIENT_ID: Optional[str] = os.getenv("MICROSOFT_CLIENT_ID")
    MICROSOFT_CLIENT_SECRET: Optional[str] = os.getenv("MICROSOFT_CLIENT_SECRET")
    MICROSOFT_TENANT_ID: str = os.getenv("MICROSOFT_TENANT_ID", "common")
    MICROSOFT_GRAPH_SCOPES: str = os.getenv(
        "MICROSOFT_GRAPH_SCOPES",
        "https://graph.microsoft.com/Calendars.ReadWrite offline_access",
    )

    # Apple iCloud / CalDAV (app-specific password)
    CALDAV_SERVER_URL: str = os.getenv("CALDAV_SERVER_URL", "https://caldav.icloud.com")

    # Celery (background jobs)
    CELERY_BROKER_URL: str = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
    CELERY_RESULT_BACKEND: str = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/1")

    # Voice call state (optional). If set, Twilio voice state and TTS cache use Redis for multi-instance and persistence.
    REDIS_URL: Optional[str] = os.getenv("REDIS_URL")
    
    # CORS origins (str so env is not JSON-parsed; use .cors_origins_list for list)
    BACKEND_CORS_ORIGINS: str = "http://localhost:3000,http://localhost:8000"

    # Frontend base URL (e.g. https://frontend-xxx.run.app). When set, calendar OAuth callbacks
    # redirect to {FRONTEND_URL}/dashboard/{business_id}/calendars so the user lands on the calendars page.
    FRONTEND_URL: Optional[str] = os.getenv("FRONTEND_URL")

    # Security
    ALLOWED_HOSTS: str = "*"
    # When False, POST /api/auth/register returns 403. You create the first admin manually (e.g. via DB or a one-off script).
    ALLOW_PUBLIC_REGISTRATION: bool = os.getenv("ALLOW_PUBLIC_REGISTRATION", "false").lower() in ("true", "1", "t")

    # Voice dashboard: max TTS preview requests per user per business per minute (in-memory limiter)
    VOICE_PREVIEW_RATE_PER_MINUTE: int = _int_env("VOICE_PREVIEW_RATE_PER_MINUTE", 30)

    @computed_field
    @property
    def cors_origins_list(self) -> List[str]:
        return [s.strip() for s in self.BACKEND_CORS_ORIGINS.split(",") if s.strip()]

    @computed_field
    @property
    def allowed_hosts_list(self) -> List[str]:
        return [s.strip() for s in self.ALLOWED_HOSTS.split(",") if s.strip()]

    @computed_field
    @property
    def google_calendar_scopes_list(self) -> List[str]:
        return [s.strip() for s in self.GOOGLE_CALENDAR_SCOPES.split(",") if s.strip()]

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"

# Create settings instance
settings = Settings()
