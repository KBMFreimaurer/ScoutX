#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

overall=0

echo "==> run go/no-go"
if ! ./ops/run-hrworks-go-no-go.sh; then
  overall=1
fi

echo "==> write status report"
./ops/generate-hrworks-status-report.sh

if [[ -x "./ops/update-hrworks-latest-report-references.sh" ]]; then
  echo "==> update latest report references"
  ./ops/update-hrworks-latest-report-references.sh
fi

LATEST_REPORT="$(ls -1 docs/hrworks-status-report-*.txt | sort | tail -n 1 || true)"
if [[ -n "$LATEST_REPORT" ]]; then
  echo "status_report: $LATEST_REPORT"
fi

exit "$overall"
