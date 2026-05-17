#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:8787}"
USER_ID="${USER_ID:-user-scout}"
PASSWORD="${PASSWORD:-ScoutX-test-pass-2026}"
CONNECTIONS="${CONNECTIONS:-100}"
DURATION_SEC="${DURATION_SEC:-5}"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

echo "[SSE-SOAK] health check: $BASE_URL/health"
curl -fsS "$BASE_URL/health" >/dev/null

echo "[SSE-SOAK] login as $USER_ID"
LOGIN_HEADERS="$TMP_DIR/login.headers"
LOGIN_BODY="$TMP_DIR/login.body.json"
curl -fsS -D "$LOGIN_HEADERS" \
  -H "content-type: application/json" \
  -X POST "$BASE_URL/api/team/auth/login" \
  -d "{\"userId\":\"$USER_ID\",\"password\":\"$PASSWORD\"}" \
  > "$LOGIN_BODY"

COOKIE="$(grep -i '^set-cookie:' "$LOGIN_HEADERS" | head -n1 | sed -E 's/^set-cookie:[[:space:]]*([^;]+).*/\1/I')"
if [[ -z "${COOKIE:-}" ]]; then
  echo "[SSE-SOAK] no session cookie returned"
  exit 1
fi

echo "[SSE-SOAK] opening $CONNECTIONS stream connections for ${DURATION_SEC}s"
PIDS=()
for i in $(seq 1 "$CONNECTIONS"); do
  curl -sS -N \
    -H "Accept: text/event-stream" \
    -H "Cookie: $COOKIE" \
    "$BASE_URL/api/team/notifications/push/stream" \
    > "$TMP_DIR/stream-$i.log" 2> "$TMP_DIR/stream-$i.err" &
  PIDS+=("$!")
done

sleep "$DURATION_SEC"

READY_COUNT=0
for i in $(seq 1 "$CONNECTIONS"); do
  if grep -q '"type":"ready"' "$TMP_DIR/stream-$i.log"; then
    READY_COUNT=$((READY_COUNT + 1))
  fi
done

for pid in "${PIDS[@]}"; do
  kill "$pid" >/dev/null 2>&1 || true
done
wait || true

echo "[SSE-SOAK] ready frames seen: $READY_COUNT / $CONNECTIONS"
if [[ "$READY_COUNT" -lt "$CONNECTIONS" ]]; then
  echo "[SSE-SOAK] FAIL: not all streams received ready frame"
  exit 1
fi

echo "[SSE-SOAK] PASS"
