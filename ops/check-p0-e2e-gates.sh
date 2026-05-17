#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[P0-E2E] Running release-gate E2E suite"
echo "[P0-E2E] Hint: requires Playwright/browser runtime and a reachable adapter/web target."

npm run test:e2e:release

echo "[P0-E2E] OK - release E2E gates passed."
