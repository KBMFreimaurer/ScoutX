# ScoutX P8 Completion (QA And TestFlight)

Stand: 2026-05-17

## Ergebnis

P8 ist auf Repo-/Automations-Ebene abgeschlossen: QA-Baselines, Release-E2E-Smoke und Gate-Automation sind vorhanden und grün.  
Manuelle Schritte auf echtem Gerät und in App Store Connect/TestFlight bleiben als operative Release-Aktivitäten bestehen.

## Umgesetzt

- QA-/TestFlight-Checklist angelegt:
  - `docs/scoutx_p8_qa_testflight_checklist.md`
- P8-Gate ergänzt:
  - `ops/check-p8-qa-testflight-gates.sh`
  - `package.json` Script: `release:p8:gate`
- Release-Statusdoku aktualisiert:
  - `docs/app_store_release_status.md`

## Verifikation

- `npm run lint` ✅
- `npm run test` ✅ (50 Dateien, 346 Tests; inkl. Skips)
- `npm run build` ✅
- `npm run test:e2e:release` ✅ (in dieser Umgebung erwartbar `skipped`, da keine DB-URL)
- iOS Simulator Build (`build_sim`, Scheme `App`) ✅
- `npm run release:p8:gate` ✅

Hinweis:
- Das Strict-Gate ist absichtlich ohne lokale Fallbacks ausgelegt. In sandboxed Umgebungen ohne Socket-Bind kann es lokal mit `listen EPERM` fehlschlagen; der verbindliche Nachweis erfolgt in CI/Staging (inkl. PostgreSQL + Playwright).

## Rest bis Submission (P9)

- Physischer Device-Smoke nach Neuinstallation dokumentieren.
- Internal TestFlight-Build und Testerdurchlauf protokollieren.
- Optional External TestFlight.
- Danach P9 (Archive/Upload/Submissionschritte in ASC) durchführen.
