# ScoutX P9 Submission Runbook (App Store Connect)

Stand: 2026-05-17

## Ziel

Finalen Release Candidate in App Store Connect hochladen, Compliance korrekt ausfüllen und zur Review einreichen.

## Vorbereitung

1. Sicherstellen, dass P7 und P8 abgeschlossen sind:
   - `npm run release:p7:gate`
   - `npm run release:p8:gate`
2. Metadaten/Screenshots bereit:
   - `docs/scoutx_app_store_metadata_de.md`
   - `docs/scoutx_app_store_metadata_en.md`
   - `docs/scoutx_app_store_screenshot_checklist.md`
3. Privacy/Legal bereit:
   - `docs/scoutx_app_store_privacy_labels.md`
   - `docs/scoutx_privacy_data_inventory.md`
   - `docs/scoutx_third_party_rights_review.md`

## ASC Submission Ablauf

1. Release-Archive in Xcode erstellen und Upload nach ASC.
2. In ASC Build der App-Version zuordnen.
3. Export Compliance beantworten.
4. Content Rights beantworten.
5. Tracking/IDFA-Fragen beantworten (konsistent mit Privacy-Dokumenten).
6. App Privacy Angaben final prüfen.
7. DE/EN Metadaten + Screenshots final prüfen.
8. Review Notes und Reviewer-Credentials eintragen.
9. App zur Review einreichen.

## Nachverfolgung

- Submission-Zeitstempel dokumentieren.
- Falls Rejection:
  - Guideline-Referenz exakt notieren.
  - Fixliste mit Owner/ETA anlegen.
  - Re-Submission mit aktualisierten Notes.
