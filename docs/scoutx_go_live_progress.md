# ScoutX Go-Live Progress (Web)

Stand: 2026-05-17

Referenz-Roadmap: [scoutx_go_live_roadmap.md](./scoutx_go_live_roadmap.md)

## Phase 0

- [x] Go-Live Kriterien final abgenommen (P0-Artefakte, Tests, Gates und Runbooks vorhanden)

## Sprint 1 – Stabilität, Sicherheit, Backend-Fundament

### 1) Notifications produktionsfest (P0)

- [x] SSE als Primärkanal, Polling nur Fallback (bereits umgesetzt)
- [x] Outbox Event-Status eingeführt (`new`, `delivered`)
- [x] Delivery-Zähler/Felder eingeführt (`deliveredCount`, `lastDeliveredAt`)
- [x] Outbox Retention/Cleanup für veraltete Events (`ADAPTER_PUSH_OUTBOX_MAX_AGE_MS`)
- [x] DB-seitige Outbox-Statuspersistenz erweitert (Schema + Rehydrate + Writes)
- [x] Load/Soak Smoke ergänzt (`ops/sse-soak-smoke.sh`, 100 Streams konfigurierbar)

### 2) Security Hardening (P0)

- [x] Passwortpolicy erweitert (min. Länge + Gross/Klein/Zahl)
- [x] Sessions werden bei Rollenwechsel/Deaktivierung serverseitig entzogen
- [x] Account-Lock/Backoff für wiederholte Login-Fehler ergänzt
- [x] Security-Audit-Logs für sensitive Member-Updates ergänzt

### 3) Rollen- und Rechte-Matrix (P0)

- [x] `docs/role-matrix.md` erstellt
- [x] Write-Endpunkte gegen Matrix verifiziert (inkl. `members`, readonly- und csrf-negativfälle)
- [x] Negativtests je Rolle für kritische Member-/Invite-Aktionen ergänzt

### 4) Datenkonsistenz/Migrationen (P0)

- [x] Migrations-Plan/Versionierung final (`docs/scoutx_migration_versioning_plan.md`)
- [x] Backfill-Utility für Team-State ergänzt (`adapter:team-state:check`, `adapter:team-state:backfill`)
- [x] Migrations-/Restore-Runbook erstellt (`docs/scoutx_team_state_migration_restore_runbook.md`)
- [x] Staging-Restore-Drill-Checkliste erstellt (`docs/scoutx_restore_drill_staging_checklist.md`)
- [x] Restore Drill lokal nachweisbar (`npm run restore:drill:local`, Artefakt: `docs/restore-drill-local-last-run.md`)

### 5) Core-Flow E2E Gates (P0)

- [x] Core-Flow E2E als Gate verkabelt (`npm run release:p0:e2e`)
- [x] Flaky-Tracking-Artefakte/Abnahmevorlagen vorhanden (`docs/templates/*`)
- [x] Lokales P0-Gate-Script ergänzt (`ops/check-p0-go-live-gates.sh`, `npm run release:p0:gate`)
- [x] E2E-P0-Gate-Script ergänzt (`ops/check-p0-e2e-gates.sh`, `npm run release:p0:e2e`)
- [x] Release-P8-Gate auf strict gestellt (kein Test-Fallback; `test:e2e:release` darf nicht skippen)

## Sprint 2 – Nutzbarkeit, Qualität, Betrieb

### 6) Team-Übersicht/Abdeckung produktionsreif (P1)

- [x] Team-Übersicht im Hub mit Last, Doppelbelegung, Konflikten und Abdeckung
- [x] Prioritätsabdeckung (Lieblingsteams/-vereine, Ligen, Jahrgänge) in Coverage-Logik integriert
- [x] Team-Status inkl. wer sieht/wer hat gesehen über Observation-Status sichtbar

### 7) Lifecycle nach "gesehen" finalisiert (P1)

- [x] CTA nach Sichtung: Bericht anlegen, Spieler highlighten, Follow-up erstellen
- [x] Notizfluss an Sichtungen (Randnotiz) inkl. Feed-/State-Sync
- [x] Statusfluss `planned -> seen -> report/followup` durch Domain- und API-Flows abgedeckt

### 8) Konfliktlogik ausgebaut (P1)

- [x] Konflikterkennung für Zeit-/Reisefenster in Team-Overview und Planabschlusswarnung
- [x] Warnstufen normalisiert (`info`, `warn`, `hard-conflict`) in Domain + UI
- [x] Deterministische Konflikt-Tests auf Domain-Ebene ergänzt

### 9) Imports robust gemacht (P1)

- [x] Importpfade für U-Nationalspiele, Turniere und Kreis-PDF stabilisiert
- [x] Kreis-PDF als Preview/Confirm-Flow mit Token/TTL
- [x] Mixed-Source-Flows (`official|manual|tournament|national`) testseitig abgesichert

### 10) Betrieb/Observability/Runbooks abgeschlossen (P1)

- [x] Monitoring-Runbook vorhanden (`docs/scoutx_monitoring_runbook.md`)
- [x] Restore-/Rollback-Artefakte vorhanden (`docs/scoutx_team_state_migration_restore_runbook.md`, `docs/scoutx_restore_drill_staging_checklist.md`)
- [x] P1-Go-Live-Gate ergänzt (`ops/check-p1-go-live-gates.sh`, `npm run release:p1:gate`)

## Status

- **P0 abgeschlossen**
- **P1 abgeschlossen**
- **P2 abgeschlossen (Web)**
- **P3 abgeschlossen** (iOS-Parität)
- **P4 gestartet**
