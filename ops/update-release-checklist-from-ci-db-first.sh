#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

CHECKLIST_FILE="docs/scoutx_v1_release_gate_checklist.md"
RESULTS_FILE="${RESULTS_FILE:-docs/release-db-first-e2e-last-run.txt}"
CI_STATUS="${CI_STATUS:-}"
DATE_UTC="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"

if [[ -z "$CI_STATUS" ]]; then
  if [[ ! -f "$RESULTS_FILE" ]]; then
    echo "Weder CI_STATUS gesetzt noch RESULTS_FILE gefunden: $RESULTS_FILE" >&2
    exit 1
  fi
  if rg -q "^[[:space:]]*[0-9]+ failed|PostgreSQL-Preflight fehlgeschlagen|Error:" "$RESULTS_FILE"; then
    CI_STATUS="failed"
  elif rg -q "^[[:space:]]*[0-9]+ passed" "$RESULTS_FILE"; then
    CI_STATUS="passed"
  else
    CI_STATUS="unknown"
  fi
fi

if [[ "$CI_STATUS" != "passed" && "$CI_STATUS" != "failed" && "$CI_STATUS" != "unknown" ]]; then
  echo "Ungültiger CI_STATUS: $CI_STATUS (erlaubt: passed|failed|unknown)" >&2
  exit 1
fi

STATUS_LINE="- \`GitHub Actions -> CI -> Job e2e-release-db-first (workflow_dispatch)\`"
if [[ "$CI_STATUS" == "passed" ]]; then
  RESULT_LINE="  - Ergebnis: \`passed\` (Stand ${DATE_UTC}, Artefakte: \`release-db-first-e2e-last-run\`, \`release-db-first-e2e-playwright-artifacts\`)."
elif [[ "$CI_STATUS" == "failed" ]]; then
  RESULT_LINE="  - Ergebnis: \`failed\` (Stand ${DATE_UTC}, siehe Artefakte: \`release-db-first-e2e-last-run\`, \`release-db-first-e2e-playwright-artifacts\`)."
else
  RESULT_LINE="  - Ergebnis: \`unknown\` (Stand ${DATE_UTC}, Bitte CI-Run/Artefakte prüfen)."
fi

if ! grep -Fq -- "$STATUS_LINE" "$CHECKLIST_FILE"; then
  {
    echo "$STATUS_LINE"
    echo "$RESULT_LINE"
  } >> "$CHECKLIST_FILE"
else
  awk -v cmd="$STATUS_LINE" -v res="$RESULT_LINE" '
    BEGIN {found=0; replaced=0}
    {
      if ($0 == cmd) { found=1; print; next }
      if (found == 1 && replaced == 0 && $0 ~ /^  - Ergebnis:/) {
        print res
        replaced=1
        found=2
        next
      }
      print
    }
  ' "$CHECKLIST_FILE" > "$CHECKLIST_FILE.tmp"
  mv "$CHECKLIST_FILE.tmp" "$CHECKLIST_FILE"
fi

echo "Checklist aktualisiert: $CHECKLIST_FILE ($CI_STATUS)"
