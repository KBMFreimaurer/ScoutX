# ScoutX Adapter Service

Dauerhafte Daten-Schicht für ScoutX ohne direkte fussball.de-API.

## Architektur

Der Adapter baut einen **persistenten Store** (default: `games.store.db`, SQLite) aus mehreren Quellen:

1. `imports/` (CSV/JSON aus DFBnet/fussball.de-Export)
2. optional `ADAPTER_REMOTE_URL` (externer Feed)
3. Fallback `games.sample.json`

Beim ersten Start mit SQLite migriert der Adapter bestehende `games.store.json`
automatisch in die Datenbank.

Zusätzlich kann pro angefragter Woche automatisch ein Export-Prozess getriggert werden.

Für Team-Accounts und Team-Workflow gilt zusätzlich:

- `ADAPTER_TEAM_STATE_FILE` speichert den aktuellen Team-State (Snapshot).
- `ADAPTER_TEAM_ARCHIVE_FILE` speichert im Hintergrund jede Änderung append-only als NDJSON-Event (Archiv).
- Wenn `ADAPTER_DATABASE_URL` (oder `DATABASE_URL`) gesetzt ist, schreibt der Adapter dieselben Team-Events zusätzlich in PostgreSQL (`team_state_events` in `db/schema.sql`).

## Vollautomatischer Wochen-Refresh

Bei jedem `POST /api/games` kann der Adapter automatisch Daten für die Woche des `fromDate` laden.

Steuerung über ENV:

- `ADAPTER_AUTO_REFRESH_WEEK=true`
- `ADAPTER_WEEK_REFRESH_TTL_SEC=300`
- optional `ADAPTER_EXPORT_COMMAND`
- optional `ADAPTER_WEEK_SOURCE_URL_TEMPLATE`

Wenn `ADAPTER_EXPORT_COMMAND` nicht gesetzt ist, nutzt der Adapter standardmäßig den produktiven Exporter:

`node /app/scripts/fetch-week.fussballde.mjs`

Wichtig für den produktiven Betrieb:

- `teams` aus ScoutX werden als Hint ausgewertet (`teamFilter.binding=false` in der API-Antwort), nicht als harter Filter. Dadurch bleiben auch andere Spiele derselben Kreis/Jugend-Woche verfügbar.
- Bei erfolgreichem Wochen-Export werden bestehende Store-Einträge derselben Woche/Kreis/Jugend durch die frischen Exportdaten ersetzt (kein dauerhafter Sample-Leak in echte Wochen-Pläne).

### Option A: Export Command (empfohlen)

Setze z. B.:

```bash
ADAPTER_EXPORT_COMMAND="node /app/scripts/fetch-week.fussballde.mjs"
```

Der Command erhält ENV:

- `SCOUTX_FROM_DATE`
- `SCOUTX_TO_DATE`
- `SCOUTX_KREIS_ID`
- `SCOUTX_JUGEND_ID`
- `SCOUTX_TEAMS_JSON`
- `SCOUTX_IMPORT_DIR`

Stdout darf JSON zurückgeben (`[]` oder `{ games: [...] }`).

Beispiele:

- `adapter-service/scripts/fetch-week.fussballde.mjs` (produktiv, echte fussball.de-Daten)
- `adapter-service/scripts/fetch-week.example.mjs` (Demo)

## fussball.de Exporter (produktiv)

Der produktive Exporter nutzt:

1. `wam_base.json` + `wam_kinds_*.json` für Saison/Filter
2. `wam_competitions_*.json` für Wettbewerbs-URLs
3. `ajax.fixturelist ... /datum-von/.../datum-bis/...` pro Staffel für Match-Links im Zeitfenster
4. Match-Detailseiten `/spiel/...` für echte Anstoßzeit + Spielort

Konfigurierbare ENV (optional):

- `FUSSBALLDE_BASE_URL` (default: `https://www.fussball.de`)
- `FUSSBALLDE_MANDANT` (default: `22`)
- `FUSSBALLDE_SAISON` (default: aus `wam_base.currentSaison`)
- `FUSSBALLDE_COMPETITION_TYPE` (default: aus `wam_base.defaultCompetitionType`)
- `FUSSBALLDE_REQUEST_TIMEOUT_MS` (default: `15000`)
- `FUSSBALLDE_PAGE_CONCURRENCY` (default: `4`)
- `FUSSBALLDE_MATCH_CONCURRENCY` (default: `6`)
- `FUSSBALLDE_MAX_COMPETITIONS` (default: `80`)
- `FUSSBALLDE_MAX_MATCHES` (default: `600`)
- `SCOUTX_DEBUG_EXPORTER=true` (Debug-Logs auf `stderr`)

