#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

run_check() {
  local name="$1"
  shift
  echo "==> ${name}"
  if "$@"; then
    echo "PASS: ${name}"
    return 0
  fi
  echo "FAIL: ${name}"
  return 1
}

overall=0

run_check "verify:hrworks" npm run -s verify:hrworks || overall=1
run_check "test:sandbox" npm run -s test:sandbox || overall=1
run_check "check:hrworks:live-readiness" npm run -s check:hrworks:live-readiness || overall=1
run_check "check:hrworks:evidence-open-items" npm run -s check:hrworks:evidence-open-items || overall=1
run_check "update:hrworks:prompt-checklist" npm run -s update:hrworks:prompt-checklist || overall=1
run_check "check:hrworks:prompt-checklist" npm run -s check:hrworks:prompt-checklist || overall=1
run_check "check:hrworks:doc-consistency" npm run -s check:hrworks:doc-consistency || overall=1
run_check "check:hrworks:acceptance-status" npm run -s check:hrworks:acceptance-status || overall=1

if [[ "$overall" -eq 0 ]]; then
  echo "GO: Alle HRworks-Gates erfüllt"
else
  echo "NO-GO: Mindestens ein HRworks-Gate ist offen"
  echo ""
  echo "==> next actions"
  npm run -s check:hrworks:next-actions || true
fi

exit "$overall"
