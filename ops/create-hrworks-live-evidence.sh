#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

TEMPLATE="docs/hrworks-live-session-evidence-template.md"
STAMP="$(date -u +"%Y%m%dT%H%M%SZ")"
OUT_FILE="docs/hrworks-live-session-evidence-${STAMP}.md"

if [[ ! -f "$TEMPLATE" ]]; then
  echo "Template not found: $TEMPLATE" >&2
  exit 1
fi

cp "$TEMPLATE" "$OUT_FILE"

echo "created=${STAMP}" >> "$OUT_FILE"
echo "Wrote $OUT_FILE"
