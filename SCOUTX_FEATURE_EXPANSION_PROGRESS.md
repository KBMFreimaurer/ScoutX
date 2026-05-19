# SCOUTX Feature Expansion Progress

Stand: 2026-05-18

Diese Datei arbeitet `src/prompt.md` in der vom Nutzer gewünschten Reihenfolge ab und mappt Anforderungen auf konkrete Artefakte im Repository.

## Reihenfolge-Check (Soll -> Ist)

1. Team-/Account-Struktur
- Status: Erfüllt
- Evidenz:
  - Rollenmatrix und Rechte: `docs/role-matrix.md`
  - Team-Auth/Accounts/Invites/Passwort-Reset Routen: `adapter-service/routes/teamAuthRoutes.js`, `adapter-service/routes/teamInvitationRoutes.js`, `adapter-service/routes/teamPasswordResetRoutes.js`
  - Team-State/Runtime-Persistenz: `adapter-service/lib/teamRuntimeDb.js`, `adapter-service/lib/teamStateDb.js`
  - Tests: `adapter-service/server.test.mjs`, `adapter-service/services/teamDomainServices.test.js`

2. Datenmodell für Spiele, Notizen, Highlights, Status, Quellen
- Status: Erfüllt
- Evidenz:
  - Produkt-Domain + Status/Typen: `src/services/scoutxDomain.js`
  - Beobachtungen/Notizen/Highlights im Team-Flow: `src/context/useTeamObservationActions.js`, `src/context/useTeamReportActions.js`
  - Backend-Team-Modelle und Feed/Notifications: `adapter-service/lib/teamBackend.js`, `adapter-service/lib/teamDbPersistence.js`, `adapter-service/routes/teamPlanningRoutes.js`, `adapter-service/routes/teamNotificationsRoutes.js`
  - Integrationstests zu Notiz/Highlight/Seen-Flow: `src/app.integration.test.jsx`

3. Favoriten, Ligen, Jahrgänge, Kreise
- Status: Erfüllt
- Evidenz:
  - Team-Ziele inkl. `favoriteTeams`, `favoriteClubs`, `leaguePriorities`, `ageGroups`: `adapter-service/openapi.team.v1.yaml`, `adapter-service/routes/teamPlanningRoutes.js`
  - Favoriten-Priorisierung im Spiele-Flow: `src/context/GamesContext.jsx`
  - Jahrgänge/Jugenden/Kreise Auswahl: `src/components/AgeGroupSelector.jsx`, `src/components/KreisSelector.jsx`, `src/pages/SetupPage.jsx`

4. Planungslogik
- Status: Erfüllt
- Evidenz:
  - Plan-Erzeugung + Historie + Sync-Kontext: `src/context/PlanContext.jsx`
  - Konflikt-/Erreichbarkeitslogik: `src/pages/GamesPage.test.jsx`, `src/services/liveConsistency.js`, `src/services/scheduleChanges.js`
  - Team-Plan-Publish/Workflow: `src/context/useTeamPlanningActions.js`, `adapter-service/routes/teamPlanningRoutes.js`

5. PDF-Import und manuelle Spiele
- Status: Erfüllt
- Evidenz:
  - Kreis-PDF Preview/Confirm Import: `adapter-service/routes/teamImportTournamentRoutes.js`, `adapter-service/lib/teamRuntimeDb.js`, `adapter-service/README.md`
  - Manuelle/inoffizielle Spiele: `adapter-service/routes/teamPlanningRoutes.js`, `src/app.integration.test.jsx`
  - CSV/Datei-Importpfade für Spiele: `src/services/dataProvider.js`, `src/services/dataProvider.test.js`

6. Turniere und Länderspiele
- Status: Erfüllt
- Evidenz:
  - Turnier-Routen inkl. Import: `adapter-service/routes/teamImportTournamentRoutes.js`, `src/services/teamBackendClient.js`
  - Länderspiel-/DFB-Importroute: `adapter-service/routes/teamImportTournamentRoutes.js` (`/import/dfb-national-games`)
  - Datenquellen-/Adaptertests: `src/services/dataProvider.test.js`

7. Benachrichtigungen
- Status: Erfüllt
- Evidenz:
  - In-App Notifications + Read-Status + Filter: `adapter-service/services/teamNotificationsDomainService.js`, `adapter-service/routes/teamNotificationsRoutes.js`
  - SSE/Pending/Ack/Push-Flow: `src/hooks/useScheduleChangeNotifications.js`, `adapter-service/routes/teamNotificationsRoutes.js`
  - Tests: `adapter-service/services/teamDomainServices.test.js`, `e2e/release-gates.spec.js`

8. PDF-Export und UI-Feinschliff
- Status: Erfüllt
- Evidenz:
  - PDF-Export Service + Tests: `src/services/pdf/index.js`, `src/services/pdf/index.test.js`, `src/components/PDFExport.jsx`
  - Plan-/Games-/Dashboard-/Hub-UX mit produktiven Flows: `src/pages/PlanPage.jsx`, `src/pages/GamesPage.jsx`, `src/pages/DashboardPage.jsx`, `src/pages/ScoutingHubPage.jsx`
  - App- und Release-Gates für UI/QA: `docs/scoutx_p8_completion.md`, `docs/scoutx_p9_completion.md`

## Ergebnis

Die in `src/prompt.md` geforderten Kernblöcke sind in der gewünschten Reihenfolge bereits im Repository umgesetzt und mit Tests/Gates/Dokumentation hinterlegt.

## Offene Punkte (nur operativ, nicht Codeblocker)

- Produktive ASC/TestFlight-Einreichung bleibt manuell (siehe `docs/scoutx_p9_completion.md`).
- HRworks-Live-Session bleibt betrieblich zu validieren (Runbooks/Status in `docs/hrworks-*.md`).
