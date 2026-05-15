# Deploy to Google Cloud

This guide walks you through setting up Google Cloud and deploying the **backend** (FastAPI) and **frontend** (Next.js) so coworkers can test.

---

## Setup checklist

- [ ] GCP project created and billing enabled
- [ ] `gcloud` CLI installed and logged in
- [ ] APIs enabled (Run, Artifact Registry, Cloud SQL, optional Secret Manager)
- [ ] Cloud SQL PostgreSQL instance and database created
- [ ] Backend image built and pushed to Artifact Registry
- [ ] Backend deployed to Cloud Run (env vars set)
- [ ] Frontend image built with `NEXT_PUBLIC_API_URL` = backend URL
- [ ] Frontend deployed to Cloud Run (or Firebase Hosting)
- [ ] CORS on backend includes frontend URL
- [ ] Twilio webhook updated to backend Cloud Run URL (if using voice)

---

## 1. Prerequisites

- A **Google Cloud account** with billing enabled (free tier is enough to start).
- **gcloud CLI** installed and logged in:
  ```bash
  # Install: https://cloud.google.com/sdk/docs/install
  gcloud auth login
  gcloud config set project YOUR_PROJECT_ID
  ```

---

## 2. Create / select a GCP project

```bash
# Create a new project (or use existing)
gcloud projects create truesecai-app --name="trueSecAI"

# Set as active project
gcloud config set project truesecai-app

# Link billing (required for Cloud Run / Cloud SQL)
# Do this in Console: Billing → Link a billing account
# https://console.cloud.google.com/billing
```

---

## 3. Enable required APIs

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com
```

- **Cloud Run** – run backend and optionally frontend.
- **Artifact Registry** – store Docker images.
- **Cloud SQL Admin** – create and manage PostgreSQL.
- **Secret Manager** – (optional) store API keys and DB password.

---

## 4. Database: Cloud SQL (PostgreSQL)

Create a PostgreSQL instance and a database for the backend.

```bash
# Set variables (adjust region if needed)
export REGION=us-central1
export DB_INSTANCE=truesecai-db
export DB_NAME=ai_support_db
export DB_USER=postgres
export DB_PASSWORD="CHOOSE_A_STRONG_PASSWORD"

# Create Cloud SQL instance (takes a few minutes)
gcloud sql instances create $DB_INSTANCE \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=$REGION

# Create database
gcloud sql databases create $DB_NAME --instance=$DB_INSTANCE

# Create user
gcloud sql users create $DB_USER \
  --instance=$DB_INSTANCE \
  --password=$DB_PASSWORD
```

Get the **connection name** (for Cloud Run private connection) or **public IP**:

```bash
gcloud sql instances describe $DB_INSTANCE --format='value(connectionName)'
# Example: project:region:truesecai-db
```

**DATABASE_URL** for Cloud Run:

- **Option A – Public IP (simplest):** Enable public IP on the instance, then add Cloud Run’s egress IPs to “Authorized networks” (or use `0.0.0.0/0` for testing). Format:
  ```text
  postgresql+psycopg://postgres:YOUR_DB_PASSWORD@PUBLIC_IP/ai_support_db
  ```
  Get public IP: `gcloud sql instances describe $DB_INSTANCE --format='value(ipAddresses[0].ipAddress)'`

- **Option B – Cloud SQL connector (recommended for production):** When deploying the backend, add the Cloud SQL connection so the service connects over a private path. Then use the **Unix socket** URL that Cloud Run provides, e.g.:
  ```text
  postgresql+psycopg://postgres:PASSWORD@/ai_support_db?host=/cloudsql/PROJECT:REGION:INSTANCE
  ```
  Deploy with: `gcloud run deploy ... --add-cloudsql-instances=PROJECT:REGION:INSTANCE`

---

## 5. Backend: build and deploy to Cloud Run

From the **backend** directory (where `Dockerfile` and `app/` live).

### 5.1 Configure Artifact Registry

```bash
cd /path/to/backend   # or: cd /Users/cherif/Desktop/backend

export REGION=us-central1
export PROJECT_ID=$(gcloud config get-value project)
export REPO=backend

gcloud artifacts repositories create $REPO \
  --repository-format=docker \
  --location=$REGION \
  --description="Backend API images"
```

### 5.2 Build and push the image

```bash
# Docker must be running
gcloud auth configure-docker $REGION-docker.pkg.dev --quiet

docker build -t $REGION-docker.pkg.dev/$PROJECT_ID/$REPO/api:latest .
docker push $REGION-docker.pkg.dev/$PROJECT_ID/$REPO/api:latest
```

### 5.3 Deploy to Cloud Run

Set env vars to match your setup. Use the **public IP** of your Cloud SQL instance and a strong **SECRET_KEY**.

```bash
export IMAGE=$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/api:latest
export DB_PASSWORD="your-db-password"
export DB_PUBLIC_IP="YOUR_CLOUD_SQL_PUBLIC_IP"
export SECRET_KEY="your-long-random-secret-key"
export OPENAI_API_KEY="sk-..."
export TWILIO_ACCOUNT_SID="AC..."
export TWILIO_AUTH_TOKEN="..."
export TWILIO_PHONE_NUMBER="+1..."
export VOICE_WEBHOOK_BASE_URL="https://YOUR-BACKEND-URL.run.app"   # set after first deploy

