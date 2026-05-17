# ScoutX P7 Completion (App Store Metadata)

Stand: 2026-05-17

## Ergebnis

Phase 7 ist auf Artefakt-Ebene abgeschlossen. Das lokalisierte Metadata-Paket und die Submission-Checklist sind erstellt und mit einem lokalen Gate abgesichert.

## Umgesetzte Artefakte

- `docs/scoutx_app_store_metadata_de.md`
- `docs/scoutx_app_store_metadata_en.md`
- `docs/scoutx_app_store_screenshot_checklist.md`
- `ops/check-p7-app-store-metadata-gates.sh`
- `package.json` Script: `release:p7:gate`
- Statusupdate in `docs/app_store_release_status.md`

## Gate-Verifikation

Ausgeführt:
- `npm run release:p7:gate`

Erwartung:
- Vorhandene DE/EN-Metadaten
- Pflichtfeld-Prüfung
- Screenshot-/Submission-Checklist vorhanden
- Privacy/Support-Referenzen konsistent
- Build-Baseline erfolgreich

## Rest bis echter Submission

- ASC-Eintrag und Screenshot-Upload manuell durchführen.
- Reviewer-Account/Notes in ASC final setzen.
- Danach P8 QA/TestFlight vollständig protokollieren.
