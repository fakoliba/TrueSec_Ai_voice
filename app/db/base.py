from sqlalchemy.ext.declarative import declarative_base

# Create a base class for SQLAlchemy models
Base = declarative_base()

# This file creates the declarative base that all models will inherit from
# It's important to import this before any of your models to avoid circular imports