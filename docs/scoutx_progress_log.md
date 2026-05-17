# ScoutX Progress Log

## 2026-05-14 - DB-SoT-Gate ergänzt: echte PostgreSQL-Integrationstest-Suite (Phase 2g.2)

### Umgesetzte Arbeit

- Neue dedizierte DB-SoT-Integrationstestdatei ergänzt:
  - `adapter-service/server.db-sot.test.mjs`
- Neuer Command ergänzt:
  - `npm run test:adapter:db-sot`
- Test-Ziel:
  - Adapter mit `ADAPTER_DB_FIRST_MODE=true` gegen echte PostgreSQL-URL starten
  - `health` auf DB-first prüfen
  - nach Team-State-Write `/api/admin/db-readiness` auf `ok=true` prüfen
- Verhalten ohne DB-URL:
  - Suite skippt bewusst (`describe.skipIf`) statt falsche Positivsignale zu liefern.

### Geänderte Dateien

- `adapter-service/server.db-sot.test.mjs`
- `package.json`
- `adapter-service/README.md`
- `docs/scoutx_v1_release_gate_checklist.md`
- `docs/scoutx_v1_production_completion_audit.md`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run lint`: bestanden.
- `npm run test:adapter:db-sot`: aktuell `skipped` (keine DB-URL in Laufumgebung).
- `npm run test -- adapter-service/server.test.mjs`: bestanden (51/51; bekannter sporadischer EPERM-Port-Bind-Fehlschlag in kombinierten Läufen, isolierter Re-Run grün).

## 2026-05-14 - DB-SoT-Härtung: Admin DB-Readiness-Probe ergänzt (Phase 2g.1)

### Umgesetzte Arbeit

- Neuer Admin-Endpoint für DB-Readiness eingeführt:
  - `GET /api/admin/db-readiness`
- Endpoint liefert:
  - `dbFirstMode`
  - `dbUrlConfigured`
  - `readModes`
  - `probes` je Domäne (accounts/sessions/teamState/notifications/observations/reports/feed/push/archive)
  - abgeleitetes `ok`-Signal (strenger in `DB_FIRST_MODE=true`)
- Implementierung:
  - Route in `adapter-service/routes/adminRoutes.js`
  - Probe-Builder in `adapter-service/server.mjs`
- Doku + Tests ergänzt:
  - Endpoint in `adapter-service/README.md`
  - Integrationstests (auth + payload) in `adapter-service/server.test.mjs`

### Geänderte Dateien

- `adapter-service/routes/adminRoutes.js`
- `adapter-service/server.mjs`
- `adapter-service/server.test.mjs`
- `adapter-service/README.md`
- `docs/scoutx_v1_production_completion_audit.md`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run lint`: bestanden.
- `npm run test -- adapter-service/server.test.mjs`: bestanden (51/51; bekannter sporadischer EPERM-Port-Bind-Fehlschlag in kombinierten Läufen, isolierter Re-Run grün).

## 2026-05-14 - Produktflow ergänzt: dediziertes Team-Audit-Log mit Filterung (Phase 5.1)

### Umgesetzte Arbeit

- Neuer Team-Audit-Log-Endpoint ergänzt:
  - `GET /api/team/audit-log?actorId=<id>&action=<type>&limit=50`
  - Implementierung in `adapter-service/routes/teamAuditRoutes.js`
- Endpoint auf vorhandene Feed-/Activity-Daten aufgesetzt (inkl. optionaler DB-Read-Pfade), damit Actor-/Action-Filter produktiv nutzbar sind.
- API-Doku und Endpoint-Liste aktualisiert:
  - `adapter-service/openapi.team.v1.yaml`
  - `adapter-service/README.md`
- Integrationstests ergänzt:
  - Auth-Schutz für `/api/team/audit-log`
  - Filterfunktion (`actorId`, `action`) nach erzeugter Plan-Publikation

### Geänderte Dateien

- `adapter-service/routes/teamAuditRoutes.js`
- `adapter-service/server.mjs`
- `adapter-service/server.test.mjs`
- `adapter-service/openapi.team.v1.yaml`
- `adapter-service/README.md`
- `docs/scoutx_v1_production_completion_audit.md`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run lint`: bestanden.
- `npm run test -- adapter-service/server.test.mjs`: bestanden (49/49; bekannter sporadischer EPERM-Port-Bind-Fehlschlag in kombinierten Läufen, isolierter Re-Run grün).

## 2026-05-14 - Adapter-Modularisierung fortgesetzt: Public-Data-Routen extrahiert (Phase 3.5)

### Umgesetzte Arbeit

- Public-Data-Endpunkte aus `server.mjs` in eigenes Route-Modul ausgelagert:
  - `adapter-service/routes/publicDataRoutes.js`
  - umfasst:
    - `POST /api/games`
    - `GET /api/clubs/search`
- `server.mjs` verdrahtet jetzt `handlePublicDataRoutes(...)`.
- Der vorherige Inline-Block für diese Endpunkte wurde entfernt.

### Geänderte Dateien

- `adapter-service/routes/publicDataRoutes.js`
- `adapter-service/server.mjs`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run lint`: bestanden.
- `npm run test -- adapter-service/server.test.mjs`: bestanden (47/47; bekannter sporadischer EPERM-Port-Bind-Fehlschlag in kombinierten Läufen, isolierter Re-Run grün).

## 2026-05-14 - Adapter-Modularisierung fortgesetzt: Team-Import/Turnier-Routen extrahiert (Phase 3.4)

### Umgesetzte Arbeit

- Team-Import-/Turnier-Endpunkte aus `server.mjs` in eigenes Route-Modul ausgelagert:
  - `adapter-service/routes/teamImportTournamentRoutes.js`
  - umfasst:
    - `/api/team/tournaments/import/meinturnierplan`
    - `/api/team/tournaments`
    - `/api/team/import/dfb-national-games`
    - `/api/team/import/kreis-pdf`
    - `/api/team/tournaments/:id/matches`
- `server.mjs` verdrahtet nun `handleTeamImportTournamentRoutes(...)` zentral.
- Vorheriger Inline-Block entfernt.

### Geänderte Dateien

- `adapter-service/routes/teamImportTournamentRoutes.js`
- `adapter-service/server.mjs`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run lint`: bestanden.
- `npm run test -- adapter-service/server.test.mjs`: bestanden (47/47; einmaliger EPERM-Port-Bind-Fehlschlag im kombinierten Lauf, isolierter Re-Run grün).

## 2026-05-14 - Adapter-Modularisierung fortgesetzt: Team-Planung/Observations-Routen extrahiert (Phase 3.3)

### Umgesetzte Arbeit

- Team-Planungs-/Observation-Endpunkte aus `server.mjs` in ein eigenes Route-Modul ausgelagert:
  - `adapter-service/routes/teamPlanningRoutes.js`
  - umfasst:
    - `/api/team/conflicts`
    - `/api/team/plans`
    - `/api/team/members`
    - `/api/team/manual-games`
    - `/api/team/goals`
    - `/api/team/observations/seen`
    - `/api/team/observations/report`
    - `/api/team/observations/note`
- `server.mjs` verdrahtet nun `handleTeamPlanningRoutes(...)` zentral.
- Der vorherige Inline-Block für diese Endpunkte wurde entfernt.

### Geänderte Dateien

- `adapter-service/routes/teamPlanningRoutes.js`
- `adapter-service/server.mjs`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run lint`: bestanden.
- `npm run test -- adapter-service/server.test.mjs`: bestanden (47/47).

## 2026-05-14 - Adapter-Modularisierung fortgesetzt: Admin-Routen extrahiert (Phase 3.2)

### Umgesetzte Arbeit

- Admin-Endpunkte aus `server.mjs` in ein eigenes Route-Modul ausgelagert:
  - `adapter-service/routes/adminRoutes.js`
  - umfasst u. a.:
    - `/api/admin/refresh`
    - `/api/admin/import`
    - `/api/admin/clubs/import`
    - `/api/admin/status`
    - `/api/admin/jobs`
    - `/api/admin/metrics`
    - `/api/admin/mandant-probe`
    - `/api/admin/verband-status`
    - `/api/admin/team-archive`
- `server.mjs` verdrahtet jetzt den Admin-Route-Handler zentral und enthält keinen doppelten Inline-Admin-Block mehr.

### Geänderte Dateien

- `adapter-service/routes/adminRoutes.js`
- `adapter-service/server.mjs`
- `adapter-service/server.test.mjs` (Timeout-Stabilisierung eines bestehenden Session-TTL-Tests)
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run lint`: bestanden.
- `npm run test -- adapter-service/server.test.mjs`: bestanden (47/47).
- `npm run test -- adapter-service/services/teamDomainServices.test.js src/context/teamBackendStateSync.test.js src/context/useTeamObservationActions.test.js src/context/useTeamPlanningActions.test.js`: bestanden.

## 2026-05-14 - Adapter-API-Doku ergänzt (Phase 3.1)

### Umgesetzte Arbeit

- OpenAPI-ähnliche Spezifikation für zentrale Adapter-Endpunkte erstellt:
  - `adapter-service/openapi.team.v1.yaml`
- Spezifikation in `adapter-service/README.md` verlinkt.
- Produktions-Audit (Priorität 3) aktualisiert: API-Doku-Lücke als teilweise geschlossen markiert.

### Geänderte Dateien

- `adapter-service/openapi.team.v1.yaml`
- `adapter-service/README.md`
- `docs/scoutx_v1_production_completion_audit.md`
- `docs/scoutx_progress_log.md`

### Validierung

- Konsistenzcheck über Referenzen in README/Audit durchgeführt.

## 2026-05-14 - E2E-Release-Gate-Spec ergänzt (Phase 7.2)

### Umgesetzte Arbeit

- Neues E2E-Kernflow-Spec für Release-Gates ergänzt:
  - `e2e/release-gates.spec.js`
  - enthält Cockpit-Feed/Plan-Publish-Sichtbarkeit sowie Seen->Report->Follow-up-Note-Flow.
- Neues npm-Script ergänzt:
  - `npm run test:e2e:release` -> `playwright test e2e/release-gates.spec.js`
- Release-Gate-Checklist um `test:e2e:release` erweitert.

### Geänderte Dateien

- `e2e/release-gates.spec.js`
- `package.json`
- `docs/scoutx_v1_release_gate_checklist.md`
- `docs/scoutx_v1_production_completion_audit.md`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run test:e2e:release`: im aktuellen Umfeld nicht ausführbar wegen Port-Bind-Fehler (`listen EPERM 127.0.0.1:4173` beim Playwright-Webserver).
- Lokale Qualitätssicherung bleibt grün:
  - `npm run lint`
  - `npm run test -- src/context/teamBackendStateSync.test.js src/context/useTeamObservationActions.test.js src/context/useTeamPlanningActions.test.js`

## 2026-05-14 - Releasefähigkeit ausgebaut: Deployment + Backup/Restore + Release-Gate-Artefakte (Phase 7.1)

### Umgesetzte Arbeit

- Neue Release-Ops-Dokumente erstellt:
  - `docs/scoutx_v1_deployment_runbook.md`
  - `docs/scoutx_v1_backup_restore_runbook.md`
  - `docs/scoutx_v1_release_gate_checklist.md`
- Root-README um direkte Verweise auf die drei neuen Artefakte ergänzt.
- Produktions-Audit (Priorität 7) aktualisiert: Runbooks als Evidenz aufgenommen, verbleibende Lücken präzisiert.

### Geänderte Dateien

