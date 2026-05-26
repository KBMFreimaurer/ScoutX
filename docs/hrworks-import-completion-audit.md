# HRworks Import Completion Audit

## Ziel/Success Criteria (aus `src/prompt.md`)
ScoutX soll einen kontrollierten, nachvollziehbaren HRworks-Import bereitstellen (inkl. Review-UI, Validierung, Mapping, Duplikatschutz, Audit-Log, Tests, Datenschutz), bevorzugt API/CSV-first und nur fallback-basiert browserautomatisiert.

## Restated Deliverables (konkret)
1. Funktionsfähiger HRworks-Import-Flow in ScoutX mit Review vor Import.
2. Stabiles internes Import-Datenmodell mit Validierung, Duplikatschutz und Audit-Status.
3. Excel/Arbeitszeit-Referenzverarbeitung und Mapping in Importdaten.
4. Mapping-/Setup-Mechanismus für robuste HRworks-Selektoren.
5. Browser-Automation-Flow mit manuellem Nutzerlogin und Save-Bestätigung.
6. Datenschutz- und Logging-Grenzen technisch umgesetzt.
7. Tests für Datenmodell, Parser, UI und Automation.
8. Doku/Runbook/Gates, die realen Rollout und Nachweis abbilden.

## Prompt-zu-Artefakt-Checklist (vollständig)

### Abschnitt 1-3 (Analyse, Datenmodell, UI)
| Requirement | Evidenz | Status |
|---|---|---|
| Analyse der ScoutX-Datenstruktur + technische Notiz | `docs/hrworks-import-plan.md` | Erfüllt |
| Internes HRworks-Datenmodell als Zwischenschicht | `src/services/hrworksImport.js` (`buildHrworksImportPayload`) | Erfüllt |
| Pflichtfeld-/Zeit-/Stundenvalidierung | `validateHrworksImportPayload` + Tests in `src/services/hrworksImport.test.js` | Erfüllt |
| Re-Import-/Duplikatwarnung | `findDuplicateImport` (Plan+Tag oder Zeitfenster), Tests vorhanden | Erfüllt |
| UI-Button `In HRworks importieren` | `src/pages/PlanPage.jsx` | Erfüllt |
| Review-Ansicht vor Import | `src/components/HrworksImportReviewModal.jsx` | Erfüllt |
| Fehlerliste blockiert Importstart | Review-Modal + Validierung, `PlanPage.test.jsx`/`HrworksImportReviewModal.test.jsx` | Erfüllt |
| Option `Nur Exportdatei erstellen` | `src/services/hrworksCsvExport.js` + Modal-Aktion | Erfüllt |
| Option `HRworks-Testlauf ohne Speichern` | Modal-Aktion + Logstatus `needs_review` | Erfüllt |

### Abschnitt 4-6 (API-first, Automation, Mapping)
| Requirement | Evidenz | Status |
|---|---|---|
| API/CSV-first technisch geprüft | Quellen in `docs/hrworks-import-plan.md` | Teilweise |
| Browser-Automation mit Nutzerlogin-Flow | Runtime/Runbook + Mock-Automation | Teilweise |
| Kein Speichern ohne Bestätigung | Guardrail `confirmBeforeSave` + Runtime-Policy | Erfüllt |
| Setup-/Mapping-Modus | `config/hrworks.selectors.json`, `hrworksSelectorMapping.js`, UI-Editor | Erfüllt |
| Selector-Fallback/Abbruch bei fehlendem Feld | `e2e/helpers/hrworksAutomation.js` + Unit-Tests | Erfüllt |

### Abschnitt 7-10 (Excel, Audit-Log, Fehler, Datenschutz)
| Requirement | Evidenz | Status |
|---|---|---|
| Excel-/Arbeitszeitdaten berücksichtigen | CSV/TXT-Parser + Dateiimport + Tests | Teilweise |
| `.xlsx` robust behandelt | explizite Abweisung mit klarer CSV-Hinweismeldung | Erfüllt |
| Lokaler Importstatus/Audit-Log | `appendHrworksImportLog` + Historie in `PlanPage` + JSON-Audit-Export | Erfüllt |
| Statuswerte (`draft/ready/imported/failed/skipped/needs_review`) | `HRWORKS_IMPORT_STATUSES` + Runtime/Buttons | Erfüllt |
| Robuste Fehlerbehandlung (Runtime-Codes) | `hrworksAutomationRuntime.js` Fehlerkatalog + UI-Blocker + Runtime-Statuskarten | Teilweise |
| Blockierte Importversuche nachvollziehbar protokolliert | `PlanPage`: `needs_review` bei fehlenden Entscheidungen, `failed` bei Preflight-Fehlern | Erfüllt |
| Datenschutz/Sicherheit (keine Credentials, minimierte Logs) | keine Credential-Persistenz, Log-Pseudonymisierung/Trunkierung | Teilweise |