Mandant-Zuordnung:

- Die produktive Zuordnung Verband/Region -> `mandant` kommt aus
  `src/data/germany_regions.js` (`fussballDeMapping.mandant`).
- `FUSSBALLDE_MANDANT` dient nur als globaler Fallback.
- Verifiziert ist derzeit vor allem der Niederrhein-Flow (`mandant=22`); andere
  Verbände sind kuratiert und sollten über Admin-Diagnostik regelmäßig geprüft
  werden.

### Option B: Week URL Template

```bash
ADAPTER_WEEK_SOURCE_URL_TEMPLATE="https://example.com/feed?from={fromDate}&to={toDate}&kreis={kreisId}&jugend={jugendId}"
ADAPTER_WEEK_SOURCE_TOKEN="..."
```

## Endpunkte

API-Spezifikation (OpenAPI-ähnlich): [openapi.team.v1.yaml](/Users/playboiiboggos/.openclaw/workspace/ScoutX/adapter-service/openapi.team.v1.yaml)

- `GET /health`
- `POST /api/games`
- `GET /api/clubs/search?q=<Vereinsname>&limit=8`
- `GET /api/clubs/logo/<filename>`
- `POST /api/admin/refresh`
- `POST /api/admin/import`
- `POST /api/admin/clubs/import`
- `GET /api/admin/status`
- `GET /api/admin/jobs`
- `GET /api/admin/metrics` (Prometheus-Textformat für Monitoring)
- `GET /api/admin/db-readiness` (DB-SoT-Readiness inkl. Probe-Report)
- `GET /api/admin/mandant-probe?mandant=<code>&season=<yyzz>`
- `GET /api/admin/verband-status`
- `GET /api/admin/team-archive?limit=50`
- `POST /api/team/auth/login`
- `POST /api/team/auth/logout`
- `POST /api/team/auth/register` (Self-Register, Standardrolle `scout`)
- `POST /api/team/invitations/create` (Admin/Koordination)
- `POST /api/team/invitations/accept`
- `POST /api/team/auth/password-reset/request`
- `POST /api/team/auth/password-reset/confirm`
- `POST /api/team/notifications/push/subscribe`
- `GET /api/team/notifications/push/pending`
- `POST /api/team/notifications/push/ack`
- `GET /api/team/notifications?status=unread|read&type=<type>`
- `POST /api/team/notifications/read`

### Team-State Backfill / Normalisierung

- Check (ohne Schreiben):
  - `npm run adapter:team-state:check`
- Backfill mit Backup:
  - `npm run adapter:team-state:backfill`
- Optional mit expliziter Datei:
  - `node adapter-service/scripts/backfill-team-state.mjs --input /abs/pfad/team-state.json --check`
  - `node adapter-service/scripts/backfill-team-state.mjs --input /abs/pfad/team-state.json --backup`

Hinweis: Das Skript nutzt standardmäßig `ADAPTER_TEAM_STATE_FILE`. Falls nicht gesetzt, muss `--input` angegeben werden.

- `GET /api/team/audit-log?actorId=<id>&action=<type>&limit=50`
- `GET /api/team/conflicts`
- `POST /api/team/tournaments`
- `POST /api/team/tournaments/:id/matches`
- `POST /api/team/tournaments/import/meinturnierplan`
- `POST /api/team/import/dfb-national-games`
- `POST /api/team/import/kreis-pdf` (`mode=preview|confirm`)
- `GET /api/team/state`
- `POST /api/team/plans`
- `POST /api/team/members`
- `POST /api/team/manual-games`
- `POST /api/team/goals`
- `POST /api/team/observations/seen`
- `POST /api/team/observations/report`
- `POST /api/team/observations/note`

Wizard-Import Hinweise:

- `POST /api/team/tournaments/import/meinturnierplan` akzeptiert neben Datum/Jugend optional `stateCode`, `regionName`, `regionShortCode` und `regionKeywords`, damit nur Turniere aus der im Setup gewählten Region zurückkommen.
- `POST /api/team/import/dfb-national-games` unterstützt DFB-U-Nationalspiele von `U15` bis `U21`.

### Vereinskatalog Import

`POST /api/admin/clubs/import` erwartet JSON:

```json
{
  "replace": true,
  "clubs": [
    {
      "name": "Duisburger SV",
      "location": "Duisburg",
      "logoUrl": "https://...",
      "logoLocal": "logos/duisburger-sv.png",
      "kreisIds": ["duisburg"],
      "link": "https://..."
    }
  ]
}
```

