#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "==> Generating status report"
./ops/generate-hrworks-status-report.sh

echo "==> Printing next actions"
./ops/print-hrworks-next-actions.sh

echo "==> Latest artifacts"
ls -1t docs/hrworks-status-report-*.txt 2>/dev/null | head -n 1 | sed 's/^/status_report: /'
find docs -maxdepth 1 -type f -name 'hrworks-live-session-evidence-20*.md' -print 2>/dev/null | sort | tail -n 1 | sed 's/^/evidence: /'
echo "blockers: docs/hrworks-final-blockers.md"
echo "closeout_cmd: npm run check:hrworks:live-closeout:cmd"
