#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "HRworks Next Actions"
echo "===================="

# 1) Evidence placeholders
LATEST_EVIDENCE="$(find docs -maxdepth 1 -type f -name 'hrworks-live-session-evidence-20*.md' -print 2>/dev/null | sort | tail -n 1 || true)"
if [[ -n "$LATEST_EVIDENCE" ]]; then
  echo "1) Live-Evidence vervollständigen: $LATEST_EVIDENCE"
  required_patterns=(
    '^1\. Review geöffnet:\s*ja\s*$'
    '^2\. Pflichtfelder validiert:\s*ja\s*$'
    '^3\. Nutzer manuell in HRworks eingeloggt:\s*ja\s*$'
    '^4\. Felder in HRworks korrekt vorbefüllt:\s*ja\s*$'
    '^5\. Finale Nutzerbestätigung vor Speichern:\s*ja\s*$'
    '^6\. Speichern erfolgreich:\s*ja\s*$'
    '^7\. ScoutX Runtime als `imported` markiert:\s*ja\s*$'
    '^- Akzeptanzkriterien im Realbetrieb erfüllt:\s*ja\s*$'
  )
  required_labels=(
    '1. Review geöffnet'
    '2. Pflichtfelder validiert'
    '3. Nutzer manuell in HRworks eingeloggt'
    '4. Felder in HRworks korrekt vorbefüllt'
    '5. Finale Nutzerbestätigung vor Speichern'
    '6. Speichern erfolgreich'
    '7. ScoutX Runtime als `imported` markiert'
    '- Akzeptanzkriterien im Realbetrieb erfüllt'
  )

  if grep -n "ja/nein" "$LATEST_EVIDENCE" >/dev/null; then
    grep -n "ja/nein" "$LATEST_EVIDENCE" | sed 's/^/   - /'
  else
    echo "   - Keine ja/nein-Platzhalter offen (siehe Pflicht-Status unten)"
  fi

  for idx in "${!required_patterns[@]}"; do
    if ! grep -qE "${required_patterns[$idx]}" "$LATEST_EVIDENCE"; then
      echo "   - Pflicht-Status nicht auf ja: ${required_labels[$idx]}"
    fi
  done

  user_line="$(grep -E '^- Durchführender Nutzer:' "$LATEST_EVIDENCE" | head -n 1 || true)"
  tenant_line="$(grep -E '^- HRworks Mandant/Umgebung:' "$LATEST_EVIDENCE" | head -n 1 || true)"
  if echo "$user_line" | grep -qiE '(vorname nachname|simulation|n/a|unknown)'; then
    echo "   - Platzhalter/Testwert bei Nutzer: ${user_line#- }"
  fi
  if echo "$tenant_line" | grep -qiE '(hrworks-mandant|hr tenant|simulation|n/a|unknown)'; then
    echo "   - Platzhalter/Testwert bei Mandant: ${tenant_line#- }"
  fi
else
  echo "1) Live-Evidence erzeugen: ./ops/create-hrworks-live-evidence-prefilled.sh"
fi

# 2) Acceptance status
STATUS_FILE="docs/hrworks-acceptance-status.json"
if [[ -f "$STATUS_FILE" ]]; then
  echo "2) Partielle Akzeptanzkriterien schließen"
  node <<'NODE'
const fs = require('fs');
const p = 'docs/hrworks-acceptance-status.json';
const d = JSON.parse(fs.readFileSync(p, 'utf8'));
const open = (d.acceptance_criteria || []).filter((i) => i.status !== 'fulfilled');
for (const item of open) {
  console.log(`   - ${item.id}: ${item.criterion} [${item.status}]`);
}
NODE
else
  echo "2) Akzeptanzstatus-Datei fehlt: $STATUS_FILE"
fi

