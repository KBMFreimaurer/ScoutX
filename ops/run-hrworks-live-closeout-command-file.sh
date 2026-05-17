#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

EXECUTE="false"
CMD_FILE=""
CMD_FILE_FROM_ARG="false"
for arg in "$@"; do
  case "$arg" in
    --execute) EXECUTE="true" ;;
    --*) echo "WARN: Unbekanntes Argument ignoriert: $arg" ;;
    *)
      if [[ -z "$CMD_FILE" ]]; then
        CMD_FILE="$arg"
        CMD_FILE_FROM_ARG="true"
      else
        echo "WARN: Zusätzlicher Positionsparameter ignoriert: $arg"
      fi
      ;;
  esac
done

if [[ -z "$CMD_FILE" ]]; then
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
    CMD_FILE="$candidate"
    break
  done < <(find docs -maxdepth 1 -type f -name 'hrworks-live-closeout-command-*.sh' -print 2>/dev/null | sort -r)
fi

if [[ -z "$CMD_FILE" || ! -f "$CMD_FILE" ]]; then
  echo "FAIL: Keine ausführbare Closeout-Kommando-Datei gefunden"
  echo "Hinweis: Erzeuge eine Datei mit gesetzten Werten, z. B."
  echo "  npm run create:hrworks:live-closeout:cmd-file -- --user='ECHTER NAME' --tenant='ECHTER HRWORKS-MANDANT'"
  echo "Usage: $0 [docs/hrworks-live-closeout-command-*.sh] [--execute]"
  exit 1
fi

if [[ "$CMD_FILE_FROM_ARG" != "true" ]]; then
  echo "INFO: automatische Auswahl: $CMD_FILE"
fi

if [[ "$EXECUTE" == "true" && "$CMD_FILE_FROM_ARG" != "true" ]]; then
  echo "FAIL: Für --execute muss die Kommando-Datei explizit angegeben werden."
  echo "Beispiel:"
  echo "  npm run run:hrworks:live-closeout:cmd-file -- docs/hrworks-live-closeout-command-YYYYMMDDTHHMMSSZ.sh --execute"
  exit 1
fi

if grep -q 'VORNAME NACHNAME' "$CMD_FILE"; then
  echo "FAIL: Platzhalter in --user ist noch nicht ersetzt: $CMD_FILE"
  exit 1
fi

if grep -q 'HRWORKS-MANDANT' "$CMD_FILE"; then
  echo "FAIL: Platzhalter in --tenant ist noch nicht ersetzt: $CMD_FILE"
  exit 1
fi

if [[ "$EXECUTE" != "true" ]]; then
  echo "DRY-RUN: $CMD_FILE ist ausführbar."
  echo "Zum tatsächlichen Ausführen:"
  echo "  $0 \"$CMD_FILE\" --execute"
  exit 0
fi

echo "==> running $CMD_FILE"
bash "$CMD_FILE"
