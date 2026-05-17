#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

STAMP="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
OUT_FILE="docs/hrworks-verification-last-run.txt"

npm run verify:hrworks

{
  echo "timestamp_utc=${STAMP}"
  echo "command=npm run verify:hrworks"
  echo "status=ok"
} > "$OUT_FILE"

echo "Wrote $OUT_FILE"
