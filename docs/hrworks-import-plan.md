# HRworks-Import Plan (ScoutX)

## Gefundene Datenquellen in ScoutX
- `src/context/PlanContext.jsx`: Plan-Historie (`planHistory`) inkl. `games`, `selectedGameIds`, Metadaten.
- `src/pages/PlanPage.jsx`: aktive Planansicht mit `activeGames`, `startLocation`, Fahrkosten-/Präsenzdaten.
- `src/utils/arbeitszeit.js`: bestehende Minuten-/Zeit-Helfer für Arbeitszeitbezug.
- `src/config/storage.js`: LocalStorage-Keys; erweitert um `hrworksImports` und `hrworksSelectors`.

## Fehlende Pflichtfelder (vor Umsetzung)
- Zielort, Kostenstelle, expliziter Endzeitpunkt je Spiel waren nicht stabil modelliert.
- Keine dedizierte HRworks-Zwischenschicht (normalisiertes Payload-Modell).
- Kein Duplikat-/Importstatus für HRworks-Importe.

## Geplantes/umgesetztes Datenmodell
- Neues Modell `HrworksImportPayload` in `src/services/hrworksImport.js`.
- Felder: `planId`, `employeeName`, `date`, `startTime`, `endTime`, `breakStart`, `breakEnd`, `workHours`, `purpose`, `note`, `departureLocation`, `destinationLocation`, `intermediateStops`, `routeLegs`, `costCenter`, `travelExpenseRequired`, `receiptsRequired`, `sourceGames`, `status`, `createdAt`, `updatedAt`.
- Validierung: Pflichtfelder, Zeitlogik, Arbeitsstunden, negatives Stundenverbot, Duplikatwarnung.
- Mehrtägige ScoutX-Pläne werden mit `buildHrworksDailyImportPayloads` pro Datum in einzelne HRworks-Payloads getrennt.
- Für Planimporte gilt: `purpose` und `note` sind identisch und folgen `Sichtung / (Heimmannschaft1 - Heimmannschaft2 - ...)`; Gegnernamen werden in HRworks-Zweck/Bemerkung nicht übernommen.
- Kilometerroute wird pro Tag als einzelne Legs modelliert: `Startort -> Spiel1 -> Spiel2 -> ... -> Startort`; Zwischenorte bleiben in den Reisedaten bewusst leer, weil HRworks danach eine Warnung anzeigt, die bestätigt wird.

## Geplante/umgesetzte UI-Änderungen
- Neuer Button `In HRworks importieren` in `src/pages/PlanPage.jsx`.
- Neues Review-Modal `HRworks-Import prüfen` in `src/components/HrworksImportReviewModal.jsx`.
- Blockierlogik: Importstart nur ohne Validierungsfehler.
- Audit-Log-Eintrag beim bestätigten Start (`status=ready`).
- Optionaler HRworks-Referenzwert beim Abschluss als `imported` (UI-Prompt + Anzeige in Importhistorie).
- Re-Import-Warnung mit expliziter Nutzerbestätigung.
- Zusatzaktionen im Modal: `Nur Exportdatei erstellen`, `HRworks-Testlauf ohne Speichern`.
- `Nur Exportdatei erstellen` erzeugt nun eine lokale CSV-Datei (`ScoutX-HRworks-Import-YYYY-MM-DD.csv`).
- Neuer CSV-Dateiimport in der Planansicht (`Arbeitszeitdatei importieren`): liest Arbeitszeitdaten ein und öffnet direkt das HRworks-Review.

## API-vor-Automation Bewertung
- Offizielle Hinweise auf API v2 vorhanden (`developers.hrworks.de`).
- Offizieller CSV-Massenimport für Reisekostenabrechnungen dokumentiert (HRworks Help Center, Menü `Reisemanagement/Import/Reisekostenabrechnungsimport`).
- Umsetzung daher als Hybridstrategie: zuerst API/CSV prüfen und bevorzugen; Browser-Automation als Fallback.

Quellen:
- https://developers.hrworks.de/
- https://help.hrworks.de/importe-in-hr-works
- https://www.hrworks.de/produkt/api/