Wenn `logoLocal` gesetzt ist und die Datei unter `ADAPTER_CLUB_LOGOS_DIR` existiert, liefert der Adapter in der Suche automatisch eine lokale Logo-URL aus (`/api/clubs/logo/<filename>`).

## Auth

Wenn `ADAPTER_TOKEN` gesetzt ist, erwarten API-Endpoints den Header:

`Authorization: Bearer <TOKEN>`

## ENV

- `ADAPTER_HOST` (default: `0.0.0.0`)
- `ADAPTER_PORT` (default: `8787`)
- `ADAPTER_STORE_FILE` (default: `adapter-service/data/games.store.db`)
- `ADAPTER_TEAM_STATE_FILE` (default: `adapter-service/data/team-state.json`)
- `ADAPTER_TEAM_ARCHIVE_FILE` (default: `adapter-service/data/team-state.archive.ndjson`)
- `ADAPTER_TEAM_SESSION_TTL_SEC` (default: `28800`)
- `ADAPTER_TEAM_INVITATION_TTL_SEC` (default: `604800`)
- `ADAPTER_TEAM_PASSWORD_RESET_TTL_SEC` (default: `3600`)
- `ADAPTER_TEAM_COOKIE_SECURE` (optional, default: `true` außerhalb `NODE_ENV=development`)
- `ADAPTER_TEAM_COOKIE_SAMESITE` (optional: `Lax|Strict|None`, default: `Lax`)
- `ADAPTER_EXPOSE_RESET_TOKEN_ON_REQUEST` (default: `false`, nur für lokale Test-/Dev-Flows)
- `ADAPTER_AUTH_READS_FROM_DB` (default: `false`; wenn `true`, nutzt Login/Reset-Request bevorzugt PostgreSQL-Accountreads mit JSON-Fallback)
- `ADAPTER_SESSION_READS_FROM_DB` (default: `false`; wenn `true`, lädt Session-Context bei Bedarf aus PostgreSQL und cached ihn in-memory)
- `ADAPTER_TEAM_STATE_READS_FROM_DB` (default: `false`; wenn `true`, wird Team-State beim Startup bevorzugt aus PostgreSQL geladen, sonst JSON-Datei)
- `ADAPTER_NOTIFICATIONS_READS_FROM_DB` (default: `false`; wenn `true`, liest `GET /api/team/notifications` bevorzugt aus PostgreSQL-Repositorium)
- `ADAPTER_OBSERVATIONS_READS_FROM_DB` (default: `false`; wenn `true`, liest `GET /api/team/state` Observations bevorzugt aus PostgreSQL-Repositorium)
- `ADAPTER_REPORTS_READS_FROM_DB` (default: `false`; wenn `true`, merged `GET /api/team/state` Report-Metadaten aus PostgreSQL-Repositorium in Observations)
- `ADAPTER_FEED_READS_FROM_DB` (default: `false`; wenn `true`, liest `GET /api/team/state` Feed-Items bevorzugt aus PostgreSQL-Repositorium)
- `ADAPTER_DB_FIRST_MODE` (default: `false`; wenn `true`, erzwingt DB-Read-Pfade für Auth/Session/Team-State/Notifications/Observations/Reports/Feed und benötigt `ADAPTER_DATABASE_URL` oder `DATABASE_URL`)
- `ADAPTER_INGESTION_RETRY_MAX` (default: `2`; Retry-Versuche für Ingestion-Jobs wie Refresh)
- `ADAPTER_INGESTION_BACKOFF_MS` (default: `750`; lineares Backoff in Millisekunden pro Retry-Schritt)
- `ADAPTER_METRICS_PROVENANCE_MISSING_WARN_THRESHOLD` (default: `1`; ab wie vielen Spielen ohne Provenance ein Monitoring-Alert erzeugt wird)
- `ADAPTER_METRICS_JOB_FAILED_WARN_THRESHOLD` (default: `1`; ab wie vielen fehlgeschlagenen Ingestion-Jobs ein Monitoring-Alert erzeugt wird)
- `ADAPTER_DATABASE_URL` (optional, PostgreSQL connection string)
- `DATABASE_URL` (optional fallback für PostgreSQL)
- `ADAPTER_STORE_MIGRATION_FILE` (optional, explizite Legacy-JSON-Quelle für Erstmigration)
- `ADAPTER_CLUB_CATALOG_FILE` (default: `adapter-service/data/clubs.catalog.json`)
- `ADAPTER_CLUB_LOGOS_DIR` (default: `adapter-service/data/logos`)
- `ADAPTER_IMPORT_DIR` (default: `adapter-service/imports`)
- `ADAPTER_DATA_FILE` (default: `adapter-service/data/games.sample.json`)
- `ADAPTER_ALIASES_FILE` (default: `adapter-service/data/team-aliases.json`)
- `ADAPTER_REMOTE_URL` (optional)
- `ADAPTER_REMOTE_TOKEN` (optional)
- `ADAPTER_REMOTE_TIMEOUT_MS` (default: `10000`)
- `ADAPTER_TOKEN` (optional Bearer-Schutz)
- `ADAPTER_REFRESH_INTERVAL_SEC` (default: `0`, z. B. `300`)
- `ADAPTER_AUTO_REFRESH_WEEK` (default: `true`)
- `ADAPTER_WEEK_REFRESH_TTL_SEC` (default: `300`)
- `ADAPTER_WEEK_SOURCE_URL_TEMPLATE` (optional)
- `ADAPTER_WEEK_SOURCE_TOKEN` (optional)
- `ADAPTER_EXPORT_COMMAND` (optional)
  - default: `node "<adapter-service>/scripts/fetch-week.fussballde.mjs"`
