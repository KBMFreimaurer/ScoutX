#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[P7-GATE] 1/5 Metadata docs vorhanden (DE+EN)"
test -f docs/scoutx_app_store_metadata_de.md
test -f docs/scoutx_app_store_metadata_en.md

echo "[P7-GATE] 2/5 Pflichtfelder enthalten"
rg -n "App Name|Subtitle|Description|Keywords|Review Notes|What’s New|Altersfreigabe|Age Rating" \
  docs/scoutx_app_store_metadata_de.md docs/scoutx_app_store_metadata_en.md >/dev/null

echo "[P7-GATE] 3/5 Screenshot-/Submission-Checklist vorhanden"
test -f docs/scoutx_app_store_screenshot_checklist.md
rg -n "Screenshot|Review|Privacy|TestFlight|Upload" docs/scoutx_app_store_screenshot_checklist.md >/dev/null

echo "[P7-GATE] 4/5 Privacy/Support-Referenzen konsistent"
rg -n "support@scoutx.app|privacy-policy" \
  docs/scoutx_app_store_metadata_de.md docs/scoutx_app_store_metadata_en.md docs/scoutx_app_store_screenshot_checklist.md >/dev/null

echo "[P7-GATE] 5/5 Build baseline"
npm run build

echo "[P7-GATE] OK - App Store Metadata Gates lokal bestanden."
