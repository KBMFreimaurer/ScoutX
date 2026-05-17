# ScoutX v1 Deployment Runbook

Stand: 2026-05-14  
Scope: Web + adapter-service (Docker Compose)

## 1) Ziel

Standardisiertes Produktions-Deployment für ScoutX v1 mit reproduzierbaren Schritten und minimalem Downtime-Risiko.

## 2) Voraussetzungen

1. Host mit Docker + Docker Compose Plugin.
2. Zugriff auf das Repository (Release-Tag oder commit hash).
3. Produktive `.env` mit mindestens:
   - `ADAPTER_TOKEN`
   - `ADAPTER_DATABASE_URL` (oder `DATABASE_URL`)
   - `ADAPTER_DB_FIRST_MODE=true`
   - `CORS_ORIGIN=<produktive origin(s)>`
4. DNS/Reverse-Proxy ist auf Frontend + Adapter geroutet.

## 3) Pre-Deploy Checks

Im Release-Commit lokal/CI:

```bash
npm run lint
npm run test -- adapter-service/server.test.mjs adapter-service/services/teamDomainServices.test.js
npm run test -- src/context/teamBackendStateSync.test.js src/context/useTeamObservationActions.test.js src/context/useTeamPlanningActions.test.js
```

Optional zusätzlich:

```bash
docker compose config
```

## 4) Deployment Schritte

```bash
# 1) Gewünschten Release-Stand auschecken
git fetch --tags
git checkout <release-tag-oder-commit>

# 2) Images bauen
docker compose --profile prod build

# 3) Services aktualisieren
docker compose --profile prod up -d prod adapter

# 4) Monitoring (falls separat betrieben)
docker compose --profile monitoring up -d prometheus alertmanager
```

## 5) Post-Deploy Verifikation

1. Health:

```bash
curl --max-time 20 -sS http://127.0.0.1:8787/health
```

Erwartung:
- `ok: true`
- `dbFirstMode: true` (Produktion)
- `dbUrlConfigured: true`

2. Admin Status (mit Bearer):

```bash
curl --max-time 20 -sS -H "Authorization: Bearer <ADAPTER_TOKEN>" http://127.0.0.1:8787/api/admin/status
```

3. Metrics erreichbar:

```bash
curl --max-time 20 -sS -H "Authorization: Bearer <ADAPTER_TOKEN>" http://127.0.0.1:8787/api/admin/metrics
```

4. UI Smoke:
- Login
- Team-State laden
- Plan veröffentlichen
- Notification read

## 6) Rollback

```bash
# 1) Letzten stabilen Tag auschecken
git checkout <previous-stable-tag>

# 2) Erneut bauen + starten
docker compose --profile prod build
docker compose --profile prod up -d prod adapter
```

Dann erneut Post-Deploy Verifikation ausführen.

## 7) Betriebsnotizen

- Produktive Secrets nicht in Repo committed halten.
- `CORS_ORIGIN=*` ist in Produktion nicht zulässig.
- Änderungen an `ADAPTER_DB_FIRST_MODE` nur mit abgesicherter DB-Verfügbarkeit.
