#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[P6-GATE] 1/5 Privacy artefacts vorhanden"
test -f docs/scoutx_privacy_data_inventory.md
test -f docs/scoutx_app_store_privacy_labels.md
test -f docs/scoutx_third_party_rights_review.md
test -f public/privacy-policy.html
test -f public/support.html

echo "[P6-GATE] 2/5 iOS Privacy Manifest vorhanden"
test -f ios/App/App/PrivacyInfo.xcprivacy
rg -n "NSPrivacyTracking" ios/App/App/PrivacyInfo.xcprivacy >/dev/null
rg -n "NSPrivacyAccessedAPITypes" ios/App/App/PrivacyInfo.xcprivacy >/dev/null

echo "[P6-GATE] 3/5 Privacy Links/Support in Statusdoku referenziert"
rg -n "Privacy|Datenschutz|support@scoutx.app|App Privacy" docs/app_store_release_status.md docs/app_store_release_goal.md >/dev/null

echo "[P6-GATE] 4/5 Build/Test baseline"
npm run test -- src/native/deepLinks.test.js
npm run build

echo "[P6-GATE] 5/5 Secret-Sanity (einfache statische Checks)"
if rg -n "sk_live_|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}" src ios public adapter-service --glob '!**/*.map' --glob '!ios/build/**' >/dev/null; then
  echo "[P6-GATE] WARN: Potenzieller Secret-String gefunden. Bitte manuell prüfen."
fi

echo "[P6-GATE] OK - Privacy/Compliance-Gates lokal bestanden."
