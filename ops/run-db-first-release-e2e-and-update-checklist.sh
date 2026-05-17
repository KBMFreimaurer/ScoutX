#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DB_URL="${ADAPTER_DATABASE_URL:-${DATABASE_URL:-}}"
if [[ -z "$DB_URL" ]]; then
  echo "ADAPTER_DATABASE_URL oder DATABASE_URL ist erforderlich." >&2
  exit 1
fi

RESULTS_FILE="${RESULTS_FILE:-docs/release-db-first-e2e-last-run.txt}"
CHECKLIST_FILE="docs/scoutx_v1_release_gate_checklist.md"

mkdir -p "$(dirname "$RESULTS_FILE")"

CMD="ADAPTER_DATABASE_URL=<redacted> npm run test:e2e:release:db-first"
DATE_UTC="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"

set +e
ADAPTER_DATABASE_URL="$DB_URL" RESULTS_FILE="$RESULTS_FILE" ./ops/run-db-first-release-e2e-with-url.sh
EXIT_CODE=$?
set -e

if [[ $EXIT_CODE -eq 0 ]]; then
  STATUS_LINE="- \`$CMD\`"
  RESULT_LINE="  - Ergebnis: \`passed\` (Stand ${DATE_UTC}, vollständiger Output: \`${RESULTS_FILE}\`)"
else
  STATUS_LINE="- \`$CMD\`"
  RESULT_LINE="  - Ergebnis: \`failed (exit ${EXIT_CODE})\` (Stand ${DATE_UTC}, vollständiger Output: \`${RESULTS_FILE}\`)"
fi

if ! grep -Fq -- "$STATUS_LINE" "$CHECKLIST_FILE"; then
  {
    echo "$STATUS_LINE"
    echo "$RESULT_LINE"
  } >> "$CHECKLIST_FILE"
else
  # Replace only the first matching result line after the command anchor.
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

echo "Checklist aktualisiert: $CHECKLIST_FILE"
exit $EXIT_CODE
