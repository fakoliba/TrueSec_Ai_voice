import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from dotenv import load_dotenv
import os
from typing import List, Optional
import uvicorn

# Load environment variables (optional; Cloud Run uses env vars)
load_dotenv()

import logging
_logger = logging.getLogger(__name__)
_logger.info("Loading application...")

# Import API router and models (so all tables are registered on Base.metadata)
from app.api.api import api_router
from app.middleware.request_timing import RequestTimingMiddleware
from app.core.config import settings
from app.db.session import engine, get_db
from app.db.base import Base
from app import models  # noqa: F401 - register Business, BusinessUser, etc.


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run DB table creation in a background thread so the server binds to PORT immediately (Cloud Run startup probe)."""
    def init_db():
        try:
            Base.metadata.create_all(bind=engine)
            _logger.info("Database tables created or already exist")
        except Exception as e:
            _logger.warning("Database table creation failed (tables may be missing): %s", e)

    thread = threading.Thread(target=init_db, daemon=True)
    thread.start()
    yield


app = FastAPI(
    title="AI Voice Assistant API",
    description="Backend API for the AI Voice Assistant application",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS: allow frontend origin so browser doesn't block cross-origin requests
_cors_origins = settings.cors_origins_list or ["*"]
if "*" not in _cors_origins:
    # Normalize: ensure no trailing slash (Origin header never has path)
    _cors_origins = [o.rstrip("/") for o in _cors_origins]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)
app.add_middleware(RequestTimingMiddleware)

# Include API router
app.include_router(api_router, prefix="/api")

_logger.info("Application ready")

@app.get("/")
async def root():
    return {"message": "Welcome to the AI Voice Assistant API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# OAuth2 scheme for token authentication
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Pydantic models
class AppointmentCreate(BaseModel):
    title: str
    start_time: str
    end_time: str
    description: Optional[str] = None

class Appointment(AppointmentCreate):
    id: int
    google_event_id: Optional[str] = None

# In-memory storage (replace with database in production)
appointments_db = []

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy", "message": "AI Voice Assistant API is running"}

# API endpoints will be added here

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
