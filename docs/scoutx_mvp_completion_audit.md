# ScoutX Web MVP Ausbauplan - Completion Audit (2026-05-13)

Quelle: `/Users/playboiiboggos/Desktop/scoutx-web-mvp-ausbauplan.md`

## 1) Ziel in konkrete Deliverables übersetzt

1. Security/Account-Basics serverseitig hart absichern (TTL, Archiv-Schutz, `active`-Durchreichung).
2. Vollständiger Observation-Lifecycle mit Statuskette und Anschlussaktionen nach `seen`.
3. Team-Übersicht + Konfliktmanagement (Tag/Woche, Auslastung, Konflikte, Warnungen vor Planabschluss).
4. Vier Spielquellen (`official|manual|tournament|national`) im selben Plan/Feed/Seen/Report-Flow.
5. Notifications MVP (Inbox unread/read + Typfilter + Browser-Push für kritische Events + Event-ID-Dedupe).
6. Account-/Rollenmodell inkl. Invite/Reset/Open-Register; jeder Write-Endpunkt rollenvalidiert + getestet.
7. Im Plan genannte öffentliche APIs implementiert und testbar.
8. Testplan-Gates mit realer Evidenz (ausgeführte Commands + grüne Resultate).

## 2) Prompt-to-Artifact Checklist

### A. Key Change 1 - Security/Account
- Anforderung: Session-Lifetime serverseitig erzwingen.
  - Evidenz Code: `adapter-service/server.mjs` (Session-Handling + Expiry-Prüfung).
  - Evidenz Test: `adapter-service/server.test.mjs` (Ablauf-/Auth-Flows).
- Anforderung: Keine `passwordHash`-Daten in Archiv-Events.
  - Evidenz Code: `persistTeamState` Sanitizing in `adapter-service/server.mjs`.
  - Evidenz Test: `it("never writes password hashes into team archive events", ...)` in `adapter-service/server.test.mjs`.
- Anforderung: `active` in Public-Payload durchreichen.
  - Evidenz Code: `toPublicAccount`/State-Payload in `adapter-service/lib/teamBackend.js` und `adapter-service/server.mjs`.

Status: Erfüllt.

### B. Key Change 2 - Lifecycle
- Anforderung: Statuskette `planned -> seen -> reported -> followup`.
  - Evidenz Code: `OBSERVATION_STATUSES` in `adapter-service/lib/teamBackend.js`.
  - Evidenz Endpunkte: `/api/team/observations/seen`, `/report`, `/note` in `adapter-service/server.mjs`.
  - Evidenz Tests: mehrere Lifecycle-Tests in `adapter-service/server.test.mjs`.
- Anforderung: Nach `seen` direkte Aktionen (`Spielbericht`, `Spieler-Highlight`, `Follow-up`).
  - Evidenz UI: Buttons in `src/pages/ScoutingHubPage.jsx` (`Spielbericht anlegen`, `Spieler highlighten`, `Follow-up`).

Status: Erfüllt.

### C. Key Change 3 - Team-Übersicht + Konflikte
- Anforderung: Wochen-/Tagesansicht inkl. Auslastung, unbesetzte Prioritätsspiele etc.
  - Evidenz Code: `buildTeamOverview` in `src/services/scoutxDomain.js`.
  - Evidenz UI: `src/pages/ScoutingHubPage.jsx` (Stats/Overview Panels).
- Anforderung: Konflikterkennung Zeitüberlappung + Erreichbarkeit.
  - Evidenz Code: `buildTeamConflicts` in `adapter-service/server.mjs`; Schedule-Conflicts im Domain-Model.
  - Evidenz Test: `detects planning conflicts for overlaps and low travel feasibility` in `adapter-service/server.test.mjs`.
- Anforderung: Warnungen vor Planabschluss + in Teamübersicht.
  - Evidenz UI: Konfliktwarnung vor Planabschluss in `src/pages/GamesPage.jsx`; Teamübersicht in `ScoutingHubPage.jsx`.
  - Evidenz Tests: `src/pages/GamesPage.test.jsx` + `src/app.integration.test.jsx`.

Status: Erfüllt.

### D. Key Change 4 - Spielerfassung/Quellen
- Anforderung: `manual` First-Class inkl. Lifecycle.
  - Evidenz Code: `upsertManualGame`/Feed/Notifications in `adapter-service/lib/teamBackend.js`.
  - Evidenz Test: manual game + lifecycle Tests in `adapter-service/server.test.mjs`.
