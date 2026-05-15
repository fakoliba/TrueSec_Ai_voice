# Troubleshooting "Service Unavailable" (503) on Cloud Run

## 0. DATABASE_URL and Cloud SQL (root cause of startup failures)

**Important:** The backend was failing to start because of an incorrect or unreachable database configuration.

- **Cloud SQL instance** vs **database name:** The instance might be named `truesecai-db` (from `gcloud sql instances list`). The **database name** in `DATABASE_URL` is the name of the database *inside* that instance (e.g. `ai_support_db` or `truesecai_db`), not the instance name.
- **Correct format:** `postgresql+psycopg://USER:PASSWORD@HOST:PORT/DATABASE_NAME`
  - `HOST` = instance IP (e.g. `35.184.212.212`) or Cloud SQL Proxy host.
  - `DATABASE_NAME` = the actual database you created in the instance (e.g. `truesecai_db`). If you use `ai_support_db`, that database must exist inside the instance.
- **If the database name is wrong:** Create the database in Cloud SQL (e.g. `truesecai_db`) or update `DATABASE_URL` to the existing database name, then update the Cloud Run service env and redeploy.
- **Optional:** Enable Compute Engine API for network troubleshooting: [Enable API](https://console.developers.google.com/apis/api/compute.googleapis.com/overview?project=truesecai-app).

---

## 1. See which service is failing

- **Backend:** Open `https://backend-api-1021282359242.us-central1.run.app/health` in a browser. If you get 503 or the page doesn’t load, the **backend** is failing.
- **Frontend:** Open `https://frontend-web-1021282359242.us-central1.run.app`. If you get 503 there, the **frontend** is failing.

---

## 2. Check logs (backend or frontend)

Replace `SERVICE_NAME` with `backend-api` or `frontend-web`.

**Recent logs in terminal:**

```bash
gcloud run services logs read SERVICE_NAME \
  --region=us-central1 \
  --project=truesecai-app \
  --limit=50
```

**Or in Google Cloud Console:**

1. Go to [Cloud Run](https://console.cloud.google.com/run?project=truesecai-app).
2. Click the service (`backend-api` or `frontend-web`).
3. Open the **Logs** tab and look for errors (Python tracebacks, “Failed to bind”, “connection refused”, etc.).

---

## 3. Common causes and fixes

### Backend

| Cause | What to do |
|-------|------------|
| **Crash on startup** (e.g. missing env, bad DB URL) | Check logs for the traceback. Ensure `DATABASE_URL`, `SECRET_KEY`, and other required vars are set and valid. |
| **Env vars wrong after `--env-vars-file`** | Ensure `cloud-run.env` has one `KEY=VALUE` per line, no spaces around `=`, no duplicate keys. Values with `=` are OK (only the first `=` is the separator). |
| **Database unreachable** | Confirm Cloud SQL (or your DB) allows connections from Cloud Run (authorized networks / Cloud SQL Auth Proxy if needed). |
| **Startup too slow** | Increase startup probe: e.g. `--cpu-boost` or increase startup timeout in the service. |

### Frontend

| Cause | What to do |
|-------|------------|
| **Node/Next crash** | Check logs for the exact error. |
| **Port not 8080** | Cloud Run sets `PORT=8080`; the Dockerfile/start script must use `PORT`. |

---

## 4. Re-apply backend env vars (safe format)

If you’re not sure env vars were applied correctly, run:

```bash
cd /Users/cherif/Desktop/backend
gcloud run services update backend-api \
  --region=us-central1 \
  --project=truesecai-app \
  --env-vars-file=cloud-run.env
```

Then check logs again. If the service still returns 503, the log output will point to the real error (e.g. config, DB, or import crash).

---

## 5. Re-adding platform user management (GET /users, PATCH /users/{id}/role)

When re-implementing admin-only “list users” and “set user role”:

- **Do not use `response_model=List[User]`** with `User` from the same module as the ORM: FastAPI can resolve `User` to the SQLAlchemy model and raise `FastAPIError: Invalid args for response field! ... is a valid Pydantic field type`.
- **Use a dedicated Pydantic schema** for responses, e.g. `UserSchema` or `UserResponse` (from `app.schemas.user`), and use `response_model=List[UserSchema]` and `response_model=UserSchema` so the response model is always the Pydantic schema, never the ORM model.
- **Keep DB init non-blocking:** The app uses a lifespan that runs `create_all` in a background thread so the server binds to `PORT` quickly for Cloud Run’s startup probe. Do not block startup on DB or heavy work.
