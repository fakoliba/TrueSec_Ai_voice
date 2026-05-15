# Plan: Admin-Only Business Creation, New User Creation, and Business Options in Dashboard

No code changes yet — this is a planning reference for implementation.

---

## 1. Restrict “Create Business” to Admin Accounts

### Goal
Only users with an **admin** (or equivalent) global role can create a new business. Regular users can still be added to existing businesses by owners/admins and use the app, but they cannot create a new business from scratch.

### Current state
- **User model** has `role` (e.g. `customer`, `business_owner`, `staff`). It is not currently enforced for “create business.”
- **POST /api/businesses/** allows any authenticated user to create a business and become its owner.

### Planned approach
- **Define “business creator” role:** e.g. require `User.role in ("admin", "business_owner", "super_admin")` to call `POST /api/businesses/`. Optionally allow the very first platform user or users with zero businesses to create one (onboarding).
- **Backend:** In `create_business` (or a dependency), check `current_user.role` and return `403 Forbidden` with a clear message if the user is not allowed to create businesses.
- **Frontend:** 
  - Hide or disable “Create business” for non-admin users (optional; backend still enforces).
  - Optionally show a message: “Contact your administrator to create a new business.”
- **Data / migration:** Decide default for `User.role` for new signups (e.g. `customer`). Existing users who should be able to create businesses need to be set to `admin` or `business_owner` (DB update or admin script).

### Open decisions
- Allow first-ever user or first business per user to bypass the check for a smoother onboarding?
- Naming: keep `business_owner` vs use only `admin` for “can create business”?

---

## 2. Dashboard: Option to Create a New User (and Add to Business)

### Goal
From the business dashboard, an owner/admin can **create a new user** (not only invite an existing one by email). That new user is automatically linked to the current business with a chosen role (e.g. staff or admin).

### Current state
- **Add user flow:** “Add team member” only works for **existing** users (email must already be registered). If the email is not found, API returns 404.
- There is no “create user + add to this business” flow in the UI or API.

### Planned approach

**Backend**
- **New endpoint (or extend existing):** e.g. `POST /api/businesses/{business_id}/users/invite` or `POST /api/businesses/{business_id}/users` with a body that can include:
  - `email`, `full_name`, `password` (for new user creation), and `role`.
  - If a user with that email already exists → add them to the business with the given role (current behavior).
  - If no user exists → create the user (same as register), then create the `BusinessUser` link with the given role.
- **Permissions:** Only `owner` or `admin` of the business can call this.
- **Validation:** Strong password rules, unique email; optional “invite” flow (e.g. temporary password + force change on first login) can be a later phase.

**Frontend**
- On the business detail page (e.g. under “Team members” / “Add team member”):
  - **Option A:** Single form with “Email, Full name, Password, Role” and a note: “If the user already exists, only the role is used; password is ignored.”
  - **Option B:** Two paths: “Invite existing user (by email)” vs “Create new user (email, name, password, role).”
- Show success/error messages (e.g. “User created and added to [Business] as [role]” or “User already exists; added to business.”).

### Open decisions
- Require email verification for new users created this way?
- Send a welcome email with login link or temporary password (later phase)?

---

## 3. Display Business Account Options in the Dashboard

### Goal
In the dashboard, **show the options a business can add or configure** for their account (features, integrations, settings). This is both informational and a path to configure them.

### Current state
- Business has: profile (name, type, contact, address, timezone), team members, AI chat, appointments, and possibly calendar/intake/voice settings in the backend.
- The dashboard does not clearly list “what you can turn on or configure” for the business.

### Planned approach

**Backend**
- No strict change required for “display”; existing endpoints for settings, calendar, etc. can be used.
- Optional: a small **“business features” or “account options”** endpoint, e.g. `GET /api/businesses/{id}/features` or include in `GET /api/businesses/{id}` a summary of what is enabled (e.g. `calendar_connected`, `voice_enabled`, `intake_forms_count`). This helps the UI show status and links.

**Frontend**
- **Dedicated section on the business dashboard** (e.g. “Account options” or “Features & integrations”):
  - **List of options** the business can add or configure, for example:
    - **AI voice / Twilio** – “Answer calls with AI.” Status: Connected / Not set up. Link to settings or docs.
    - **Calendar** – “Sync availability (Google, Outlook, Apple).” Status: Connected / Not connected. Link to connect flow.
    - **Business hours** – “Set opening hours and availability.” Link to hours/settings.
    - **Intake forms** – “Collect customer/patient intake.” Link to intake list or create.
    - **Appointments** – “View and manage appointments.” Link to appointments page.
    - **Team members** – “Add admins and staff.” Link to team section (already there).
  - Each row/card can show:
    - Name and short description.
    - Status (e.g. “Configured”, “Not set up”, “Connected”).
    - Primary action (e.g. “Set up”, “Connect”, “Edit”).
- Place this section on the **business detail page** (`/dashboard/[id]`) so it’s visible when viewing one business, or as a separate “Settings” or “Account options” subpage under that business.

### Open decisions
- Which options to show first (voice, calendar, hours, intake, team) and in what order.
- Whether to gate some options by subscription plan later (e.g. “Premium only”).

---

## 4. Suggested Implementation Order

1. **Restrict create business to admin** – Backend check + optional frontend hide/message. Quick and clear.
2. **Dashboard: display business options** – Frontend-only (or with a minimal “features” summary from API). Gives immediate value and clarity.
3. **Create new user from dashboard** – New/updated API for “create user + add to business,” then dashboard form (single or two-path as above).

---

## 5. Summary Table

| Item | Backend | Frontend |
|------|--------|----------|
| Only admin can create business | Check `User.role` in `POST /api/businesses/`; 403 if not allowed | Optionally hide “Create business” for non-admin; show message |
| Create new user and add to business | New or extended endpoint: create user if email new, then add to business with role | Form: email, name, password, role; or separate “invite existing” vs “create new” |
| Display business account options | Optional: include “features/enabled” in business response or small endpoint | New section: list options (voice, calendar, hours, intake, team) with status and links |

You can use this doc to implement step by step and adjust naming or flows as needed.
