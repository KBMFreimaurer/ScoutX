# HRworks Final Blockers (External Only)

Stand: 2026-05-17

## Restziel
Für die vollständige Erreichung von `src/prompt.md` sind nur noch zwei Nachweise offen:

1. `ac8`: Nutzer loggt sich selbst in HRworks ein (Realbetrieb).
2. `ac9`: HRworks-Felder werden robust über Selector-Mapping im echten HRworks-DOM befüllt.

## Aktueller Gate-Status
- `npm run check:hrworks:go-no-go` => **NO-GO**
- Lokal technische Gates grün:
  - `npm run verify:hrworks`
  - `npm run test:sandbox`
- Prompt-Checklist wird im Go/No-Go-Lauf automatisch synchronisiert und geprüft:
  - `npm run update:hrworks:prompt-checklist`
  - `npm run check:hrworks:prompt-checklist`
- Blockierende Gates:
  - `npm run check:hrworks:live-readiness`
  - `npm run check:hrworks:evidence-open-items`
  - `npm run check:hrworks:acceptance-status`

## Externer Abschlussablauf (manuell)
1. Live-Session nach Runbook durchführen:
   - `docs/hrworks-live-session-runbook.md`
   - Kompakter 3-Schritte-Guide: `npm run check:hrworks:external-closeout-steps`
2. Closeout-Befehl erzeugen:
   - `npm run check:hrworks:live-closeout:cmd`
   - Aktuelle Evidence-Datei: `docs/hrworks-live-session-evidence-20260517T131103Z.md`
3. Generierten Befehl mit echten Werten ausführen.
   - Keine Platzhalter/Testwerte verwenden (`Max Mustermann`, `HR Tenant`, `n/a`), da `check:hrworks:live-readiness` diese explizit blockiert.
   - Direkter Aufruf (mit echten Werten ersetzen):
     - `npm run check:hrworks:live-closeout -- "docs/hrworks-live-session-evidence-20260517T131103Z.md" --user="..." --tenant="..." --review=ja --validated=ja --login=ja --prefill=ja --confirm=ja --saved=ja --imported=ja --reference-captured=ja --abort-ok=ja --acceptance=ja --status=imported --open-points="keine"`
   - Alternativ über Skriptdatei:
     - `npm run create:hrworks:live-closeout:cmd-file -- --user="ECHTER NAME" --tenant="ECHTER MANDANT"`
     - `npm run run:hrworks:live-closeout:cmd-file -- docs/hrworks-live-closeout-command-<timestamp>.sh --execute`
   - One-Command-Alternative:
     - `npm run prepare:hrworks:final-closeout -- "docs/hrworks-live-session-evidence-20260517T131103Z.md" --user="ECHTER NAME" --tenant="ECHTER HRWORKS-MANDANT"`
     - optional direkt inkl. Ausführung: `npm run prepare:hrworks:final-closeout -- "docs/hrworks-live-session-evidence-20260517T131103Z.md" --user="ECHTER NAME" --tenant="ECHTER HRWORKS-MANDANT" --execute`
   - Empfohlener End-to-End-Wrapper (inkl. Statusreport):
     - `npm run run:hrworks:final-closeout -- "docs/hrworks-live-session-evidence-20260517T131103Z.md" --user="ECHTER NAME" --tenant="ECHTER HRWORKS-MANDANT"`
   - Env-Var-Alternative (ohne Klartextwerte im Command):
     - `HRW_USER="ECHTER NAME" HRW_TENANT="ECHTER HRWORKS-MANDANT" npm run run:hrworks:final-closeout:env -- "docs/hrworks-live-session-evidence-20260517T131103Z.md"`
   - Exakten Env-Finalbefehl für die aktuelle Evidence-Datei erzeugen:
     - `npm run check:hrworks:final-closeout:env-cmd`
4. Abschluss prüfen:
   - `npm run check:hrworks:go-no-go`
   - Alternativ als finalen Nachweislauf inkl. frischem Statusreport: `npm run run:hrworks:final-audit`

- Prompt-zu-Artefakt-Checklist: `docs/hrworks-prompt-checklist.json`

## Erfolgskriterium
Die Arbeit ist abgeschlossen, wenn:
- `npm run check:hrworks:go-no-go` => `GO`
- `docs/hrworks-acceptance-status.json` => `global_status=complete`
- Neuester konsolidierter Statusreport: `docs/hrworks-status-report-20260517T153448Z.txt`
