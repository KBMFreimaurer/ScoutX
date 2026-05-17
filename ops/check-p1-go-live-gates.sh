#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[P1-GATE] 1/6 Lint"
npx eslint \
  src/services/scoutxDomain.js \
  src/services/scoutxDomain.test.js \
  src/pages/GamesPage.jsx \
  src/pages/ScoutingHubPage.jsx \
  adapter-service/routes/teamImportTournamentRoutes.js \
  adapter-service/routes/teamPlanningRoutes.js

echo "[P1-GATE] 2/6 P1 domain + flow tests"
NODE_OPTIONS='--localstorage-file=.vitest-localstorage' npx vitest run \
  src/services/scoutxDomain.test.js \
  src/pages/GamesPage.test.jsx \
  src/app.integration.test.jsx \
  src/context/useTeamPlanningActions.test.js \
  src/context/useTeamObservationActions.test.js \
  src/services/dataProvider.test.js

echo "[P1-GATE] 3/6 Build"
npm run build

echo "[P1-GATE] 4/6 Dokumente vorhanden"
test -f docs/scoutx_monitoring_runbook.md
test -f docs/scoutx_team_state_migration_restore_runbook.md
test -f docs/scoutx_restore_drill_staging_checklist.md
test -f docs/role-matrix.md

echo "[P1-GATE] 5/6 Ops Skripte vorhanden"
test -x ops/sse-soak-smoke.sh
test -x ops/run-local-restore-drill.sh
test -x ops/check-p0-go-live-gates.sh

echo "[P1-GATE] 6/6 Progress + Completion Artefakte"
test -f docs/scoutx_go_live_progress.md
test -f docs/scoutx_p1_completion.md

echo "[P1-GATE] OK - alle lokalen P1-Gates sind gruen."
