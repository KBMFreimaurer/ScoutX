# ScoutX v1 Backup & Restore Runbook

Stand: 2026-05-14  
Scope: PostgreSQL Source-of-Truth + Fallback-Dateien

## 1) Ziel

Wiederherstellbarkeit des produktiven ScoutX-Zustands (Accounts, Sessions, Team-State, Observations, Reports, Notifications, Feed, Archive).

## 2) Backup Scope

Primär:
- PostgreSQL Datenbank (`ADAPTER_DATABASE_URL` / `DATABASE_URL`)

Sekundär (Fallback/forensisch):
- `adapter-service/data/team-state.archive.ndjson`
- optional `adapter-service/data/games.store.json` / `games.store.db`

## 3) Backup Frequenz

- PostgreSQL: täglich Vollbackup + stündliches WAL/Incremental (je nach Infrastruktur).
- NDJSON-Archiv: täglich Snapshot.

## 4) Manuelles PostgreSQL Backup

```bash
# Beispiel (an Umgebung anpassen)
pg_dump "$ADAPTER_DATABASE_URL" --format=custom --file /private/tmp/scoutx_$(date +%Y%m%d_%H%M%S).dump
```

Backup validieren:

```bash
pg_restore --list /private/tmp/scoutx_<timestamp>.dump > /private/tmp/scoutx_<timestamp>.list
```

## 5) Restore (Staging zuerst)

1. Ziel-DB vorbereiten (leer oder isoliert).
2. Restore ausführen:

```bash
pg_restore --clean --if-exists --no-owner --no-privileges --dbname "$ADAPTER_DATABASE_URL" /private/tmp/scoutx_<timestamp>.dump
```

3. Adapter mit `ADAPTER_DB_FIRST_MODE=true` starten.
4. Smoke-Checks:

```bash
curl --max-time 20 -sS http://127.0.0.1:8787/health
curl --max-time 20 -sS -H "Authorization: Bearer <ADAPTER_TOKEN>" http://127.0.0.1:8787/api/admin/status
```

## 6) Recovery-Abnahmekriterien

- Auth-Login funktioniert.
- Team-State lädt vollständig.
- Observations/Reports/Notifications/Feed vorhanden.
- Admin-Status und Metrics sind erreichbar.

## 7) RTO/RPO Zielwerte (initial)

- Ziel-RTO: <= 60 Minuten
- Ziel-RPO: <= 24 Stunden (ohne WAL), <= 1 Stunde (mit WAL)

## 8) Offene Punkte

- Automatisierte Restore-Drills (monatlich) noch nicht automatisiert.
- Zentrales Backup-Monitoring/Alerting der Backup-Jobs fehlt noch.
