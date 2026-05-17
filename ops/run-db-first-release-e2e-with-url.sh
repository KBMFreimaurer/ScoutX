#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DB_URL="${ADAPTER_DATABASE_URL:-${DATABASE_URL:-}}"
if [[ -z "$DB_URL" ]]; then
  echo "ADAPTER_DATABASE_URL oder DATABASE_URL ist erforderlich." >&2
  exit 1
fi

RESULTS_FILE="${RESULTS_FILE:-docs/release-db-first-e2e-last-run.txt}"
mkdir -p "$(dirname "$RESULTS_FILE")"

{
  echo "=== ScoutX DB-First Release E2E ==="
  echo "Date: $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
  echo "Command: npm run test:e2e:release:db-first"
  echo
  echo "Prüfe PostgreSQL-Verbindung (pg SELECT 1)..."
  if ! command -v pg_isready >/dev/null 2>&1; then
    echo "PostgreSQL-Preflight fehlgeschlagen: 'pg_isready' ist nicht verfügbar." >&2
    exit 1
  fi
  if ! command -v psql >/dev/null 2>&1; then
    echo "PostgreSQL-Preflight fehlgeschlagen: 'psql' ist nicht verfügbar." >&2
    exit 1
  fi
  if ! pg_isready -d "$DB_URL" >/dev/null 2>&1; then
    echo "PostgreSQL-Preflight fehlgeschlagen: pg_isready meldet keine erreichbare DB unter der angegebenen URL." >&2
    exit 1
  fi
  if ! psql "$DB_URL" -v ON_ERROR_STOP=1 -c "SELECT 1;" >/dev/null; then
    echo "PostgreSQL-Preflight fehlgeschlagen: psql SELECT 1 schlug fehl." >&2
    exit 1
  fi
  echo "PostgreSQL-Verbindung erfolgreich."
  echo
  ADAPTER_DATABASE_URL="$DB_URL" npm run test:e2e:release:db-first
} 2>&1 | tee "$RESULTS_FILE"
