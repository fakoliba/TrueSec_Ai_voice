# Celery & Calendar Sync

Background jobs use **Celery** with **Redis** as the broker.

## Setup

1. **Install Redis** (e.g. `brew install redis` on macOS, or run via Docker).
2. **Start Redis:** `redis-server` (or `docker run -p 6379:6379 redis`).
3. **Environment** (optional in `.env`):
   - `CELERY_BROKER_URL=redis://localhost:6379/0`
   - `CELERY_RESULT_BACKEND=redis://localhost:6379/1`

## Run Celery

**Worker** (processes tasks):

```bash
cd /path/to/backend
source venv/bin/activate
celery -A app.celery_app worker -l info
```

**Beat** (schedules periodic tasks; run in a second terminal):

```bash
celery -A app.celery_app beat -l info
```

Or run worker and beat together:

```bash
celery -A app.celery_app worker --beat -l info
```

## Tasks

- **sync_business_calendar(business_id)** – Sync one business’s primary calendar into the cache (used for conflict detection).
- **sync_all_calendars()** – Runs every 15 minutes; syncs all businesses that have a connected calendar.

## API

- **POST** `/api/businesses/{id}/calendars/sync` – Trigger a one-off sync for that business (requires worker running).
- **POST** `/api/businesses/{id}/appointments` – Creating an appointment checks for conflicts (appointments + cached calendar events). If there is a conflict, the API returns **409** with `conflicts` in the body unless you pass **?force=true**.

## Cache table

`calendar_event_cache` stores events fetched from Google/Outlook/Apple. It is populated by the sync task and used for conflict detection when creating appointments.