- `docs/scoutx_v1_deployment_runbook.md`
- `docs/scoutx_v1_backup_restore_runbook.md`
- `docs/scoutx_v1_release_gate_checklist.md`
- `README.md`
- `docs/scoutx_v1_production_completion_audit.md`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run lint`: bestanden.
- `npm run test -- src/context/teamBackendStateSync.test.js src/context/useTeamObservationActions.test.js src/context/useTeamPlanningActions.test.js`: bestanden.

## 2026-05-14 - Frontend-Entkopplung fortgesetzt: Team-Planungsaktionen ausgelagert (Phase 4.3)

### Umgesetzte Arbeit

- Dritter Entkopplungs-Schnitt für `ScoutXProductContext`:
  - Team-Planungsaktionen in eigenes Hook ausgelagert:
    - `src/context/useTeamPlanningActions.js`
  - umfasst:
    - `onPublishTeamPlan`
    - `onUpsertManualGame`
    - `onUpdateTeamGoals`
    - `onUpsertTeamAccount`
- `ScoutXProductContext` nutzt diese Aktionen nun über `useTeamPlanningActions(...)`.
- Helper für konsistente Backend-Fallback-States ergänzt:
  - `createBackendFallbackState(...)`
- Unit-Test ergänzt:
  - `src/context/useTeamPlanningActions.test.js`

### Geänderte Dateien

- `src/context/useTeamPlanningActions.js`
- `src/context/useTeamPlanningActions.test.js`
- `src/context/ScoutXProductContext.jsx`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run lint`: bestanden.
- `npm run test -- src/context/teamBackendStateSync.test.js src/context/useTeamObservationActions.test.js src/context/useTeamPlanningActions.test.js`: bestanden.
- `npm run test -- adapter-service/server.test.mjs`: bestanden (47/47).

## 2026-05-14 - Frontend-Entkopplung fortgesetzt: Observation-/Notification-Aktionen ausgelagert (Phase 4.2)

### Umgesetzte Arbeit

- Zweiter Entkopplungs-Schnitt für `ScoutXProductContext`:
  - Observation-/Notification-bezogene Handler in eigenes Hook ausgelagert:
    - `src/context/useTeamObservationActions.js`
    - umfasst:
      - `onMarkNotificationRead`
      - `onMarkGameSeen`
      - `onCreateObservationMatchReport`
      - `onUpdateObservationNote`
- `ScoutXProductContext` nutzt diese Aktionen nun über `useTeamObservationActions(...)`.
- Hilfsfunktion für ID-Normalisierung ergänzt:
  - `normalizeNotificationTargetId(...)`
- Zusätzliche Unit-Tests:
  - `src/context/useTeamObservationActions.test.js`

### Geänderte Dateien

- `src/context/useTeamObservationActions.js`
- `src/context/useTeamObservationActions.test.js`
- `src/context/ScoutXProductContext.jsx`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run lint`: bestanden.
- `npm run test -- src/context/teamBackendStateSync.test.js src/context/useTeamObservationActions.test.js`: bestanden.
- Gesamt-Regression (zuletzt): `npm run test -- src/context/teamBackendStateSync.test.js src/context/useTeamObservationActions.test.js adapter-service/server.test.mjs adapter-service/services/teamDomainServices.test.js` bestanden (56/56).

## 2026-05-14 - Frontend-Entkopplung gestartet: Backend-Sync aus ProductContext extrahiert (Phase 4.1)

### Umgesetzte Arbeit

- `ScoutXProductContext` um einen ersten modularen Baustein entschlackt:
  - Backend-Sync-Merge/Persist-Logik in separates Modul ausgelagert:
    - `src/context/teamBackendStateSync.js`
    - enthält `mergeTeamBackendPayload(...)` und `createPersistableProductState(...)`.
- `src/context/ScoutXProductContext.jsx` verwendet nun diese ausgelagerten Funktionen via Import.
- Neue Unit-Tests für den extrahierten Sync-Baustein:
  - `src/context/teamBackendStateSync.test.js`
  - validiert Merge, `switchUser=false`-Verhalten und Persistenz-Bereinigung bei `connected`.

### Geänderte Dateien

- `src/context/teamBackendStateSync.js`
- `src/context/teamBackendStateSync.test.js`
- `src/context/ScoutXProductContext.jsx`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run test -- src/context/teamBackendStateSync.test.js adapter-service/server.test.mjs adapter-service/services/teamDomainServices.test.js`: bestanden (55/55 Tests grün).

## 2026-05-14 - Externe Monitoring-Anbindung über Prometheus/Alertmanager ergänzt (Phase 6.5)

### Umgesetzte Arbeit

- Docker-Compose um Monitoring-Profile erweitert:
  - Service `prometheus` (Port `9090`)
  - Service `alertmanager` (Port `9093`)
- Monitoring-Konfigurationen ergänzt:
  - `ops/monitoring/prometheus/prometheus.yml` (Scrape von `/api/admin/metrics`)
  - `ops/monitoring/prometheus/rules/scoutx-alerts.yml` (4 Basis-Alerts)
  - `ops/monitoring/alertmanager/alertmanager.yml` (Basis-Route/Receiver)
- Runbook erstellt:
  - `docs/scoutx_monitoring_runbook.md` mit Setup, Verifikation, Reload und offenen Lücken.
- Root-README um Monitoring-Startkommando und Runbook-Link ergänzt.

### Geänderte Dateien

- `docker-compose.yml`
- `ops/monitoring/prometheus/prometheus.yml`
- `ops/monitoring/prometheus/rules/scoutx-alerts.yml`
- `ops/monitoring/alertmanager/alertmanager.yml`
- `docs/scoutx_monitoring_runbook.md`
- `README.md`
- `docs/scoutx_progress_log.md`

### Validierung

- `docker compose config`: bestanden.

## 2026-05-14 - Admin-Monitoring-Gate mit Prometheus-Metriken ergänzt (Phase 6.4)

### Umgesetzte Arbeit

- Neuer Monitoring-Endpunkt: `GET /api/admin/metrics` (auth-geschützt, Prometheus-Textformat).
- Laufzeit-Metriken im Adapter ergänzt:
  - `runtimeMetrics.totalResponses`
  - `runtimeMetrics.errorResponses`
  - `runtimeMetrics.statusCounts`
  - `startedAt`, `lastSuccessfulRefreshAt`
- Alert-Ableitung für Operations ergänzt:
  - `INGESTION_JOB_FAILED` (threshold via ENV)
  - `MISSING_GAME_PROVENANCE` (threshold via ENV)
  - `ADAPTER_LAST_ERROR`
- `buildAdminMeta()` liefert jetzt zusätzlich `alerts`, `runtimeMetrics`, `startedAt`, `lastSuccessfulRefreshAt`.
- Neue ENV-Steuerung:
  - `ADAPTER_METRICS_PROVENANCE_MISSING_WARN_THRESHOLD`
  - `ADAPTER_METRICS_JOB_FAILED_WARN_THRESHOLD`
- README um Endpoint + neue ENV-Variablen ergänzt.

### Geänderte Dateien

- `adapter-service/server.mjs`
- `adapter-service/server.test.mjs`
- `adapter-service/README.md`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run test -- adapter-service/server.test.mjs adapter-service/services/teamDomainServices.test.js`: bestanden (52/52 Tests grün).

## 2026-05-14 - Spiel-Provenance pro Import + Admin-Summary ergänzt (Phase 6.3)

### Umgesetzte Arbeit

- Einheitliches `provenance`-Objekt pro Team-Spiel eingeführt/normalisiert:
  - in `adapter-service/lib/teamBackend.js` für `manual`, `tournament`, `national`.
  - enthält `source`, `method`, `provider`, `importedBy`, `ingestedAt`, optional `requestId/jobId`.
- Import-Flows schreiben jetzt explizite Provenance:
  - `POST /api/team/import/dfb-national-games` -> `method: "api-import"`, `provider: "dfb-national-games"`.
  - `POST /api/team/import/kreis-pdf` (confirm) -> `method: "pdf-import"`, `provider: "kreis-pdf"`.
  - `POST /api/team/tournaments/:id/matches` -> `method: "tournament-match-import"`, `provider: "team-tournament"`.
- Admin-Diagnostics erweitert:
  - `buildAdminMeta()` enthält jetzt `provenance`-Summary mit:
    - `totalGames`, `catalogGames`, `manualGames`,
    - `withProvenance`, `missingProvenance`,
    - `bySource`, `byMethod`.

### Geänderte Dateien

- `adapter-service/lib/teamBackend.js`
- `adapter-service/server.mjs`
- `adapter-service/server.test.mjs`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run test -- adapter-service/server.test.mjs adapter-service/services/teamDomainServices.test.js`: bestanden (50/50 Tests grün).

## 2026-05-14 - Strukturierte Job-Metadaten für Operations ergänzt (Phase 6.2)

### Umgesetzte Arbeit

- `adapter-service/lib/jobRunner.js` erweitert um strukturierte Job-Felder:
  - `category`
  - `jobId`
  - `correlationId`
  - `runCount`
- Retry-Warnlogs enthalten jetzt ebenfalls `category/jobId/correlationId`.
- Refresh-Ingestion-Jobs übergeben strukturierte Metadaten:
  - `category: "refresh"`
  - korrelationsfähige `correlationId` nach Muster `refresh:<reason>:<timestamp>`
- Integrationstest für `/api/admin/jobs` erweitert:
  - verifiziert `category`, `jobId`, `correlationId`, `runCount` am `refresh:admin-refresh` Job.

### Geänderte Dateien

- `adapter-service/lib/jobRunner.js`
- `adapter-service/server.mjs`
- `adapter-service/server.test.mjs`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run lint`: bestanden.
- `npm run test -- adapter-service/server.test.mjs adapter-service/services/teamDomainServices.test.js`: bestanden (49/49 Tests grün).

## 2026-05-13 - Ingestion-Job-Runner + Admin-Jobs-Diagnostics ergänzt (Phase 6.1)

### Umgesetzte Arbeit

- Neues Modul `adapter-service/lib/jobRunner.js` ergänzt (Job-Registry mit Retry/Backoff + Laufstatus).
- Refresh-Ingestion (`startup`, `interval`, `admin-refresh`) läuft nun über den Job-Runner.
- Neuer Admin-Endpunkt `GET /api/admin/jobs` ergänzt (auth-geschützt) für Operations-Diagnostics.
- `buildAdminMeta()` enthält jetzt zusätzlich `jobs`.
- Neue ENVs:
  - `ADAPTER_INGESTION_RETRY_MAX`
  - `ADAPTER_INGESTION_BACKOFF_MS`
- README um Endpoint + ENV-Doku ergänzt.
- Integrationstests ergänzt:
  - Auth-Schutz für `/api/admin/jobs`
  - Positive Diagnostics-Antwort mit mindestens einem `refresh:*` Job-Eintrag

### Geänderte Dateien

- `adapter-service/lib/jobRunner.js`
- `adapter-service/server.mjs`
- `adapter-service/server.test.mjs`
- `adapter-service/README.md`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run lint`: bestanden.
- `npm run test -- adapter-service/server.test.mjs adapter-service/services/teamDomainServices.test.js`: bestanden (49/49 Tests grün).

## 2026-05-13 - DB-first Produktions-Gate ergänzt (Phase 2f.1)

### Umgesetzte Arbeit

- Neuer Modus `ADAPTER_DB_FIRST_MODE` ergänzt.
- Verhalten:
  - Erzwingt effektive DB-Read-Pfade für Auth/Session/Team-State/Notifications/Observations/Reports/Feed.
  - Start-Guard: bei `ADAPTER_DB_FIRST_MODE=true` ohne `ADAPTER_DATABASE_URL`/`DATABASE_URL` wird der Adapter nicht gestartet.
- Health-Payload erweitert um:
  - `dbFirstMode`
  - `dbUrlConfigured`
  - `dbReadModes` (effective Flags je Domäne)
- Integrationstest erweitert (`returns health payload`) zur Verifikation der neuen Metadaten.

### Geänderte Dateien

