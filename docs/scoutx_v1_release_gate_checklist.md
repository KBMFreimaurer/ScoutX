# ScoutX v1 Release Gate Checklist (Go/No-Go)

Stand: 2026-05-14
Last Reviewed (UTC): 2026-05-14T20:25:37Z

Referenzen:
- `docs/scoutx_v1_production_completion_audit.md`
- `docs/scoutx_v1_deployment_runbook.md`
- `docs/scoutx_v1_backup_restore_runbook.md`
- `docs/scoutx_monitoring_runbook.md`

## 1) Security Gate

- [ ] Reset-Token-Leak default aus (`ADAPTER_EXPOSE_RESET_TOKEN_ON_REQUEST=false`)
- [ ] CORS-Allowlist produktiv gesetzt (kein `*`)
- [ ] Secure/SameSite-Cookies gesetzt
- [ ] Auth/CSRF/Rate-Limit Tests grün

## 2) Persistence Gate

- [ ] PostgreSQL erreichbar
- [ ] `ADAPTER_DB_FIRST_MODE=true` in Produktion
- [ ] Health zeigt `dbFirstMode=true` und `dbUrlConfigured=true`
- [ ] Runtime-State ist DB-persistent (Team-Sessions, Invitations, Password-Reset-Tokens, Team-Rate-Limits, Kreis-PDF-Previews)
- [ ] Kein produktiver Write-Pfad hängt an Prozess-Memory als SoT
- [ ] Migrations-/Restore-Test für Zielrelease dokumentiert

## 3) Adapter-Quality Gate

- [ ] Kernroutes funktionieren (Auth, Team-State, Plan, Observations, Notifications)
- [ ] Admin-Diagnostics (`status/jobs/metrics`) erreichbar
- [ ] Ingestion-Jobs ohne `failed`-Status nach Startup-Window

## 4) Frontend Gate

- [ ] Login/Team-Flow funktioniert im produktiven Build
- [ ] Plan- und Observation-Lifecycle nutzbar
- [ ] Notification-Center nutzbar
- [ ] Keine kritischen Console/Runtime-Fehler in Smoke-Flow

## 5) Operations Gate

- [ ] Prometheus scrapt `scoutx-adapter`
- [ ] Alert-Regeln geladen
- [ ] Mindestens 1 Test-Alert/Monitoring-Probe durchgeführt
- [ ] On-call/Incident Kontakt für Release benannt

## 6) Release-Ops Gate

- [ ] Deployment nach `docs/scoutx_v1_deployment_runbook.md` durchgespielt
- [ ] Backup erzeugt und Restore in Staging validiert
- [ ] Rollback-Pfad getestet oder als dry-run verifiziert

## 7) Test Gate (Commands)

- [ ] `npm run lint`
- [ ] `npm run test -- adapter-service/server.test.mjs adapter-service/services/teamDomainServices.test.js`
- [ ] `ADAPTER_DATABASE_URL=<postgres-url> npm run test:adapter:db-sot`
- [ ] `npm run test:adapter:runtime-restart`
- [ ] `ADAPTER_DATABASE_URL=<postgres-url> npm run test -- adapter-service/server.runtime-restart.db.test.mjs`
- [ ] `npm run test -- src/context/teamBackendStateSync.test.js src/context/useTeamObservationActions.test.js src/context/useTeamPlanningActions.test.js`
- [ ] `ADAPTER_DATABASE_URL=<postgres-url> npm run test:e2e:release` (darf nicht `skipped` sein)
- [ ] `ADAPTER_DATABASE_URL=<postgres-url> npm run release:p8:gate` (strict, keine Excludes/Fallbacks)

## 8) Entscheidungsprotokoll

- Release-Kandidat / Tag:
- Datum / Uhrzeit:
- Entscheider:
- Ergebnis: `GO` / `NO-GO`
- Begründung:
- Rest-Risiken:

## 9) Letzte Command-Ergebnisse (Ist-Stand)

Stand: 2026-05-14

- `npm run test:e2e:release`
  - Ergebnis: `1 skipped` (Stand 2026-05-14T20:02:50Z; DB-First Release-E2E ist aktiv, benötigt für Ausführung `ADAPTER_DATABASE_URL`/`DATABASE_URL`)
- `npm run test:e2e:release:db-first`
  - Ergebnis: `failed` mit klarer Vorbedingung `ADAPTER_DATABASE_URL oder DATABASE_URL ist erforderlich.`
- `ADAPTER_DATABASE_URL=postgresql://127.0.0.1:59999/postgres npm run test:e2e:release:db-first`
  - Ergebnis: `failed` (Stand 2026-05-14T20:06:26Z) mit `Adapter health timeout: http://127.0.0.1:18787/health`; im stderr zusätzlich `postgres teamState mirror write failed` (`DB_MIRROR_WRITE_FAILED`), da keine echte PostgreSQL-Instanz unter der Test-URL erreichbar ist.
