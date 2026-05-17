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
  echo "Usage: $0 <evidence-file> --user=... --tenant=... --review=ja|nein --validated=ja|nein --login=ja|nein --prefill=ja|nein --confirm=ja|nein --saved=ja|nein --imported=ja|nein --reference-captured=ja|nein --abort-ok=ja|nein --acceptance=ja|nein --status=imported|failed|needs_review|skipped --open-points=..."
  exit 1
fi

shift || true

USER_NAME=""
TENANT=""
REVIEW=""
VALIDATED=""
LOGIN=""
PREFILL=""
CONFIRM=""
SAVED=""
IMPORTED=""
REFERENCE_CAPTURED=""
ABORT_OK=""
ACCEPTANCE=""
STATUS_VALUE=""
OPEN_POINTS=""

for arg in "$@"; do
  case "$arg" in
    --user=*) USER_NAME="${arg#*=}" ;;
    --tenant=*) TENANT="${arg#*=}" ;;
    --review=*) REVIEW="${arg#*=}" ;;
    --validated=*) VALIDATED="${arg#*=}" ;;
    --login=*) LOGIN="${arg#*=}" ;;
    --prefill=*) PREFILL="${arg#*=}" ;;
    --confirm=*) CONFIRM="${arg#*=}" ;;
    --saved=*) SAVED="${arg#*=}" ;;
    --imported=*) IMPORTED="${arg#*=}" ;;
    --reference-captured=*) REFERENCE_CAPTURED="${arg#*=}" ;;
    --abort-ok=*) ABORT_OK="${arg#*=}" ;;
    --acceptance=*) ACCEPTANCE="${arg#*=}" ;;
    --status=*) STATUS_VALUE="${arg#*=}" ;;
    --open-points=*) OPEN_POINTS="${arg#*=}" ;;
    *)
      echo "WARN: Unbekanntes Argument ignoriert: $arg"
      ;;
  esac
done

fail_usage() {
  echo "FAIL: $1"
  echo "Usage: $0 <evidence-file> --user=... --tenant=... --review=ja|nein --validated=ja|nein --login=ja|nein --prefill=ja|nein --confirm=ja|nein --saved=ja|nein --imported=ja|nein --reference-captured=ja|nein --abort-ok=ja|nein --acceptance=ja|nein --status=imported|failed|needs_review|skipped --open-points=..."
  exit 1
}

require_non_empty() {
  local name="$1"
  local value="$2"
  if [[ -z "$value" ]]; then
    fail_usage "Fehlendes Pflichtargument: ${name}"
  fi
}

require_ja_nein() {
  local name="$1"
  local value="$2"
  if [[ "$value" != "ja" && "$value" != "nein" ]]; then
    fail_usage "Ungültiger Wert für ${name}: '${value}' (erlaubt: ja|nein)"
  fi
}

require_non_empty "--user" "$USER_NAME"
require_non_empty "--tenant" "$TENANT"
require_non_empty "--open-points" "$OPEN_POINTS"
require_non_empty "--status" "$STATUS_VALUE"

require_ja_nein "--review" "$REVIEW"
require_ja_nein "--validated" "$VALIDATED"
require_ja_nein "--login" "$LOGIN"
require_ja_nein "--prefill" "$PREFILL"
require_ja_nein "--confirm" "$CONFIRM"
require_ja_nein "--saved" "$SAVED"
require_ja_nein "--imported" "$IMPORTED"
require_ja_nein "--reference-captured" "$REFERENCE_CAPTURED"
require_ja_nein "--abort-ok" "$ABORT_OK"
require_ja_nein "--acceptance" "$ACCEPTANCE"

if [[ "$USER_NAME" =~ ^(n/a|na|none|unknown)$ ]]; then
  fail_usage "Ungültiger Wert für --user: '${USER_NAME}'"
fi
if [[ "$TENANT" =~ ^(n/a|na|none|unknown)$ ]]; then
  fail_usage "Ungültiger Wert für --tenant: '${TENANT}'"
