# ScoutX Monitoring Runbook (Prometheus/Alertmanager)

Stand: 2026-05-14

## Ziel

Externe Monitoring-Basis für den Adapter bereitstellen, um Priorität 6 (Operations) mit einem realen Metrik-Sink abzudecken.

## Artefakte

- `docker-compose.yml` (`prometheus`, `alertmanager`, profile `monitoring`)
- `ops/monitoring/prometheus/prometheus.yml`
- `ops/monitoring/prometheus/rules/scoutx-alerts.yml`
- `ops/monitoring/alertmanager/alertmanager.yml`

## Voraussetzungen

1. Adapter läuft auf dem Host auf Port `8787` (z. B. über `docker compose --profile prod up`).
2. `ADAPTER_TOKEN` ist bekannt.
3. In `ops/monitoring/prometheus/prometheus.yml` ist
   `authorization.credentials` von `REPLACE_WITH_ADAPTER_TOKEN`
   auf den echten Token gesetzt.

## Start

```bash
docker compose --profile monitoring up -d prometheus alertmanager
```

## Verifikation

1. Prometheus UI öffnen: `http://127.0.0.1:9090`
2. Query testen:
   - `scoutx_adapter_uptime_seconds`
   - `scoutx_adapter_games_total`
   - `scoutx_ingestion_jobs_failed`
   - `scoutx_game_provenance_missing`
3. Rule-Health prüfen:
   - Prometheus -> `Status` -> `Rules`
4. Alertmanager UI öffnen: `http://127.0.0.1:9093`

## Alerts (aktuell)

- `ScoutXIngestionJobsFailed`
- `ScoutXMissingGameProvenance`
- `ScoutXAdapterErrorResponsesHigh`
- `ScoutXMetricsUnavailable`

## Betriebshinweise

1. Bei Token-Rotation: `prometheus.yml` Credentials aktualisieren und Prometheus neu laden.
2. Regeländerungen: Datei unter `ops/monitoring/prometheus/rules/` ändern und Prometheus reloaden.
3. Fehlersuche Scrape:
   - `http://127.0.0.1:8787/api/admin/metrics` manuell mit Bearer-Token testen.
   - In Prometheus unter `Status` -> `Targets` den Job `scoutx-adapter` prüfen.

## Reload / Stop

```bash
# Config reload (Prometheus)
curl -X POST http://127.0.0.1:9090/-/reload

# Stop
docker compose --profile monitoring down
```

## Offene Lücken

- Kein produktiver Notification-Receiver (Slack/Teams/PagerDuty/Webhook) konfiguriert.
- Keine formale SLO/Incident-Rotation dokumentiert.
- Keine zentrale Log-Aggregation (nur Service-Logs lokal).
