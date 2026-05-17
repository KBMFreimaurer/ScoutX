#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

TEMPLATE="docs/hrworks-live-session-evidence-template.md"
VERIFY_FILE="docs/hrworks-verification-last-run.txt"
STAMP="$(date -u +"%Y%m%dT%H%M%SZ")"
STAMP_ISO="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
OUT_FILE="docs/hrworks-live-session-evidence-${STAMP}.md"
COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"

if [[ ! -f "$TEMPLATE" ]]; then
  echo "Template not found: $TEMPLATE" >&2
  exit 1
fi

VERIFY_STATUS="nein"
if [[ -f "$VERIFY_FILE" ]] && grep -q "status=ok" "$VERIFY_FILE"; then
  VERIFY_STATUS="ja"
fi

awk \
  -v stamp_iso="$STAMP_ISO" \
  -v commit="$COMMIT" \
  -v verify_status="$VERIFY_STATUS" \
  '
  BEGIN { }
  /^- Datum \(UTC\):/ { print "- Datum (UTC): " stamp_iso; next }
  /^- ScoutX Version\/Commit:/ { print "- ScoutX Version/Commit: " commit; next }
  /^- `npm run verify:hrworks` ausgeführt: ja\/nein/ {
    print "- `npm run verify:hrworks` ausgeführt: " verify_status;
    next
  }
  { print }
' "$TEMPLATE" > "$OUT_FILE"

{
  echo ""
  echo "created=${STAMP}"
  echo "source_verify_file=${VERIFY_FILE}"
} >> "$OUT_FILE"

echo "Wrote $OUT_FILE"
