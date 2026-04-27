# ScoutX Phasenstatus

Stand: 2026-04-28

## Phase 1 – Korrekturen & Stabilisierung

- Status: abgeschlossen
- Enthalten:
  - Doku-Konsolidierung (`README.md`, `CLAUDE.md`, Adapter-README)
  - Secret-Härtung (kein harter Adapter-Token im Client/Server-Default)
  - Admin-Mandant-Diagnostik (`/api/admin/mandant-probe`)
  - Adapter-Integrationstests für Kernendpunkte

## Phase 2 – Adapter-Robustheit

- Status: abgeschlossen
- Enthalten:
  - Strukturierte JSON-Logs mit `requestId`
  - SQLite-Store (`games.store.db`) inkl. Legacy-JSON-Migration
  - Scraper-Härtung (Circuit Breaker, adaptive Concurrency, robots.txt-Check, UA-Pool)
  - Neuer Endpoint `/api/admin/verband-status`

## Phase 3 – Code-Hygiene & Refactor

- Status: gestartet (Teilabschluss)
- Enthalten:
  - Node-Engines pin (`>=20 <23`) + `.nvmrc` (`20.18.0`)
  - CI Matrix auf Node 20 + 22
  - Playwright Smoke-E2E Setup (optionaler CI-Job)
- Offen:
  - Große Modul-Splits (`ScoutingHubPage`, `scoutxDomain`, `server.mjs`, `dataProvider.js`)
  - UI-Tokenisierung/Entkopplung der Inline-Styles in Kernseiten

## Phase 4 – Datenmodell & Multi-User

- Status: offen
- Nächster sinnvoller Startpunkt:
  1. SQLite-Schema für `scouts`, `reports`, `watchlists`, `plans`
  2. API-Routen unter `/api/scouts/*`, `/api/reports/*`
  3. Auth-Layer (JWT + Rollenmodell)

## Phase 5 – Feature-Sprint

- Status: gestartet (Teilabschluss)
- Enthalten:
  - Kalender-Export (.ics) direkt in der Games-Ansicht
- Offen (Top-Prio):
  - LLM-Planer (Backend-Integration)
  - Kartenansicht + Routen
  - Live-Standings-Integration
