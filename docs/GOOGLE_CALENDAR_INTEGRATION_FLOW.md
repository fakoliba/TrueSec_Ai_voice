# Google Calendar Integration Flow — New Business

This document explains **how a new business connects their Google Calendar** to the app: plan, flow diagram, and step-by-step.

---

## High-level flow

1. **Business exists** in the app (created, has `business_id`).
2. **Owner or staff** opens the business in the dashboard and chooses to connect a calendar.
3. **App** starts the Google OAuth flow and redirects the user to Google to sign in and grant calendar access.
4. **Google** redirects back to the app with an authorization code.
5. **App** exchanges the code for tokens and saves a **CalendarIntegration** record for that business.
6. **Ongoing**: The app uses the stored tokens to read/write calendar events and optionally syncs events into a cache for availability.

---

## Flow diagram

```mermaid
flowchart TB
    subgraph Business setup
        A[New business created in app] --> B[Business has business_id]
    end

    subgraph User initiates connect
        B --> C[User opens business dashboard]
        C --> D[User clicks Connect Calendar / Connect Google]
        D --> E[Frontend calls GET /api/businesses/{id}/calendars/google/connect]
    end

    subgraph Backend starts OAuth
        E --> F[Backend: get Google OAuth URL with redirect_uri and state=business_id]
        F --> G[Backend returns authorization_url]
        G --> H[Frontend redirects user to authorization_url]
    end

    subgraph Google consent
        H --> I[User signs in to Google if needed]
        I --> J[User grants calendar scope]
        J --> K[Google redirects to redirect_uri with ?code=...&state=business_id]
    end

    subgraph Backend completes OAuth
        K --> L[GET /api/businesses/{id}/calendars/google/callback?code=...]
        L --> M[Backend exchanges code for access_token + refresh_token]
        M --> N[Create or update CalendarIntegration for this business_id]
        N --> O[Store tokens, set provider=google, sync_enabled=true]
        O --> P[Redirect user to success URL e.g. dashboard or CALENDAR_CONNECT_SUCCESS_URL]
    end

    subgraph After connection
        P --> Q[Calendar is now connected for the business]
        Q --> R[App can list/create events on that calendar]
        Q --> S[Celery sync job can pull events into CalendarEventCache]
    end
```

---

## Sequence diagram (OAuth + persistence)

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Google
    participant DB

    User->>Frontend: Open business → Connect calendar
    Frontend->>Backend: GET /businesses/{id}/calendars/google/connect
    Backend->>Backend: Build redirect_uri = base_url + /api/businesses/{id}/calendars/google/callback
    Backend->>Backend: get_authorization_url(redirect_uri, state=business_id)
    Backend-->>Frontend: { authorization_url }
    Frontend->>User: Redirect to authorization_url
    User->>Google: Sign in & grant calendar access
    Google->>User: Redirect to redirect_uri?code=...&state=...
    User->>Backend: GET /businesses/{id}/calendars/google/callback?code=...&state=...
    Backend->>Google: Exchange code for tokens (access_token, refresh_token)
    Google-->>Backend: Tokens
    Backend->>DB: Create or update CalendarIntegration(business_id, provider=google, tokens)
    Backend->>User: Redirect to success URL
    User->>Frontend: Land on dashboard; calendar shows as Connected
```

---

## Prerequisites (one-time)

| Item | Description |
|------|-------------|
| **Google Cloud project** | Create a project and enable the **Google Calendar API**. |
| **OAuth 2.0 credentials** | In APIs & Services → Credentials, create **OAuth 2.0 Client ID** (Web application). Note **Client ID** and **Client secret**. |
| **Authorized redirect URI** | Add the exact callback URL to the OAuth client. For Cloud Run backend: `https://<backend-url>/api/businesses/<business_id>/calendars/google/callback`. Because `business_id` varies, use a path pattern if your provider allows, or register the production base: `https://backend-api-xxxx.run.app/api/businesses/` and ensure the full path is under that base. (Some setups use a single redirect URI with a wildcard or register multiple IDs.) |
| **Backend env vars** | Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and optionally `GOOGLE_REDIRECT_URI`. Scopes are configured in app settings (e.g. `https://www.googleapis.com/auth/calendar.events`). |
| **FRONTEND_URL** (optional) | Set to your frontend base URL (e.g. `https://frontend-xxx.run.app`). When set, after OAuth the backend redirects to `{FRONTEND_URL}/dashboard/{business_id}/calendars` so the user lands on the calendars page for that business. If unset, redirect uses `CALENDAR_CONNECT_SUCCESS_URL` or backend `/docs`. |

