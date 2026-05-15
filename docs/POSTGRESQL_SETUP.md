# PostgreSQL Setup

This app uses **PostgreSQL only**. All data is stored in PostgreSQL, including:

- **User accounts and login** (email, hashed passwords)
- **OAuth tokens** (e.g. Google)
- **Businesses and business users**
- **Appointments**, and everything else

Run PostgreSQL (Docker or local), set `DATABASE_URL` in `.env`, then start the app.

---

## Option A: Docker (recommended)

1. **Start PostgreSQL**
   ```bash
   docker compose up -d
   ```

2. **Set `.env`**
   ```env
   # Use postgresql+psycopg:// for Python 3.13 (psycopg v3)
   DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/ai_support_db
   ```

3. **Create tables** (Alembic recommended)
   ```bash
   # From project root with venv activated
   alembic revision --autogenerate -m "initial"
   alembic upgrade head
   ```
   Or start the app (tables created via `Base.metadata.create_all`):
   ```bash
   uvicorn app.main:app --reload
   ```

4. **Stop when done**
   ```bash
   docker compose down
   ```

---

## Option B: Local PostgreSQL

1. **Install PostgreSQL**
   - macOS: `brew install postgresql@16` then `brew services start postgresql@16`
   - Ubuntu: `sudo apt install postgresql postgresql-contrib`
   - Windows: [PostgreSQL installer](https://www.postgresql.org/download/windows/)

2. **Create database and user**
   ```bash
   # Connect as postgres user
   psql -U postgres

   CREATE USER your_user WITH PASSWORD 'your_password';
   CREATE DATABASE ai_support_db OWNER your_user;
   \q
   ```

3. **Set `.env`**
   ```env
   DATABASE_URL=postgresql+psycopg://your_user:your_password@localhost:5432/ai_support_db
   ```

---

## Connection string format

- **Python 3.13** (psycopg v3): `postgresql+psycopg://USER:PASSWORD@HOST:PORT/DATABASE`
- **Python 3.12 and below** (psycopg2): `postgresql://USER:PASSWORD@HOST:PORT/DATABASE` or `postgresql+psycopg2://...`

- **USER** – PostgreSQL user
- **PASSWORD** – User password
- **HOST** – `localhost` (local) or hostname (Docker/remote)
- **PORT** – Default `5432`
- **DATABASE** – Database name (e.g. `ai_support_db`)

---

## Verify connection

```bash
# With venv activated and DATABASE_URL set to PostgreSQL
python -c "
from app.db.session import engine
from sqlalchemy import text
with engine.connect() as conn:
    conn.execute(text('SELECT 1'))
print('PostgreSQL connection OK')
"
```

---

## Note

This project is configured to use **PostgreSQL only**. SQLite is not supported.
