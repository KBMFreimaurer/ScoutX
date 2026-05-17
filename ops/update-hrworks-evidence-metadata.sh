#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

EVIDENCE_FILE="${1:-}"
if [[ -z "$EVIDENCE_FILE" || ! -f "$EVIDENCE_FILE" ]]; then
  echo "FAIL: Evidence-Datei fehlt oder existiert nicht"
  echo "Usage: $0 <docs/hrworks-live-session-evidence-20*.md> --user='Echter Name' --tenant='Echter Mandant'"
  exit 1
fi
shift || true

USER_VALUE=""
TENANT_VALUE=""
for arg in "$@"; do
  case "$arg" in
    --user=*) USER_VALUE="${arg#*=}" ;;
    --tenant=*) TENANT_VALUE="${arg#*=}" ;;
    *) echo "WARN: Unbekanntes Argument ignoriert: $arg" ;;
  esac
done

if [[ -z "$USER_VALUE" || -z "$TENANT_VALUE" ]]; then
  echo "FAIL: --user und --tenant sind Pflicht"
  echo "Usage: $0 <docs/hrworks-live-session-evidence-20*.md> --user='Echter Name' --tenant='Echter Mandant'"
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

tmp_file="$(mktemp)"
cp "$EVIDENCE_FILE" "$tmp_file"

REPLACE_USER="$USER_VALUE" REPLACE_TENANT="$TENANT_VALUE" perl -0pi -e '
  my $user = $ENV{"REPLACE_USER"};
  my $tenant = $ENV{"REPLACE_TENANT"};
  s#^- Durchführender Nutzer:.*$#- Durchführender Nutzer: $user#mg;
  s#^- HRworks Mandant/Umgebung:.*$#- HRworks Mandant/Umgebung: $tenant#mg;
' "$tmp_file"

cp "$tmp_file" "$EVIDENCE_FILE"
rm -f "$tmp_file"
echo "OK: Evidence-Metadaten aktualisiert: $EVIDENCE_FILE"