- `ADAPTER_CLUB_SEARCH_URL` (default: `https://www.fussball.de/suche`)
- `ADAPTER_CLUB_SEARCH_TIMEOUT_MS` (default: `12000`)
- `ADAPTER_CLUB_SEARCH_MAX_LIMIT` (default: `20`)
- `ADAPTER_MANDANT_PROBE_TIMEOUT_MS` (default: `15000`)
- `ADAPTER_VERBAND_STATUS_MAX` (default: `8`, parallele Mandant-Checks pro Batch)
- `LOG_LEVEL` (`debug|info|warn|error`, default: `info`)
  - zum Deaktivieren explizit leer setzen (`ADAPTER_EXPORT_COMMAND=`)
- `ADAPTER_WEEK_COMMAND_TIMEOUT_MS` (default: `60000`)
- `CORS_ORIGIN` (default: `http://localhost:5173,http://127.0.0.1:5173`)

Sicherheitsverhalten:

- Password-Reset-Request (`POST /api/team/auth/password-reset/request`) liefert standardmäßig **keinen** Reset-Token zurück (verhindert Token-Leaks im API-Response).
- Für lokale Entwicklungs-/Integrationstests kann das Rückgeben des Tokens explizit mit `ADAPTER_EXPOSE_RESET_TOKEN_ON_REQUEST=true` aktiviert werden.
- Neue E-Mail-Registrierungen bleiben bis zur Bestätigung gesperrt. Der Bestätigungscode wird per SMTP, Mail-Webhook oder lokaler Outbox zugestellt:
  - SMTP: `ADAPTER_SMTP_HOST`, optional `ADAPTER_SMTP_PORT`, `ADAPTER_SMTP_SECURE`, `ADAPTER_SMTP_STARTTLS`, `ADAPTER_SMTP_USER`, `ADAPTER_SMTP_PASS`, `ADAPTER_EMAIL_FROM`, `ADAPTER_EMAIL_FROM_ADDRESS`.
  - Webhook: `ADAPTER_EMAIL_WEBHOOK_URL` erhält JSON mit `to`, `subject`, `text`.
  - Dev/Test-Outbox: `ADAPTER_EMAIL_OUTBOX_FILE` schreibt UTF-8 JSONL.
  - `ADAPTER_EXPOSE_VERIFICATION_TOKEN_ON_REGISTER=true` gibt den Code nur für lokale Dev/Test-Flows im API-Response zurück; in Produktion ist das verboten. Ohne Mail-Konfiguration blockt Produktion Registrierung und Resend mit `503`.