- `ADAPTER_DATABASE_URL=postgresql://127.0.0.1:59999/postgres RESULTS_FILE=docs/release-db-first-e2e-last-run.txt ./ops/run-db-first-release-e2e-with-url.sh`
  - Ergebnis: `failed` (Stand 2026-05-14T20:08:52Z) mit `PostgreSQL-Preflight fehlgeschlagen: pg_isready meldet keine erreichbare DB unter der angegebenen URL.`; vollständiger Laufoutput wurde nach `docs/release-db-first-e2e-last-run.txt` geschrieben.
- `./ops/run-db-first-release-e2e.sh`
  - Ergebnis: `failed` (Stand 2026-05-14T20:04:54Z) in dieser Umgebung mit `docker daemon ist nicht erreichbar.`
- `./ops/run-db-first-release-e2e-with-url.sh`
  - Ergebnis: `failed` in dieser Umgebung mit `ADAPTER_DATABASE_URL oder DATABASE_URL ist erforderlich.`
- `npm run test -- adapter-service/server.test.mjs adapter-service/services/teamDomainServices.test.js adapter-service/lib/teamDbPersistence.test.js`
  - Ergebnis: `59 passed`
- `npm run lint`
  - Ergebnis: erfolgreich (`eslint .`)
- `ADAPTER_DATABASE_URL=<redacted> npm run test:e2e:release:db-first`
  - Ergebnis: `failed (exit 1)` (Stand 2026-05-14T19:58:34Z, vollständiger Output: `docs/release-db-first-e2e-last-run.txt`)
- `npm run test:e2e:release:db-first:local-pg`
  - Ergebnis: `failed` (Stand 2026-05-14T20:05:33Z) weiterhin bereits bei `initdb` mit `FATAL: could not create shared memory segment: Operation not permitted` (`shmget`), daher keine lokale PostgreSQL-Testinstanz startbar (vollständiger Output: `docs/release-db-first-e2e-local-pg-last-run.txt`).
- `GitHub Actions -> CI -> Job e2e-release-db-first (workflow_dispatch)`
  - Ergebnis: `failed` (Stand 2026-05-14T20:21:17Z, siehe Artefakte: `release-db-first-e2e-last-run`, `release-db-first-e2e-playwright-artifacts`).
- `npm run test:e2e:release:db-first:ci`
  - Ergebnis: `failed` (Stand 2026-05-14T20:18:45Z) in dieser Umgebung mit `GitHub CLI ist nicht authentifiziert. Nutze GH_TOKEN/GITHUB_TOKEN oder führe 'gh auth login' aus.`
- `npm run test:e2e:release:db-first:prereqs:ci`
  - Ergebnis: `failed` (Stand 2026-05-14T20:18:05Z) wegen `gh` nicht authentifiziert (`RESULT: NOT_READY`); `docker` ist in diesem Modus kein Pflicht-Check mehr.
- `npm run test:e2e:release:db-first:prereqs`
  - Ergebnis: `failed` (Stand 2026-05-14T20:14:04Z) nur wegen fehlender `ADAPTER_DATABASE_URL`/`DATABASE_URL`; `gh`-Auth ist für `local-db-run` optional (`[warn]`, weiterhin `RESULT: NOT_READY`).
- `echo $GH_TOKEN / $GITHUB_TOKEN`
  - Ergebnis: `missing` (Stand 2026-05-14T20:20:22Z): weder `GH_TOKEN` noch `GITHUB_TOKEN` gesetzt; authentifizierter CI-Trigger aktuell nicht möglich.
- `bash -n ops/run-db-first-release-e2e-with-url.sh && bash -n ops/run-db-first-release-e2e.sh && bash -n ops/run-db-first-release-e2e-local-pg.sh && bash -n ops/check-db-first-release-e2e-prereqs.sh && bash -n ops/update-release-checklist-from-ci-db-first.sh`
  - Ergebnis: `SCRIPT_SYNTAX_OK` (Stand 2026-05-14T20:10:56Z).
- `Artifact-Existenzcheck (Spec/Config/Workflow/Ops/Docs)`
  - Ergebnis: alle Objective-kritischen Artefakte vorhanden (`OK ...` für jede Ziel-Datei, Stand 2026-05-14T20:11:03Z).
- `Konsistenzscan Checklist/Audit (kein pending/unknown-Reststatus)`
  - Ergebnis: keine verbleibenden `pending`/`unknown`-Status in Checklist/Audit (Stand 2026-05-14T20:19:28Z).

## 10) Completion Verdict (Objective)

- 1. Echte PostgreSQL-Testumgebung starten: `offen`
- 2. Backend-Login ohne localStorage-Seeding: `implementiert, nicht final grün verifiziert`
- 3. Plan veröffentlichen: `implementiert, nicht final grün verifiziert`
- 4. Observation seen/report/note: `implementiert, nicht final grün verifiziert`
- 5. Notifications/Audit/Admin-Readiness: `implementiert, nicht final grün verifiziert`
- 6. Playwright-Release-Gates DB-first umgebaut: `erfüllt`
- 7. Release-Checklist mit realen Command-Ergebnissen: `erfüllt`
- Entscheidung: Objective aktuell **nicht achieved**.
