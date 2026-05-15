from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# Connect args: SQLite needs check_same_thread=False; PostgreSQL does not
_connect_args = (
    {"check_same_thread": False}
    if settings.DATABASE_URL.split(":")[0] == "sqlite"
    else {}
)
engine = create_engine(
    settings.DATABASE_URL,
    connect_args=_connect_args,
    pool_pre_ping=True,  # verify connections before use (helps with PostgreSQL)
)

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()

def get_db():
    """Dependency for getting database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
