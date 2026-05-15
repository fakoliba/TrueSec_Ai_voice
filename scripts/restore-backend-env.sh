#!/usr/bin/env bash
# Restore backend-api env vars from working revision 00005 and add CORS.
# Run from repo root: ./scripts/restore-backend-env.sh
# Requires: gcloud, jq
set -e
REVISION="${1:-backend-api-00005-xf5}"
REGION="${2:-us-central1}"
SERVICE="backend-api"
PROJECT="${GCLOUD_PROJECT:-truesecai-app}"
CORS_ORIGIN="${BACKEND_CORS_ORIGIN:-https://frontend-web-1021282359242.us-central1.run.app}"
ENV_FILE="${ENV_FILE:-./cloud-run-backend.env}"

echo "Exporting env from revision $REVISION..."
# Only export vars that have .value (skip secret refs valueFrom); escape double-quotes in values
gcloud run revisions describe "$REVISION" \
  --region="$REGION" \
  --project="$PROJECT" \
  --format=json \
  | jq -r '
    .spec.containers[0].env[]? |
    select(.value != null) |
    .name + "=\"" + (.value | gsub("\""; "\\\"")) + "\""
  ' > "$ENV_FILE" || true

if [[ ! -s "$ENV_FILE" ]]; then
  echo "No env vars in revision (or jq failed). Create $ENV_FILE manually from .env and add:"
  echo "  BACKEND_CORS_ORIGINS=$CORS_ORIGIN"
  echo "Then run:"
  echo "  gcloud run services update $SERVICE --region=$REGION --project=$PROJECT --env-vars-file=$ENV_FILE"
  exit 1
fi

# Add or overwrite CORS
(grep -v '^BACKEND_CORS_ORIGINS=' "$ENV_FILE" || true; echo "BACKEND_CORS_ORIGINS=$CORS_ORIGIN") > "${ENV_FILE}.tmp"
mv "${ENV_FILE}.tmp" "$ENV_FILE"

echo "Updating service with env from $ENV_FILE (includes CORS)..."
echo "If deploy fails, check logs: https://console.cloud.google.com/run?project=$PROJECT"
gcloud run services update "$SERVICE" \
  --region="$REGION" \
  --project="$PROJECT" \
  --env-vars-file="$ENV_FILE" \
  --startup-probe=timeoutSeconds=120,periodSeconds=10,failureThreshold=12

echo "Done. Delete local env file if it contains secrets: rm $ENV_FILE"
