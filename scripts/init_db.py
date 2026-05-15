#!/usr/bin/env python3
"""
Create all database tables. Run once against your Cloud SQL (or local) DB.
Usage (from repo root, with DATABASE_URL in env or .env):
  python scripts/init_db.py
Or:
  DATABASE_URL=postgresql+psycopg://user:pass@host:5432/dbname python scripts/init_db.py
"""
import os
import sys

# Add project root so "app" is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from app.db.base import Base
from app.db.session import engine
from app import models  # noqa: F401 - register all models

if __name__ == "__main__":
    url = os.environ.get("DATABASE_URL", "")
    if not url or "localhost" in url.split("@")[-1].split("/")[0]:
        print("Set DATABASE_URL to your Cloud SQL (or target) connection string.")
        print("Example: DATABASE_URL=postgresql+psycopg://user:pass@35.184.212.212:5432/ai_support_db python scripts/init_db.py")
        sys.exit(1)
    print("Creating tables on", url.split("@")[-1].split("/")[0], "...")
    Base.metadata.create_all(bind=engine)
    print("Done. Tables created or already exist.")
