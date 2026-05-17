#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

EVIDENCE_FILE=""
USER_VALUE=""
TENANT_VALUE=""
EXECUTE="false"

for arg in "$@"; do
  case "$arg" in
    --user=*) USER_VALUE="${arg#*=}" ;;
    --tenant=*) TENANT_VALUE="${arg#*=}" ;;
    --execute) EXECUTE="true" ;;
    --*) echo "WARN: Unbekanntes Argument ignoriert: $arg" ;;
    *)
      if [[ -z "$EVIDENCE_FILE" ]]; then
        EVIDENCE_FILE="$arg"
      else
        echo "WARN: Zusätzlicher Positionsparameter ignoriert: $arg"
      fi
      ;;
  esac
done

if [[ -z "$EVIDENCE_FILE" ]]; then
  EVIDENCE_FILE="$(find docs -maxdepth 1 -type f -name 'hrworks-live-session-evidence-20*.md' -print 2>/dev/null | sort | tail -n 1 || true)"
fi

if [[ -z "$EVIDENCE_FILE" || ! -f "$EVIDENCE_FILE" ]]; then
  echo "FAIL: Evidence-Datei nicht gefunden"
  echo "Usage: $0 [docs/hrworks-live-session-evidence-20*.md] --user='Echter Name' --tenant='Echter Mandant' [--execute]"
  exit 1
fi

if [[ -z "$USER_VALUE" || -z "$TENANT_VALUE" ]]; then
  echo "FAIL: --user und --tenant sind Pflicht"
  echo "Usage: $0 [docs/hrworks-live-session-evidence-20*.md] --user='Echter Name' --tenant='Echter Mandant' [--execute]"
  exit 1
fi

echo "==> update metadata in $EVIDENCE_FILE"
./ops/update-hrworks-evidence-metadata.sh "$EVIDENCE_FILE" --user="$USER_VALUE" --tenant="$TENANT_VALUE"

echo "==> create closeout command file"
create_out="$(./ops/create-hrworks-live-closeout-command-file.sh "$EVIDENCE_FILE" --user="$USER_VALUE" --tenant="$TENANT_VALUE")"
echo "$create_out"

CMD_FILE="$(printf '%s\n' "$create_out" | sed -n 's/^Wrote //p' | tail -n 1)"
if [[ -z "$CMD_FILE" || ! -f "$CMD_FILE" ]]; then
  echo "FAIL: Kommando-Datei konnte nicht ermittelt werden"
  exit 1
fi

echo "==> prepared"
echo "evidence: $EVIDENCE_FILE"
echo "command_file: $CMD_FILE"

if [[ "$EXECUTE" == "true" ]]; then
  echo "==> execute closeout"
  ./ops/run-hrworks-live-closeout-command-file.sh "$CMD_FILE" --execute
else
  echo "Nächster Schritt:"
  echo "  npm run run:hrworks:live-closeout:cmd-file -- \"$CMD_FILE\" --execute"
fi

