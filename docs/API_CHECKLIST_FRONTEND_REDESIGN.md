# API Checklist – Frontend Redesign (Businesses & Account)

Use this to implement “create/edit businesses” and “account” in the frontend. Base URL: `https://backend-api-1021282359242.us-central1.run.app` (or `NEXT_PUBLIC_API_URL`).

---

## 1. Auth (account & login)

| Method | Path | Auth | Purpose | Status |
|--------|------|------|---------|--------|
| POST | `/api/auth/register` | No | Register new user | ✅ Exists |
| POST | `/api/auth/token` | No | Login (get access token) | ✅ Exists |
| GET | `/api/auth/users/me` | Bearer | Get current user profile | ✅ Exists |
| PUT/PATCH | `/api/auth/users/me` | Bearer | Update profile (name, email) | ❌ **Missing** |
| POST | `/api/auth/change-password` (or similar) | Bearer | Change password | ❌ **Missing** |

### 1.1 POST `/api/auth/register`

- **Body (JSON):** `UserCreate`
  - `email` (string, required)
  - `full_name` (string, optional)
  - `password` (string, required)
- **Response:** `User` (id, email, full_name, is_active, created_at, updated_at)

### 1.2 POST `/api/auth/token`

- **Body:** `application/x-www-form-urlencoded`
  - `username` = email
  - `password` = password
- **Response:** `{ "access_token": "...", "token_type": "bearer" }`

### 1.3 GET `/api/auth/users/me`

- **Headers:** `Authorization: Bearer <token>`
- **Response:** `User` (id, email, full_name, is_active, created_at, updated_at)

### 1.4 Update profile – **NOT IMPLEMENTED**

- **Suggested:** `PATCH /api/auth/users/me`
- **Body (JSON):** e.g. `{ "full_name": "...", "email": "..." }` (only fields to update)
- **Backend:** Add endpoint + use existing `UserUpdate` schema; ensure only the current user’s row is updated.

### 1.5 Change password – **NOT IMPLEMENTED**

- **Suggested:** `POST /api/auth/change-password`
- **Body (JSON):** e.g. `{ "current_password": "...", "new_password": "..." }`
- **Backend:** Add endpoint; verify current password, then update hashed password for current user.

---

## 2. Businesses

| Method | Path | Auth | Purpose | Status |
|--------|------|------|---------|--------|
| POST | `/api/businesses` | Bearer | Create business | ✅ Exists |
| GET | `/api/businesses` | Bearer | List my businesses | ✅ Exists |
| GET | `/api/businesses/{id}` | Bearer | Get one business | ✅ Exists |
| PUT | `/api/businesses/{id}` | Bearer | Update business | ✅ Exists |
| DELETE | `/api/businesses/{id}` | Bearer | Delete business | ✅ Exists |

All of these require `Authorization: Bearer <token>`.

### 2.1 POST `/api/businesses` – Create business

- **Body (JSON):** `BusinessCreate`
  - `name` (string, required, max 255)
  - `business_type` (string, optional, max 50) – e.g. dental, medical, mechanic, other
  - `email` (string, optional, valid email)
  - `phone` (string, optional, max 20)
  - `address` (string, optional)
  - `timezone` (string, optional, default `"UTC"`, max 50)
- **Response:** `Business` (id, name, business_type, email, phone, address, timezone, subscription_plan, subscription_status, created_at, updated_at)
- **Note:** Current user is set as **owner** automatically.

**Minimal example:**

```json
{
  "name": "My Business",
  "business_type": "retail"
}
```

### 2.2 GET `/api/businesses` – List my businesses

- **Response:** Array of `Business` (same shape as above).

### 2.3 GET `/api/businesses/{business_id}` – Get one business

- **Response:** Single `Business`.

### 2.4 PUT `/api/businesses/{business_id}` – Update business

- **Body (JSON):** `BusinessUpdate` – all fields optional:
  - `name`, `business_type`, `email`, `phone`, `address`, `timezone`
- **Response:** Updated `Business`.
- **Note:** Only members can update; consider restricting to owner/admin later.

### 2.5 DELETE `/api/businesses/{business_id}` – Delete business

- **Response:** 204 No Content.
- **Note:** Backend checks role (e.g. only owner can delete); frontend can hide Delete for non-owners.

---

## 3. Summary for frontend

- **Already available for frontend:**
  - Register, login, get profile (`/users/me`).
  - Full business CRUD: create, list, get, update, delete.

- **Backend work needed for “account” UX:**
  - **Update profile:** add `PATCH /api/auth/users/me` (or PUT) using `UserUpdate`.
  - **Change password:** add `POST /api/auth/change-password` (or similar) with current + new password.

- **Frontend can implement now (no backend changes):**
  - Create business (form → POST `/api/businesses`).
  - Edit business (form → PUT `/api/businesses/{id}`).
  - Delete business (confirm → DELETE `/api/businesses/{id}`).
  - Read-only account page (GET `/api/auth/users/me`).

- **Frontend after backend adds endpoints:**
  - Edit profile (PATCH `/api/auth/users/me`).
  - Change password (POST `/api/auth/change-password`).

---

## 4. Quick reference – request bodies

**Register:**  
`{ "email": "...", "full_name": "...", "password": "..." }`

**Create business:**  
`{ "name": "...", "business_type": "...", "email": "...", "phone": "...", "address": "...", "timezone": "UTC" }`

**Update business:**  
`{ "name": "...", "business_type": "...", ... }` (any subset of fields)

**Login (form):**  
`username=<email>&password=<password>`, header `Content-Type: application/x-www-form-urlencoded`

All authenticated requests: header `Authorization: Bearer <access_token>`.