- `adapter-service/server.mjs`
- `adapter-service/server.test.mjs`
- `adapter-service/README.md`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run lint`: bestanden.
- `npm run test -- adapter-service/server.test.mjs adapter-service/services/teamDomainServices.test.js`: bestanden (47/47 Tests grün).

## 2026-05-13 - Produktions-Audit Priorität 2 neu bewertet

### Umgesetzte Arbeit

- `docs/scoutx_v1_production_completion_audit.md` auf den aktuellen Persistenzstand aktualisiert:
  - dedizierte Repositories für Notifications/Observations/Reports/Feed als Evidenz aufgenommen
  - DB-Read-Flags vollständig ergänzt
  - Priorität-2-Lücke auf Produktions-Umschaltung/Konsistenznachweis präzisiert

### Geänderte Dateien

- `docs/scoutx_v1_production_completion_audit.md`
- `docs/scoutx_progress_log.md`

## 2026-05-13 - Dediziertes Feed-Repository in PostgreSQL ergänzt (Phase 2e.4)

### Umgesetzte Arbeit

- Neues Repository-Modul `adapter-service/lib/teamFeedDb.js` ergänzt:
  - `syncTeamFeedItemsToDb(teamState, logger)`
  - `fetchTeamFeedItemsFromDb(teamId, logger)`
  - Tabelle: `adapter_team_feed_items`
- `persistTeamState(...)` synchronisiert Feed-Items jetzt zusätzlich in das dedizierte PG-Repository.
- Startup-Load spiegelt initialen Team-State ebenfalls in `adapter_team_feed_items`.
- `GET /api/team/state` kann optional Feed-Items per Flag aus PG lesen:
  - `ADAPTER_FEED_READS_FROM_DB=true`
  - Fallback bleibt Team-State.
- README um neuen Flag + Persistenzhinweis erweitert.

### Geänderte Dateien

- `adapter-service/lib/teamFeedDb.js`
- `adapter-service/server.mjs`
- `adapter-service/README.md`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run lint`: bestanden.
- `npm run test -- adapter-service/server.test.mjs adapter-service/services/teamDomainServices.test.js`: bestanden (47/47 Tests grün).

## 2026-05-13 - Dediziertes Reports-Repository in PostgreSQL ergänzt (Phase 2e.3)

### Umgesetzte Arbeit

- Neues Repository-Modul `adapter-service/lib/teamReportsDb.js` ergänzt:
  - `syncTeamReportsToDb(teamState, logger)`
  - `fetchTeamReportMapFromDb(teamId, logger)`
  - Tabelle: `adapter_team_reports`
- `persistTeamState(...)` synchronisiert Report-Metadaten (aus Observations mit `reportId`/`reportUrl`) zusätzlich in das dedizierte PG-Repository.
- Startup-Load spiegelt initialen Team-State ebenfalls in `adapter_team_reports`.
- `GET /api/team/state` kann optional Report-Metadaten per Flag aus PG mergen:
  - `ADAPTER_REPORTS_READS_FROM_DB=true`
  - Fallback bleibt Team-State.
- README um neuen Flag + Persistenzhinweis erweitert.

### Geänderte Dateien

- `adapter-service/lib/teamReportsDb.js`
- `adapter-service/server.mjs`
- `adapter-service/README.md`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run lint`: bestanden.
- `npm run test -- adapter-service/server.test.mjs adapter-service/services/teamDomainServices.test.js`: bestanden (47/47 Tests grün).

## 2026-05-13 - Dediziertes Observations-Repository in PostgreSQL ergänzt (Phase 2e.2)

### Umgesetzte Arbeit

- Neues Repository-Modul `adapter-service/lib/teamObservationsDb.js` ergänzt:
  - `syncTeamObservationsToDb(teamState, logger)`
  - `fetchTeamObservationsFromDb(teamId, logger)`
  - Tabelle: `adapter_team_observations`
- `persistTeamState(...)` synchronisiert Observations jetzt zusätzlich in das dedizierte PG-Repository.
- Startup-Load spiegelt initialen Team-State ebenfalls in `adapter_team_observations`.
- `GET /api/team/state` kann optional Observations per Flag aus PG lesen:
  - `ADAPTER_OBSERVATIONS_READS_FROM_DB=true`
  - Fallback bleibt Team-State.
- README um neuen Flag + Persistenzhinweis erweitert.

### Geänderte Dateien

- `adapter-service/lib/teamObservationsDb.js`
- `adapter-service/server.mjs`
- `adapter-service/README.md`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run lint`: bestanden.
- `npm run test -- adapter-service/server.test.mjs adapter-service/services/teamDomainServices.test.js`: bestanden (47/47 Tests grün).

## 2026-05-13 - Dediziertes Notifications-Repository in PostgreSQL ergänzt (Phase 2e.1)

### Umgesetzte Arbeit

- Neues Repository-Modul `adapter-service/lib/teamNotificationsDb.js` ergänzt:
  - `syncTeamNotificationsToDb(teamState, logger)`
  - `fetchTeamNotificationsFromDb(teamId, logger)`
  - Tabelle: `adapter_team_notifications`
- `persistTeamState(...)` synchronisiert Notifications jetzt zusätzlich in das dedizierte PG-Repository.
- Startup-Load spiegelt initialen Team-State ebenfalls in `adapter_team_notifications`.
- `GET /api/team/notifications` kann optional per Flag aus PG lesen:
  - `ADAPTER_NOTIFICATIONS_READS_FROM_DB=true`
  - Fallback bleibt In-Memory/Team-State.
- README um neuen Flag + Persistenzhinweis erweitert.

### Geänderte Dateien

- `adapter-service/lib/teamNotificationsDb.js`
- `adapter-service/server.mjs`
- `adapter-service/routes/teamNotificationsRoutes.js`
- `adapter-service/README.md`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run lint`: bestanden.
- `npm run test -- adapter-service/server.test.mjs adapter-service/services/teamDomainServices.test.js`: bestanden (47/47 Tests grün).

## 2026-05-13 - Produktions-v1 Completion-Audit erstellt

### Umgesetzte Arbeit

- Neuer Audit-Report für den 7-Prioritäten-Produktionsplan erstellt:
  - `docs/scoutx_v1_production_completion_audit.md`
- Report enthält:
  - Success-Kriterien je Priorität
  - Prompt-to-Artifact-Mapping mit Code-/Test-Evidenz
  - Go/No-Go-Matrix je Priorität
  - explizite Lückenliste + priorisierte nächste Arbeitspakete

### Geänderte Dateien

- `docs/scoutx_v1_production_completion_audit.md`
- `docs/scoutx_progress_log.md`

## 2026-05-13 - Standardisierte Route-Fehlerantworten ergänzt (Phase 3.5b)

### Umgesetzte Arbeit

- Neues Helper-Modul `adapter-service/routes/routeErrorResponses.js` ergänzt:
  - `sendRouteError(...)`
- Ausgelagerte Team-Routen nutzen jetzt den zentralen Fehler-Response-Helper:
  - `routes/teamAuthRoutes.js`
  - `routes/teamInvitationRoutes.js`
  - `routes/teamPasswordResetRoutes.js`
  - `routes/teamNotificationsRoutes.js`
- Ergebnis: konsistentes Mapping von `statusCode`/Fallback-Message ohne duplizierte Catch-Logik.

### Geänderte Dateien

- `adapter-service/routes/routeErrorResponses.js`
- `adapter-service/routes/teamAuthRoutes.js`
- `adapter-service/routes/teamInvitationRoutes.js`
- `adapter-service/routes/teamPasswordResetRoutes.js`
- `adapter-service/routes/teamNotificationsRoutes.js`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run lint`: bestanden.
- `npm run test -- adapter-service/server.test.mjs adapter-service/services/teamDomainServices.test.js`: bestanden (47/47 Tests grün).

## 2026-05-13 - Zentrale Team-Route-Context-Factory ergänzt (Phase 3.5a)

### Umgesetzte Arbeit

- Neues Factory-Modul `adapter-service/routes/routeContextFactory.js` ergänzt.
- `server.mjs` erstellt nun einen gemeinsamen Team-Basiskontext pro Request:
  - `teamRouteBaseContext`
- Delegation an ausgelagerte Routen nutzt jetzt diesen Basiskontext (per Spread) statt duplizierter Übergaben:
  - `handleTeamAuthRoutes`
  - `handleTeamInvitationRoutes`
  - `handleTeamPasswordResetRoutes`
  - `handleTeamNotificationsRoutes`
- Ergebnis: weniger Boilerplate in `server.mjs`, konsistentere Route-Wiring-Struktur.

### Geänderte Dateien

- `adapter-service/routes/routeContextFactory.js`
- `adapter-service/server.mjs`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run lint`: bestanden.
- `npm run test -- adapter-service/server.test.mjs adapter-service/services/teamDomainServices.test.js`: bestanden (47/47 Tests grün).

## 2026-05-13 - Notifications-Domain-Service + Service-Unit-Tests ergänzt (Phase 3.4c)

### Umgesetzte Arbeit

- Neues Domain-Service-Modul `adapter-service/services/teamNotificationsDomainService.js` ergänzt:
  - `filterNotificationsList(...)`
  - `markNotificationsRead(...)`
  - `applyPushAck(...)`
- `routes/teamNotificationsRoutes.js` nutzt diese Service-Funktionen statt Inline-Business-Logik.
- Neue dedizierte Service-Unit-Tests ergänzt:
  - `adapter-service/services/teamDomainServices.test.js`
  - Deckt Auth-Service-Helfer und Notifications-Domain-Service ab.

### Geänderte Dateien

- `adapter-service/services/teamNotificationsDomainService.js`
- `adapter-service/routes/teamNotificationsRoutes.js`
- `adapter-service/services/teamDomainServices.test.js`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run lint`: bestanden.
- `npm run test -- adapter-service/server.test.mjs adapter-service/services/teamDomainServices.test.js`: bestanden (47/47 Tests grün).

## 2026-05-13 - Domain-Services für Auth/Invite/Reset ergänzt (Phase 3.4b)

### Umgesetzte Arbeit

- Neues Domain-Service-Modul `adapter-service/services/teamAuthDomainService.js` ergänzt.
- Kapselte Use-Cases:
  - `registerAccount(...)`
  - `acceptInvitation(...)`
  - `confirmPasswordReset(...)`
- Route-Module nutzen diese Use-Cases jetzt für State-Mutationen/Persistenz:
  - `routes/teamAuthRoutes.js`
  - `routes/teamInvitationRoutes.js`
  - `routes/teamPasswordResetRoutes.js`
- Ergebnis: Routen enthalten weniger Business-Logik; Domain-Operationen sind zentral wiederverwendbar.

### Geänderte Dateien

- `adapter-service/services/teamAuthDomainService.js`
- `adapter-service/routes/teamAuthRoutes.js`
- `adapter-service/routes/teamInvitationRoutes.js`
- `adapter-service/routes/teamPasswordResetRoutes.js`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run lint`: bestanden.
- `npm run test -- adapter-service/server.test.mjs`: bestanden (42/42 Tests grün).

## 2026-05-13 - Auth-Service-Layer gestartet (Phase 3.4a)

### Umgesetzte Arbeit

- Neues Service-Modul `adapter-service/services/teamAuthService.js` ergänzt.
- Wiederverwendbare Business-Regeln zentralisiert:
  - Mindestlängen-Validierung (`assertMinLength`, `assertPasswordMinLength`)
  - Rollen-Normalisierung für Einladungen (`normalizeInvitationRole`)
  - Token/TTL-Erzeugung (`createTimedToken`)
- Route-Module auf Service-Regeln umgestellt:
  - `routes/teamAuthRoutes.js`
  - `routes/teamInvitationRoutes.js`
  - `routes/teamPasswordResetRoutes.js`
- Ziel: Controller bleiben dünn (HTTP/Mapping), Domänenregeln werden service-seitig vereinheitlicht.

### Geänderte Dateien

- `adapter-service/services/teamAuthService.js`
- `adapter-service/routes/teamAuthRoutes.js`
- `adapter-service/routes/teamInvitationRoutes.js`
- `adapter-service/routes/teamPasswordResetRoutes.js`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run lint`: bestanden.
- `npm run test -- adapter-service/server.test.mjs`: bestanden (42/42 Tests grün).

## 2026-05-13 - Auth-Routen in Modul ausgelagert (Phase 3.3c)

### Umgesetzte Arbeit

- Neues Route-Modul `adapter-service/routes/teamAuthRoutes.js` ergänzt.
- Aus `server.mjs` ausgelagert:
  - `POST /api/team/auth/login`
  - `POST /api/team/auth/register`
  - `POST /api/team/auth/logout`
- `server.mjs` delegiert diese Endpunkte nun über `handleTeamAuthRoutes(...)`.
- Inline-Implementierung der drei Auth-Routen im Hauptrouter entfernt.

### Geänderte Dateien

