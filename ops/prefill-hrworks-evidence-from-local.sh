#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

EVIDENCE_FILE="${1:-}"
VERIFY_FILE="docs/hrworks-verification-last-run.txt"
IMPORT_LOG_KEY="scoutx.hrworksImports.v1"

if [[ -z "$EVIDENCE_FILE" ]]; then
  EVIDENCE_FILE="$(find docs -maxdepth 1 -type f -name 'hrworks-live-session-evidence-20*.md' -print 2>/dev/null | sort | tail -n 1 || true)"
fi

if [[ -z "$EVIDENCE_FILE" || ! -f "$EVIDENCE_FILE" ]]; then
  echo "FAIL: Evidence-Datei nicht gefunden"
  exit 1
fi

VERIFY_STATUS="nein"
if [[ -f "$VERIFY_FILE" ]] && grep -q "status=ok" "$VERIFY_FILE"; then
  VERIFY_STATUS="ja"
fi

IMPORT_STATUS=""
IMPORT_PRESENT="nein"
LOG_EXPORT_PRESENT="nein"

# Try reading from docs export first if present
LATEST_AUDIT_JSON="$(ls -1t docs/ScoutX-HRworks-Audit-*.json 2>/dev/null | head -n 1 || true)"
if [[ -n "$LATEST_AUDIT_JSON" && -f "$LATEST_AUDIT_JSON" ]]; then
  LOG_EXPORT_PRESENT="ja"
fi

# Try extracting last status from browser-localstorage snapshot fallback file if user stored one
# If unavailable, keep placeholders for manual completion.

awk \
  -v verify_status="$VERIFY_STATUS" \
  -v import_present="$IMPORT_PRESENT" \
  -v import_status="$IMPORT_STATUS" \
  -v log_export_present="$LOG_EXPORT_PRESENT" \
  '
  /^- Ergebnisdatei \(`docs\/hrworks-verification-last-run.txt`\) aktualisiert: ja\/nein/ {
    print "- Ergebnisdatei (`docs/hrworks-verification-last-run.txt`) aktualisiert: " verify_status;
    next
  }
  /^- HRworks-Importhistorie-Eintrag vorhanden: ja\/nein/ {
    print "- HRworks-Importhistorie-Eintrag vorhanden: " import_present;
    next
  }
  /^- Status \(`imported\/failed\/\.\.\.`\):/ {
    if (length(import_status) > 0) {
      print "- Status (`imported/failed/...`): " import_status;
    } else {
      print $0;
    }
    next
  }
  /^- Audit-Log exportiert \(`JSON`\): ja\/nein/ {
    print "- Audit-Log exportiert (`JSON`): " log_export_present;
    next
  }
  { print }
' "$EVIDENCE_FILE" > "$EVIDENCE_FILE.tmp"

mv "$EVIDENCE_FILE.tmp" "$EVIDENCE_FILE"
echo "OK: Evidence vorbefüllt: $EVIDENCE_FILE"
