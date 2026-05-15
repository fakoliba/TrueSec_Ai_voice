# Backend (FastAPI) for Google Cloud Run
# On Apple Silicon, build with: docker build --platform linux/amd64 ...
FROM python:3.13-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Application code
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini .

# Cloud Run sets PORT at runtime (default 8080)
ENV PORT=8080
EXPOSE 8080

# PYTHONUNBUFFERED=1 so Cloud Run logs show startup errors immediately
ENV PYTHONUNBUFFERED=1
CMD ["sh", "-c", "exec python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