## Geplante/umgesetzte Browser-Automation
- Selektor-Mapping-Datei: `config/hrworks.selectors.json`.
- Mock-Automation mit Playwright: `e2e/helpers/hrworksAutomation.js` + `e2e/hrworks-import-mock.spec.js`.
- Automation-Guardrails: kein Speichern ohne explizite Bestätigung (`confirmBeforeSave`), Abbruch bei fehlendem Feld oder nicht auflösbarem Dropdown-Wert.
- Unit-Tests für Automation-Guardrails: `e2e/helpers/hrworksAutomation.unit.test.js`.
- Runtime-Orchestrierung mit klaren Steps/Fehlercodes/Preflight in `src/services/hrworksAutomationRuntime.js` und Einbindung in `PlanPage`.
- Mock-Zielseite: `public/mock/hrworks-travel-form.html`.
- Robustheitsprinzip: fehlender Selektor => harter Abbruch mit Fehler.
- Setup-/Mapping-Modus in UI: `HRworks Mapping bearbeiten` (JSON-Editing mit Validierung + LocalStorage-Persistenz).
- Tenant-Policy-Modus in UI: `HRworks Pflichtfelder` (JSON-Editing für Default-Kostenstelle + Required-Fields).
- Erweiterte Policy: `requireSaveConfirmation` und `allowDebugScreenshots`.
  - Debug-Screenshots sind runtime-seitig nur zulässig bei aktivierter Policy **und** expliziter Nutzerfreigabe.
  - UI-Abbildung vorhanden: Consent-Checkbox in der Runtime-Karte zeigt `Screenshot erlaubt: Ja/Nein`.
  - Betriebsentscheidungs-Blocker aktiv: `aggregationMode` und `finalSaveMode` müssen gesetzt sein, sonst wird `Import starten` mit klarer Meldung abgebrochen.
  - Erlaubte Werte werden validiert: `aggregationMode` = `per_day|combined`, `finalSaveMode` = `prefill_only|auto_save`.
  - Zusätzlich sichtbare Warnkarte in `PlanPage`, solange diese Entscheidungen fehlen.
  - Schnellhilfe in UI: `HRworks Setup (Empfohlen)` setzt `per_day` + `auto_save`.
- Live-Workflow-Regel aus echter HRworks-Session: Nach dem Speichern der Reisedaten muss die Warnung zu fehlenden Zwischenorten mit `Ja` bestätigt werden. Anschließend wird unter `Kilometerangaben` für jedes Leg über `+ Neu` / `Neue Kilometerangabe` ein separater Kilometerdatensatz angelegt; die Kilometer-Bemerkung bleibt leer. Danach wird `Berichte -> Abschließen` ausgeführt, ein ggf. zweiter Abschlussbutton auf der Detailseite geklickt und die finale Warnung zu leerem Zielort mit `Ja` bestätigt.

## Fortschritt gegen Prompt-Schritte (Stand)
- 1 Analyse/Notiz: erledigt.
- 2 Datenmodell + Validierung: erledigt (Basisumfang).
- 3 UI-Button + Review: erledigt.
- 4 API-zuerst-Strategie: dokumentiert, endgültige Tenant-Entscheidung offen.
- 5 Browser-Automation mit Nutzer-Login: Mock-Prototyp erledigt; Live-Workflow für Reisedaten/Kilometerangaben aus echter Session nachgezogen.
  - Live-Testablauf dokumentiert in `docs/hrworks-live-session-runbook.md`.
- 6 Selector-Mapping: erledigt (Version 1 + UI-Setupmodus).
- 7 Excel-/CSV-Arbeitszeitparser: CSV/Text-Import erledigt; `.xlsx/.xls` werden kontrolliert mit klarer Umwandlungshinweis-Meldung abgefangen.
- 8 Duplikatschutz + Audit-Log: erledigt (lokal).
  - Duplikaterkennung greift bei `gleicher Plan + gleicher Tag` oder identischem Zeitfenster am selben Tag.
- 9 Fehlerbehandlung: teilweise erledigt, echte HRworks-Laufzeitfehler offen; Berichtabschluss wird nicht automatisiert.
- 10 Datenschutz/Sicherheit: teilweise umgesetzt (keine Credentials-Persistenz im aktuellen Stand).
- Pflichtfeld-/Kostenstellen-Regeln sind jetzt lokal konfigurierbar, aber organisatorisch noch nicht final abgestimmt.
- Import-Logs wurden datensparsam reduziert (Pseudonymisierung `executedBy`, Trunkierung technischer Texte).
- 11 Tests: Unit/UI/Mock-Automation vorhanden; echter E2E-Lauf in Sandbox nicht ausführbar.

