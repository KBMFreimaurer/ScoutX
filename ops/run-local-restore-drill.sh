#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

START_TS="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
TMP_DIR="$(mktemp -d)"
STATE_FILE="$TMP_DIR/team-state.json"
BACKUP_FILE=""
REPORT_FILE="docs/restore-drill-local-last-run.md"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

cat > "$STATE_FILE" <<'JSON'
{
  "version": 1,
  "team": {
    "id": "team-scoutx",
    "name": "ScoutX Team",
    "accounts": [
      { "id": "user-admin", "name": "Leitung", "role": "admin", "teamId": "team-scoutx", "active": true },
      { "id": "user-coordinator", "name": "Koordination", "role": "coordinator", "teamId": "team-scoutx", "active": true },
      { "id": "user-scout", "name": "Scout", "role": "scout", "teamId": "team-scoutx", "active": true },
      { "id": "user-readonly", "name": "Gast", "role": "readonly", "teamId": "team-scoutx", "active": true }
    ]
  },
  "manualGames": [],
  "teamGoals": { "favoriteTeams": [], "favoriteClubs": [], "leaguePriorities": [], "ageGroups": [] },
  "observations": [],
  "feedItems": []
}
JSON

set +e
node adapter-service/scripts/backfill-team-state.mjs --input "$STATE_FILE" --check >/tmp/scoutx_restore_check_before.out 2>/tmp/scoutx_restore_check_before.err
CHECK_BEFORE_CODE=$?
set -e

if [[ "$CHECK_BEFORE_CODE" -ne 0 && "$CHECK_BEFORE_CODE" -ne 2 ]]; then
  echo "Backfill pre-check failed unexpectedly (exit $CHECK_BEFORE_CODE)"
  cat /tmp/scoutx_restore_check_before.err || true
  exit 1
fi

node adapter-service/scripts/backfill-team-state.mjs --input "$STATE_FILE" --backup >/tmp/scoutx_restore_backfill.out 2>/tmp/scoutx_restore_backfill.err
BACKUP_FILE="$(ls -1 "$STATE_FILE".bak.* 2>/dev/null | head -n 1 || true)"

if [[ -z "${BACKUP_FILE:-}" ]]; then
  echo "Expected backup file not found."
  exit 1
fi

cp "$BACKUP_FILE" "$STATE_FILE"
# Simulate post-restore reconciliation: backup restore + backfill + check
node adapter-service/scripts/backfill-team-state.mjs --input "$STATE_FILE" --backup >/tmp/scoutx_restore_reconcile.out 2>/tmp/scoutx_restore_reconcile.err
node adapter-service/scripts/backfill-team-state.mjs --input "$STATE_FILE" --check >/tmp/scoutx_restore_check_after.out 2>/tmp/scoutx_restore_check_after.err

END_TS="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

cat > "$REPORT_FILE" <<EOF
# ScoutX Local Restore Drill Report

Datum (UTC): $END_TS

## Ergebnis

- Status: PASS
- Start: $START_TS
- Ende: $END_TS
- Team-State Testdatei: $STATE_FILE (temp)
- Backup erzeugt: $BACKUP_FILE

## Schritte

1. Backfill Pre-Check ausgeführt (exit: $CHECK_BEFORE_CODE)
2. Backfill mit Backup ausgeführt
3. Restore aus Backup ausgeführt
4. Post-Restore Check erfolgreich
EOF

echo "Local restore drill finished. Report: $REPORT_FILE"
