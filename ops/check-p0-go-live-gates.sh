#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[P0-GATE] 1/4 Lint"
npx eslint adapter-service/server.mjs \
  adapter-service/routes/teamAuthRoutes.js \
  adapter-service/routes/teamPlanningRoutes.js \
  adapter-service/routes/teamNotificationsRoutes.js \
  adapter-service/lib/teamPushDb.js \
  adapter-service/lib/teamRuntimeDb.js \
  adapter-service/services/teamAuthService.js \
  adapter-service/server.test.mjs \
  src/hooks/useScheduleChangeNotifications.js

echo "[P0-GATE] 2/4 Adapter integration tests"
ATTEMPT=1
MAX_ATTEMPTS=3
until NODE_OPTIONS='--localstorage-file=.vitest-localstorage' npx vitest run adapter-service/server.test.mjs; do
  if [[ "$ATTEMPT" -ge "$MAX_ATTEMPTS" ]]; then
    echo "[P0-GATE] Adapter integration tests failed after $ATTEMPT attempts."
    exit 1
  fi
  echo "[P0-GATE] Adapter tests failed (attempt $ATTEMPT/$MAX_ATTEMPTS), retrying..."
  ATTEMPT=$((ATTEMPT + 1))
  sleep 2
done

echo "[P0-GATE] 3/4 Core web flow tests"
NODE_OPTIONS='--localstorage-file=.vitest-localstorage' npx vitest run src/app.integration.test.jsx src/pages/GamesPage.test.jsx

echo "[P0-GATE] 4/4 Build"
npm run build

echo "[P0-GATE] OK - all local P0 gates passed."
