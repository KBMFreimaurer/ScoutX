# HRworks Live Session Runbook

## Ziel
Manueller End-to-End-Test des ScoutX-HRworks-Imports mit aktivem Nutzer-Login, ohne Speicherung von Zugangsdaten.

## Voraussetzungen
- Nutzer ist in ScoutX und HRworks berechtigt.
- ScoutX-Plan enthält valide Daten oder eine importierte Arbeitszeitdatei.
- `HRworks Mapping bearbeiten` wurde gegen den echten HRworks-DOM geprüft.
- `HRworks Pflichtfelder` entsprechen den Unternehmensvorgaben.
- Qualitäts-Gates lokal grün:
  - `npm run lint:hrworks`
  - `npm run test:hrworks`
  - optional kombiniert: `npm run verify:hrworks`

## Ablauf
1. In ScoutX `In HRworks importieren` öffnen.
2. Review prüfen. Bei mehrtägigen Plänen wird pro Datum eine eigene HRworks-Abrechnung vorbereitet.
3. HRworks im Browser öffnen.
4. Nutzer loggt sich manuell ein.
5. Runtime-Status in ScoutX prüfen (`HRworks Runtime aktiv`).
6. In HRworks `Reisedaten` anlegen: Zweck und Bemerkung müssen `Sichtung / (Heimmannschaft1 - Heimmannschaft2 - ...)` aus den ScoutX-Spielen des Tages enthalten; Gegnernamen werden nicht übernommen.
7. Datum, Beginn und Ende aus dem ScoutX-Tag übernehmen und speichern.
8. HRworks-Warnung zu fehlenden Zwischenorten bewusst mit `Ja` bestätigen.
9. In `Kilometerangaben` für jedes Leg `+ Neu` / `Neue Kilometerangabe` öffnen und genau einen Streckenabschnitt speichern: `Startort -> Spiel1`, `Spiel1 -> Spiel2`, ..., `letztes Spiel -> Startort`; die Kilometer-Bemerkung bleibt leer.
10. Zur Berichtseite wechseln. HRworks generiert die Berichte aus Reisedaten und Kilometerangaben.
11. `Abschließen` klicken. Falls HRworks auf die Detail-/Übersichtsseite zurückleitet und erneut `Abschließen` zeigt, diesen finalen Abschluss ebenfalls ausführen.
12. Die Abschlusswarnung wegen leerem Zielort mit `Ja` bestätigen.
13. ScoutX darf den Lauf erst als erfolgreich markieren, wenn HRworks den Abschluss bestätigt hat.

## Timing-Nachweis
- Während des Live-Laufs schreibt die Bridge im Terminal strukturierte Timing-Zeilen im Format:
  - `[HRworks][ISO-Zeit][+1234ms] step_name: detail`
- Erwartete Messpunkte:
  - `workflow_start`
  - `travel_entry_open_dashboard` / `travel_entry_open_trips` / `travel_entry_clicked_new`
  - `base_data_filled`
  - `base_data_save_attempt`
  - `base_data_persisted`
  - pro Leg: `leg_open`, `leg_filled`, `leg_save_attempt`, `leg_persisted`
  - `reports_opened`, `reports_complete_attempt`, `reports_completed`
- Zusätzlich speichert ScoutX nach erfolgreichem Lauf in der `HRworks-Importhistorie`:
  - Gesamtlaufzeit (`Laufzeit: ...`)
  - die ersten Timing-Schritte mit Millisekundenwerten
- Für die Live-Evidenz sollten mindestens diese drei Aussagen explizit festgehalten werden:
  - erster Klick startet den Lauf direkt
  - Reisedatum ist beim ersten Save korrekt persistiert
  - alle Legs wurden ohne unnötige Zusatznavigation in richtiger Reihenfolge gespeichert

## Abbruchkriterien
- Feld oder Dropdown in HRworks nicht gefunden.
- Kostenstelle in HRworks nicht auflösbar.
- HRworks-Validierungsfehler beim Speichern.
- Unklare UI-Änderungen in HRworks.
- Unklarer Berichtabschluss: nicht blind fortfahren; Status in HRworks prüfen und bei fehlender Abschlussbestätigung als Fehler markieren.

## Nachweise
- Eintrag in `HRworks-Importhistorie` mit Status `imported` oder `failed`.
- Bei Fehlern: technische Fehlermeldung im Log.
- Ausgefüllte Evidenzvorlage: `docs/hrworks-live-session-evidence-template.md`.
- Optional: `./ops/create-hrworks-live-evidence.sh` erzeugt automatisch eine datierte Evidenzdatei im `docs/`-Ordner.
- Optional (empfohlen): `./ops/create-hrworks-live-evidence-prefilled.sh` erzeugt eine datierte Evidenzdatei mit vorausgefülltem UTC-Zeitpunkt, Commit und Verify-Status.
- Optional: `./ops/prefill-hrworks-evidence-from-local.sh [evidence-file]` ergänzt Verify-/Audit-Basisfelder in einer bestehenden Evidenzdatei.
  - Wenn ein `ScoutX-HRworks-Audit-*.json` vorliegt, werden auch Status, Referenznummer, Laufzeit und die ersten gemessenen Schritte automatisch übernommen.