- Anforderung: Turniermodell + Matches + Planung.
  - Evidenz APIs: `/api/team/tournaments`, `/api/team/tournaments/:id/matches`.
  - Evidenz Tests: `creates tournaments and tournament matches` in `adapter-service/server.test.mjs`.
- Anforderung: U-Nationalspiele via Import.
  - Evidenz API: `/api/team/import/dfb-national-games`.
  - Evidenz Test: `imports national games into team flows`.
- Anforderung: Kreis-PDF Import Preview/Confirm (+ multipart).
  - Evidenz API: `/api/team/import/kreis-pdf`.
  - Evidenz Tests: preview/confirm + multipart Test in `adapter-service/server.test.mjs`.
- Akzeptanzkriterium: alle 4 Quellen im gleichen Flow.
  - Evidenz Test: `runs official/manual/tournament/national through one shared plan-seen-report flow` in `adapter-service/server.test.mjs`.

Status: Erfüllt.

### E. Key Change 5 - Notifications MVP
- Anforderung: Inbox unread/read + Typfilter.
  - Evidenz API: `GET /api/team/notifications`, `POST /api/team/notifications/read`.
  - Evidenz UI: Filter in `src/pages/ScoutingHubPage.jsx`.
  - Evidenz Test: Inbox filter/read Tests in `adapter-service/server.test.mjs`.
- Anforderung: Browser Push für kritische Events.
  - Evidenz API: `/api/team/notifications/push/subscribe`, `/pending`, `/ack`.
  - Evidenz Code: Critical-Type Queueing (`absage|konflikt|followup`) in `adapter-service/server.mjs`.
  - Evidenz Test: `queues critical push events ... deduplicates after ack`.
- Anforderung: Feed + Notifications gleiche Event-ID.
  - Evidenz Code: `eventId`-Mapping in `adapter-service/lib/teamBackend.js`.
  - Evidenz Test: eventId Equality Assertions in `adapter-service/server.test.mjs`.

Status: Erfüllt.

### F. Key Change 6 - Account/Teammodell + Rollen
- Anforderung: Invite + Reset + Open Register parallel.
  - Evidenz APIs: `/invitations/create`, `/invitations/accept`, `/auth/password-reset/request`, `/confirm`, `/auth/register`.
  - Evidenz Tests: entsprechende Auth-Integrationstests in `adapter-service/server.test.mjs`.
- Anforderung: Rechte `admin|coordinator|scout|readonly`.
  - Evidenz Code: Rollenmodell + zentrale Write-Guard in `adapter-service/lib/teamBackend.js` und `adapter-service/server.mjs`.
  - Evidenz Test: `rejects readonly team members on all critical write endpoints` + weitere 403 Tests.
- Akzeptanzkriterium: jeder Write-Endpunkt rollenvalidiert + testabgedeckt.
  - Evidenz: alle `/api/team/*` POST-Write-Routen laufen über `requireTeamWriteAllowed`; Sammeltest deckt kritische Endpunkte ab.

Status: Erfüllt.

### G. Öffentliche APIs / Interfaces
- Alle im Plan genannten Endpunkte sind implementiert in `adapter-service/server.mjs`.
- Client-Anbindung vorhanden in `src/services/teamBackendClient.js`.
- Testnachweise in `adapter-service/server.test.mjs`.

Status: Erfüllt.

### H. Testplan-Gates (explizite Commands + Resultate)
- `npm run test -- adapter-service/server.test.mjs` -> bestanden, 36/36.
- `npm run test -- src/services/dataProvider.test.js src/pages/GamesPage.test.jsx src/app.integration.test.jsx` -> bestanden, 46/46.

Status: Erfüllt.

## 3) Offene Punkte / Unsicherheiten

- Keine blocker-relevanten offenen Punkte aus dem Ausbauplan identifiziert.
- Scope-Annahmen (nur Web, kein iOS-Push) sind eingehalten.

## 4) Audit-Fazit

Der Ausbauplan ist im aktuellen Scope vollständig umgesetzt und mit konkreter Code-/Test-Evidenz abgedeckt.  
Es wurde kein nicht-abgedecktes Muss-Kriterium aus der Plan-Datei gefunden.

Abnahmehinweis: Dieser Audit-Report ist als Referenzbasis für den MVP-v1-Web Go/No-Go verwendbar; operative Freigabegates stehen in `docs/scoutx_mvp_release_checklist.md`.