- CORS-Preflights von nicht erlaubten Origins werden mit `403` beantwortet.
- Wenn `ADAPTER_DATABASE_URL`/`DATABASE_URL` gesetzt ist, schreibt der Adapter Team-Login-Sessions zusätzlich in PostgreSQL (`adapter_team_sessions`) als Runtime-Source-of-Truth-Baustein (Write-Through, JSON/In-Memory bleibt kompatibler Fallback).
- Wenn `ADAPTER_DATABASE_URL`/`DATABASE_URL` gesetzt ist, werden Team-Invitations, Password-Reset-Tokens und Kreis-PDF-Preview-Tokens zusätzlich in PostgreSQL gehalten (`adapter_team_runtime_tokens`) und über Restart/Instance-Wechsel wiederverwendet.
- Wenn `ADAPTER_DATABASE_URL`/`DATABASE_URL` gesetzt ist, werden Team-Rate-Limits (Login/Write/Reset-Scopes) zusätzlich in PostgreSQL gehalten (`adapter_runtime_rate_limits`) und sind damit instance-übergreifend wirksam.
- Wenn `ADAPTER_DATABASE_URL`/`DATABASE_URL` gesetzt ist, synchronisiert der Adapter Team-Accounts zusätzlich in PostgreSQL (`adapter_team_accounts`) als Write-Through-Snapshot (inkl. Role/Active/Credential-Hash), während JSON weiterhin als Fallback bleibt.
- Wenn `ADAPTER_DATABASE_URL`/`DATABASE_URL` gesetzt ist, werden Push-Subscriptions/Outbox/Acks zusätzlich in PostgreSQL gehalten (`adapter_team_push_subscriptions`, `adapter_team_push_outbox`, `adapter_team_push_acked`) und beim Startup in den Runtime-Cache rehydriert.
- Wenn `ADAPTER_DATABASE_URL`/`DATABASE_URL` gesetzt ist, werden Team-Notifications zusätzlich in PostgreSQL gehalten (`adapter_team_notifications`) und auf Wunsch per `ADAPTER_NOTIFICATIONS_READS_FROM_DB=true` als primärer Read-Pfad genutzt.
- Wenn `ADAPTER_DATABASE_URL`/`DATABASE_URL` gesetzt ist, werden Team-Observations zusätzlich in PostgreSQL gehalten (`adapter_team_observations`) und auf Wunsch per `ADAPTER_OBSERVATIONS_READS_FROM_DB=true` als primärer Read-Pfad genutzt.
- Wenn `ADAPTER_DATABASE_URL`/`DATABASE_URL` gesetzt ist, werden Team-Report-Metadaten zusätzlich in PostgreSQL gehalten (`adapter_team_reports`) und auf Wunsch per `ADAPTER_REPORTS_READS_FROM_DB=true` in den Team-State-Read-Flow gemerged.
- Wenn `ADAPTER_DATABASE_URL`/`DATABASE_URL` gesetzt ist, werden Team-Feed-Items zusätzlich in PostgreSQL gehalten (`adapter_team_feed_items`) und auf Wunsch per `ADAPTER_FEED_READS_FROM_DB=true` im Team-State-Read-Flow bevorzugt gelesen.
- DB-SoT-Integrationsgate (echte PostgreSQL-Umgebung): `ADAPTER_DATABASE_URL=<postgres-url> npm run test:adapter:db-sot`
- Runtime-Restart-/Multi-Instance-Gate (echte PostgreSQL-Umgebung): `ADAPTER_DATABASE_URL=<postgres-url> npm run test:adapter:runtime-restart-db`

Exporter-Härtung (fussball.de):

- `FUSSBALLDE_CIRCUIT_THRESHOLD` (default: `3`)
- `FUSSBALLDE_CIRCUIT_COOLDOWN_MS` (default: `600000`)
- `FUSSBALLDE_ROBOTS_CHECK` (default: `true`)
- `FUSSBALLDE_ROBOTS_TTL_MS` (default: `86400000`)
- `FUSSBALLDE_STATE_FILE` (default: `adapter-service/data/fussballde.fetch-state.json`)

## Dauerhafter Betrieb

1. Adapter starten.
2. In ScoutX Datenquelle `Live-Adapter (HTTP)` nutzen.
3. Beim Erstellen eines Plans ruft die SPA `POST /api/games` auf.
4. Adapter refresh-t die relevante Woche automatisch und liefert sofort gefilterte Spiele zurück.

## Lokal starten

```bash
node adapter-service/server.mjs
```

## Team-Accounts per Terminal verwalten

Rollen und Passwortverwaltung kannst du bewusst im Terminal halten:

```bash
npm run adapter:accounts -- list
npm run adapter:accounts -- create <userId> "<Name>" "<Passwort>" --role <admin|coordinator|scout|readonly> --email <email> --email-verified
TEAM_ACCOUNT_PASSWORD="<Passwort>" npm run adapter:accounts -- create <userId> "<Name>" --role <admin|coordinator|scout|readonly> --email <email> --email-verified
npm run adapter:accounts -- set-role <userId> <admin|coordinator|scout|readonly>
npm run adapter:accounts -- set-password <userId> "<Passwort>"
npm run adapter:accounts -- set-email <userId> <email> --email-verified
npm run adapter:accounts -- verify-email <userId>
npm run adapter:accounts -- activate <userId>
npm run adapter:accounts -- deactivate <userId>
```

## Vereinskatalog neu scrapen

Das Projekt enthält einen wiederverwendbaren Scraper:

```bash
npm run adapter:clubs:scrape
```

Er schreibt:

- `adapter-service/data/clubs.catalog.json`
- `adapter-service/data/logos/*.png`