### Abschnitt 11-13 (Tests, Vorgehen, Acceptance)
| Requirement | Evidenz | Status |
|---|---|---|
| Tests: Datenmodell/Parser/UI/Automation | breite Unit/UI/Mock-Abdeckung mit grünem Gesamtlauf | Teilweise |
| Bestehende ScoutX-Funktionalität intakt | keine negativen Hinweise in gelaufenen Tests | Teilweise |

### Abschnitt 14 (Rückfragen)
| Requirement | Evidenz | Status |
|---|---|---|
| Zwingende offene Fachfragen adressieren, wenn für Korrektheit nötig | `docs/hrworks-open-questions.md`, `docs/hrworks-live-session-runbook.md`, Evidence-Template | Teilweise |

## Verifikationsbelege (aktueller Stand am 2026-05-26)
- `npm run check:hrworks:go-no-go` ausgeführt am 2026-05-17:
  - `verify:hrworks`: PASS (`9` Dateien, `46` Tests).
  - `test:sandbox`: PASS (`54 passed | 2 skipped` Dateien, `325 passed | 5 skipped` Tests).
  - `check:hrworks:live-readiness`: FAIL (aktueller Blocker: Platzhalter/Testwert in Metadaten, `HRworks Mandant/Umgebung: HR Tenant`).
  - `check:hrworks:evidence-open-items`: FAIL (aktueller Blocker: Platzhalter/Testwert in Metadaten, `HRworks Mandant/Umgebung: HR Tenant`).
  - `check:hrworks:acceptance-status`: FAIL (`global_status=not_complete`, `fulfilled=14`, `partial=2`).
- Gate-Härtung ergänzt:
  - `ops/check-hrworks-live-readiness.sh` prüft jetzt explizit, dass die Pflichtschritte 1-7 und das Realbetriebs-Ergebnis auf `ja` stehen.
  - `ops/check-hrworks-live-readiness.sh` blockiert Platzhalter/Testwerte in Nutzer/Mandant und gibt direkte Recovery-Kommandos aus.
  - Zusätzlich wurde die automatische Evidence-Auswahl auf timestamp-basierte Dateien (`docs/hrworks-live-session-evidence-20*.md`) eingeschränkt, sodass `docs/hrworks-live-session-evidence-template.md` nicht mehr fälschlich als „latest evidence“ verwendet wird.
- `ops/print-hrworks-next-actions.sh` zeigt zusätzlich Pflichtfelder, die nicht auf `ja` stehen (nicht nur Platzhalter).
- `ops/list-hrworks-evidence-open-items.sh` listet zusätzlich alle Pflicht-`ja`-Nachweise, die noch nicht erfüllt sind, und liefert bei offenen Punkten Exit-Code `1`.
  - Zusätzlich werden Platzhalter/Testwerte in `Durchführender Nutzer` und `HRworks Mandant/Umgebung` als offene Punkte gemeldet.
- `ops/print-hrworks-live-closeout-command.sh` erzeugt eine sichere Kommando-Vorlage für den finalen manuellen Live-Closeout.
- `ops/run-hrworks-live-closeout-command-file.sh` läuft standardmäßig im Dry-Run und führt nur mit `--execute` aus; verhindert so unbeabsichtigte Closeout-Läufe.
- Neuer sicherer One-Command-Flow verfügbar:
  - `ops/prepare-hrworks-final-closeout.sh` (npm alias: `npm run prepare:hrworks:final-closeout`) setzt Metadaten, erzeugt Closeout-Command-Datei und gibt den exakten Execute-Befehl aus (optional direkte Ausführung via `--execute`).
- `npm run report:hrworks:status` erzeugt (zuletzt):
  - `docs/hrworks-status-report-20260526T070754Z.txt`

## Test-/Verifikationsstand (lokal, zusammengefasst)
- Mehrere zielgerichtete Vitest-Suites erfolgreich (u. a. `hrworksImport`, `hrworksExcelParser`, `hrworksCsvExport`, `hrworksSelectorMapping`, `hrworksAutomationRuntime`, `PlanPage`, `HrworksImportReviewModal`).
- ESLint auf geänderten HRworks-Dateien erfolgreich.
- Bridge-/Automation-Metriken lokal verifiziert:
  - Cold-Start-Pfad `Dashboard -> Trips -> Neue Reisekostenabrechnung`
  - Reload-basierter Nachweis für `base_data_persisted`
  - Schrittmetriken pro Leg (`leg_open`, `leg_filled`, `leg_save_attempt`, `leg_persisted`)
