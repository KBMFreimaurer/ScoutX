#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Dieser Autostart ist nur fuer macOS LaunchAgents gedacht." >&2
  exit 1
fi

LABEL="com.scoutx.hrworks-companion"
DOMAIN="gui/$(id -u)"
PLIST_PATH="$HOME/Library/LaunchAgents/${LABEL}.plist"

launchctl bootout "$DOMAIN" "$PLIST_PATH" >/dev/null 2>&1 || true
launchctl disable "$DOMAIN/$LABEL" >/dev/null 2>&1 || true
rm -f "$PLIST_PATH"

echo "ScoutX HRworks Companion LaunchAgent entfernt."
