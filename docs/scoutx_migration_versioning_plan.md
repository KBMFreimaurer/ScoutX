# ScoutX Migration & Versioning Plan (P0)

Stand: 2026-05-17

## Ziel

Reproduzierbare, sichere Schema- und Datenmigrationen für Adapter/Team-State.

## Prinzipien

1. **Forward-only DB Migrationen** im Regelfall.
2. **Rollback über Backup/Restore**, nicht über komplexe Down-Migrations.
3. **Idempotente Daten-Backfills** (mehrfach ausführbar, ohne Datenverlust).
4. **Verifikation nach jedem Schritt** (health, auth, state, core writes).

## Versionsschema

- `VYYYYMMDDHHMM__<slug>.sql` für DB-Migrationen.
- Beispiel:
  - `V202605170900__push_outbox_status_fields.sql`
  - `V202605171030__runtime_session_revoke_support.sql`

## Reihenfolge pro Release

1. Backup erzeugen (DB + Team-State).
2. Migrationen anwenden.
3. Daten-Backfill ausführen.
4. Adapter starten und Smoke-Checks.
5. Release-Gates laufen lassen.

## Backfill-Mechanik (Team-State)

- Check:
  - `npm run adapter:team-state:check`
- Ausführung:
  - `npm run adapter:team-state:backfill`
- Script:
  - `adapter-service/scripts/backfill-team-state.mjs`

## Rollback-Strategie

1. Service stoppen.
2. Datenstand aus Backup wiederherstellen.
3. Service neu starten.
4. Smoke-Checks wiederholen.

Referenzen:

- `docs/scoutx_team_state_migration_restore_runbook.md`
- `docs/scoutx_restore_drill_staging_checklist.md`
- `docs/scoutx_staging_restore_drill_env.md`
