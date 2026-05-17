#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

MODE="${1:-${MODE:-ci-trigger}}"
if [[ "$MODE" != "ci-trigger" && "$MODE" != "local-db-run" ]]; then
  echo "Usage: ./ops/check-db-first-release-e2e-prereqs.sh [ci-trigger|local-db-run]" >&2
  exit 1
fi

echo "=== ScoutX DB-First Release-E2E Prereqs ==="
echo "Date: $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
echo "Mode: $MODE"
echo

ok=1

check_cmd() {
  local name="$1"
  if command -v "$name" >/dev/null 2>&1; then
    echo "[ok] command available: $name"
  else
    echo "[missing] command not found: $name"
    ok=0
  fi
}

check_cmd node
check_cmd npm
check_cmd gh

if [[ "$MODE" == "local-db-run" ]]; then
  check_cmd docker
  check_cmd pg_isready
  check_cmd psql
fi

echo
if [[ "$MODE" == "ci-trigger" ]]; then
  if gh auth status >/dev/null 2>&1; then
    echo "[ok] gh auth status: authenticated"
  else
    echo "[missing] gh auth status: not authenticated (use GH_TOKEN/GITHUB_TOKEN or gh auth login)"
    ok=0
  fi
else
  if gh auth status >/dev/null 2>&1; then
    echo "[ok] gh auth status: authenticated (optional for local-db-run)"
  else
    echo "[warn] gh auth status: not authenticated (optional for local-db-run)"
  fi
fi

echo
if [[ "$MODE" == "local-db-run" ]]; then
  if [[ -n "${ADAPTER_DATABASE_URL:-${DATABASE_URL:-}}" ]]; then
    DB_URL="${ADAPTER_DATABASE_URL:-${DATABASE_URL:-}}"
    echo "[info] DB URL provided"
    if command -v pg_isready >/dev/null 2>&1 && pg_isready -d "$DB_URL" >/dev/null 2>&1; then
      echo "[ok] pg_isready reached DB"
    else
      echo "[missing] pg_isready could not reach DB URL"
      ok=0
    fi
  else
    echo "[missing] no ADAPTER_DATABASE_URL/DATABASE_URL provided"
    ok=0
  fi
fi

echo
if [[ $ok -eq 1 ]]; then
  echo "RESULT: READY"
  exit 0
fi

echo "RESULT: NOT_READY"
exit 1
