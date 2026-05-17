#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[P9-ASC] 1/4 Required docs present"
test -f docs/scoutx_app_store_metadata_de.md
test -f docs/scoutx_app_store_metadata_en.md
test -f docs/scoutx_p9_submission_runbook.md
test -f docs/scoutx_p9_asc_execution_log.md

echo "[P9-ASC] 2/4 Placeholder check"
if rg -n "<your-domain>|TODO|TBD" docs/scoutx_app_store_metadata_de.md docs/scoutx_app_store_metadata_en.md docs/scoutx_p9_submission_runbook.md >/dev/null; then
  echo "[P9-ASC] FAIL: Platzhalter in Submission-relevanten Docs gefunden. Bitte vor ASC-Submit ersetzen."
  exit 1
fi

echo "[P9-ASC] 3/4 Support/Privacy references"
rg -n "support@scoutx.app" docs/scoutx_app_store_metadata_de.md docs/scoutx_app_store_metadata_en.md >/dev/null
rg -n "privacy-policy\\.html" docs/scoutx_app_store_metadata_de.md docs/scoutx_app_store_metadata_en.md >/dev/null

echo "[P9-ASC] 4/4 Release status references P9"
rg -n "Phase 9|Submission" docs/app_store_release_status.md >/dev/null

echo "[P9-ASC] OK - ASC preflight bestanden."
