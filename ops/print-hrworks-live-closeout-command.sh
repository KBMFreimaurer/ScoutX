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
  echo "Usage: $0 [docs/hrworks-live-session-evidence-20*.md]"
  exit 1
fi

cat <<EOF
npm run check:hrworks:live-closeout -- "$EVIDENCE_FILE" \\
  --user="VORNAME NACHNAME" \\
  --tenant="HRWORKS-MANDANT" \\
  --review=ja \\
  --validated=ja \\
  --login=ja \\
  --prefill=ja \\
  --confirm=ja \\
  --saved=ja \\
  --imported=ja \\
  --reference-captured=ja \\
  --abort-ok=ja \\
  --acceptance=ja \\
  --status=imported \\
  --open-points="keine"
EOF