- `adapter-service/routes/teamAuthRoutes.js`
- `adapter-service/server.mjs`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run lint`: bestanden.
- `npm run test -- adapter-service/server.test.mjs`: bestanden (42/42 Tests grün).

## 2026-05-13 - Invite-Routen in Modul ausgelagert (Phase 3.3b)

### Umgesetzte Arbeit

- Neues Route-Modul `adapter-service/routes/teamInvitationRoutes.js` ergänzt.
- Aus `server.mjs` ausgelagert:
  - `POST /api/team/invitations/create`
  - `POST /api/team/invitations/accept`
- `server.mjs` delegiert diese Endpunkte nun über `handleTeamInvitationRoutes(...)`.
- Inline-Implementierung der beiden Invite-Routen im Hauptrouter entfernt.

### Geänderte Dateien

- `adapter-service/routes/teamInvitationRoutes.js`
- `adapter-service/server.mjs`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run lint`: bestanden.
- `npm run test -- adapter-service/server.test.mjs`: bestanden (42/42 Tests grün).

## 2026-05-13 - Passwort-Reset in Route-Modul ausgelagert (Phase 3.3a)

### Umgesetzte Arbeit

- Neues Route-Modul `adapter-service/routes/teamPasswordResetRoutes.js` ergänzt.
- Aus `server.mjs` ausgelagert:
  - `POST /api/team/auth/password-reset/request`
  - `POST /api/team/auth/password-reset/confirm`
- `server.mjs` delegiert diese Endpunkte nun über `handleTeamPasswordResetRoutes(...)`.
- Inline-Implementierung der beiden Reset-Routen im Hauptrouter entfernt.

### Geänderte Dateien

- `adapter-service/routes/teamPasswordResetRoutes.js`
- `adapter-service/server.mjs`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run lint`: bestanden.
- `npm run test -- adapter-service/server.test.mjs`: bestanden (42/42 Tests grün).

## 2026-05-13 - Fehlerklassen für modulare Routen ergänzt (Phase 3.2b)

### Umgesetzte Arbeit

- Neues Fehler-Modul `adapter-service/lib/httpErrors.js` eingeführt:
  - `HttpError`
  - `ValidationError`
  - `getHttpErrorStatus(...)`
- `requestValidation` nutzt jetzt `ValidationError` statt ad-hoc `Error + statusCode`.
- `teamNotificationsRoutes` nutzt zentralisierte Statusauflösung (`getHttpErrorStatus`) und trennt Validation-/Serverfehler konsistenter.

### Geänderte Dateien

- `adapter-service/lib/httpErrors.js`
- `adapter-service/lib/requestValidation.js`
- `adapter-service/routes/teamNotificationsRoutes.js`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run lint`: bestanden.
- `npm run test -- adapter-service/server.test.mjs`: bestanden (42/42 Tests grün).

## 2026-05-13 - Team-Notifications in Route-Modul ausgelagert (Phase 3.2)

### Umgesetzte Arbeit

- Neues Route-Modul `adapter-service/routes/teamNotificationsRoutes.js` ergänzt.
- Aus `server.mjs` ausgelagert:
  - `GET /api/team/notifications`
  - `POST /api/team/notifications/read`
  - `POST /api/team/notifications/push/subscribe`
  - `GET /api/team/notifications/push/pending`
  - `POST /api/team/notifications/push/ack`
- `server.mjs` delegiert diese Endpunkte nun zentral an `handleTeamNotificationsRoutes(...)`.
- Inline-Branches im Hauptrouter entfernt; Validierung bleibt über `lib/requestValidation.js` zentralisiert.

### Geänderte Dateien

- `adapter-service/routes/teamNotificationsRoutes.js`
- `adapter-service/server.mjs`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run lint`: bestanden.
- `npm run test -- adapter-service/server.test.mjs`: bestanden (42/42 Tests grün).

## 2026-05-13 - Zentrale Request-Validation gestartet (Phase 3.1)

### Umgesetzte Arbeit

- Neues Modul `adapter-service/lib/requestValidation.js` ergänzt.
- Zentralisierte Parser/Validatoren eingeführt:
  - `parsePushSubscriptionPayload(...)`
  - `parseEventIdsPayload(...)`
- `server.mjs` auf diese zentralen Validatoren umgestellt in:
  - `POST /api/team/notifications/push/subscribe`
  - `POST /api/team/notifications/push/ack`
  - `POST /api/team/notifications/read`
- Ergebnis: weniger Inline-Validierungslogik im Router, konsistentere Fehlermeldungen/Statuscodes als Basis für weitere Modularisierung.

### Geänderte Dateien

- `adapter-service/lib/requestValidation.js`
- `adapter-service/server.mjs`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run lint`: bestanden.
- `npm run test -- adapter-service/server.test.mjs`: bestanden (42/42 Tests grün).

## 2026-05-13 - Push-Runtime in PostgreSQL gespiegelt (Phase 2d.3)

### Umgesetzte Arbeit

- Neues Modul `adapter-service/lib/teamPushDb.js` ergänzt:
  - Subscriptions (`adapter_team_push_subscriptions`)
  - Outbox-Events (`adapter_team_push_outbox`)
  - Acked-Events (`adapter_team_push_acked`)
- Push-Subscribe-Endpunkt schreibt Subscriptions jetzt zusätzlich in PostgreSQL (Write-Through).
- Kritische Notifications werden beim Queueing als Outbox-Events zusätzlich in PostgreSQL gespiegelt.
- Push-Ack entfernt Outbox-Events und markiert Acked-Events zusätzlich in PostgreSQL.
- Startup-Rehydrate ergänzt:
  - Lädt Subscriptions/Outbox/Acked-IDs aus PostgreSQL zurück in Runtime-Maps/Sets.
- `GET /api/team/notifications/push/pending` liefert Outbox-Events jetzt team-gefiltert.

### Geänderte Dateien

- `adapter-service/lib/teamPushDb.js`
- `adapter-service/server.mjs`
- `adapter-service/README.md`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run lint`: bestanden.
- `npm run test -- adapter-service/server.test.mjs`: bestanden (42/42 Tests grün).

## 2026-05-13 - Archive-Diagnostics Read-Pfad ergänzt (Phase 2d.2)

### Umgesetzte Arbeit

- `teamArchiveDb` um Read-Funktion ergänzt: `fetchRecentTeamArchiveEvents(limit, logger)`.
- Neuer Admin-Endpunkt `GET /api/admin/team-archive?limit=50` ergänzt.
- Endpoint-Verhalten:
  - DB-first: liest jüngste Archivevents aus PostgreSQL.
  - Fallback: liest NDJSON-Archivdatei (`ADAPTER_TEAM_ARCHIVE_FILE`) robust bei DB-Ausfall/leerem DB-Result.
  - Liefert `source` (`postgres|ndjson`) und Events für Diagnostics/Operations.
- Adapter-Tests ergänzt:
  - Auth-Schutz für `/api/admin/team-archive`.
  - Positive Rückgabe inkl. Eventliste und Nachweis, dass keine `passwordHash`-Felder in Archivpayloads auftauchen.

### Geänderte Dateien

- `adapter-service/lib/teamArchiveDb.js`
- `adapter-service/server.mjs`
- `adapter-service/server.test.mjs`
- `adapter-service/README.md`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run lint`: bestanden.
- `npm run test -- adapter-service/server.test.mjs`: bestanden (42/42 Tests grün).

## 2026-05-13 - PostgreSQL Team-State Snapshot (Phase 2d.1) ergänzt

### Umgesetzte Arbeit

- Neues Modul `adapter-service/lib/teamStateDb.js` ergänzt.
- Team-State wird bei jedem `persistTeamState(...)` zusätzlich als JSONB-Snapshot in PostgreSQL geschrieben (Write-Through).
- Optionaler Startup-Read aus PostgreSQL via `ADAPTER_TEAM_STATE_READS_FROM_DB=true` ergänzt.
- Startup-Fallback bleibt robust:
  - Bei DB-Miss wird aus JSON-Datei geladen und in DB gespiegelt.
  - Bei deaktiviertem DB-Read bleibt JSON-Load aktiv, mit zusätzlichem DB-Sync.
- Zielbild: PostgreSQL als Source-of-Truth schrittweise aktivierbar, JSON weiterhin Dev-/Fallback-Pfad.

### Geänderte Dateien

- `adapter-service/lib/teamStateDb.js`
- `adapter-service/server.mjs`
- `adapter-service/README.md`
- `docs/scoutx_progress_log.md`

## 2026-05-13 - PostgreSQL Session-Reads (Phase 2c) ergänzt

### Umgesetzte Arbeit

- Optionalen Session-Read-Pfad aus PostgreSQL ergänzt (`ADAPTER_SESSION_READS_FROM_DB=true`).
- Request-weiter Session-Context wird einmalig vor geschützten Routen aufgelöst und in `req.__teamSessionContext` vorgeladen.
- Bei DB-Hit wird Session in den In-Memory-Cache übernommen, damit bestehende Guards/Flows unverändert weiterlaufen.
- Session-Objekte enthalten nun konsistent `expiresAt`; Expiry-Prüfung nutzt bevorzugt `expiresAt` (Fallback auf `createdAt + TTL`).
- Session-Resolver validiert weiterhin Team-/Account-Konsistenz und revoked/expired Fälle werden serverseitig invalidiert.

### Geänderte Dateien

- `adapter-service/server.mjs`
- `adapter-service/lib/teamRuntimeDb.js`
- `adapter-service/README.md`
- `docs/scoutx_progress_log.md`

## 2026-05-13 - MVP-Blocker Security/Account-Basics gehärtet

### Umgesetzte Arbeit

- Team-Session-Lifetime wird serverseitig geprüft und abgelaufene Sessions werden aktiv entfernt.
- Session-TTL ist per `ADAPTER_TEAM_SESSION_TTL_SEC` konfigurierbar und wird auch für Cookie-`Max-Age` verwendet.
- Public-Team-Payload gibt `account.active` konsistent durch (`toPublicAccount`), damit Deaktivierungen im UI ankommen.
- Team-Archiv-Events (NDJSON + DB-Persistenz) werden ohne `passwordHash` geschrieben.
- Bestehende lokale Archivdatei `adapter-service/data/team-state.archive.ndjson` wurde bereinigt, sodass keine `passwordHash`-Felder mehr enthalten sind.

### Geänderte Dateien

- `adapter-service/server.mjs`
- `adapter-service/server.test.mjs`
- `adapter-service/data/team-state.archive.ndjson`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run test -- adapter-service/server.test.mjs`: bestanden (23/23 Tests grün).

### Offene Punkte aus dem Ausbauplan

- Scouting-Lifecycle-Erweiterung (`reported`/`followup`, Statuskette im Feed/UI).
- Team-Übersicht mit Konfliktmanagement (Überlappung + Erreichbarkeit).
- Zusätzliche Quellen/Imports (Turniere, U-Nationalspiele, Kreisauswahl-PDF-Endpunkte).
- Notifications MVP (Inbox-Filter, Push-Subscription, deduplizierbare Event-IDs).
- Invite/Password-Reset-Endpunkte und vollständige Rollenvalidierung aller Write-Endpunkte.

## 2026-05-13 - Lifecycle-Statuskette im Backend erweitert

### Umgesetzte Arbeit

- Observation-Status im Team-Backend auf vierstufige Kette erweitert: `planned`, `seen`, `reported`, `followup`.
- Report-Verknüpfung (`/api/team/observations/report`) setzt den Observation-Status nun auf `reported`.
- Notiz-Update (`/api/team/observations/note`) setzt den Observation-Status auf `followup`.
- Status-Normalisierung akzeptiert jetzt alle vier Statuswerte robust und erhält `seenAt` für Folge-Status.

### Geänderte Dateien

- `adapter-service/lib/teamBackend.js`
- `adapter-service/server.test.mjs`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run test -- adapter-service/server.test.mjs`: bestanden (23/23 Tests grün).

## 2026-05-13 - Invite- und Password-Reset-APIs ergänzt

### Umgesetzte Arbeit

- Neue Team-Auth-Endpunkte im Adapter ergänzt:
  - `POST /api/team/invitations/create`
  - `POST /api/team/invitations/accept`
  - `POST /api/team/auth/password-reset/request`
  - `POST /api/team/auth/password-reset/confirm`
