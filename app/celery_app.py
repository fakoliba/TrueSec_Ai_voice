"""
Celery application for background jobs (calendar sync, etc.).
Run worker: celery -A app.celery_app worker -l info
Run beat (scheduler): celery -A app.celery_app beat -l info
"""
from celery import Celery
from celery.schedules import crontab

from app.core.config import settings

celery_app = Celery(
    "ai_support_agent",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.tasks.calendar_sync"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

# Periodic tasks: sync calendars every 15 minutes
celery_app.conf.beat_schedule = {
    "sync-all-calendars": {
        "task": "app.tasks.calendar_sync.sync_all_calendars",
        "schedule": 900.0,  # 15 minutes in seconds
    },
}