fi

case "$STATUS_VALUE" in
  imported|failed|needs_review|skipped) ;;
  *)
    fail_usage "Ungültiger Wert für --status: '${STATUS_VALUE}'"
    ;;
esac

if [[ "$ACCEPTANCE" == "ja" ]]; then
  OPEN_POINTS_LOWER="$(printf '%s' "$OPEN_POINTS" | tr '[:upper:]' '[:lower:]')"
  for pair in \
    "review:$REVIEW" \
    "validated:$VALIDATED" \
    "login:$LOGIN" \
    "prefill:$PREFILL" \
    "confirm:$CONFIRM" \
    "saved:$SAVED" \
    "imported:$IMPORTED" \
    "abort-ok:$ABORT_OK"; do
    key="${pair%%:*}"
    value="${pair#*:}"
    if [[ "$value" != "ja" ]]; then
      fail_usage "Inkonsistent: --acceptance=ja erfordert ${key}=ja"
    fi
  done
  if [[ "$STATUS_VALUE" != "imported" ]]; then
    fail_usage "Inkonsistent: --acceptance=ja erfordert --status=imported"
  fi
  if [[ "$OPEN_POINTS_LOWER" != "keine" ]]; then
    fail_usage "Inkonsistent: --acceptance=ja erfordert --open-points='keine'"
  fi
fi

tmp_file="$(mktemp)"
cp "$EVIDENCE_FILE" "$tmp_file"

replace_line() {
  local pattern="$1"
  local replacement="$2"
  REPLACE_PATTERN="$pattern" REPLACE_VALUE="$replacement" perl -0pi -e '
    my $pattern = $ENV{"REPLACE_PATTERN"};
    my $value = $ENV{"REPLACE_VALUE"};
    s/^$pattern.*$/$value/mg;
  ' "$tmp_file"
}

replace_line "- Durchführender Nutzer:" "- Durchführender Nutzer: ${USER_NAME}"
replace_line "- HRworks Mandant/Umgebung:" "- HRworks Mandant/Umgebung: ${TENANT}"
replace_line "1\\. Review geöffnet:" "1. Review geöffnet: ${REVIEW}"
replace_line "2\\. Pflichtfelder validiert:" "2. Pflichtfelder validiert: ${VALIDATED}"
replace_line "3\\. Nutzer manuell in HRworks eingeloggt:" "3. Nutzer manuell in HRworks eingeloggt: ${LOGIN}"
replace_line "4\\. Felder in HRworks korrekt vorbefüllt:" "4. Felder in HRworks korrekt vorbefüllt: ${PREFILL}"
replace_line "5\\. Finale Nutzerbestätigung vor Speichern:" "5. Finale Nutzerbestätigung vor Speichern: ${CONFIRM}"
replace_line "6\\. Speichern erfolgreich:" "6. Speichern erfolgreich: ${SAVED}"
replace_line '7\. ScoutX Runtime als `imported` markiert:' "7. ScoutX Runtime als \`imported\` markiert: ${IMPORTED}"
replace_line "8\\. HRworks-Referenz erfasst:" "8. HRworks-Referenz erfasst: ${REFERENCE_CAPTURED}"
replace_line "- Abbruch korrekt erfolgt \\(keine Folgeklicks\\):" "- Abbruch korrekt erfolgt (keine Folgeklicks): ${ABORT_OK}"
replace_line '- Status \(`imported/failed/\.\.\.`\):' "- Status (\`imported/failed/...\`): ${STATUS_VALUE}"
replace_line "- Akzeptanzkriterien im Realbetrieb erfüllt:" "- Akzeptanzkriterien im Realbetrieb erfüllt: ${ACCEPTANCE}"
replace_line "- Offene Punkte:" "- Offene Punkte: ${OPEN_POINTS}"

cp "$tmp_file" "$EVIDENCE_FILE"
rm -f "$tmp_file"

echo "OK: Evidence aktualisiert: $EVIDENCE_FILE"