- Optional: `npm run update:hrworks:evidence-metadata -- <evidence-file> --user="ECHTER NAME" --tenant="ECHTER HRWORKS-MANDANT"` korrigiert nur Nutzer/Mandant in einer bestehenden Evidence-Datei.
- Hinweis zur Dateiauswahl in Scripts: Als „latest evidence“ werden nur timestamp-Dateien `docs/hrworks-live-session-evidence-20*.md` verwendet (nicht die Template-Datei).
- Formeller Readiness-Check: `npm run check:hrworks:live-readiness` (muss `OK` melden).
  - Bei `FAIL` listet der Check offene `ja/nein`-Platzhalter, `nein` bei Pflicht-`ja`-Nachweisen und leere Pflichtfelder inkl. Zeilennummern.
  - Bei Platzhalter/Testwerten in Nutzer/Mandant gibt der Check direkte Recovery-Kommandos mit echten Werten aus.
- Detail-Check offener Nachweispunkte: `npm run check:hrworks:evidence-open-items`.
- Prompt-zu-Artefakt-Checklist-Gate: `npm run check:hrworks:prompt-checklist`.
- Doku-Konsistenz-Gate (Report-Referenzen + Pflichtbefehle): `npm run check:hrworks:doc-consistency`.
- Status-Gate auf AK-Ebene: `npm run check:hrworks:acceptance-status`.
- Optionaler AK-Sync aus Evidence: `npm run update:hrworks:acceptance-from-evidence`.
- Live-Closeout in einem Schritt (Evidence finalisieren + AK sync + Go/No-Go):
  - Hinweis: `check:hrworks:live-closeout` verlangt jetzt eine explizite Evidence-Datei als erstes Argument.
  - Wichtig: `--user` und `--tenant` müssen echte Werte sein; Platzhalter/Testwerte (z. B. `Max Mustermann`, `HR Tenant`, `n/a`) blockieren den Readiness-Check.
  - `npm run check:hrworks:live-closeout -- <evidence-file> --user=... --tenant=... --review=ja --validated=ja --login=ja --prefill=ja --confirm=ja --saved=ja --imported=ja --reference-captured=ja --abort-ok=ja --acceptance=ja --status=imported --open-points="keine"`
  - Befehlsvorlage automatisch erzeugen: `npm run check:hrworks:live-closeout:cmd`
  - Ausführbare Kommando-Datei erzeugen: `npm run create:hrworks:live-closeout:cmd-file -- --user="ECHTER NAME" --tenant="ECHTER HRWORKS-MANDANT"`
  - Ausführbare Kommando-Datei mit Placeholder-Checks ausführen: `npm run run:hrworks:live-closeout:cmd-file -- docs/hrworks-live-closeout-command-<timestamp>.sh --execute`
  - Optionaler One-Command-Flow (Metadaten setzen + Kommando-Datei erzeugen + optional ausführen):
    - `npm run prepare:hrworks:final-closeout -- <evidence-file> --user="ECHTER NAME" --tenant="ECHTER HRWORKS-MANDANT"`
    - mit direkter Ausführung: `npm run prepare:hrworks:final-closeout -- <evidence-file> --user="ECHTER NAME" --tenant="ECHTER HRWORKS-MANDANT" --execute`
  - Optionaler End-to-End-Wrapper (prepare + execute + Statusreport):
    - `npm run run:hrworks:final-closeout -- <evidence-file> --user="ECHTER NAME" --tenant="ECHTER HRWORKS-MANDANT"`
  - Optionaler Env-Var-Flow (ohne Klartextwerte in der Command-History):
    - `HRW_USER="ECHTER NAME" HRW_TENANT="ECHTER HRWORKS-MANDANT" npm run run:hrworks:final-closeout:env -- <evidence-file>`
  - Exakten Env-Finalbefehl für die aktuelle Evidence-Datei ausgeben:
    - `npm run check:hrworks:final-closeout:env-cmd`
- Konsolidierter Go/No-Go-Check: `npm run check:hrworks:go-no-go`.
- Finaler Audit-Check inkl. neuem Statusreport: `npm run run:hrworks:final-audit`.
- Nächste To-dos automatisch anzeigen: `npm run check:hrworks:next-actions`.
- Kompakten External-Closeout-Guide anzeigen: `npm run check:hrworks:external-closeout-steps`.
- Statusreport als Artefakt schreiben: `npm run report:hrworks:status`.
- Handover-Bundle (Statusreport + Next Actions): `npm run report:hrworks:handover`.

## Datenschutz
- Keine Speicherung von Login-Daten.
- Keine Persistenz von Session-Tokens.
- Debug-Screenshots nur bei expliziter Freigabe und gemäß Policy.
