# ScoutX

ScoutX ist eine React-SPA für die Konfiguration, Sichtung und Planung von Fußball-Scouting.

## Architektur

- Frontend: React 19, Vite, React Router v6
- Haupt-Routen: `/hub`, `/setup`, `/games`, `/plan`, `/scout-sheet`, `/dashboard`, `/support`, `/privacy`
- Admin-Route `/admin` ist nur mit `VITE_ENABLE_ADMIN=true` sichtbar
- State: `SetupContext`, `GamesContext`, `PlanContext`, `ScoutXProductContext` + `ScoutXContext`
- Adapter: Node.js-Service unter `adapter-service/server.mjs`

## Schnellstart

```bash
npm install
npm run adapter:dev
npm run dev
```

- Frontend: `http://localhost:5173`
- Adapter Health: `http://127.0.0.1:8787/health`

## Qualitätschecks

```bash
npm run lint
npm run test
npm run build
```

## Adapter-Betrieb

- Frontend verwendet standardmäßig `/api/games` (Proxy über Vite/Nginx).
- Optionales Override: `VITE_ADAPTER_ENDPOINT=https://dein-host/api/games`
- `VITE_ADAPTER_TOKEN` ist optional und sollte nur für interne/staging Zwecke genutzt werden.
- Keine produktiven Secrets im Frontend-Bundle hinterlegen.

Details: [adapter-service/README.md](/Users/playboiiboggos/.openclaw/workspace/ScoutX/adapter-service/README.md)

## Adapter-Deployment (Server)

Der Live-Adapter ist Teil dieses Repositories (`adapter-service/`) und wird im
Produktiv-Deploy zusammen mit dem Frontend aus demselben `main`-Commit gebaut
und gestartet (`prod + adapter`).

Damit ist der Server nicht von einem lokal manuell gestarteten Adapter-Prozess abhängig.

## Google Maps

- Der Google-API-Key ist zentral im Code hinterlegt (kein `.env`-Override, keine Runtime-Eingabe).
- Optional kann nur der Strict-Mode konfiguriert werden:

```bash
VITE_GOOGLE_MAPS_STRICT=false
```

- `VITE_GOOGLE_MAPS_STRICT=false` ist der Default.

## Docker

```bash
docker compose --profile dev up --build
docker compose --profile prod up --build
docker compose --profile monitoring up -d prometheus alertmanager
```

Monitoring-Runbook: [docs/scoutx_monitoring_runbook.md](/Users/playboiiboggos/.openclaw/workspace/ScoutX/docs/scoutx_monitoring_runbook.md)
Deployment-Runbook: [docs/scoutx_v1_deployment_runbook.md](/Users/playboiiboggos/.openclaw/workspace/ScoutX/docs/scoutx_v1_deployment_runbook.md)
Backup/Restore-Runbook: [docs/scoutx_v1_backup_restore_runbook.md](/Users/playboiiboggos/.openclaw/workspace/ScoutX/docs/scoutx_v1_backup_restore_runbook.md)
Release-Gate-Checklist: [docs/scoutx_v1_release_gate_checklist.md](/Users/playboiiboggos/.openclaw/workspace/ScoutX/docs/scoutx_v1_release_gate_checklist.md)

## iOS (Capacitor)

```bash
# Beispiel für Home-Server-Adapter:
# VITE_ADAPTER_ENDPOINT=https://dein-homeserver.tld/api/games npm run ios:sync
npm run ios:sync
```

- Erstellt das aktuelle Web-Bundle und synchronisiert es in `ios/App/App/public`.
- Für echte iPhones ohne lokalen Adapter muss `VITE_ADAPTER_ENDPOINT` auf einen erreichbaren Host zeigen.
- Danach kann der Build über Xcode oder über Build-iOS-Apps-Tools erfolgen.