- Invite-Erstellung ist auf `admin`/`coordinator` begrenzt (Session + CSRF + Rollenprüfung).
- Token-Handling für Einladungen und Passwort-Resets mit TTL ergänzt.
- Client-Interface (`src/services/teamBackendClient.js`) um passende Funktionen erweitert.
- Adapter-README um neue Endpunkte und relevante ENV-Variablen aktualisiert.

### Geänderte Dateien

- `adapter-service/server.mjs`
- `adapter-service/server.test.mjs`
- `src/services/teamBackendClient.js`
- `adapter-service/README.md`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run test -- adapter-service/server.test.mjs`: bestanden (25/25 Tests grün).

## 2026-05-13 - Push-Subscribe-API ergänzt

### Umgesetzte Arbeit

- Neuer Team-Endpunkt `POST /api/team/notifications/push/subscribe` im Adapter implementiert.
- Endpunkt erfordert gültige Session + CSRF und speichert Web-Push-Subscriptions dedupliziert nach `endpoint`.
- Client-Service um `subscribeTeamPushNotifications(subscription)` ergänzt.

### Geänderte Dateien

- `adapter-service/server.mjs`
- `adapter-service/server.test.mjs`
- `src/services/teamBackendClient.js`
- `adapter-service/README.md`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run test -- adapter-service/server.test.mjs`: bestanden (26/26 Tests grün).

## 2026-05-13 - Turnier-APIs ergänzt

### Umgesetzte Arbeit

- Neue Endpunkte ergänzt:
  - `POST /api/team/tournaments`
  - `POST /api/team/tournaments/:id/matches`
- Turniere werden im Team-State persistiert (`tournaments`), Matches werden als `source: "tournament"` geführt.
- Turnier-Matches werden zusätzlich in `manualGames` übernommen, damit sie in bestehende Plan-/Seen-/Feed-Flows einlaufen.
- Client-Service um `createTeamTournament` und `addTeamTournamentMatches` erweitert.

### Geänderte Dateien

- `adapter-service/server.mjs`
- `adapter-service/lib/teamBackend.js`
- `adapter-service/server.test.mjs`
- `src/services/teamBackendClient.js`
- `adapter-service/README.md`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run test -- adapter-service/server.test.mjs`: bestanden (27/27 Tests grün).

## 2026-05-13 - Externe Turnier-/Nationalspiel-Imports ergänzt

### Umgesetzte Arbeit

- Neuer Endpoint `POST /api/team/tournaments/import/meinturnierplan`:
  - Ruft `https://www.meinturnierplan.de/suche/<from>/<to>` mit Wizard-Datumsparametern ab.
  - Extrahiert `window.mapSearchTournaments` aus der HTML-Seite.
  - Filtert Ergebnisse anhand Wizard-Parameter (`teams`, `jugend`, `kreis`) und gibt normalisierte Turniere zurück.
- Neuer Endpoint `POST /api/team/import/dfb-national-games`:
  - Importiert übergebene U-Nationalspiele in `manualGames` mit `source: "national"`.
  - Dedupliziert über `id` und schreibt in den persistierten Team-State.
- Client-Service um `importTeamTournamentsFromMeinturnierplan` und `importTeamNationalGames` ergänzt.

### Geänderte Dateien

- `adapter-service/server.mjs`
- `adapter-service/server.test.mjs`
- `src/services/teamBackendClient.js`
- `adapter-service/README.md`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run test -- adapter-service/server.test.mjs`: bestanden (28/28 Tests grün).

## 2026-05-13 - Kreis-PDF Preview/Confirm Import ergänzt

### Umgesetzte Arbeit

- Neuer Endpoint `POST /api/team/import/kreis-pdf` mit zwei Modi:
  - `mode=preview`: Parse von `extractedText` in importierbare Spiele + Preview-Token.
  - `mode=confirm`: Übernahme der Preview-Spiele in `manualGames` (Team-State).
- Preview-Tokens werden serverseitig temporär gehalten und mit Ablaufzeit bereinigt.
- Client-Service um `previewTeamKreisPdfImport` und `confirmTeamKreisPdfImport` ergänzt.

### Geänderte Dateien

- `adapter-service/server.mjs`
- `adapter-service/server.test.mjs`
- `src/services/teamBackendClient.js`
- `adapter-service/README.md`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run test -- adapter-service/server.test.mjs`: bestanden (29/29 Tests grün).

## 2026-05-13 - Notifications Inbox Backend ergänzt

### Umgesetzte Arbeit

- Team-State um `notifications` erweitert.
- Feed-Events erzeugen nun gleichzeitig Inbox-Notifications mit identischer Event-ID (`eventId === feed.id`) für Deduplizierung.
- Neue Endpunkte:
  - `GET /api/team/notifications` mit Filtern `status=unread|read` und `type=...`
  - `POST /api/team/notifications/read` zum Markieren als gelesen.
- Client-Service um `fetchTeamNotifications` und `markTeamNotificationsRead` ergänzt.

### Geänderte Dateien

- `adapter-service/lib/teamBackend.js`
- `adapter-service/server.mjs`
- `adapter-service/server.test.mjs`
- `src/services/teamBackendClient.js`
- `adapter-service/README.md`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run test -- adapter-service/server.test.mjs`: bestanden (30/30 Tests grün).

## 2026-05-13 - Konfliktanalyse-Endpunkt ergänzt

### Umgesetzte Arbeit

- Neuer Endpoint `GET /api/team/conflicts` ergänzt.
- Konflikterkennung umfasst aktuell:
  - Zeitüberlappung (`time_overlap`) bei eng aufeinanderliegenden Spielzeiten.
  - Erreichbarkeitsrisiko (`travel_risk`) bei unterschiedlichen Orten und knappen Zeitfenstern.
- Client-Service um `fetchTeamConflicts` erweitert.

### Geänderte Dateien

- `adapter-service/server.mjs`
- `adapter-service/server.test.mjs`
- `src/services/teamBackendClient.js`
- `adapter-service/README.md`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run test -- adapter-service/server.test.mjs`: bestanden (31/31 Tests grün).

## 2026-05-13 - Planabschluss-Warnung im Games-Flow + Backend-Inbox-Sync

### Umgesetzte Arbeit

- `GamesPage` ergänzt:
  - Konfliktwarnung vor Planabschluss bei ausgewählten Spielen (Zeitkollision/Reisefenster).
  - Bestätigungsdialog vor `Plan öffnen`, wenn Konflikte vorliegen.
- `ScoutXProductContext` ergänzt:
  - Backend-Notifications werden in das UI-Notificationmodell gemappt.
  - `onMarkNotificationRead` synchronisiert im Connected-Mode gegen `/api/team/notifications/read`.

### Geänderte Dateien

- `src/pages/GamesPage.jsx`
- `src/pages/GamesPage.test.jsx`
- `src/context/ScoutXProductContext.jsx`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run test -- src/pages/GamesPage.test.jsx src/app.integration.test.jsx`: bestanden (19/19 Tests grün).
- `npm run test -- adapter-service/server.test.mjs`: bestanden (31/31 Tests grün).

## 2026-05-13 - Inbox-Filter im Hub ergänzt

### Umgesetzte Arbeit

- `ScoutingHubPage` zeigt Inbox-Notifications jetzt mit Filtern:
  - Status: `unread`, `read`, `all`
  - Typ: `plan`, `seen`, `absage`, `konflikt`, `followup`
- Trefferanzahl wird direkt im Panel angezeigt.

### Geänderte Dateien

- `src/pages/ScoutingHubPage.jsx`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run test -- src/app.integration.test.jsx src/pages/GamesPage.test.jsx`: bestanden (19/19 Tests grün).

## 2026-05-13 - Kritische Push-Trigger mit Event-ID-Deduplizierung ergänzt

### Umgesetzte Arbeit

- Push-Outbox im Adapter eingeführt:
  - Kritische Notification-Typen (`absage`, `konflikt`, `followup`) werden bei State-Persistierung automatisch in die Push-Queue übernommen.

## 2026-05-13 - Wizard-Turnierimport + stabiler Kreis-PDF-Multipart-Import

### Umgesetzte Arbeit

- Wizard-Datenfluss erweitert:
  - `fetchGamesWithProviders` nutzt bei `turnier=true` priorisiert den Provider `tournament` (meinturnierplan), mit Fallback auf `adapter`.
  - Auto-Mode erweitert auf `csv -> tournament -> adapter` für Turnier-Jugenden.
- Turnierdaten-Mapping in das bestehende Game-Modell ergänzt, sodass Importergebnisse direkt in Games-/Plan-Flow dargestellt werden.
- Kreis-PDF-Import robuster gemacht:
  - Multipart-Parser toleriert CRLF/LF-Varianten.
  - Nicht-JSON Requests werden als Rohtext-Fallback verarbeitet.
  - `multipart/form-data` ohne sauberes Feld-Mapping fällt auf Rohtext-Parsing zurück.
- Integrationstest für `kreis-pdf` Multipart stabilisiert:
  - expliziter multipart Body mit Boundary statt inkonsistenter Test-`FormData`-Serialisierung.

### Geänderte Dateien

- `src/services/dataProvider.js`
- `src/services/dataProvider.test.js`
- `adapter-service/server.mjs`
- `adapter-service/server.test.mjs`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run test -- src/services/dataProvider.test.js`: bestanden (27/27 Tests grün).
- `npm run test -- adapter-service/server.test.mjs`: bestanden (33/33 Tests grün).

## 2026-05-13 - Rollenlücke in Write-Guard geschlossen (readonly-Härtung)

### Umgesetzte Arbeit

- Zentrale Write-Guard-Funktion im Adapter (`requireTeamWriteAllowed`) um Rollenprüfung ergänzt:
  - nur `admin`, `coordinator`, `scout` dürfen Team-Write-Endpunkte ausführen.
  - `readonly` wird jetzt konsistent vor jeder Write-Aktion mit HTTP 403 geblockt.
- Sammeltest ergänzt, der `readonly` gegen die kritischen Write-Endpunkte verifiziert:
  - Invitations, Push-Subscribe, Turnier-/Import-Endpunkte, Notifications-Read, Manual-Games, Goals, Observation-Updates und Tournament-Matches.

### Geänderte Dateien

- `adapter-service/server.mjs`
- `adapter-service/server.test.mjs`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run test -- adapter-service/server.test.mjs`: bestanden (34/34 Tests grün).
- `npm run test -- src/services/dataProvider.test.js src/pages/GamesPage.test.jsx src/app.integration.test.jsx`: bestanden (46/46 Tests grün).

## 2026-05-13 - Meinturnierplan-Import API testbar gegen lokalen Stub abgesichert

### Umgesetzte Arbeit

- `adapter-service/server.test.mjs` um lokalen HTTP-Stub für `meinturnierplan` erweitert.
- Neuer Integrationstest deckt `POST /api/team/tournaments/import/meinturnierplan` end-to-end ab:
  - Wizard-Zeitraum/Filter werden an den Endpoint übergeben.
  - HTML-Extraktion (`window.mapSearchTournaments`) und Mapping auf Turnierobjekte werden verifiziert.
  - Filterwirkung über Team-Keywords wird nachgewiesen.

### Geänderte Dateien

- `adapter-service/server.test.mjs`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run test -- adapter-service/server.test.mjs`: bestanden (35/35 Tests grün).

## 2026-05-13 - Vier Quelltypen im gemeinsamen Plan-/Seen-/Report-Flow nachgewiesen

### Umgesetzte Arbeit

- Neuer Integrationstest im Adapter deckt den End-to-End-Flow über alle geforderten Quellen ab:
  - `official` (offizielles Spiel im Plan),
  - `tournament` (Turnier + Match),
  - `national` (DFB U-Nationalspiel Import),
  - `manual` (Kreis-PDF Preview + Confirm Import).
- Alle vier Typen laufen in demselben Durchlauf durch:
  - Plan-Publish (`/api/team/plans`),
  - Observation `seen` (`/api/team/observations/seen`),
  - Observation `reported` (`/api/team/observations/report`).
- Test verifiziert zusätzlich:
  - Quellenmenge in Observationen enthält alle vier Source-Typen.
  - Finaler Observation-Status ist für alle vier auf `reported`.
  - Feed enthält Einträge für jede der vier Spiel-IDs.

### Geänderte Dateien

- `adapter-service/server.test.mjs`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run test -- adapter-service/server.test.mjs -t "runs official/manual/tournament/national through one shared plan-seen-report flow"`: bestanden.
- `npm run test -- adapter-service/server.test.mjs`: bestanden (36/36 Tests grün).
  - Event-ID bleibt identisch zu Feed/Inbox (`eventId`), deduplizierbar.
