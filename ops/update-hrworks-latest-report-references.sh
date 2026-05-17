#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

LATEST_REPORT="$(ls -1 docs/hrworks-status-report-*.txt 2>/dev/null | sort | tail -n 1 || true)"
if [[ -z "$LATEST_REPORT" || ! -f "$LATEST_REPORT" ]]; then
  echo "FAIL: Kein Statusreport gefunden unter docs/hrworks-status-report-*.txt"
  exit 1
fi

update_file() {
  local file="$1"
  local tmp
  tmp="$(mktemp)"
  cp "$file" "$tmp"
  perl -0pi -e 's#docs/hrworks-status-report-\d{8}T\d{6}Z\.txt#'"$LATEST_REPORT"'#g' "$tmp"
  cp "$tmp" "$file"
  rm -f "$tmp"
  echo "OK: updated $file"
}

update_file "docs/hrworks-import-completion-audit.md"
update_file "docs/hrworks-final-blockers.md"

echo "latest_report=$LATEST_REPORT"