## Prompt-zu-Artefakt-Checkliste
- 1 Analyse + Doku (`/docs/hrworks-import-plan.md`): erfüllt durch diese Datei.
- 2 Datenmodell (`HrworksImportPayload`) + Validierung: [src/services/hrworksImport.js](/Users/playboiiboggos/.openclaw/workspace/ScoutX/src/services/hrworksImport.js), Tests in `src/services/hrworksImport.test.js`.
- 3 UI-Button + Review-Modal: [src/pages/PlanPage.jsx](/Users/playboiiboggos/.openclaw/workspace/ScoutX/src/pages/PlanPage.jsx), [src/components/HrworksImportReviewModal.jsx](/Users/playboiiboggos/.openclaw/workspace/ScoutX/src/components/HrworksImportReviewModal.jsx), Test in `src/components/HrworksImportReviewModal.test.jsx`.
  - Ergänzende Seiten-UI-Tests in `src/pages/PlanPage.test.jsx` (Button sichtbar/deaktiviert, Review-Dialog öffnet, Fehler blockieren Import).
- 4 API-vor-Automation-Check: dokumentierte Quellen/Strategie in Abschnitt `API-vor-Automation Bewertung`.
- 5 Browser-Automation mit Nutzer-Login-Flow: Runtime/Guardrails in [src/services/hrworksAutomationRuntime.js](/Users/playboiiboggos/.openclaw/workspace/ScoutX/src/services/hrworksAutomationRuntime.js), [e2e/helpers/hrworksAutomation.js](/Users/playboiiboggos/.openclaw/workspace/ScoutX/e2e/helpers/hrworksAutomation.js), Tests vorhanden; echter Live-Run bleibt für Tenant-Selectoren erforderlich.
- 6 Selector-Mapping + Setupmodus: `config/hrworks.selectors.json`, [src/services/hrworksSelectorMapping.js](/Users/playboiiboggos/.openclaw/workspace/ScoutX/src/services/hrworksSelectorMapping.js), UI-Aktion `HRworks Mapping bearbeiten`.
- 7 Excel-/Arbeitszeitdaten: Parser in [src/services/hrworksExcelParser.js](/Users/playboiiboggos/.openclaw/workspace/ScoutX/src/services/hrworksExcelParser.js), Dateiimport in `PlanPage`, Tests in `src/services/hrworksExcelParser.test.js`.
- 8 Duplikatschutz + Audit-Log: `read/appendHrworksImportLog` in `src/services/hrworksImport.js`, Historie-UI in `PlanPage`.
  - Exportfunktion vorhanden: `Audit-Log exportieren` (JSON-Download).
- 9 Fehlerbehandlung: strukturierte Runtime-Fehlercodes und Abbrüche (Services + UI). Echte HRworks-Fehlerpfade nur teilweise verifiziert.
- 10 Datenschutz/Sicherheit: keine Credential-/Token-Persistenz im aktuellen Code; Logs enthalten technische Minimalinfos.
- 11 Tests: `hrworksImport`, `hrworksExcelParser`, `hrworksCsvExport`, `hrworksSelectorMapping`, `hrworksAutomationRuntime`, `HrworksImportReviewModal`, `hrworksAutomation.unit` vorhanden.
- 12 Entwicklungsweise (iterativ + Fortschrittsupdate): umgesetzt; diese Datei wurde fortlaufend aktualisiert.
- 13 Akzeptanzkriterien: teilweise erfüllt. Vollständig offen bis Real-E2E gegen echte HRworks-Session erfolgreich dokumentiert ist; finaler HRworks-Berichtabschluss bleibt bewusst manuell.

## Offene Risiken
- Reale HRworks-DOM kann vom Mock abweichen; Mapping muss im Setup-Modus pro Tenant verifiziert werden.
- API-v2 Detailendpunkte/Scopes müssen gegen echte Kundendoku konkretisiert werden.
- Endzeit wird derzeit teilweise heuristisch aus Spielstart (+120 min) abgeleitet, falls fehlend.
- Unternehmenspflichtfelder (Kostenstelle/Zweck-Policy) sind noch nicht tenant-spezifisch konfiguriert.


## Abschlussaudit
- Detaillierte Matrix: `docs/hrworks-import-completion-audit.md`
- Letzter reproduzierbarer Verifikationslauf: `docs/hrworks-verification-last-run.txt`
