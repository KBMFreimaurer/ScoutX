#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [[ "$#" -eq 0 ]]; then
  echo "FAIL: Parameter fehlen"
  echo "Usage: $0 [docs/hrworks-live-session-evidence-20*.md] --user='Echter Name' --tenant='Echter Mandant'"
  exit 1
fi

echo "==> prepare + execute final closeout"
./ops/prepare-hrworks-final-closeout.sh "$@" --execute

echo "==> write status report"
./ops/generate-hrworks-status-report.sh

LATEST_REPORT="$(ls -1 docs/hrworks-status-report-*.txt | sort | tail -n 1 || true)"
if [[ -n "$LATEST_REPORT" ]]; then
  echo "status_report: $LATEST_REPORT"
fi

