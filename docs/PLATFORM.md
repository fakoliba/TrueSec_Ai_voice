# Platform super admin (`super_admin`)

## Role

- **Platform role** `super_admin` identifies trusted operators who can run the **Platform** console (`/platform` in the web app).
- **UI** may label this as “Super user” or “Platform admin.”

## Rules

1. **Super admins must not be business members**  
   There must be **no `BusinessUser` row** for a user whose `User.role` is `super_admin`.  
   - API enforces this when adding members by email and when creating businesses via normal `POST /api/businesses` (super admins are blocked from that path).

2. **Onboarding tenants**  
   Super admins must use **`POST /api/platform/businesses/onboard`**, which creates a **new owner user** and a **new business** and does **not** link the super admin.

3. **Assigning `super_admin`**  
   Only an existing **`super_admin`** can assign the **`super_admin`** platform role (see `PATCH /api/auth/users/{id}/role`). Other platform roles may be managed by `admin` or `super_admin` depending on the endpoint.

4. **Access without membership**  
   Super admins can open tenant APIs and dashboards by business id; the backend treats them as having access without a real `BusinessUser` row (synthetic membership for permission checks only).

## Security

- Frontend role checks are for UX only; **all enforcement is server-side** (JWT does not carry role; role is loaded on the server).
