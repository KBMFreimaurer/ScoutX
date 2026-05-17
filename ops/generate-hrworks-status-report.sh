#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

STAMP="$(date -u +"%Y%m%dT%H%M%SZ")"
OUT="docs/hrworks-status-report-${STAMP}.txt"

{
  echo "timestamp_utc=$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo "command=npm run check:hrworks:go-no-go"
  echo "---"
  npm run -s check:hrworks:go-no-go || true
} > "$OUT"

echo "Wrote $OUT"
