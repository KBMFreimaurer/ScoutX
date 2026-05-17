#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

EVIDENCE_FILE="$(find docs -maxdepth 1 -type f -name 'hrworks-live-session-evidence-20*.md' -print 2>/dev/null | sort | tail -n 1 || true)"
if [[ -z "$EVIDENCE_FILE" || ! -f "$EVIDENCE_FILE" ]]; then
  EVIDENCE_FILE="docs/hrworks-live-session-evidence-<timestamp>.md"
fi

echo "HRworks External Closeout Steps"
echo "==============================="
echo "1) Exakten Env-Finalbefehl anzeigen:"
echo "   npm run check:hrworks:final-closeout:env-cmd"
echo "2) Final-Closeout mit echten Werten ausführen:"
echo "   HRW_USER='ECHTER NAME' HRW_TENANT='ECHTER HRWORKS-MANDANT' npm run run:hrworks:final-closeout:env -- \"$EVIDENCE_FILE\""
echo "3) Finalen Audit-/Gate-Lauf ausführen:"
echo "   npm run run:hrworks:final-audit"

