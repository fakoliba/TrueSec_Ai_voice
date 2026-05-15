# Changelog — 2026-03-05

Summary of changes made in this session.

---

## 1. Business settings (hours + services) in the UI

**Backend**
- **Schemas** (`app/schemas/business.py`): `ServiceBase`, `ServiceCreate`, `ServiceUpdate`, `ServiceResponse`; `ServiceResponse` has `field_validator` for `price` (Decimal → float).
- **Endpoints** (`app/api/endpoints/businesses.py`):  
  `GET/POST /api/businesses/{id}/services`, `GET/PUT/DELETE /api/businesses/{id}/services/{service_id}`.

**Frontend**
- **API** (`frontend/src/lib/api.ts`): `BusinessSettings`, `Service` types; `getBusinessSettings`, `updateBusinessSettings`, `listBusinessServices`, `createBusinessService`, `updateBusinessService`, `deleteBusinessService`.
- **Settings page** (`frontend/src/app/dashboard/[id]/settings/page.tsx`): Business hours form (Mon–Sun, open/close times); services list with add/edit/delete (name, description, duration, price, is_active).
- **Dashboard** (`frontend/src/app/dashboard/[id]/page.tsx`): "Business hours" → "Business hours & services", link to `/dashboard/[id]/settings`.

---

## 2. Google Calendar integration flow (documentation only)

- **New doc** `docs/GOOGLE_CALENDAR_INTEGRATION_FLOW.md`: High-level flow, Mermaid flowchart, sequence diagram, prerequisites (OAuth client, redirect URI, env vars), step-by-step, data model, and `FRONTEND_URL` for post-OAuth redirect.

---

## 3. Calendar Connect flow in the dashboard

**Issue:** "Connect" for Calendar went to the business edit page instead of a calendar-connect flow.

**Backend**  
- No code changes (connect/callback endpoints already existed).

**Frontend**
- **API** (`frontend/src/lib/api.ts`): `getGoogleCalendarConnectUrl(businessId)`, `getOutlookCalendarConnectUrl(businessId)`.
- **Calendars page** (`frontend/src/app/dashboard/[id]/calendars/page.tsx`): Lists connected calendars; "Connect Google Calendar" and "Connect Outlook Calendar" redirect to OAuth.
- **Dashboard** (`frontend/src/app/dashboard/[id]/page.tsx`): Calendar row "Connect" → `/dashboard/[id]/calendars`; when connected, show "Connected" + "Manage" → same page.

---

## 4. Backend builds success URL for calendar OAuth (FRONTEND_URL)

**Backend**
- **Config** (`app/core/config.py`): `FRONTEND_URL: Optional[str]`.
- **Callbacks** (`app/api/endpoints/businesses.py`): Google and Outlook calendar OAuth callbacks redirect to `{FRONTEND_URL}/dashboard/{business_id}/calendars` when `FRONTEND_URL` is set; otherwise keep `CALENDAR_CONNECT_SUCCESS_URL` or `/docs`.
- **Env** (`cloud-run.env`): `FRONTEND_URL=https://frontend-web-1021282359242.us-central1.run.app`.
- **Docs** (`docs/GOOGLE_CALENDAR_INTEGRATION_FLOW.md`): Prerequisites and step-by-step updated for `FRONTEND_URL`.

---

## 5. Restrict “Create Business” to admin/owner

**Backend**
- **User schema** (`app/schemas/user.py`): `UserInDBBase` (and thus `User`) includes `role`.
- **User model** (`app/models/user.py`): Comment updated for role values (super_admin, admin, owner, staff, customer).
- **Auth service** (`app/services/auth.py`): First user on platform gets `role="admin"` in `create_user`.
- **Businesses API** (`app/api/endpoints/businesses.py`): `create_business` returns 403 if `current_user.role not in ("super_admin", "admin", "owner")`.

**Frontend**
- **API** (`frontend/src/lib/api.ts`): `UserProfile` includes `role`; `canCreateBusiness(profile)`.
- **Dashboard** (`frontend/src/app/dashboard/page.tsx`): Fetches profile; shows "Create business" only when `canCreateBusiness(profile)`; otherwise "Contact your administrator to create a new business" (header and empty state).

---

## 6. Platform user management (admin can set user roles)