- Echter Browser-E2E gegen reales HRworks in dieser Umgebung nicht durchgeführt (Sandbox-/Umgebungsgrenzen).
- Letzter konsolidierter Nachweislauf:
  - `npm run test:hrworks` → `10 passed, 68 passed`.
  - `npm run lint:hrworks` → ohne Befunde.
  - `npm run verify:hrworks` als kombinierter Gate-Befehl verfügbar.
  - `npx playwright test e2e/hrworks-import-mock.spec.js` → `3 passed`.
  - Letzte vollständige lokale Verifikation bestätigt am `2026-05-26T07:07:54Z` (UTC).
- Zusätzlicher Volltestlauf (`npm test`) durchgeführt:
  - Ergebnis: `54 passed`, `2 failed`, `2 skipped`, `321 passed` Tests.
  - Ausfallgrund der 2 Fehlsuites: Sandbox-Beschränkung `listen EPERM 127.0.0.1` in adapter-service Integrationssuiten (kein fachlicher HRworks-Fehler).
- Sandbox-kompatibler Volltestlauf (`npm run test:sandbox`) durchgeführt:
  - Ergebnis: `54 passed`, `2 skipped` Test Files; `325 passed`, `5 skipped` Tests.
  - Zweck: reproduzierbarer grüner Lauf ohne lokal verbotene Netzwerk-Bindings.

## Offene Punkte für „vollständig erreicht“
1. Realer End-to-End-Test gegen echte HRworks-Session (manueller Login, echtes DOM, echtes Save-Verhalten) mit dokumentierter Evidenz.
2. Tenant-spezifische API-v2/CSV-Entscheidung mit finaler Feld-/Pflichtfeldbelegung und Kostenstellenregel.
3. Direkter `.xlsx`-Parser (falls als Muss definiert) statt aktuellem CSV/TXT-Flow mit `.xlsx`-Abweisung.
4. Vollständige Abdeckung der Fehlerfälle aus Prompt gegen reale HRworks-UI (nicht nur Mock/Unit).
5. Abschlussnachweis, dass alle Akzeptanzkriterien im Realbetrieb erfüllt sind.

## Externe Abhängigkeiten (nicht lokal abschließbar)
- HRworks-Real-E2E benötigt manuelle Anmeldung in einer echten HRworks-Umgebung; dies ist in der aktuellen Sandbox nicht ausführbar.
- Tenant-/Mandantenregeln (Pflichtfelder, Kostenstellen-Policy, finaler Speichermodus) müssen organisatorisch freigegeben werden.
- Ohne echte HRworks-DOM/Session kann die Robustheit gegen produktive UI-Änderungen nur teilweise (Mock/Unit) belegt werden.

## Operative Referenzen
- Live-Session-Ablauf und Gates: `docs/hrworks-live-session-runbook.md`
- Reproduzierbarer Verifikationslauf: `ops/run-hrworks-verification.sh` (schreibt `docs/hrworks-verification-last-run.txt`)
- Real-E2E-Nachweisvorlage: `docs/hrworks-live-session-evidence-template.md`
- Evidence-Scaffold-Skript: `ops/create-hrworks-live-evidence.sh`
- Evidence-Prefill-Skript: `ops/create-hrworks-live-evidence-prefilled.sh`
- Evidence-Update aus lokalen Artefakten: `ops/prefill-hrworks-evidence-from-local.sh`
- Evidence-Metadaten-Quickfix (nur Nutzer/Mandant): `ops/update-hrworks-evidence-metadata.sh` (npm alias: `npm run update:hrworks:evidence-metadata -- <evidence-file> --user="..." --tenant="..."`)
- Evidence-Finalisierung (Ja/Nein + Pflichtmetadaten, mit Pflichtargument-Validierung): `ops/finalize-hrworks-live-evidence.sh` (npm alias: `npm run update:hrworks:live-evidence -- <evidence-file> --user=.. --tenant=.. --review=ja|nein ...`)
- Live-Readiness-Gate: `ops/check-hrworks-live-readiness.sh` (npm alias: `npm run check:hrworks:live-readiness`)
- Evidence-Open-Items-Gate: `ops/list-hrworks-evidence-open-items.sh` (npm alias: `npm run check:hrworks:evidence-open-items`)
- Maschinenlesbarer AK-Status: `docs/hrworks-acceptance-status.json`
- AK-Gate-Skript: `ops/check-hrworks-acceptance-status.sh` (npm alias: `npm run check:hrworks:acceptance-status`)
- AK-Sync aus Live-Evidence: `ops/update-hrworks-acceptance-from-evidence.sh` (npm alias: `npm run update:hrworks:acceptance-from-evidence`)
- Konsolidierter Gate-Runner: `ops/run-hrworks-go-no-go.sh` (npm alias: `npm run check:hrworks:go-no-go`)
  - Enthält auch `npm run test:sandbox` als Stabilitäts-Gate.
  - Synchronisiert vor dem Checklist-Gate automatisch `docs/hrworks-prompt-checklist.json` via `npm run update:hrworks:prompt-checklist`.
