# Creating an Admin User and a New Business (Team Testing Guide)

Use this guide to create admin users and businesses on the deployed app for testing.

---

## App URLs (deployed)

| App        | URL |
|-----------|-----|
| **Frontend** | https://frontend-web-1021282359242.us-central1.run.app |
| **Backend API** | https://backend-api-1021282359242.us-central1.run.app |
| **API docs** | https://backend-api-1021282359242.us-central1.run.app/docs |

---

## 1. Create the first admin user (if none exists)

The **first user** who registers on the platform is automatically made an **admin**.

1. Open the **frontend**: https://frontend-web-1021282359242.us-central1.run.app  
2. Click **Register** (or go to `/register`).  
3. Enter **email**, **full name**, and **password**.  
4. Submit the form.  
5. That user is now an admin and can create businesses and manage other users.

---

## 2. Add another admin user

To give admin rights to someone else:

**Option A – Promote an existing user (recommended)**

1. The new person **registers** on the app (Register → email, name, password).  
2. An **existing admin** logs in.  
3. Go to **Account** (e.g. from the menu or `/account`).  
4. In the **“Manage platform users”** section, find the new user in the table.  
5. Change their **Role** dropdown from `customer` to **`admin`**.  
6. They can now log in and create businesses and manage users.

**Option B – Create a new user and promote via API**

1. New user registers via the UI (same as above).  
2. An admin calls the API to set role (see “Using the API” below).

---

## 3. Create a new business

Only users with role **super_admin**, **admin**, or **owner** can create a business.

1. **Log in** as an admin (or owner).  
2. Open **Dashboard** (My businesses).  
3. Click **“Create business”**.  
4. Fill in:
   - **Name** (required)
   - **Business type** (optional)
   - **Email**, **Phone** (optional)
   - **Address** (street, city, state, postal code, country) – optional
   - **Timezone** (defaults to your browser timezone)
5. Click **Create** (or equivalent submit button).  
6. You are taken to the new business’s dashboard. You can then:
   - **Connect calendars** (e.g. Google/Outlook) from the business’s dashboard.  
   - Configure **Business hours & services** under **Settings** for that business.

If a user does **not** have permission, they will see: *“Contact your administrator to create a new business.”* An existing admin must promote them (see step 2 above).

---

## 4. Quick reference – roles

| Role          | Can create business? | Can manage platform users (list/set roles)? |
|---------------|------------------------|---------------------------------------------|
| **super_admin** | Yes                    | Yes                                         |
| **admin**       | Yes                    | Yes                                         |
| **owner**       | Yes                    | No                                          |
| **staff**       | No                     | No                                          |
| **customer**    | No                     | No                                          |

---

## 5. Using the API (optional)

Useful for scripts or automation.

**Base URL:** `https://backend-api-1021282359242.us-central1.run.app`

### Get an access token (login)

```bash
curl -X POST "https://backend-api-1021282359242.us-central1.run.app/api/auth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=ADMIN_EMAIL&password=ADMIN_PASSWORD"
```

Response example: `{"access_token":"eyJ...","token_type":"bearer"}`. Use `access_token` in the next requests.

### List users (admin only)

```bash
curl -X GET "https://backend-api-1021282359242.us-central1.run.app/api/auth/users" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Set a user’s role (admin only)

```bash
curl -X PATCH "https://backend-api-1021282359242.us-central1.run.app/api/auth/users/USER_ID/role" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role":"admin"}'
```

Replace `USER_ID` with the numeric user id (from the list users response).

### Create a business (admin/owner)

```bash
curl -X POST "https://backend-api-1021282359242.us-central1.run.app/api/businesses/" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Business",
    "business_type": "Retail",
    "email": "business@example.com",
    "timezone": "America/New_York"
  }'
```

---

## 6. Troubleshooting

- **“Contact your administrator to create a new business”**  
  Your account has role `staff` or `customer`. Ask an admin to set your role to `admin` or `owner` in Account → Manage platform users.

- **“Only platform admins can perform this action”**  
  You tried to open “Manage platform users” or call the users API without being `super_admin` or `admin`.

- **No “Manage platform users” section**  
  Only `super_admin` and `admin` see it. Log in with an admin account.

- **Can’t log in / 401**  
  Check email and password. Use “Register” if the user doesn’t exist yet.

---

*Last updated for the deployed app (frontend + backend on Google Cloud Run).*
