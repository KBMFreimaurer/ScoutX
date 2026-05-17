#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

EVIDENCE_FILE="${1:-}"
if [[ -z "$EVIDENCE_FILE" ]]; then
  EVIDENCE_FILE="$(find docs -maxdepth 1 -type f -name 'hrworks-live-session-evidence-20*.md' -print 2>/dev/null | sort | tail -n 1 || true)"
fi

if [[ -z "$EVIDENCE_FILE" || ! -f "$EVIDENCE_FILE" ]]; then
  echo "FAIL: Evidence-Datei nicht gefunden"
  echo "Usage: HRW_USER='Echter Name' HRW_TENANT='Echter Mandant' $0 [docs/hrworks-live-session-evidence-20*.md]"
  exit 1
fi

if [[ -z "${HRW_USER:-}" || -z "${HRW_TENANT:-}" ]]; then
  echo "FAIL: HRW_USER und HRW_TENANT müssen gesetzt sein"
  echo "Beispiel:"
  echo "  HRW_USER='Echter Name' HRW_TENANT='Echter Mandant' $0 \"$EVIDENCE_FILE\""
  exit 1
fi

exec ./ops/run-hrworks-final-closeout.sh "$EVIDENCE_FILE" --user="$HRW_USER" --tenant="$HRW_TENANT"

