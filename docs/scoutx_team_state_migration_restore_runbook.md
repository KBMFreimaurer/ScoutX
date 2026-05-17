# ScoutX Team-State Migration & Restore Runbook

Stand: 2026-05-16

## Ziel

Sichere Durchführung von Team-State-Backfills/Migrationen mit klarer Restore-Option.

## Voraussetzungen

- Gültige Team-State Datei (`ADAPTER_TEAM_STATE_FILE` oder explizit via `--input`)
- Schreibrechte auf Zielpfad
- Vorhandenes Backup-Verzeichnis

## 1) Vorab-Check (Read-Only)

```bash
npm run adapter:team-state:check
```

Oder mit expliziter Datei:

```bash
node adapter-service/scripts/backfill-team-state.mjs --input /abs/path/team-state.json --check
```

Exit-Codes:

- `0`: bereits normalisiert
- `2`: Änderungen erforderlich
- `1`: Fehler (Datei/JSON/etc.)

## 2) Backfill ausführen (mit Backup)

```bash
npm run adapter:team-state:backfill
```

Oder explizit:

```bash
node adapter-service/scripts/backfill-team-state.mjs --input /abs/path/team-state.json --backup
```

Ergebnis:

- `.bak.<timestamp>` wird neben der Input-Datei angelegt.
- Normalisierter Team-State wird geschrieben.

## 3) Verifikation

1. Script erneut im Check-Modus:

```bash
npm run adapter:team-state:check
```

2. Adapter-Integrationstests:

```bash
npm run test -- adapter-service/server.test.mjs
```

3. Smoke-Check im laufenden Adapter:

- `GET /health`
- `POST /api/team/auth/login`
- `GET /api/team/state`

## 4) Rollback

Wenn Backfill unerwartetes Verhalten zeigt:

1. Adapter stoppen.
2. Backup zurückkopieren:

```bash
cp /abs/path/team-state.json.bak.<timestamp> /abs/path/team-state.json
```

3. Adapter neu starten.
4. Verifikation wie in Schritt 3 wiederholen.

## 5) Produktionshinweise

- Vor Produktionslauf immer `--check` und Backup erzwingen.
- Backfill nur in Wartungsfenster durchführen.
- Nach Backfill Audit-Log und Feed stichprobenartig prüfen.