gcloud run deploy backend-api \
  --image=$IMAGE \
  --region=$REGION \
  --platform=managed \
  --allow-unauthenticated \
  --set-env-vars="DATABASE_URL=postgresql+psycopg://postgres:${DB_PASSWORD}@${DB_PUBLIC_IP}:5432/ai_support_db" \
  --set-env-vars="SECRET_KEY=${SECRET_KEY}" \
  --set-env-vars="OPENAI_API_KEY=${OPENAI_API_KEY}" \
  --set-env-vars="TWILIO_ACCOUNT_SID=${TWILIO_ACCOUNT_SID}" \
  --set-env-vars="TWILIO_AUTH_TOKEN=${TWILIO_AUTH_TOKEN}" \
  --set-env-vars="TWILIO_PHONE_NUMBER=${TWILIO_PHONE_NUMBER}" \
  --set-env-vars="VOICE_WEBHOOK_BASE_URL=${VOICE_WEBHOOK_BASE_URL}" \
  --set-env-vars="BACKEND_CORS_ORIGINS=https://YOUR-FRONTEND-URL"
```

After the first deploy, note the service URL (e.g. `https://backend-api-xxxxx.run.app`), then:

1. Set **VOICE_WEBHOOK_BASE_URL** to that URL and **BACKEND_CORS_ORIGINS** to your frontend URL.
2. Redeploy or update env vars in the Cloud Run console.