- Neue Endpunkte:
  - `GET /api/team/notifications/push/pending`
  - `POST /api/team/notifications/push/ack`
- Ack entfernt Event aus Outbox und markiert es als bereits gepusht.

### Geänderte Dateien

- `adapter-service/server.mjs`
- `adapter-service/server.test.mjs`
- `src/services/teamBackendClient.js`
- `adapter-service/README.md`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run test -- adapter-service/server.test.mjs`: bestanden (32/32 Tests grün).

## 2026-04-23 - Audit und MVP-Fundament gestartet

### Umgesetzte Arbeit

- Codebasis strukturell analysiert: React/Vite-SPA, Context-State, Adapter-Service, lokale Persistenz, Tests, Routing, UI-Schicht.
- Baseline-Lint gestartet und sauber abgeschlossen.
- Baseline-Testlauf initial mit falscher Jest-Option blockiert; erneuter Vitest-Lauf gestartet.
- Audit-, Gap-, Zielarchitektur- und Implementierungsplan-Dokumente angelegt.

### Geänderte Dateien

- `docs/scoutx_feature_expansion_audit.md`
- `docs/scoutx_gap_analysis.md`
- `docs/scoutx_target_architecture.md`
- `docs/scoutx_implementation_plan.md`
- `docs/scoutx_progress_log.md`

### Technische Entscheidungen

- Kein Komplettumbau der bestehenden Planungs-App.
- Neue MVP-Domain wird additiv, zentral validiert und lokal persistiert.
- Rollen/Sichtbarkeit werden zentral als Produktregel implementiert und später API-fähig gehalten.
- KI-Auswertung wird im MVP deterministisch und nicht-destruktiv implementiert, damit UX und Datenmodell sofort testbar sind.

### Offene Punkte

- Product-Domain-Service und Context implementieren.
- Hub-Route ergänzen.
- Domain-Tests schreiben.
- Lint/Test/Build nach Implementierung erneut ausführen.

### Nächste konkrete Schritte

1. `src/services/scoutxDomain.js` erstellen.
2. `src/context/ScoutXProductContext.jsx` erstellen.
3. `src/pages/ScoutingHubPage.jsx` erstellen und Route/Navi integrieren.
4. Tests für Domainlogik ergänzen.

## 2026-04-23 - MVP-Produktdomain und Scouting-Hub implementiert

### Umgesetzte Arbeit

- Zentrale Product-Domain in `src/services/scoutxDomain.js` implementiert:
  - Rollen: Admin, Koordinator, Scout, Gast.
  - Sichtbarkeit: privat, team, geteilt.
  - Reports mit Typen, Status, Ratings, Sections, Versionen und nicht-destruktiver AI-Analyse.
  - Watchlists mit Einträgen, Priorität, Labels, Status und Notizen.
  - Assignments mit Status, Fälligkeit, Assignee und Links zu Reports/Games.
  - Notifications als generische In-App-Grundlage.
  - Globale Suche über Reports, Watchlists, Assignments, PlayerSheets, Games und PlanHistory.
  - Dashboard-Aggregation für offene Aufgaben, fällige Aufgaben, ungelesene Meldungen und Prioritätsspieler.
- React Product Context mit lokaler Persistenz unter `scoutx.product.v1` ergänzt.
- Neue Route `/hub` als echte Startansicht implementiert und Root-Fallback darauf umgestellt.
- Desktop-Rail und mobile Zusatznavigation um "Cockpit" erweitert.
- Scouting-Hub-UI implementiert:
  - Rollenwechsel.
  - Kennzahlen.
  - globale Suche mit Typ-/Statusfiltern.
  - Report-Erfassung mit strukturierten Feldern und Ratings.
  - KI-Assist mit Loading/Error/Retry-Grundlage.
  - Watchlist-Erstellung und Spieleraufnahme.
  - Aufgaben-/Kalender-Grundlage.
  - Benachrichtigungen mit gelesen-Status.
- Regressionstest für Root-Start auf Scouting-Cockpit ergänzt.

### Geänderte Dateien

- `src/services/scoutxDomain.js`
- `src/services/scoutxDomain.test.js`
- `src/context/ScoutXProductContext.jsx`
- `src/pages/ScoutingHubPage.jsx`
- `src/app.jsx`
- `src/app.integration.test.jsx`
- `src/config/storage.js`
- `eslint.config.js`
- `docs/scoutx_progress_log.md`

### Technische Entscheidungen

- Die neue Produktdomain ist bewusst lokal-persistent, aber API-fähig modelliert: normalisierte Objekte, Versionierung und zentrale Permission-Regeln.
- Die KI-Auswertung ist im MVP lokal deterministisch, damit keine Secrets oder externen Provider in die SPA eingebaut werden.
- `/hub` ist jetzt Startpunkt, während Setup/Games/Plan unverändert als spezialisierter Spielplan-/PDF-Flow erhalten bleiben.
- Gastzugriff bleibt schreibgeschützt; Schreibfehler werden im Hub als Produktfehler angezeigt statt die App zu crashen.

### Validierung

- `npm run lint`: bestanden.
- `npm run test`: bestanden, 32 Testdateien / 177 Tests.
- `npm run build`: bestanden.

### Offene Punkte

- Keine echte serverseitige Authentifizierung oder Multiuser-Persistenz; Rollen/Sichtbarkeit sind MVP-Produktlogik im Client.
- Vergleichsansichten und echte externe KI-Anbindung sind vorbereitet, aber noch nicht umgesetzt.

### Nächste konkrete Schritte

1. Report-Detailbearbeitung und Watchlist-Entry-Statusupdates vertiefen.
2. Export der neuen Produktdomain als JSON/CSV ergänzen.
3. Echte serverseitige Authentifizierung/API-Persistenz planen.

## 2026-04-23 - Persistenz- und Auth-Fundament bereinigt

### Umgesetzte Arbeit

- `SetupContext` stellt persistierte Setup-Wizard-Daten wieder her statt sie beim Start zu löschen.
- Setup-Persistenz speichert Kreis, Jugend, Teams, Zeitraum, Unterstufen, Startort und Favoriten versioniert unter bestehendem Key.
- Frontend nutzt keinen eingebauten Adapter-Token mehr; `VITE_ADAPTER_TOKEN` bleibt optional.
- Adapter-Service aktiviert Auth nur noch, wenn `ADAPTER_TOKEN` gesetzt ist.
- Setup-Regressionstest an das dokumentierte Persistenzverhalten angepasst.

### Geänderte Dateien

- `src/context/SetupContext.jsx`
- `src/pages/SetupPage.test.jsx`
- `adapter-service/server.mjs`
- `docs/scoutx_progress_log.md`

### Technische Entscheidungen

- Lokale Setup-Persistenz ist für Mobile-Nutzung und echte Feldarbeit wichtiger als ein immer leer startender Wizard.
- Adapter-Auth ohne gesetztes Secret bleibt deaktiviert; damit gibt es keinen impliziten Projekt-Shared-Secret mehr im Code.

### Validierung

- Gezielte Tests: `src/pages/SetupPage.test.jsx`, `src/services/scoutxDomain.test.js`, `src/app.integration.test.jsx` bestanden.
- `npm run lint`: bestanden.
- `npm run test`: bestanden, 32 Testdateien / 177 Tests.
- `npm run build`: bestanden.
- Dev-Server erreichbar: `http://127.0.0.1:5173/hub`.

### Offene Punkte

- Rollen/Sichtbarkeit sind im MVP zentral und konsistent, aber noch keine echte Security-Grenze ohne Backend-Auth.
- Externe KI-Anbindung, Vergleichsansichten und Produktdomain-Export bleiben nächste Ausbauschritte.

## 2026-04-24 - Funktionale Cockpit-Erweiterung vor UX-Pass

### Umgesetzte Arbeit

- Report-Workflow erweitert:
  - Statuswechsel für Entwurf, Review, Geteilt und Archiv.
  - Review-Kommentare mit Autor, Zeitstempel und Notification.
  - Versionierung bleibt bei Status-/Report-Änderungen erhalten.
- Watchlist-Workflow erweitert:
  - Einträge können direkt priorisiert werden.
  - Eintragsstatus kann geändert werden.
  - Einträge können entfernt werden.
- Suche erweitert:
  - Such-/Filterkombinationen können als Saved Filter gespeichert, angewendet und gelöscht werden.
- Spielerprofile ergänzt:
  - Profile werden aus PlayerSheets, Reports, Watchlists und Assignments aggregiert.
  - Kennzahlen: Rating, Reportanzahl, Shortlistanzahl, Aufgabenanzahl, Priorität.
  - Spieler-zu-Spieler-Vergleich mit Metriken.
- Kalender-/Planungsgrundlage erweitert:
  - Aufgaben werden nach Fälligkeit gruppiert.
  - Offene Aufgaben je Datum werden sichtbar.
- Export ergänzt:
  - Sichtbarkeitsgerechter JSON-Export der Product-Domain inklusive Reports, Watchlists, Assignments, Notifications, Saved Filters, Spielerprofilen, Games und PlanHistory.

### Geänderte Dateien

- `src/services/scoutxDomain.js`
- `src/services/scoutxDomain.test.js`
- `src/context/ScoutXProductContext.jsx`
- `src/pages/ScoutingHubPage.jsx`
- `docs/scoutx_progress_log.md`

### Technische Entscheidungen

- Die funktionalen Erweiterungen bleiben bewusst im bestehenden Cockpit-Layout. Der angekündigte UX-Pass kommt danach, damit visuelle Struktur nicht vor fachlicher Tiefe optimiert wird.
- Spielerprofile sind aggregierte Views statt neue doppelte Persistenzobjekte. Dadurch bleiben Reports, Watchlists und PlayerSheets die Quellen der Wahrheit.
- Export respektiert die aktuell aktive Rolle/Sichtbarkeit.

### Validierung

- Gezielte Tests für Domain und App-Start: bestanden.
- `npm run lint`: bestanden.
- `npm run test`: bestanden, 32 Testdateien / 182 Tests.
- `npm run build`: bestanden.
- Dev-Server erreichbar: `http://127.0.0.1:5173/hub`.

### Offene Punkte

- Detailseiten/Drawer für Reports und Spielerprofile sind funktional vorbereitet, aber visuell noch nicht sauber ausgearbeitet.
- Echte externe KI-Anbindung und serverseitige Persistenz/Auth bleiben spätere Integrationsschritte.
- UX-Pass für Übersichtlichkeit, Symmetrie und Informationsgewichtung steht als nächster grosser Schritt an.

## 2026-04-24 - Cockpit UX-Pass

### Umgesetzte Arbeit

- Cockpit in fokussierte Arbeitsbereiche gegliedert:
  - Heute
  - Reports
  - Shortlists
  - Planung
  - Profile
- Dauerhaft sichtbare Formularfläche reduziert:
  - Report-Erfassung ist einklappbar.
  - Watchlist-Bearbeitung ist einklappbar.
  - Aufgabenanlage ist einklappbar.
- Startbereich gestrafft:
  - kurze Rollen-/Daten-Chips statt langer Beschreibung.
  - symmetrisches Kennzahlenraster mit sechs Kacheln.
- Profile und Vergleich in einen eigenen Arbeitsbereich verschoben.
- Kalender-/Aufgabengruppierung in den Planungsbereich verschoben.
- Suche und Benachrichtigungen bilden den heutigen Arbeitsbereich.

### Geänderte Dateien

- `src/pages/ScoutingHubPage.jsx`
- `docs/scoutx_progress_log.md`

### Technische Entscheidungen

