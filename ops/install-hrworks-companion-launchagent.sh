#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Dieser Autostart ist nur fuer macOS LaunchAgents gedacht." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LABEL="com.scoutx.hrworks-companion"
DOMAIN="gui/$(id -u)"
PLIST_PATH="$HOME/Library/LaunchAgents/${LABEL}.plist"
LOG_DIR="$HOME/Library/Logs/ScoutX"
NODE_BIN="${NODE_BIN:-$(command -v node || true)}"
BRIDGE_SCRIPT="$REPO_ROOT/scripts/hrworks-automation-bridge.mjs"

if [[ -z "$NODE_BIN" || ! -x "$NODE_BIN" ]]; then
  echo "Node.js wurde nicht gefunden. Setze NODE_BIN=/voller/pfad/zu/node und starte erneut." >&2
  exit 1
fi

if [[ ! -f "$BRIDGE_SCRIPT" ]]; then
  echo "Bridge-Skript fehlt: $BRIDGE_SCRIPT" >&2
  exit 1
fi

xml_escape() {
  sed \
    -e 's/&/\&amp;/g' \
    -e 's/</\&lt;/g' \
    -e 's/>/\&gt;/g' \
    -e 's/"/\&quot;/g' \
    -e "s/'/\&apos;/g"
}

mkdir -p "$HOME/Library/LaunchAgents" "$LOG_DIR"

NODE_XML="$(printf '%s' "$NODE_BIN" | xml_escape)"
REPO_XML="$(printf '%s' "$REPO_ROOT" | xml_escape)"
SCRIPT_XML="$(printf '%s' "$BRIDGE_SCRIPT" | xml_escape)"
STDOUT_XML="$(printf '%s' "$LOG_DIR/hrworks-companion.out.log" | xml_escape)"
STDERR_XML="$(printf '%s' "$LOG_DIR/hrworks-companion.err.log" | xml_escape)"

cat > "$PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${NODE_XML}</string>
    <string>${SCRIPT_XML}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${REPO_XML}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${STDOUT_XML}</string>
  <key>StandardErrorPath</key>
  <string>${STDERR_XML}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
</dict>
</plist>
PLIST

chmod 644 "$PLIST_PATH"

launchctl bootout "$DOMAIN" "$PLIST_PATH" >/dev/null 2>&1 || true
launchctl bootstrap "$DOMAIN" "$PLIST_PATH"
launchctl enable "$DOMAIN/$LABEL" >/dev/null 2>&1 || true
launchctl kickstart -k "$DOMAIN/$LABEL"

for _ in {1..30}; do
  if curl -fsS --max-time 2 http://127.0.0.1:8791/health >/dev/null 2>&1; then
    echo "ScoutX HRworks Companion LaunchAgent installiert und erreichbar."
    echo "Plist: $PLIST_PATH"
    echo "Logs: $LOG_DIR/hrworks-companion.out.log und $LOG_DIR/hrworks-companion.err.log"
    exit 0
  fi
  sleep 1
done

echo "LaunchAgent wurde installiert, aber http://127.0.0.1:8791/health antwortet noch nicht." >&2
echo "Pruefe die Logs:" >&2
echo "  $LOG_DIR/hrworks-companion.out.log" >&2
echo "  $LOG_DIR/hrworks-companion.err.log" >&2
exit 1
