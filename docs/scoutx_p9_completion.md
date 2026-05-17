# ScoutX P9 Completion (Submission Readiness)

Stand: 2026-05-17

## Ergebnis

P9 ist als **Submission-Readiness im Repository** abgeschlossen.  
Die tatsächliche ASC-Einreichung bleibt ein manueller Apple-Account-Prozess und kann nicht lokal automatisiert durchgeführt werden.

## Umgesetzt

- Submission-Runbook erstellt:
  - `docs/scoutx_p9_submission_runbook.md`
- P9-Gate ergänzt:
  - `ops/check-p9-submission-readiness-gates.sh`
  - `package.json` Script: `release:p9:gate`
- Release-Status aktualisiert:
  - `docs/app_store_release_status.md`

## Lokale Verifikation

- `npm run release:p9:gate`

## Manuelle Restschritte in ASC

- RC-Build in ASC hochladen/zuordnen.
- Compliance/Content-Rights/Privacy-Formulare final beantworten.
- Review Notes + Reviewer Account eintragen.
- App zur Review einreichen.