- Keine Domain-Änderung im UX-Pass; alle Funktionen bleiben über die bestehenden Actions erreichbar.
- Tabs wurden lokal in der Page umgesetzt, damit der bestehende Router nicht mit Zwischenrouten überladen wird.
- Formulare bleiben inline, aber eingeklappt. Das ist ein pragmatischer Zwischenschritt vor späteren Drawern/Detailseiten.

### Validierung

- `npm run lint`: bestanden.
- Gezielte Tests für App-Start und Domain: bestanden.
- `npm run test`: bestanden, 32 Testdateien / 182 Tests.
- `npm run build`: bestanden.
- Dev-Server erreichbar: `http://127.0.0.1:5173/hub`.

### Offene Punkte

- Detailseiten oder Side-Drawer für Report- und Spielerprofil-Bearbeitung würden die nächste UX-Stufe bringen.
- Mobile Feinschliff sollte nach realer Nutzung im Browser erfolgen.

## 2026-04-24 - Report- und Profil-Detailflächen

### Umgesetzte Arbeit

- Reports-Arbeitsbereich vertieft:
  - Reportliste und Report-Detailansicht getrennt.
  - Statuswechsel bleiben direkt aus dem Detail heraus möglich.
  - Ratings, strukturierte Sections, Kommentare und KI-Auswertung sind in einer fokussierten Detailfläche sichtbar.
  - KI-Analyse kann aus dem Detailkontext erneut gestartet werden.
- Profil-Arbeitsbereich vertieft:
  - Spielerprofile können aus der Liste geöffnet werden.
  - Detailfläche zeigt Reportanzahl, Shortlistanzahl, Aufgabenanzahl, Priorität, Notizen und Shortlist-Kontext.
  - Ausgewählte Einträge werden visuell markiert.
- Responsive Layouts angepasst:
  - Desktop nutzt Master-Detail-Raster.
  - Mobile fällt auf eine einspaltige Struktur zurück.

### Geänderte Dateien

- `src/pages/ScoutingHubPage.jsx`
- `docs/scoutx_progress_log.md`

### Technische Entscheidungen

- Detailflächen sind zunächst als inline Master-Detail-Ansichten umgesetzt statt als Router-Unterseiten. Dadurch bleiben Kontextwechsel schnell und die vorhandene Cockpit-Persistenz unverändert.
- Auswahlzustand bleibt lokal in der Page; Domain-State wird nur für echte Datenmutationen verwendet.
- Spielerprofile bleiben aggregierte Views aus bestehenden Objekten und werden nicht separat dupliziert.

### Validierung

- `npm run lint`: bestanden.
- Gezielte Tests für App-Start und Domain: bestanden.
- `npm run test`: bestanden, 32 Testdateien / 182 Tests.
- `npm run build`: bestanden.
- Dev-Server erreichbar: `http://127.0.0.1:5173/hub`.

### Offene Punkte

- Nächster fachlicher Schritt: gespeicherte Filter und Vergleichs-/Export-Interaktionen sichtbarer machen.
- Danach: Mobile-Browser-Check und gezielter UX-Feinschliff für Abstände, Symmetrie und Scanbarkeit.

## 2026-04-24 - Such-, Filter-, Vergleichs- und Export-Workflows sichtbar gemacht

### Umgesetzte Arbeit

- Globale Suche erweitert:
  - Treffer zeigen lesbare Typen statt technischer Keys.
  - Treffer können geöffnet werden und springen in den passenden Arbeitsbereich.
  - Report-Treffer öffnen die Report-Detailfläche.
  - Spieler-Treffer öffnen das aggregierte Spielerprofil.
  - Watchlist-, Aufgaben-, Spiel- und Historien-Treffer springen in Shortlists bzw. Planung.
- Gespeicherte Filter verbessert:
  - Anzeige respektiert aktive Rolle: Admin sieht alle, andere Rollen nur eigene Filter.
  - Aktive Suchmenge zeigt Trefferanzahl und Anzahl gespeicherter Sichten.
  - Filter können mit einem Klick geleert werden.
  - Gespeicherte Filter haben beschreibende Tooltips aus Query, Typ und Status.
- Vergleichsworkflow verbessert:
  - Profil-Detail kann den geöffneten Spieler direkt als Spieler A oder Spieler B in den Vergleich übernehmen.
- Exportworkflow verbessert:
  - Eigene Export-/Arbeitsset-Fläche im Heute-Bereich.
  - Sichtbarer Umfang des rollenbasierten Exports wird vor dem Download angezeigt.
- Kleine Designkorrektur:
  - Negative Letter-Spacing im Cockpit entfernt.

### Geänderte Dateien

- `src/pages/ScoutingHubPage.jsx`
- `docs/scoutx_progress_log.md`

### Technische Entscheidungen

- Suchtreffer bleiben generisch, aber die Page interpretiert Typ und Entity für Navigation. Dadurch muss die Domain-Suche keine UI-Routen kennen.
- Filter-Sichtbarkeit wird in der UI mit derselben Rollenlogik wie der Export gespiegelt; echte Security-Grenzen bleiben später Backend-Aufgabe.
- Export bleibt JSON-basiert und rollenbasiert, damit BI/API-Vorbereitung ohne zusätzliche Formatbindung möglich bleibt.

### Validierung

- `npm run lint`: bestanden.
- Gezielte Tests für App-Start und Domain: bestanden.
- `npm run test`: bestanden, 32 Testdateien / 182 Tests.
- `npm run build`: bestanden.
- Dev-Server erreichbar: `http://127.0.0.1:5173/hub`.

### Offene Punkte

- Nächster fachlicher Schritt: Planning-/Assignment-Detailfläche mit Match-Kontext und direkter Statusarbeit.
- Danach: Browser-basierter Mobile-/Desktop-UX-Check und Feinschliff.

## 2026-04-24 - Planning- und Assignment-Detailworkflow

### Umgesetzte Arbeit

- Planungsbereich zu einem Master-Detail-Workflow erweitert:
  - Kalendergruppen und Aufgabenlisten können eine Aufgabe öffnen.
  - Ausgewählte Aufgabe wird visuell markiert.
  - Neue Detailfläche zeigt Titel, Fälligkeit, Assignee, Status, Typ, Sichtbarkeit, Kontext und Arbeitsnotiz.
- Statusarbeit verbessert:
  - Aufgabenstatus kann weiterhin in der Liste geändert werden.
  - Aufgabenstatus kann zusätzlich direkt im Detail geändert werden.
- Suchintegration verbessert:
  - Aufgaben-Treffer öffnen die konkrete Aufgabe im Planungsbereich.
  - Spiel-Treffer springen in die Planung, befüllen das Spiel im Aufgabenformular und öffnen die Erfassung.
- Match-/Report-Kontext sichtbar gemacht:
  - Verknüpfte Reports werden im Detail mit Titel angezeigt.
  - Verknüpfte Spiele werden mit Paarung, Datum und Ort angezeigt.

### Geänderte Dateien

- `src/pages/ScoutingHubPage.jsx`
- `docs/scoutx_progress_log.md`

### Technische Entscheidungen

- Assignment-Auswahl bleibt lokaler UI-State, während Statuswechsel weiter über zentrale Domain-Actions laufen.
- Match- und Report-Kontext wird aus bestehenden Quellen aufgelöst statt in Assignment-Objekten dupliziert.
- Der Planungsbereich nutzt dasselbe Master-Detail-Muster wie Reports und Profile, damit die Cockpit-UX konsistent bleibt.

### Validierung

- `npm run lint`: bestanden.
- Gezielte Tests für App-Start und Domain: bestanden.
- `npm run test`: bestanden, 32 Testdateien / 182 Tests.
- `npm run build`: bestanden.
- Dev-Server erreichbar: `http://127.0.0.1:5173/hub`.

### Offene Punkte

- Browser-basierter Mobile-/Desktop-UX-Check steht weiterhin aus.

## 2026-04-24 - UTF-8-Umlaute korrigiert

### Umgesetzte Arbeit

- Deutschsprachige UI-Texte im Scouting-Cockpit auf echte UTF-8-Umlaute umgestellt.
- Domain-Labels, Report-Vorlagen, KI-Auswertungstexte und Beispielinhalte korrigiert.
- ScoutX-MVP-Dokumentation auf korrekte Schreibweise mit Umlauten umgestellt.
- Betroffene Testbeschreibungen und PDF-Texte ebenfalls angepasst.

### Geänderte Dateien

- `src/pages/ScoutingHubPage.jsx`
- `src/services/scoutxDomain.js`
- `src/app.integration.test.jsx`
- `src/components/GameTable.test.jsx`
- `src/components/TeamPicker.test.jsx`
- `src/pages/SetupPage.test.jsx`
- `src/services/pdf/sections.js`
- `docs/scoutx_feature_expansion_audit.md`
- `docs/scoutx_gap_analysis.md`
- `docs/scoutx_implementation_plan.md`
- `docs/scoutx_progress_log.md`
- `docs/scoutx_target_architecture.md`

### Validierung

- `npm run lint`: bestanden.
- `npm run test`: bestanden, 32 Testdateien / 182 Tests.
- `npm run build`: bestanden.
- Dev-Server erreichbar: `http://127.0.0.1:5173/hub`.

## 2026-04-24 - Top-Navigation kontextsensitiv gemacht

### Umgesetzte Arbeit

- Obere Schritt-Navigation vereinfacht:
  - Im Cockpit und außerhalb des Setup-Flows wird nur noch „Konfiguration“ angezeigt.
  - „Spiele“ und „Plan“ erscheinen erst innerhalb des Konfigurationsflows (`/setup`, `/games`, `/plan`).
  - Klick auf „Konfiguration“ führt weiterhin direkt in `/setup`.
- Regressionstest ergänzt:
  - Außerhalb des Konfigurationsflows werden Spiele/Plan nicht mehr gerendert.
  - Innerhalb des Konfigurationsflows bleiben alle drei Schritte verfügbar.

### Geänderte Dateien

- `src/components/StepNav.jsx`
- `src/components/StepNav.test.jsx`
- `docs/scoutx_progress_log.md`

### Validierung

- Gezielte Tests für StepNav und App-Integration: bestanden.
- `npm run lint`: bestanden.
- `npm run build`: bestanden.
- Dev-Server erreichbar: `http://127.0.0.1:5173/hub` und `http://127.0.0.1:5173/setup`.

## 2026-04-24 - Setup-Kalender und Mannschaften-Zählung korrigiert

### Umgesetzte Arbeit

- Setup-Zeitraum intelligenter gemacht:
  - Initiales Von-Datum ist jetzt der reale heutige Tag.
  - Bis-Datum läuft automatisch bis zum nächsten Sonntag.
  - Persistierte Setup-Daten mit Startdatum in der Vergangenheit werden beim Laden auf heute bis nächsten Sonntag normalisiert.
  - Bei Änderung des Von-Datums wird das Bis-Datum wieder auf den kommenden Sonntag dieses Startdatums gesetzt.
- Zusammenfassung der optionalen Mannschaften korrigiert:
  - Die Anzeige zählt nur noch explizit vom User eingetragene Mannschaften.
  - Automatisch abgeleitete Unterstufen-Hinweise wie D I/D1 bleiben für die Plansuche nutzbar, erscheinen aber nicht mehr als gesetzte Mannschaften.

### Geänderte Dateien

- `src/context/shared.js`
- `src/context/shared.test.js`
- `src/context/SetupContext.jsx`
- `src/pages/SetupPage.jsx`
- `src/pages/SetupPage.test.jsx`
- `docs/scoutx_progress_log.md`

### Validierung

- Gezielte Tests für Shared-Date-Logik und SetupPage: bestanden, 20 Tests.
- `npm run lint`: bestanden.
- `npm run build`: bestanden.
- `npm run test`: bestanden, 33 Testdateien / 193 Tests.

## 2026-04-24 - Cockpit-Seed-Daten entfernt

### Umgesetzte Arbeit

- Initiale Produktdomain startet jetzt leer:
  - keine Beispielreports
  - keine Beispielshortlists
  - keine Beispielaufgaben
  - keine Beispielbenachrichtigungen
