# trueSecAI Frontend (Next.js)

Frontend for the AI Voice Assistant backend. Sign in, view businesses, chat with the AI, and view appointments.

## Setup

1. Copy env example and set your backend URL:
   ```bash
   cp .env.local.example .env.local
   ```
   Edit `.env.local` and set:
   ```
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```
   (Use your deployed API URL when testing on GC.)

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
