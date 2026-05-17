#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

EVIDENCE_FILE="${1:-}"
if [[ -n "$EVIDENCE_FILE" && "$EVIDENCE_FILE" == --* ]]; then
  EVIDENCE_FILE=""
fi

if [[ -z "$EVIDENCE_FILE" ]]; then
  EVIDENCE_FILE="$(find docs -maxdepth 1 -type f -name 'hrworks-live-session-evidence-20*.md' -print 2>/dev/null | sort | tail -n 1 || true)"
fi

if [[ -z "$EVIDENCE_FILE" || ! -f "$EVIDENCE_FILE" ]]; then
  echo "FAIL: Evidence-Datei nicht gefunden"
  echo "Usage: $0 [docs/hrworks-live-session-evidence-20*.md] --user='Vorname Nachname' --tenant='Mandant'"
  exit 1
fi

if [[ "${1:-}" == "$EVIDENCE_FILE" ]]; then
  shift || true
fi

USER_VALUE=""
TENANT_VALUE=""
for arg in "$@"; do
  case "$arg" in
    --user=*) USER_VALUE="${arg#*=}" ;;
    --tenant=*) TENANT_VALUE="${arg#*=}" ;;
    *)
      echo "WARN: Unbekanntes Argument ignoriert: $arg"
      ;;
  esac
done

if [[ -z "$USER_VALUE" || -z "$TENANT_VALUE" ]]; then
  echo "FAIL: --user und --tenant sind Pflicht"
  echo "Usage: $0 [docs/hrworks-live-session-evidence-20*.md] --user='Vorname Nachname' --tenant='Mandant'"
  exit 1
fi

if echo "$USER_VALUE" | grep -qiE '(vorname nachname|simulation|n/a|unknown)'; then
  echo "FAIL: --user enthält Platzhalter/Testwert"
  exit 1
fi
if echo "$TENANT_VALUE" | grep -qiE '(hrworks-mandant|hr tenant|simulation|n/a|unknown)'; then
  echo "FAIL: --tenant enthält Platzhalter/Testwert"
  exit 1
fi

STAMP="$(date -u +"%Y%m%dT%H%M%SZ")"
OUT_FILE="docs/hrworks-live-closeout-command-${STAMP}.sh"

cat > "$OUT_FILE" <<EOF
#!/usr/bin/env bash
set -euo pipefail

npm run check:hrworks:live-closeout -- "$EVIDENCE_FILE" \\
  --user="$USER_VALUE" \\
  --tenant="$TENANT_VALUE" \\
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

chmod +x "$OUT_FILE"
echo "Wrote $OUT_FILE"
