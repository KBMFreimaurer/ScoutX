#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[P8-GATE] 1/5 QA checklist artefact vorhanden"
test -f docs/scoutx_p8_qa_testflight_checklist.md
rg -n "Automated Baseline|Simulator Manual Smoke|Real Device Smoke|TestFlight" docs/scoutx_p8_qa_testflight_checklist.md >/dev/null

echo "[P8-GATE] 2/5 Static quality checks"
npm run lint

echo "[P8-GATE] 3/5 Unit/integration suite"
env -u ADAPTER_DATABASE_URL -u DATABASE_URL npm run test

echo "[P8-GATE] 4/5 Production build + release E2E smoke"
npm run build
if [[ -z "${ADAPTER_DATABASE_URL:-}" && -z "${DATABASE_URL:-}" ]]; then
  echo "[P8-GATE] FAIL: ADAPTER_DATABASE_URL oder DATABASE_URL fehlt für DB-first Release-E2E."
  exit 1
fi
if [[ "${SCOUTX_DB_RESET_BEFORE_E2E:-false}" == "true" ]]; then
  echo "[P8-GATE] DB reset requested (SCOUTX_DB_RESET_BEFORE_E2E=true)"
  node -e '
    const { Client } = require("pg");
    (async () => {
      const connectionString = process.env.ADAPTER_DATABASE_URL || process.env.DATABASE_URL;
      const allowReset = String(process.env.SCOUTX_ALLOW_DB_RESET || "").toLowerCase() === "true";
      const parsed = new URL(connectionString);
      const host = String(parsed.hostname || "").toLowerCase();
      const isLocalHost = host === "127.0.0.1" || host === "localhost" || host === "::1";
      if (!isLocalHost && !allowReset) {
        throw new Error(
          `Refusing DB reset on non-local host (${host}). Set SCOUTX_ALLOW_DB_RESET=true to override.`,
        );
      }
      const client = new Client({ connectionString });
      await client.connect();
      const result = await client.query(
        "SELECT tablename FROM pg_tables WHERE schemaname = '\''public'\'' AND tablename LIKE '\''adapter_%'\''",
      );
      const tables = result.rows.map((row) => row.tablename).filter(Boolean);
      if (tables.length > 0) {
        const joined = tables.map((name) => `\"${name}\"`).join(", ");
        await client.query(`TRUNCATE TABLE ${joined} RESTART IDENTITY CASCADE`);
      }
      await client.end();
    })().catch((error) => {
      console.error("[P8-GATE] DB reset failed:", error?.message || error);
      process.exit(1);
    });
  '
fi
ADAPTER_TEAM_LOGIN_RATE_LIMIT_MAX="${ADAPTER_TEAM_LOGIN_RATE_LIMIT_MAX:-10000}" \
ADAPTER_TEAM_LOGIN_LOCK_THRESHOLD="${ADAPTER_TEAM_LOGIN_LOCK_THRESHOLD:-1000}" \
ADAPTER_TEAM_WRITE_RATE_LIMIT_MAX="${ADAPTER_TEAM_WRITE_RATE_LIMIT_MAX:-10000}" \
npm run test:e2e:release:db-first

echo "[P8-GATE] 5/5 Status docs referenzieren P8/TestFlight"
rg -n "Phase 8|QA And TestFlight|TestFlight" docs/app_store_release_status.md docs/app_store_release_goal.md >/dev/null

echo "[P8-GATE] OK - QA/TestFlight Gates lokal bestanden."
