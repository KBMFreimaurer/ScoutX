#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

LOCAL_PG_RESULTS_FILE="${LOCAL_PG_RESULTS_FILE:-docs/release-db-first-e2e-local-pg-last-run.txt}"
mkdir -p "$(dirname "$LOCAL_PG_RESULTS_FILE")"

run() {
  POSTGRES_BIN_DIR="${POSTGRES_BIN_DIR:-/opt/homebrew/opt/postgresql@16/bin}"
  INITDB_BIN="${INITDB_BIN:-$POSTGRES_BIN_DIR/initdb}"
  PG_CTL_BIN="${PG_CTL_BIN:-$POSTGRES_BIN_DIR/pg_ctl}"
  PG_ISREADY_BIN="${PG_ISREADY_BIN:-$POSTGRES_BIN_DIR/pg_isready}"

  if [[ ! -x "$INITDB_BIN" || ! -x "$PG_CTL_BIN" || ! -x "$PG_ISREADY_BIN" ]]; then
    echo "PostgreSQL-Tools nicht gefunden. Erwartet: $POSTGRES_BIN_DIR" >&2
    return 1
  fi

  PG_ROOT="${PG_ROOT:-/private/tmp/scoutx-db-first-e2e-pg16}"
  PG_DATA="${PG_DATA:-$PG_ROOT/data}"
  PG_LOG="${PG_LOG:-$PG_ROOT/postgres.log}"
  POSTGRES_PORT="${POSTGRES_PORT:-55433}"
  POSTGRES_DB="${POSTGRES_DB:-postgres}"
  POSTGRES_USER="${POSTGRES_USER:-$USER}"

  cleanup() {
    "$PG_CTL_BIN" -D "$PG_DATA" stop -m fast >/dev/null 2>&1 || true
  }

  mkdir -p "$PG_ROOT"
  if [[ ! -f "$PG_DATA/PG_VERSION" ]]; then
    if ! "$INITDB_BIN" -D "$PG_DATA" --set=shared_memory_type=mmap --set=dynamic_shared_memory_type=mmap; then
      return 1
    fi
  fi
  trap cleanup EXIT

  "$PG_CTL_BIN" -D "$PG_DATA" -l "$PG_LOG" -o "-p ${POSTGRES_PORT} -h 127.0.0.1 -c shared_memory_type=mmap -c dynamic_shared_memory_type=mmap" start

  for _ in {1..30}; do
    if "$PG_ISREADY_BIN" -h 127.0.0.1 -p "$POSTGRES_PORT" -d "$POSTGRES_DB" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done

  if ! "$PG_ISREADY_BIN" -h 127.0.0.1 -p "$POSTGRES_PORT" -d "$POSTGRES_DB" >/dev/null 2>&1; then
    echo "PostgreSQL wurde nicht rechtzeitig ready. Log: $PG_LOG" >&2
    return 1
  fi

  export ADAPTER_DATABASE_URL="postgresql://${POSTGRES_USER}@127.0.0.1:${POSTGRES_PORT}/${POSTGRES_DB}"
  echo "Starte DB-First Release E2E mit $ADAPTER_DATABASE_URL"

  RESULTS_FILE="${RESULTS_FILE:-docs/release-db-first-e2e-last-run.txt}"
  ADAPTER_DATABASE_URL="$ADAPTER_DATABASE_URL" RESULTS_FILE="$RESULTS_FILE" ./ops/run-db-first-release-e2e-and-update-checklist.sh
}

set +e
run 2>&1 | tee "$LOCAL_PG_RESULTS_FILE"
RUN_EXIT=${PIPESTATUS[0]}
set -e
exit "$RUN_EXIT"