---

## Step-by-step (what happens in the app)

### 1. User wants to connect Google Calendar

- User is on the **business detail** or **edit** page for a business.
- They click a “Connect” or “Connect Google Calendar” action.
- Frontend calls: **`GET /api/businesses/{business_id}/calendars/google/connect`** (with auth).

### 2. Backend returns the OAuth URL

- Backend builds **redirect_uri**:  
  `{request.base_url}/api/businesses/{business_id}/calendars/google/callback`  
  Example: `https://backend-api-xxx.run.app/api/businesses/1/calendars/google/callback`
- Backend uses the Google provider to get **authorization_url** (with `redirect_uri`, `state=business_id`, scopes, `access_type=offline`, `prompt=consent`).
- Response: `{ "authorization_url": "https://accounts.google.com/o/oauth2/auth?..." }`.

### 3. User is sent to Google

- Frontend redirects the browser to **authorization_url**.
- User signs in to Google (if needed) and consents to calendar access.
- Google redirects the browser to **redirect_uri** with query params: **`code`** (one-time) and **`state`** (business_id).

### 4. Callback: exchange code and save integration

- Browser hits: **`GET /api/businesses/{business_id}/calendars/google/callback?code=...&state=...`**
- Backend:
  - Uses the same **redirect_uri** as in step 2.
  - Calls Google to **exchange `code` for tokens** (access_token, refresh_token, expiry).
  - Looks up or creates a **CalendarIntegration** row for this `business_id` and `provider='google'`.
  - Saves **access_token**, **refresh_token**, **token_expiry** (and optionally **calendar_id**, e.g. `"primary"**).
  - Sets **sync_enabled = true**; first integration for the business is marked **is_primary = true**.
- Backend responds with **HTTP 302** to a **success URL**. If `FRONTEND_URL` is set, the backend builds `{FRONTEND_URL}/dashboard/{business_id}/calendars` so the user lands on the calendars page; otherwise it uses `CALENDAR_CONNECT_SUCCESS_URL` or the API docs URL.

### 5. After connection

- **Listing events**: `GET /api/businesses/{business_id}/calendars/events` uses the primary Google integration’s tokens to call the Google Calendar API.
- **Creating appointments**: When the app creates an appointment, it can create an event on the business’s calendar using the same integration.
- **Availability**: Business hours + existing appointments + (optionally) calendar events from the integration are used to compute available slots.
- **Sync**: A Celery task (`sync_all_calendars` or `sync_business_calendar`) can pull events from the connected calendar into **CalendarEventCache** for conflict checks and faster availability.

---

## Data model (in app)

| Concept | Where it lives |
|--------|-----------------|
| Business | `businesses` table (id, name, …). |
| Calendar connection | **`calendar_integrations`**: `business_id`, `provider='google'`, `access_token`, `refresh_token`, `token_expiry`, `calendar_id`, `is_primary`, `sync_enabled`. |
| Cached events (optional) | **`calendar_event_cache`**: events synced from the integration for that business. |

One business can have multiple **CalendarIntegration** rows (e.g. Google + Outlook); **is_primary** and provider logic determine which one is used for “the” business calendar.

---

## Summary

- **New business** → has `business_id`.
- **Connect flow** → Frontend calls **connect** → user is sent to Google → Google redirects to **callback** with `code` → Backend exchanges code, saves **CalendarIntegration** for that business → user is redirected to success.
- **After that** → The app uses the stored tokens to read/write the business’s Google Calendar and optionally sync events into the cache for availability and conflict detection.

No code changes were made; this document is plan and explanation only.
