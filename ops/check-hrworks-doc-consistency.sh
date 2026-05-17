#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

AUDIT_DOC="docs/hrworks-import-completion-audit.md"
BLOCKERS_DOC="docs/hrworks-final-blockers.md"
LATEST_REPORT="$(ls -1 docs/hrworks-status-report-*.txt 2>/dev/null | sort | tail -n 1 || true)"

if [[ -z "$LATEST_REPORT" ]]; then
  echo "FAIL: Kein Statusreport gefunden"
  exit 1
fi

if [[ ! -f "$AUDIT_DOC" || ! -f "$BLOCKERS_DOC" ]]; then
  echo "FAIL: Abschlussdokumente fehlen"
  exit 1
fi

fail=0

check_contains() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  if ! grep -qF "$pattern" "$file"; then
    echo "FAIL: $label fehlt in $file"
    fail=1
  fi
}

check_contains "$AUDIT_DOC" "$LATEST_REPORT" "neuester Statusreport"
check_contains "$BLOCKERS_DOC" "$LATEST_REPORT" "neuester Statusreport"
check_contains "$AUDIT_DOC" "npm run run:hrworks:final-audit" "final-audit command"
check_contains "$BLOCKERS_DOC" "npm run run:hrworks:final-closeout:env" "env final-closeout command"
check_contains "$BLOCKERS_DOC" "npm run check:hrworks:final-closeout:env-cmd" "env-cmd helper"

if [[ "$fail" -eq 1 ]]; then
  exit 1
fi

echo "OK: Dokument-Konsistenz gegeben"
echo "latest_report=$LATEST_REPORT"

