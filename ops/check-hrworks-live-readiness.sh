#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

VERIFY_FILE="docs/hrworks-verification-last-run.txt"
EVIDENCE_LATEST="$(find docs -maxdepth 1 -type f -name 'hrworks-live-session-evidence-20*.md' -print 2>/dev/null | sort | tail -n 1 || true)"

if [[ ! -f "$VERIFY_FILE" ]]; then
  echo "FAIL: $VERIFY_FILE fehlt"
  exit 1
fi

if ! grep -q "status=ok" "$VERIFY_FILE"; then
  echo "FAIL: HRworks-Verifikation ist nicht als ok markiert"
  exit 1
fi

if [[ -z "$EVIDENCE_LATEST" ]]; then
  echo "FAIL: Keine HRworks-Live-Evidence-Datei gefunden"
  exit 1
fi

if grep -q "ja/nein" "$EVIDENCE_LATEST"; then
  echo "FAIL: Evidence-Datei enthält noch Platzhalter (ja/nein): $EVIDENCE_LATEST"
  echo "Offene Zeilen:"
  grep -n "ja/nein" "$EVIDENCE_LATEST" | sed 's/^/  - /'
  exit 1
fi

require_yes_line() {
  local label="$1"
  local pattern="$2"
  if ! grep -qE "$pattern" "$EVIDENCE_LATEST"; then
    echo "FAIL: Pflichtnachweis nicht auf 'ja' gesetzt: ${label}"
    grep -nE "$label" "$EVIDENCE_LATEST" | sed 's/^/  - /' || true
    exit 1
  fi
}

require_yes_line "1\\. Review geöffnet:" '^1\. Review geöffnet:\s*ja\s*$'
require_yes_line "2\\. Pflichtfelder validiert:" '^2\. Pflichtfelder validiert:\s*ja\s*$'
require_yes_line "3\\. Nutzer manuell in HRworks eingeloggt:" '^3\. Nutzer manuell in HRworks eingeloggt:\s*ja\s*$'
require_yes_line "4\\. Felder in HRworks korrekt vorbefüllt:" '^4\. Felder in HRworks korrekt vorbefüllt:\s*ja\s*$'
require_yes_line "5\\. Finale Nutzerbestätigung vor Speichern:" '^5\. Finale Nutzerbestätigung vor Speichern:\s*ja\s*$'
require_yes_line "6\\. Speichern erfolgreich:" '^6\. Speichern erfolgreich:\s*ja\s*$'
require_yes_line '7\. ScoutX Runtime als `imported` markiert:' '^7\. ScoutX Runtime als `imported` markiert:\s*ja\s*$'
require_yes_line "- Akzeptanzkriterien im Realbetrieb erfüllt:" '^- Akzeptanzkriterien im Realbetrieb erfüllt:\s*ja\s*$'

EMPTY_REQUIRED_PATTERN='^- (Durchführender Nutzer|HRworks Mandant/Umgebung|Status \(`imported/failed/\.\.\.`\)|Offene Punkte):\s*$'
if grep -nE "$EMPTY_REQUIRED_PATTERN" "$EVIDENCE_LATEST" >/dev/null; then
  echo "FAIL: Pflichtfelder in Evidence-Datei sind leer: $EVIDENCE_LATEST"
  echo "Leere Pflichtzeilen:"
  grep -nE "$EMPTY_REQUIRED_PATTERN" "$EVIDENCE_LATEST" | sed 's/^/  - /'
  exit 1
fi

if grep -q "Offene Punkte:" "$EVIDENCE_LATEST"; then
  # allow section header, but ensure something was actually filled below it
  tail -n 3 "$EVIDENCE_LATEST" | grep -q "Offene Punkte:" && {
    echo "WARN: Offene Punkte nicht konkret ausgefüllt in $EVIDENCE_LATEST"
  }
fi

if grep -qE "ScoutX Version/Commit:\\s*$" "$EVIDENCE_LATEST"; then
  echo "FAIL: ScoutX Version/Commit ist nicht ausgefüllt in $EVIDENCE_LATEST"
  exit 1
fi

USER_LINE="$(grep -E '^- Durchführender Nutzer:' "$EVIDENCE_LATEST" | head -n 1 || true)"
TENANT_LINE="$(grep -E '^- HRworks Mandant/Umgebung:' "$EVIDENCE_LATEST" | head -n 1 || true)"
if echo "$USER_LINE" | grep -qiE '(vorname nachname|simulation|n/a|unknown)'; then
  echo "FAIL: Durchführender Nutzer wirkt wie Platzhalter/Testwert in $EVIDENCE_LATEST"
  echo "  - $USER_LINE"
  exit 1
fi
if echo "$TENANT_LINE" | grep -qiE '(hrworks-mandant|hr tenant|simulation|n/a|unknown)'; then
  echo "FAIL: HRworks Mandant/Umgebung wirkt wie Platzhalter/Testwert in $EVIDENCE_LATEST"
  echo "  - $TENANT_LINE"
  echo "Nächster Schritt (mit echten Werten):"
  echo "  npm run create:hrworks:live-closeout:cmd-file -- --user=\"ECHTER NAME\" --tenant=\"ECHTER HRWORKS-MANDANT\""
  echo "  npm run run:hrworks:live-closeout:cmd-file -- docs/hrworks-live-closeout-command-<timestamp>.sh --execute"
  exit 1
fi

echo "OK: HRworks-Live-Readiness erfüllt ($EVIDENCE_LATEST)"
