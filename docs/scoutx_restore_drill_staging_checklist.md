# ScoutX Restore Drill Checklist (Staging)

Stand: 2026-05-16

## Ziel

Nachweis, dass Team-State und Runtime-Daten in Staging innerhalb definierter Zeit wiederhergestellt werden können.

## Scope

- Team-State-Datei/DB-Stand
- Runtime-Daten (Sessions/Tokens/Rate-Limits)
- Push-Outbox/Subscriptions

## Erfolgsmetriken

- RTO (Recovery Time Objective): ___ Minuten
- RPO (Recovery Point Objective): ___ Minuten
- Verifikations-Endpoints alle grün

## Vorbereitungen

1. Staging-Release-Commit notieren: `________`
2. Backups verfügbar:
   - Team-State Snapshot: `________`
   - DB Dump: `________`
   - Runtime Snapshot (falls separat): `________`
3. Wartungsfenster kommuniziert: `________`

## Drill-Ablauf

### A) Baseline erfassen

```bash
curl -sS "$STAGING_URL/health"
```

```bash
curl -sS -H "Authorization: Bearer $ADAPTER_TOKEN" "$STAGING_URL/api/admin/status"
```

Notieren:

- team/accounts count
- observations/feed count
- pending push count

### B) Simulierter Verlust / Zustand zurücksetzen

- Staging-Service stoppen.
- Team-State/DB auf älteren Stand setzen (kontrolliert).

### C) Wiederherstellen

1. Backup einspielen (Datei oder DB).
2. Falls Datei-basiert, optional Backfill-Check:

```bash
ADAPTER_TEAM_STATE_FILE=/path/to/team-state.json npm run adapter:team-state:check
```

3. Service starten.

### D) Funktional verifizieren

1. Login möglich (admin + scout).
2. `GET /api/team/state` konsistent.
3. Core-Write:
   - Plan publizieren
   - observation seen
   - note/report link
4. Notifications:
   - pending/ack funktioniert
   - SSE stream liefert neue Events

### E) Metriken/Logs prüfen

- Keine erhöhten 5xx nach Restore
- Keine schema/migration errors
- Keine Auth/Session regression

## Abnahme

- [ ] RTO eingehalten
- [ ] RPO eingehalten
- [ ] Funktionsprüfung vollständig grün
- [ ] Findings dokumentiert
- [ ] Follow-up Tickets angelegt

## Artefakte

- Run-Log: `docs/release-db-first-e2e-last-run.txt` (oder aktuelles Run-Log)
- Testergebnis-Link: `________`
- Verantwortlich: `________`
