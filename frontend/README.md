# trueSecAI Frontend (Next.js)

Frontend for the AI Voice Assistant backend. Sign in, view businesses, chat with the AI, and view appointments.

## Setup

1. Create `frontend/.env.local` for local dev against the **deployed** backend (recommended — avoids CORS):
   ```
   NEXT_PUBLIC_USE_API_PROXY=true
   BACKEND_PROXY_TARGET=https://backend-api-1021282359242.us-central1.run.app
   ```
   Or point the browser directly at a backend (requires `BACKEND_CORS_ORIGINS` to include `http://localhost:3000`):
   ```
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```

2. Install and run:
   ```bash
   npm install
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

## Backend

Ensure the FastAPI backend is running (e.g. `uvicorn app.main:app --reload --port 8000`) and that you have a user account. Register via `POST /api/auth/register` or create a user in the DB, then sign in on the frontend.

## Routes

- `/` – Home (sign in / dashboard links)
- `/login` – Sign in (email + password → token in localStorage)
- `/dashboard` – List my businesses (requires auth)
- `/dashboard/[id]` – Business overview
- `/dashboard/[id]/activity` – Call activity workspace (AI chat opens from bottom dock on all business pages)
- `/dashboard/[id]/appointments` – List appointments