- Live-Closeout-Runner: `ops/run-hrworks-live-closeout.sh` (npm alias: `npm run check:hrworks:live-closeout`) verlangt explizite Evidence-Datei zur Vermeidung falscher Auto-Auswahl.
- Live-Closeout-Kommando-Generator: `ops/print-hrworks-live-closeout-command.sh` (npm alias: `npm run check:hrworks:live-closeout:cmd`)
- Live-Closeout-Kommando-Datei-Generator: `ops/create-hrworks-live-closeout-command-file.sh` (npm alias: `npm run create:hrworks:live-closeout:cmd-file`)
- Live-Closeout-Kommando-Datei-Runner mit Placeholder-Checks und `--execute`-Freigabe: `ops/run-hrworks-live-closeout-command-file.sh` (npm alias: `npm run run:hrworks:live-closeout:cmd-file -- docs/hrworks-live-closeout-command-<timestamp>.sh --execute`)
- One-Command-Final-Closeout-Helper: `ops/prepare-hrworks-final-closeout.sh` (npm alias: `npm run prepare:hrworks:final-closeout -- <evidence-file> --user="ECHTER NAME" --tenant="ECHTER HRWORKS-MANDANT" [--execute]`)
- End-to-End-Final-Closeout-Wrapper (prepare + execute + Statusreport): `ops/run-hrworks-final-closeout.sh` (npm alias: `npm run run:hrworks:final-closeout -- <evidence-file> --user="ECHTER NAME" --tenant="ECHTER HRWORKS-MANDANT"`)
- End-to-End-Final-Closeout-Wrapper via Env-Variablen (ohne Klartextwerte im Command): `ops/run-hrworks-final-closeout-from-env.sh` (npm alias: `HRW_USER="..." HRW_TENANT="..." npm run run:hrworks:final-closeout:env -- <evidence-file>`)
- Env-Finalbefehl-Generator für aktuelle Evidence-Datei: `ops/print-hrworks-final-closeout-env-command.sh` (npm alias: `npm run check:hrworks:final-closeout:env-cmd`)
- Statusreport-Generator: `ops/generate-hrworks-status-report.sh` (npm alias: `npm run report:hrworks:status`)
- Final-Audit-Runner (Go/No-Go + Statusreport): `ops/run-hrworks-final-audit.sh` (npm alias: `npm run run:hrworks:final-audit`)
- Kompakter External-Closeout-Guide (3 zwingende Schritte): `ops/print-hrworks-external-closeout-steps.sh` (npm alias: `npm run check:hrworks:external-closeout-steps`)
- Handover-Bundle: `ops/run-hrworks-handover.sh` (npm alias: `npm run report:hrworks:handover`)
- Offene Fachentscheidungen: `docs/hrworks-open-questions.md`
- Externe Abschluss-Blocker: `docs/hrworks-final-blockers.md`
- Aktueller/neuester Statusreport: `docs/hrworks-status-report-20260526T070754Z.txt`
- Prompt-zu-Artefakt-Checklist (maschinenlesbar): `docs/hrworks-prompt-checklist.json`
- Prompt-zu-Artefakt-Checklist-Gate: `ops/check-hrworks-prompt-checklist.sh` (npm alias: `npm run check:hrworks:prompt-checklist`)
- Prompt-zu-Artefakt-Checklist-Sync aus Acceptance-Status: `ops/update-hrworks-prompt-checklist-status.sh` (npm alias: `npm run update:hrworks:prompt-checklist`)
- Doku-Konsistenz-Gate: `ops/check-hrworks-doc-consistency.sh` (npm alias: `npm run check:hrworks:doc-consistency`)

## Gesamtbewertung
- Implementierungsfortschritt: **hoch**
- Prompt-Ziel vollständig erreicht: **nein** (nur Realbetriebs-Evidenz für manuellen Login + echtes Selector-Mapping fehlt)
