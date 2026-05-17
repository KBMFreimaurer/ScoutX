# ScoutX Restore Drill Report (Template)

Datum: `YYYY-MM-DD`  
Umgebung: `staging`  
Verantwortlich: `name`  
Commit SHA: `...`

## 1) Input-Artefakte

- Team-State Backup: `...`
- DB Dump: `...`
- Runtime Snapshot (optional): `...`

## 2) Zeitmessung

- Drill Start (UTC): `...`
- Service wieder verfügbar (UTC): `...`
- RTO: `... min`
- Datenstand vor/nach: `...`
- RPO: `... min`

## 3) Durchführung

1. Baseline erfasst: `ok|fail`
2. Restore ausgeführt: `ok|fail`
3. Backfill-Check (`adapter:team-state:check`): `ok|fail`
4. App/Adapter Restart: `ok|fail`

## 4) Verifikation

- `GET /health`: `ok|fail`
- Admin Status Snapshot: `ok|fail`
- Login admin/scout: `ok|fail`
- `GET /api/team/state`: `ok|fail`
- Plan publish: `ok|fail`
- Observation seen: `ok|fail`
- Push pending/ack: `ok|fail`
- SSE delivery smoke: `ok|fail`

## 5) Findings

- Finding 1: `...`
- Finding 2: `...`

## 6) Maßnahmen

- Sofortmaßnahmen: `...`
- Follow-up Tickets: `...`

## 7) Freigabe

- Restore Drill bestanden: `yes|no`
- Freigegeben durch: `name`
