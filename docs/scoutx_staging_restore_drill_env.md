# ScoutX Staging Restore Drill – Env/Profile Vorlage

Stand: 2026-05-16

## 1) Minimale Variablen

```bash
export STAGING_URL="https://<staging-host>"
export ADAPTER_TOKEN="<admin-token>"
export ADAPTER_TEAM_STATE_FILE="/abs/path/team-state.json"
export ADAPTER_DATABASE_URL="postgres://..."
```

## 2) Basischecks

```bash
curl -sS "$STAGING_URL/health"
curl -sS -H "Authorization: Bearer $ADAPTER_TOKEN" "$STAGING_URL/api/admin/status"
```

## 3) Team-State Backfill Check (Datei-basiert)

```bash
ADAPTER_TEAM_STATE_FILE="$ADAPTER_TEAM_STATE_FILE" npm run adapter:team-state:check
```

## 4) Team-State Backfill (mit Backup)

```bash
ADAPTER_TEAM_STATE_FILE="$ADAPTER_TEAM_STATE_FILE" npm run adapter:team-state:backfill
```

## 5) Local P0 Gate vor/nach Drill

```bash
./ops/check-p0-go-live-gates.sh
```

## 6) Restore-Verifikation (Kurz)

1. Login als `admin` und `scout`.
2. `GET /api/team/state` prüfen.
3. Core write:
   - `POST /api/team/plans`
   - `POST /api/team/observations/seen`
4. Notification flow:
   - `GET /api/team/notifications/push/pending`
   - `POST /api/team/notifications/push/ack`

## 7) Artefakte protokollieren

- verwendeter Commit SHA
- Backup-Pfad
- Start-/Endzeit (RTO)
- Datenstand-Differenz (RPO)
- Admin-Status Snapshot vor/nach Restore
