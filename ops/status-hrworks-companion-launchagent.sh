#!/usr/bin/env bash
set -euo pipefail

LABEL="com.scoutx.hrworks-companion"
DOMAIN="gui/$(id -u)"
PLIST_PATH="$HOME/Library/LaunchAgents/${LABEL}.plist"
LOG_DIR="$HOME/Library/Logs/ScoutX"

echo "Plist: $PLIST_PATH"
if [[ -f "$PLIST_PATH" ]]; then
  echo "Plist vorhanden: ja"
else
  echo "Plist vorhanden: nein"
fi

if [[ "$(uname -s)" == "Darwin" ]]; then
  echo
  launchctl print "$DOMAIN/$LABEL" 2>/dev/null || echo "LaunchAgent ist nicht geladen."
fi

echo
if curl -fsS --max-time 2 http://127.0.0.1:8791/health; then
  echo
  echo "Health: erreichbar"
else
  echo "Health: nicht erreichbar"
fi

echo
echo "Logs:"
echo "  $LOG_DIR/hrworks-companion.out.log"
echo "  $LOG_DIR/hrworks-companion.err.log"
