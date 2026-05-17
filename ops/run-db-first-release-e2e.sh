#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker ist nicht verfügbar." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "docker daemon ist nicht erreichbar." >&2
  exit 1
fi

CONTAINER_NAME="${CONTAINER_NAME:-scoutx-db-first-e2e-pg}"
POSTGRES_IMAGE="${POSTGRES_IMAGE:-postgres:16-alpine}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-postgres}"
POSTGRES_PORT="${POSTGRES_PORT:-55432}"

cleanup() {
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
docker run -d \
  --name "$CONTAINER_NAME" \
  -e POSTGRES_USER="$POSTGRES_USER" \
  -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
  -e POSTGRES_DB="$POSTGRES_DB" \
  -p "${POSTGRES_PORT}:5432" \
  "$POSTGRES_IMAGE" >/dev/null

echo "Warte auf PostgreSQL..."
for _ in {1..60}; do
  if docker exec "$CONTAINER_NAME" pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! docker exec "$CONTAINER_NAME" pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; then
  echo "PostgreSQL wurde nicht rechtzeitig ready." >&2
  exit 1
fi

export ADAPTER_DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:${POSTGRES_PORT}/${POSTGRES_DB}"

echo "Starte DB-First Release E2E mit $ADAPTER_DATABASE_URL"
RESULTS_FILE="${RESULTS_FILE:-docs/release-db-first-e2e-last-run.txt}"
ADAPTER_DATABASE_URL="$ADAPTER_DATABASE_URL" RESULTS_FILE="$RESULTS_FILE" ./ops/run-db-first-release-e2e-and-update-checklist.sh