**Backend**
- **Auth service** (`app/services/auth.py`): `get_user_by_id(db, user_id)`, `set_user_role(db, user_id, new_role)`.
- **Schema** (`app/schemas/user.py`): `SetUserRoleRequest(role=str)`.
- **Auth API** (`app/api/endpoints/auth.py`): `_require_platform_admin` dependency; `GET /api/auth/users` (list users, admin only); `PATCH /api/auth/users/{user_id}/role` (admin only; only super_admin can set role to super_admin). All user response models use `UserSchema` (Pydantic) not ORM `User`.

**Frontend**
- **API** (`frontend/src/lib/api.ts`): `canManagePlatformUsers(profile)`, `PlatformUser` type, `listPlatformUsers()`, `setPlatformUserRole(userId, role)`.
- **Account page** (`frontend/src/app/account/page.tsx`): "Manage platform users" section (when `canManagePlatformUsers(profile)`): table (email, name, role) and role dropdown; changing role calls API; super_admin-only option "super_admin" hidden for non–super_admin admins.

---

## 7. Env var update steps (documentation)

- Steps for updating Cloud Run env vars (CLI and Console) were provided in the conversation; no new file added.

---

## 8. CORS / “Cannot reach the API” and env

- **Login error** (`frontend/src/lib/api.ts`): Message now includes the API URL being called (e.g. `Cannot reach the API at https://...`).
- **Env file** (`cloud-run.env`): Duplicate `DATABASE_URL` line removed.
- User was instructed to set `BACKEND_CORS_ORIGINS` and/or apply full env with `--env-vars-file=cloud-run.env`.

---

## 9. Service Unavailable (503) troubleshooting

- **New doc** `docs/TROUBLESHOOT_SERVICE_UNAVAILABLE.md`: How to see which service fails, how to read Cloud Run logs, common causes (backend vs frontend), and re-applying backend env from `cloud-run.env`.

---

## 10. Backend config and startup resilience

- **Config** (`app/core/config.py`): `_int_env()` helper; `ACCESS_TOKEN_EXPIRE_MINUTES` set via `_int_env` to avoid crash on invalid env; `load_dotenv` only if `.env` exists.
- **Main** (`app/main.py`): "Loading application..." and "Application ready" log lines.

---

## 11. Backend crash: FastAPI response_model (User vs UserSchema)

**Issue:** `FastAPIError: Invalid args for response field! ... <class 'app.models.user.User'> is a valid Pydantic field type` — FastAPI was using the SQLAlchemy User model for response_model.

**Fix** (`app/api/endpoints/auth.py`):
- Import Pydantic user as `User as UserSchema`.
- All routes that return user(s) use `UserSchema`: register, users/me GET/PATCH, users list, users/{id}/role PATCH.

---

## 12. Cloud Run startup TCP probe failure

**Issue:** "Default STARTUP TCP probe failed ... port 8080 ... Connection failed with status CANCELLED" — container not listening on 8080 in time.

**Backend**
- **Main** (`app/main.py`): DB table creation moved from import-time to a **lifespan** handler; `create_all` runs in a **background daemon thread** so the app yields immediately and uvicorn can bind to PORT (8080) without waiting for DB.
- **Cloud Build** (`cloudbuild.yaml`): `--cpu-boost` added to `gcloud run deploy` for the backend so the container gets full CPU during startup.

---

## Files touched (summary)

| Area        | Files |
|------------|--------|
| Backend    | `app/main.py`, `app/core/config.py`, `app/schemas/user.py`, `app/schemas/business.py`, `app/models/user.py`, `app/services/auth.py`, `app/api/endpoints/auth.py`, `app/api/endpoints/businesses.py`, `cloudbuild.yaml`, `cloud-run.env` |
| Frontend   | `frontend/src/lib/api.ts`, `frontend/src/app/dashboard/page.tsx`, `frontend/src/app/dashboard/[id]/page.tsx`, `frontend/src/app/dashboard/[id]/settings/page.tsx`, `frontend/src/app/dashboard/[id]/calendars/page.tsx`, `frontend/src/app/account/page.tsx` |
| Docs       | `docs/GOOGLE_CALENDAR_INTEGRATION_FLOW.md`, `docs/TROUBLESHOOT_SERVICE_UNAVAILABLE.md`, `docs/CHANGELOG_2026-03-05.md` (this file) |

---

## Deploy commands (reference)

```bash
# Backend
cd /Users/cherif/Desktop/backend
gcloud builds submit --config=cloudbuild.yaml . --project=truesecai-app

# Frontend
gcloud builds submit --config=cloudbuild-frontend.yaml . --project=truesecai-app

# Backend env (if needed)
gcloud run services update backend-api --region=us-central1 --project=truesecai-app --env-vars-file=cloud-run.env
```