echo "3) Kompakten External-Closeout-Guide anzeigen: npm run check:hrworks:external-closeout-steps"
echo "4) Exakten Env-Finalbefehl ausgeben: npm run check:hrworks:final-closeout:env-cmd"
echo "5) Nach Abschluss erneut laufen lassen: npm run check:hrworks:go-no-go"
echo "   - Alternativ als finalen Nachweislauf inkl. frischem Statusreport: npm run run:hrworks:final-audit"
echo "6) Live-Closeout-Befehl erzeugen: npm run check:hrworks:live-closeout:cmd"
echo "7) Live-Closeout-Skriptdatei erzeugen: npm run create:hrworks:live-closeout:cmd-file -- --user=\"ECHTER NAME\" --tenant=\"ECHTER HRWORKS-MANDANT\""
LATEST_CLOSEOUT_CMD_FILE=""
while IFS= read -r candidate; do
  if grep -q 'VORNAME NACHNAME' "$candidate"; then
    continue
  fi
  if grep -q 'HRWORKS-MANDANT' "$candidate"; then
    continue
  fi
  if grep -qiE -- '--user="?Max Mustermann"?' "$candidate"; then
    continue
  fi
  if grep -qiE -- '--tenant="?HR Tenant"?' "$candidate"; then
    continue
  fi
  LATEST_CLOSEOUT_CMD_FILE="$candidate"
  break
done < <(find docs -maxdepth 1 -type f -name 'hrworks-live-closeout-command-*.sh' -print 2>/dev/null | sort -r)
if [[ -n "$LATEST_CLOSEOUT_CMD_FILE" ]]; then
echo "8) Live-Closeout-Skriptdatei ausführen (mit Placeholder-Checks): npm run run:hrworks:live-closeout:cmd-file -- \"$LATEST_CLOSEOUT_CMD_FILE\" --execute"
else
  echo "8) Live-Closeout-Skriptdatei ausführen (mit Placeholder-Checks): npm run run:hrworks:live-closeout:cmd-file -- docs/hrworks-live-closeout-command-<timestamp>.sh --execute"
fi
if [[ -n "$LATEST_EVIDENCE" ]]; then
  echo "9) Nur Metadaten korrigieren (falls Platzhalter): npm run update:hrworks:evidence-metadata -- \"$LATEST_EVIDENCE\" --user=\"ECHTER NAME\" --tenant=\"ECHTER HRWORKS-MANDANT\""
  echo "10) One-Command-Flow (prepare + closeout file): npm run prepare:hrworks:final-closeout -- \"$LATEST_EVIDENCE\" --user=\"ECHTER NAME\" --tenant=\"ECHTER HRWORKS-MANDANT\""
  echo "11) One-Command-Flow inkl. Ausführung + Statusreport: npm run run:hrworks:final-closeout -- \"$LATEST_EVIDENCE\" --user=\"ECHTER NAME\" --tenant=\"ECHTER HRWORKS-MANDANT\""
  echo "12) Env-Var-Flow ohne Klartext in Command-History: HRW_USER='ECHTER NAME' HRW_TENANT='ECHTER HRWORKS-MANDANT' npm run run:hrworks:final-closeout:env -- \"$LATEST_EVIDENCE\""
else
  echo "9) Nur Metadaten korrigieren (falls Platzhalter): npm run update:hrworks:evidence-metadata -- docs/hrworks-live-session-evidence-<timestamp>.md --user=\"ECHTER NAME\" --tenant=\"ECHTER HRWORKS-MANDANT\""
  echo "10) One-Command-Flow (prepare + closeout file): npm run prepare:hrworks:final-closeout -- docs/hrworks-live-session-evidence-<timestamp>.md --user=\"ECHTER NAME\" --tenant=\"ECHTER HRWORKS-MANDANT\""
  echo "11) One-Command-Flow inkl. Ausführung + Statusreport: npm run run:hrworks:final-closeout -- docs/hrworks-live-session-evidence-<timestamp>.md --user=\"ECHTER NAME\" --tenant=\"ECHTER HRWORKS-MANDANT\""
  echo "12) Env-Var-Flow ohne Klartext in Command-History: HRW_USER='ECHTER NAME' HRW_TENANT='ECHTER HRWORKS-MANDANT' npm run run:hrworks:final-closeout:env -- docs/hrworks-live-session-evidence-<timestamp>.md"
fi
echo "13) Externe Blocker/Abschlussplan: docs/hrworks-final-blockers.md"
