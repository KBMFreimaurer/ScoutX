#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

EVIDENCE_FILE="${1:-}"
if [[ -z "$EVIDENCE_FILE" ]]; then
  echo "FAIL: Evidence-Datei muss explizit angegeben werden"
  echo "Usage: $0 <docs/hrworks-live-session-evidence-20*.md> [--user=... --tenant=... --review=ja --validated=ja --login=ja --prefill=ja --confirm=ja --saved=ja --imported=ja --reference-captured=ja --abort-ok=ja --acceptance=ja --status=imported --open-points='keine']"
  exit 1
fi

if [[ ! -f "$EVIDENCE_FILE" ]]; then
  echo "FAIL: Evidence-Datei nicht gefunden: $EVIDENCE_FILE"
  exit 1
fi

shift || true

echo "==> finalize live evidence"
npm run -s update:hrworks:live-evidence -- "$EVIDENCE_FILE" "$@"

echo "==> sync acceptance from evidence"
npm run -s update:hrworks:acceptance-from-evidence -- "$EVIDENCE_FILE"

echo "==> run go/no-go"
npm run -s check:hrworks:go-no-go
