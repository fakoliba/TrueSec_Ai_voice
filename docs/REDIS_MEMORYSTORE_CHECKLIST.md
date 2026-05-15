# Redis (GCP Memorystore) + Cloud Run — planning checklist

This checklist supports deploying **managed Redis** before **Twilio Media Streams** work. The app already reads **`REDIS_URL`** for Twilio call state and TTS token cache ([`app/services/voice_call_state.py`](../app/services/voice_call_state.py)).

Confirm details against current [Memorystore for Redis](https://cloud.google.com/memorystore/docs/redis) and [Cloud Run VPC](https://cloud.google.com/run/docs/configuring/connecting-vpc) documentation.

## 1. Network

- Use a **VPC** in the same **GCP project** as Cloud Run.
- Create **Memorystore for Redis** in the **same region** as Cloud Run (e.g. `us-central1`).
- Provide the **private IP** and port (typically `6379`) from the Memorystore instance page after creation.

## 2. Cloud Run → VPC

- **Serverless VPC Access connector** (same region as Cloud Run) so Cloud Run egress can reach the VPC private IP of Memorystore, **or**
- **Direct VPC egress** for Cloud Run if available in your region (see Google docs).
- Ensure the connector’s IP range / subnet does **not** conflict with Memorystore’s reserved range.

## 3. Memorystore instance

- Enable **Memorystore for Redis API** if needed.
- Choose tier/size for staging/production.
- Note whether **AUTH** or **TLS** is required; if so, build `REDIS_URL` accordingly (`redis://` vs `rediss://`, password in URL).

## 4. `REDIS_URL` format

Examples (replace host, password, DB index as needed):

```text
redis://10.x.x.x:6379/0
redis://:PASSWORD@10.x.x.x:6379/0
rediss://...   # if TLS required
```

The app uses DB index in the path (`/0`). Celery can use `/1` on the same host if you want logical separation.

## 5. Cloud Run environment variables

| Variable | Notes |
|----------|--------|
| `REDIS_URL` | Required for Redis-backed voice state. |
| `CELERY_BROKER_URL` | If you run Celery workers; default in code is `redis://localhost:6379/0`. |
| `CELERY_RESULT_BACKEND` | Optional; often `redis://.../1`. |

## 6. Verification

- After setting env vars and redeploying, check logs: avoid repeated **`Redis connection failed, using in-memory voice state`** from `voice_call_state`.
- Run a **voice call** or integration test that touches call state.

## 7. Optional

- Store `REDIS_URL` in **Secret Manager** and reference it from Cloud Run.
- Separate Redis instances for dev/staging/prod if policy requires.
