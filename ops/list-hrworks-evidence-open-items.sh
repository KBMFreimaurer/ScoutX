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
  exit 1
fi

echo "Evidence: $EVIDENCE_FILE"

has_issues=0

echo "Open yes/no placeholders:"
if grep -n "ja/nein" "$EVIDENCE_FILE" >/dev/null; then
  grep -n "ja/nein" "$EVIDENCE_FILE" | sed 's/^/  - /'
  has_issues=1
else
  echo "  - none"
fi

echo "Open empty required key lines:"
required_empty_pattern='^- (Durchführender Nutzer|HRworks Mandant/Umgebung|Status \(`imported/failed/\.\.\.`\)|Offene Punkte):\s*$'
if grep -nE "$required_empty_pattern" "$EVIDENCE_FILE" >/dev/null; then
  grep -nE "$required_empty_pattern" "$EVIDENCE_FILE" | sed 's/^/  - /'
  has_issues=1
else
  echo "  - none"
fi

echo "Open empty optional key lines:"
optional_empty_pattern='^- [^:]+:\s*$'
if grep -nE "$optional_empty_pattern" "$EVIDENCE_FILE" >/dev/null; then
  grep -nE "$optional_empty_pattern" "$EVIDENCE_FILE" \
    | grep -vE "$required_empty_pattern" \
    | sed 's/^/  - /' || true
else
  echo "  - none"
fi

echo "Required yes lines still not 'ja':"
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

missing_required=0
for idx in "${!required_patterns[@]}"; do
  if ! grep -qE "${required_patterns[$idx]}" "$EVIDENCE_FILE"; then
    echo "  - ${required_labels[$idx]}"
    missing_required=1
  fi
done

if [[ "$missing_required" -eq 0 ]]; then
  echo "  - none"
else
  has_issues=1
fi

echo "Placeholder/Test values in metadata:"
user_line="$(grep -E '^- Durchführender Nutzer:' "$EVIDENCE_FILE" | head -n 1 || true)"
tenant_line="$(grep -E '^- HRworks Mandant/Umgebung:' "$EVIDENCE_FILE" | head -n 1 || true)"
placeholder_hits=0
if echo "$user_line" | grep -qiE '(vorname nachname|simulation|n/a|unknown)'; then
  echo "  - ${user_line#- }"
  placeholder_hits=1
fi
if echo "$tenant_line" | grep -qiE '(hrworks-mandant|hr tenant|simulation|n/a|unknown)'; then
  echo "  - ${tenant_line#- }"
  placeholder_hits=1
fi
if [[ "$placeholder_hits" -eq 0 ]]; then
  echo "  - none"
else
  has_issues=1
fi

if [[ "$has_issues" -eq 1 ]]; then
  exit 1
fi