- Cockpit zeigt damit nur noch Daten, die der User selbst angelegt hat oder die aus vorhandenen echten App-Daten wie PlayerSheets, Games und PlanHistory stammen.
- Migration ergänzt:
  - Bereits lokal gespeicherte alte Seed-Daten werden beim Laden erkannt und aus dem Product-State entfernt.
  - User, Rollen und echte selbst angelegte Inhalte bleiben erhalten.
- Domain-Tests angepasst:
  - Tests erzeugen benötigte Reports, Watchlists und Assignments explizit im jeweiligen Test.
  - Regressionstest für das Entfernen alter Seed-Daten ergänzt.

### Geänderte Dateien

- `src/services/scoutxDomain.js`
- `src/services/scoutxDomain.test.js`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run lint`: bestanden.
- `npm run test`: bestanden, 32 Testdateien / 185 Tests.
- `npm run build`: bestanden.
- Dev-Server erreichbar: `http://127.0.0.1:5173/hub`.

## 2026-04-24 - Zeiterfassungen im Cockpit ergänzt

### Umgesetzte Arbeit

- Neuer Cockpit-Tab „Zeiterfassungen“ ergänzt.
- Monatliche Abrechnungsübersicht aus echten PlanHistory-Daten gebaut:
  - Einsätze pro Monat.
  - erfasste und offene Arbeitszeiten.
  - gesamte Arbeitszeit.
  - abrechnungsrelevante Kilometer.
  - erwartetes Tankgeld je Monat.
  - fehlende Kilometerdaten werden sichtbar markiert.
- Detailtabelle je Monat ergänzt:
  - Datum und Uhrzeit.
  - Spielpaarung und Ort.
  - Dauer.
  - Kilometer.
  - Tankgeld.
  - Status „erfasst“ oder „offen“.
- Eigene Service-Schicht `timeTracking` ergänzt, damit die Logik testbar und später exportfähig bleibt.

### Geänderte Dateien

- `src/services/timeTracking.js`
- `src/services/timeTracking.test.js`
- `src/pages/ScoutingHubPage.jsx`
- `docs/scoutx_progress_log.md`

### Technische Entscheidungen

- Zeiterfassung nutzt ausschließlich vorhandene echte Daten aus `planHistory` und `presenceByGame`.
- Tankgeld wird nur für erfasste Einsätze mit vorhandener Distanz berechnet. Offene Zeiten bleiben sichtbar, erhöhen aber noch keine Auszahlungssumme.
- Kilometerbasis ist aktuell die beste vorhandene Spiel-Distanz (`fromStartRouteDistanceKm` vor `distanceKm`) mit Hin- und Rückfahrt.
- Fehlende Kilometer werden bewusst nicht geschätzt, sondern als Abrechnungslücke markiert.

### Validierung

- `npm run lint`: bestanden.
- Gezielte Tests für Zeiterfassung und App-Integration: bestanden.
- `npm run test`: bestanden, 33 Testdateien / 188 Tests.
- `npm run build`: bestanden.
- Dev-Server erreichbar: `http://127.0.0.1:5173/hub`.

## 2026-04-24 - Setup Action-Bar Visual Glitch behoben

### Umgesetzte Arbeit

- Sticky Bottom-Bar im Setup visuell abgedichtet.
- Transparenter Blur-Hintergrund durch deckende Oberfläche ersetzt.
- Untere Maskenfläche ergänzt, damit darunterliegende Kreis-Karten nicht zwischen Buttonleiste und Seitenende durchscheinen.
- Ebenenordnung der Action-Bar erhöht.

### Geänderte Dateien

- `src/styles/theme.js`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run lint`: bestanden.
- `npm run build`: bestanden.
- Dev-Server erreichbar: `http://127.0.0.1:5173/setup`.

## 2026-04-24 - Zeiterfassungen monatsweise bearbeitbar gemacht

### Umgesetzte Arbeit

- Monatswechsel im Zeiterfassungs-Tab klarer gemacht:
  - sichtbarer Monatsumschalter.
  - Monatsliste bleibt als schnelle Auswahl erhalten.
- Inline-Bearbeitung ergänzt:
  - Dauer je Einsatz kann direkt in Minuten angepasst oder geleert werden.
  - einfache Kilometer je Einsatz können direkt angepasst oder geleert werden.
  - Änderungen schreiben zurück in die echte PlanHistory.
  - Monats-Arbeitszeit, Kilometer und Tankgeld berechnen sich danach automatisch neu.

### Geänderte Dateien

- `src/pages/ScoutingHubPage.jsx`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run lint`: bestanden.
- Gezielte Tests für Zeiterfassung und App-Integration: bestanden.
- `npm run test`: bestanden, 33 Testdateien / 188 Tests.
- `npm run build`: bestanden.
- Dev-Server erreichbar: `http://127.0.0.1:5173/hub`.

## 2026-04-24 - Cockpit-Rücksprung in Top-Navigation ergänzt

### Umgesetzte Arbeit

- Top-Navigation erweitert:
  - „Cockpit“ steht jetzt links vor „Konfiguration“.
  - Im Cockpit werden nur „Cockpit“ und „Konfiguration“ angezeigt.
  - Im Konfigurationsflow werden „Cockpit“, „Konfiguration“, „Spiele“ und „Plan“ angezeigt.
  - Von `/setup`, `/games` und `/plan` kann man über die obere Navigation direkt zurück ins Cockpit wechseln.
- Regressionstests ergänzt:
  - Cockpit ist außerhalb und innerhalb des Konfigurationsflows sichtbar.
  - Klick auf „Cockpit“ löst Navigation zu `hub` aus.

### Geänderte Dateien

- `src/components/StepNav.jsx`
- `src/components/StepNav.test.jsx`
- `docs/scoutx_progress_log.md`

### Validierung

- Gezielte Tests für StepNav und App-Integration: bestanden.
- `npm run lint`: bestanden.
- `npm run build`: bestanden.
- Dev-Server erreichbar: `http://127.0.0.1:5173/hub` und `http://127.0.0.1:5173/setup`.
# 2026-05-13 - Security-Fundament Phase 1 gehaertet (CORS/Cookies/Reset-Leak/ENV)

### Umgesetzte Arbeit

- Adapter-Sicherheitsdefaults geschaerft:
  - CORS-Policy von permissiv auf Allowlist umgestellt (default lokal: `http://localhost:5173,http://127.0.0.1:5173`).
  - Disallowed Preflight-Origins werden aktiv mit `403` abgewiesen.
- Session-Cookie-Haertung:
  - `Secure` standardmaessig aktiv ausserhalb `NODE_ENV=development`.
  - `SameSite` ueber ENV konfigurierbar (`Lax|Strict|None`), sichere Kombinationslogik fuer `None`.
- Password-Reset Leak reduziert:
  - `POST /api/team/auth/password-reset/request` liefert standardmaessig keinen Reset-Token mehr.
  - Token-Rueckgabe nur noch explizit via `ADAPTER_EXPOSE_RESET_TOKEN_ON_REQUEST=true` (Test/Dev).
- Fruehe ENV-Validierung eingefuehrt:
  - Numerische Kern-ENV-Werte werden zentral validiert (Port/Timeouts/RateLimits/TTLs).
  - Ungueltige Werte failen frueh mit klarer Fehlermeldung.

### Geänderte Dateien

- `adapter-service/server.mjs`
- `adapter-service/server.test.mjs`
- `adapter-service/README.md`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run lint`: bestanden.
- `npm run test -- adapter-service/server.test.mjs`: bestanden (37/37 Tests gruen).

## 2026-05-13 - Security-Testmatrix erweitert (CORS/CSRF/Token-Replay)

### Umgesetzte Arbeit

- Zusätzliche Sicherheits-Integrationstests ergänzt:
  - CORS-Allowlist positive Abdeckung: erlaubte Origin bekommt `204` + `Access-Control-Allow-Origin` + `Access-Control-Allow-Credentials`.
  - Password-Reset-Token-Replay: zweiter Confirm mit bereits verbrauchtem Token wird abgewiesen.
  - CSRF-Mismatch auf weiteren Write-Endpunkten (`/notifications/read`, `/manual-games`) wird abgewiesen.
- Testreihenfolge stabilisiert: Reset-Replay-Test nutzt `new-scout`, um Seiteneffekte auf Standard-Login-Daten zu vermeiden.

### Geänderte Dateien

- `adapter-service/server.test.mjs`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run lint`: bestanden.
- `npm run test -- adapter-service/server.test.mjs`: bestanden (40/40 Tests gruen).

## 2026-05-13 - PostgreSQL SoT Phase 1: Team-Session Write-Through

### Umgesetzte Arbeit

- Neuer Runtime-DB-Baustein eingeführt (`adapter-service/lib/teamRuntimeDb.js`):
  - lazy PostgreSQL-Init über `ADAPTER_DATABASE_URL`/`DATABASE_URL`.
  - automatische Schema-Erstellung für `adapter_team_sessions`.
  - Funktionen für Session-Write, Revoke und Expired-Pruning.
- Session-Lifecycle im Adapter an PostgreSQL angebunden (Write-Through):
  - Login/Register/Invite-Accept/Password-Reset-Confirm schreiben Session zusätzlich nach Postgres.
  - Logout und serverseitige Session-Invalidierung markieren Session als `revoked`.
  - periodischer Cleanup prune-t abgelaufene/revokte Sessions in Postgres.
- Bestehender JSON/In-Memory-Flow bleibt als kompatibler Fallback unverändert aktiv.

### Geänderte Dateien

- `adapter-service/lib/teamRuntimeDb.js`
- `adapter-service/server.mjs`
- `adapter-service/README.md`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run lint`: bestanden.
- `npm run test -- adapter-service/server.test.mjs`: bestanden (40/40 Tests gruen).

## 2026-05-13 - PostgreSQL SoT Phase 2a: Team-Accounts Write-Through

### Umgesetzte Arbeit

- Neues PostgreSQL-Accounts-Modul ergänzt (`adapter-service/lib/teamAccountsDb.js`):
  - lazy DB-Init via `ADAPTER_DATABASE_URL`/`DATABASE_URL`.
  - automatische Schema-Erstellung (`adapter_team_accounts`).
  - transaktionale Synchronisierung aller Team-Accounts (upsert + delete verwaister Team-Accounts).
- Server-Integration:
  - `persistTeamState(...)` führt zusätzlich `syncTeamAccountsToDb(...)` aus.
  - Beim Startup wird geladener Team-State sofort in DB gespiegelt (inkl. Fallback-Initial-State).
- Ziel: Accounts/Credentials nicht mehr nur im JSON-Snapshot halten, sondern parallel als relationalen Write-Through-Baustein aufbauen.

### Geänderte Dateien

- `adapter-service/lib/teamAccountsDb.js`
- `adapter-service/server.mjs`
- `adapter-service/README.md`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run lint`: bestanden.
- `npm run test -- adapter-service/server.test.mjs`: bestanden (40/40 Tests gruen).

## 2026-05-13 - PostgreSQL SoT Phase 2b: optionale Auth-Reads aus DB (Feature-Flag)

### Umgesetzte Arbeit

- `adapter-service/lib/teamAccountsDb.js` um Account-Read erweitert:
  - `fetchTeamAccountByIdFromDb(accountId, logger)`
- Auth-Resolver im Server eingeführt:
  - `resolveAccountForAuth(...)` nutzt bei `ADAPTER_AUTH_READS_FROM_DB=true` bevorzugt PostgreSQL, sonst/fallback weiterhin JSON-State.
- Login und Password-Reset-Request auf den Resolver umgestellt:
  - `POST /api/team/auth/login`
  - `POST /api/team/auth/password-reset/request`
- Integrationstests laufen mit aktiviertem Flag (`ADAPTER_AUTH_READS_FROM_DB=true`) und validieren damit explizit den Fallbackpfad ohne harte DB-Abhängigkeit.

### Geänderte Dateien

- `adapter-service/lib/teamAccountsDb.js`
- `adapter-service/server.mjs`
- `adapter-service/server.test.mjs`
- `adapter-service/README.md`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run lint`: bestanden.
- `npm run test -- adapter-service/server.test.mjs`: bestanden (40/40 Tests gruen).
