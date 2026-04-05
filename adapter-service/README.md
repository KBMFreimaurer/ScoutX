# ScoutPlan Adapter Service

Dauerhafte Daten-Schicht für ScoutPlan ohne direkte fussball.de-API.

## Architektur

Der Adapter baut einen **persistenten Store** (`games.store.json`) aus mehreren Quellen:

1. `imports/` (CSV/JSON aus DFBnet/fussball.de-Export)
2. optional `ADAPTER_REMOTE_URL` (externer Feed)
3. Fallback `games.sample.json`

Zusätzlich kann pro angefragter Woche automatisch ein Export-Prozess getriggert werden.

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

- `SCOUTPLAN_FROM_DATE`
- `SCOUTPLAN_TO_DATE`
- `SCOUTPLAN_KREIS_ID`
- `SCOUTPLAN_JUGEND_ID`
- `SCOUTPLAN_TEAMS_JSON`
- `SCOUTPLAN_IMPORT_DIR`

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
- `SCOUTPLAN_DEBUG_EXPORTER=true` (Debug-Logs auf `stderr`)

### Option B: Week URL Template

```bash
ADAPTER_WEEK_SOURCE_URL_TEMPLATE="https://example.com/feed?from={fromDate}&to={toDate}&kreis={kreisId}&jugend={jugendId}"
ADAPTER_WEEK_SOURCE_TOKEN="..."
```

## Endpunkte

- `GET /health`
- `POST /api/games`
- `POST /api/admin/refresh`
- `POST /api/admin/import`
- `GET /api/admin/status`

## Auth

Wenn `ADAPTER_TOKEN` gesetzt ist, erwarten API-Endpoints den Header:

`Authorization: Bearer <TOKEN>`

## ENV

- `ADAPTER_HOST` (default: `0.0.0.0`)
- `ADAPTER_PORT` (default: `8787`)
- `ADAPTER_STORE_FILE` (default: `adapter-service/data/games.store.json`)
- `ADAPTER_IMPORT_DIR` (default: `adapter-service/imports`)
- `ADAPTER_DATA_FILE` (default: `adapter-service/data/games.sample.json`)
- `ADAPTER_ALIASES_FILE` (default: `adapter-service/data/team-aliases.json`)
- `ADAPTER_REMOTE_URL` (optional)
- `ADAPTER_REMOTE_TOKEN` (optional)
- `ADAPTER_TOKEN` (optional Bearer-Schutz)
- `ADAPTER_REFRESH_INTERVAL_SEC` (default: `0`, z. B. `300`)
- `ADAPTER_AUTO_REFRESH_WEEK` (default: `true`)
- `ADAPTER_WEEK_REFRESH_TTL_SEC` (default: `300`)
- `ADAPTER_WEEK_SOURCE_URL_TEMPLATE` (optional)
- `ADAPTER_WEEK_SOURCE_TOKEN` (optional)
- `ADAPTER_EXPORT_COMMAND` (optional)
  - default: `node "<adapter-service>/scripts/fetch-week.fussballde.mjs"`
  - zum Deaktivieren explizit leer setzen (`ADAPTER_EXPORT_COMMAND=`)
- `ADAPTER_WEEK_COMMAND_TIMEOUT_MS` (default: `30000`)
- `CORS_ORIGIN` (default: `*`)

## Dauerhafter Betrieb

1. Adapter starten.
2. In ScoutPlan Datenquelle `Live-Adapter (HTTP)` nutzen.
3. Beim Erstellen eines Plans ruft die SPA `POST /api/games` auf.
4. Adapter refresh-t die relevante Woche automatisch und liefert sofort gefilterte Spiele zurück.

## Lokal starten

```bash
node adapter-service/server.mjs
```
