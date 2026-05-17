#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[P9-GATE] 1/6 P7/P8 Gates vorhanden"
test -x ops/check-p7-app-store-metadata-gates.sh
test -x ops/check-p8-qa-testflight-gates.sh

echo "[P9-GATE] 2/6 Submission Runbook vorhanden"
test -f docs/scoutx_p9_submission_runbook.md
rg -n "Export Compliance|Content Rights|Tracking|App Privacy|Review" docs/scoutx_p9_submission_runbook.md >/dev/null

echo "[P9-GATE] 3/6 Metadata + Privacy Artefakte vorhanden"
test -f docs/scoutx_app_store_metadata_de.md
test -f docs/scoutx_app_store_metadata_en.md
test -f docs/scoutx_app_store_privacy_labels.md
test -f docs/scoutx_third_party_rights_review.md
test -f public/privacy-policy.html
test -f public/support.html

echo "[P9-GATE] 4/6 Build + iOS sync baseline"
npm run build
npm run ios:sync

echo "[P9-GATE] 5/6 Release status enthält Phase-9-Referenz"
rg -n "Phase 9|Submission|Review" docs/app_store_release_status.md docs/app_store_release_goal.md >/dev/null

echo "[P9-GATE] 6/6 Abschlussdokument vorhanden"
test -f docs/scoutx_p9_completion.md

echo "[P9-GATE] OK - Submission Readiness lokal bestanden."