**Optional:** Use **Secret Manager** for sensitive values instead of `--set-env-vars` (see [Cloud Run secrets](https://cloud.google.com/run/docs/configuring/services/secrets)).

### 5.4 Run migrations (one-time)

Either run Alembic from your laptop against the Cloud SQL public IP (with authorized networks), or run a one-off Cloud Run job that executes `alembic upgrade head`. For a quick start, you can rely on `Base.metadata.create_all()` in `main.py` if the DB is empty (not ideal for production; use migrations when possible).

---

## 6. Frontend: deploy to Cloud Run (or Firebase Hosting)

### Option A: Next.js on Cloud Run

Build a Docker image for the Next.js app and deploy to Cloud Run.

Create **frontend/Dockerfile** (see below). Then:

```bash
cd frontend
docker build -t $REGION-docker.pkg.dev/$PROJECT_ID/frontend/web:latest .
docker push $REGION-docker.pkg.dev/$PROJECT_ID/frontend/web:latest

gcloud run deploy frontend-web \
  --image=$REGION-docker.pkg.dev/$PROJECT_ID/frontend/web:latest \
  --region=$REGION \
  --platform=managed \
  --allow-unauthenticated \
  --set-env-vars="NEXT_PUBLIC_API_URL=https://YOUR-BACKEND-URL.run.app"
```

### Option B: Static export + Firebase Hosting

If you use Next.js static export (`output: 'export'`) or a separate build, upload the `out/` or `dist/` folder to Firebase Hosting or Cloud Storage + Load Balancer. Set **NEXT_PUBLIC_API_URL** at build time to your backend Cloud Run URL.

---

## 7. Environment variables checklist

### Backend (Cloud Run)

| Variable | Required | Example |
|----------|----------|---------|
| `DATABASE_URL` | Yes | `postgresql+psycopg://postgres:PASS@IP:5432/ai_support_db` |
| `SECRET_KEY` | Yes | Long random string |
| `OPENAI_API_KEY` | For AI | `sk-...` |
| `TWILIO_ACCOUNT_SID` | For voice | `AC...` |
| `TWILIO_AUTH_TOKEN` | For voice | Your token |
| `TWILIO_PHONE_NUMBER` | For voice | `+1...` |
| `VOICE_WEBHOOK_BASE_URL` | For voice | `https://backend-api-xxx.run.app` |
| `BACKEND_CORS_ORIGINS` | Yes for frontend | `https://frontend-xxx.run.app` or your frontend URL |

### Frontend (build-time)

| Variable | Required | Example |
|----------|----------|---------|
| `NEXT_PUBLIC_API_URL` | Yes | `https://backend-api-xxx.run.app` |

---

## 8. Post-deploy

1. **Twilio:** Set the phone number webhook to `https://YOUR-BACKEND-URL.run.app/api/voice/incoming?business_id=1`.
2. **CORS:** Ensure `BACKEND_CORS_ORIGINS` includes the exact frontend origin (no trailing slash). When updating only CORS, use **`--update-env-vars`** (not `--set-env-vars`), or you will remove all other env vars and the container will fail to start:
   ```bash
   gcloud run services update backend-api --region=us-central1 \
     --update-env-vars="BACKEND_CORS_ORIGINS=https://frontend-web-XXXXX.us-central1.run.app"
   ```
   **If the service was ever updated with `--set-env-vars` (only CORS),** the stored config has no other vars, so new revisions keep failing. Restore all env vars from the working revision, then add CORS: run `./scripts/restore-backend-env.sh` (requires `jq`), or create an env file from your `.env` (add `BACKEND_CORS_ORIGINS=https://frontend-web-XXX.run.app`) and run `gcloud run services update backend-api --region=us-central1 --env-vars-file=that-file.env`.
   **Local dev (npm run dev on localhost:3000):** To call the deployed backend from your machine, add the local origin to CORS. Because the value contains a comma, use the `^@^` delimiter so gcloud doesn't split it:
   ```bash
   gcloud run services update backend-api --region=us-central1 --project=truesecai-app \
     --update-env-vars='^@^BACKEND_CORS_ORIGINS=https://frontend-web-1021282359242.us-central1.run.app,http://localhost:3000'
   ```
   In the frontend repo set `NEXT_PUBLIC_API_URL` to your backend URL (e.g. in `frontend/.env.local`).
3. **Health:** Open `https://YOUR-BACKEND-URL.run.app/health` to confirm the API is up.
4. **Frontend:** Open your frontend URL, sign in, and test businesses and AI chat.

---

## 9. Deploy using Git (Cloud Build)

You can deploy by pushing to Git: Cloud Build builds the backend image and deploys to Cloud Run.

### 9.1 One-time setup

1. **Create the Artifact Registry repo** (if you haven’t):
   ```bash
   gcloud artifacts repositories create backend \
     --repository-format=docker \
     --location=us-central1
   ```

2. **Set backend env vars once** (Cloud Run keeps them on later deploys):
   - In [Cloud Run](https://console.cloud.google.com/run) → select your service (or create one) → Edit & deploy new revision → Variables & secrets.
   - Add at least: `DATABASE_URL`, `SECRET_KEY`, `OPENAI_API_KEY` (and Twilio vars if you use voice).
   - Or deploy once from your machine with `gcloud run deploy ... --set-env-vars="..."` so the service exists with env vars; after that, Git-based deploys only update the image.

3. **Connect your repo to Cloud Build:**
   - [Cloud Build → Triggers](https://console.cloud.google.com/cloud-build/triggers).
   - **Create trigger**.
   - **Source:** connect GitHub, GitLab, or Bitbucket (or use Cloud Source Repositories). Authorize and pick the repo.
   - **Configuration:** Cloud Build configuration file (YAML or JSON).
   - **Location:** Repository (e.g. `cloudbuild.yaml` in the repo root).
   - **Branch:** `^main$` (or your default branch).
   - **Substitution variables** (optional): `_REGION` = `us-central1`, `_SERVICE_NAME` = `backend-api`, `_REPO` = `backend`.
   - Save.

### 9.2 Repo layout

- **If your Git repo root is the backend** (contains `Dockerfile`, `app/`, `requirements.txt`): the provided `cloudbuild.yaml` works as-is.
- **If your repo is a monorepo** (e.g. `backend/` and `frontend/` subfolders), change the build step in `cloudbuild.yaml` to use the backend directory:
  - In the first step, add `dir: backend` (or your backend folder name).
  - Use `-f backend/Dockerfile` and ensure the build context is `backend` (e.g. `args: ['build', '-t', '...', '-f', 'Dockerfile', '.'], dir: 'backend'`).

### 9.3 Deploy

- Push to the branch you configured (e.g. `main`). The trigger runs, builds the image, and deploys to Cloud Run.
- View logs in [Cloud Build → History](https://console.cloud.google.com/cloud-build/builds).

### 9.4 Frontend from Git (optional)

To build and deploy the Next.js frontend from Git too, add a second trigger that uses a separate `cloudbuild-frontend.yaml` (or a second build config) to build the frontend image with `NEXT_PUBLIC_API_URL` set and deploy to a second Cloud Run service. You can add that file and trigger when you’re ready.

---

## Quick reference: backend only (minimal)

```bash
# 1. Enable APIs
gcloud services enable run.googleapis.com artifactregistry.googleapis.com

# 2. Build and push (from backend folder)
export PROJECT_ID=$(gcloud config get-value project)
export REGION=us-central1
gcloud auth configure-docker $REGION-docker.pkg.dev --quiet
docker build -t $REGION-docker.pkg.dev/$PROJECT_ID/backend/api:latest .
docker push $REGION-docker.pkg.dev/$PROJECT_ID/backend/api:latest

# 3. Deploy (set env vars first)
gcloud run deploy backend-api --image=... --region=$REGION --allow-unauthenticated --set-env-vars="..."
```

For a full production setup, use **Cloud SQL** with a private IP or **Cloud SQL Auth Proxy**, and **Secret Manager** for secrets.
