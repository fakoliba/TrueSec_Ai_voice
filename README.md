# AI Voice Assistant Backend

This is the backend service for the AI Voice Assistant application, featuring FastAPI, Google Calendar integration, and AI agent capabilities.

## Setup Instructions

1. **Set up the virtual environment**:
   ```bash
   # Navigate to the backend directory
   cd backend
   
   # Activate the virtual environment
   # On macOS/Linux:
   source venv/bin/activate
   # On Windows:
   # .\venv\Scripts\activate

   # Install dependencies
   pip install -r requirements.txt
   ```

2. **Configure Environment Variables**:
   - Copy `.env.example` to `.env`
   - Update the values in `.env` with your actual configuration
   - Make sure to set up your Google Cloud Project and get OAuth2 credentials
   - Add your OpenAI API key for AI capabilities

3. **Database (PostgreSQL)**:
   - The app uses PostgreSQL only (including for user accounts and login).
   - Run `docker compose up -d`, then set in `.env`:
     `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ai_support_db`
   - See `docs/POSTGRESQL_SETUP.md` for details.

4. **Run the Development Server**:
   ```bash
   uvicorn main:app --reload
   ```

5. **Access the API Documentation**:
   - Open your browser and go to: http://localhost:8000/docs
   - This will show the interactive API documentation (Swagger UI)

## Project Structure

- `main.py` - Main FastAPI application
- `config.py` - Application configuration and settings
- `app/` - Application package
  - `routers/` - API route handlers
  - `models/` - Database models
  - `schemas/` - Pydantic models
  - `services/` - Business logic
  - `utils/` - Utility functions

## API Endpoints

- `GET /health` - Health check endpoint
- `POST /api/appointments` - Create a new appointment
- `GET /api/appointments` - List all appointments
- `GET /api/appointments/{appointment_id}` - Get appointment details
- `DELETE /api/appointments/{appointment_id}` - Delete an appointment
- `POST /api/chat` - Chat with the AI agent

## Google Calendar Integration

To enable Google Calendar integration:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable the Google Calendar API
4. Create OAuth 2.0 credentials
5. Download the credentials and update your `.env` file

## Development

- Use `black` for code formatting
- Use `isort` for import sorting
- Write tests in the `tests/` directory
- Follow PEP 8 style guide

## Deployment

For production deployment, consider using:
- Docker + Docker Compose
- Gunicorn with Uvicorn workers
- PostgreSQL for the database
- Redis for caching
- Nginx as a reverse proxy
