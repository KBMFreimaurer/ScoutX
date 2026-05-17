# ScoutX DB-First Release-E2E CI Runbook

Stand: 2026-05-14
Last Reviewed (UTC): 2026-05-14T20:25:37Z

## Ziel

Den finalen Nachweis für das DB-First Release-E2E Gate mit echter PostgreSQL-Instanz über GitHub Actions erbringen.

## Voraussetzungen

- Zugriff auf das Repository in GitHub.
- GitHub CLI installiert (`gh`).
- Authentifizierung via `GH_TOKEN` oder `GITHUB_TOKEN` (oder interaktiv via `gh auth login`).

## Ausführung

1. Optional Token setzen (headless):

```bash
export GH_TOKEN="<github-token-mit-actions-rechten>"
gh auth status
```

Falls nur `GITHUB_TOKEN` vorhanden ist:

```bash
export GITHUB_TOKEN="<github-token-mit-actions-rechten>"
export GH_TOKEN="$GITHUB_TOKEN"
gh auth status
```

2. Vorab-Prüfung der Voraussetzungen:

```bash
npm run test:e2e:release:db-first:prereqs:ci
```

Hinweis: In `ci-trigger` prüft das Prereq-Skript bewusst **kein** lokales Docker, da PostgreSQL im GitHub-Runner-Service bereitgestellt wird.

Optional lokaler DB-Run-Check:

```bash
npm run test:e2e:release:db-first:prereqs
```

3. Automatisierten CI-Lauf starten:

```bash
npm run test:e2e:release:db-first:ci
```

Hinweis: Das Skript bewertet den Abschlussstatus gezielt über den Job `e2e-release-db-first` (nicht nur über die Workflow-Gesamt-Conclusion).

4. Erwartete Artefakte nach Run:
- `release-db-first-e2e-last-run`
- `release-db-first-e2e-playwright-artifacts`
- `release-db-first-checklist`

5. Artefakte lokal übernehmen (optional, falls nicht durch das CI-Skript bereits erfolgt):

```bash
./ops/apply-ci-db-first-artifacts.sh /pfad/zu/heruntergeladenen/artifacts
```

## Erfolgskriterium

- Workflow `CI` Job `e2e-release-db-first` ist `success`.
- Artefakt `release-db-first-e2e-last-run` zeigt erfolgreichen Lifecycle:
  - Backend-Login ohne LocalStorage-Seeding
  - Plan publish
  - Observation seen/report/note
  - Notifications/Audit/Admin-Readiness Checks
- `docs/scoutx_v1_release_gate_checklist.md` ist im Artefakt `release-db-first-checklist` für den CI-Gate-Eintrag auf `passed` gesetzt.

## Troubleshooting (verifiziert)

- Fehler: `GitHub CLI ist nicht authentifiziert`
  - Ursache: `gh auth status` ist nicht erfolgreich.
  - Fix: `export GH_TOKEN=...` (oder `GITHUB_TOKEN` setzen und nach `GH_TOKEN` spiegeln) oder `gh auth login`.

- Fehler: `RESULT: NOT_READY` bei `npm run test:e2e:release:db-first:prereqs:ci`
  - Ursache: fehlende GitHub-Authentifizierung.
  - Fix: Token/Auth setzen, danach Prereq-Check erneut ausführen.

- Hinweis: lokales Docker ist für `prereqs:ci` nicht erforderlich
  - Der CI-Run nutzt PostgreSQL als Service im GitHub-Runner.
