# ScoutX Web Go-Live Roadmap

## Annahmen

- Fokus: Web-App produktionsreif machen, iOS folgt später.
- Zeitraum: 4 Wochen (2 Sprints à 2 Wochen).
- Ziel: Team kann zuverlässig planen, sichten, reporten und zusammenarbeiten.

## Phase 0 – Go-Live Kriterien (1 Tag)

### Definition of Done

1. Kein Datenverlust bei Team-State (Pläne, Sichtungen, Feed, Notes, Goals).
2. Kritische Events (Absage/Konflikt/Follow-up) kommen bei aktiven Nutzern in <10s an.
3. Core-Flow E2E stabil:
   - Spiel finden -> planen -> Feed sichtbar -> gesehen markieren -> Report/Highlight/Follow-up.
4. Rollenrechte sauber (Admin/Koordinator/Scout/Readonly) inkl. Negativtests.
5. Monitoring + Alerting + Runbooks vorhanden.

---

## Sprint 1 (Woche 1-2): Stabilität, Sicherheit, Backend-Fundament

## 1) Notifications produktionsfest machen (P0)

### Scope

- SSE als Primärkanal.
- Polling nur Fallback.
- Dedupe und Ack robust.

### Tasks

- Outbox-Statusfelder erweitern (`new`, `delivered`, `acked`, optional `failed`).
- Duplicate-Guard pro `eventId + user/team`.
- Cleanup-Strategie für alte Outbox-Events (TTL/Retention).
- SSE-Metriken ergänzen (aktive Verbindungen, reconnect rate).

### Tests

- Unit: Dedupe- und Ack-Idempotenz.
- Integration: disconnect/reconnect ohne duplicate-notify.
- Load smoke: 100+ gleichzeitige Streams.

## 2) Security Hardening (P0)

### Tasks

- Passwortpolicy (Länge + Mindestqualität).
- Session-Rotation nach Login und Rollenänderung.
- Account-Lock/Backoff bei Fehlversuchen.
- Audit-Log für sensitive Aktionen (Rollenwechsel, Team-Member-Änderung, Report-Link-Änderung).

### Tests

- Negativtests pro Rolle/Route.
- Login-Bruteforce-/Rate-Limit-Tests.
- Security-Checklist pro Merge.

## 3) Rollen- und Rechte-Matrix finalisieren (P0)

### Tasks

- Rechte-Matrix als Doku (`docs/role-matrix.md`).
- Jede Team-Write-API gegen Matrix prüfen.
- UI-Gates und serverseitige Gates synchronisieren.

### Tests

- Table-driven API-Tests je Rolle und Endpoint.
- Klare 403-Fehlermeldungen validieren.

## 4) Datenkonsistenz und Migrationen (P0)

### Tasks

- Versionierte DB-Migrationen (inkl. Rollback-Strategie).
- Backfill für `jugendIds`, provenance-Felder, observation/report-links.
- Restore-Test aus Backup auf Staging.

### Tests

- Migration dry-run auf Prod-ähnlichen Daten.
- Restore drill mit RTO/RPO-Messung.

## 5) Core-Flow E2E-Suite als Gate (P0)

### Pflicht-Szenarien

1. Official game planen -> feed -> seen -> report.
2. Manual game erstellen -> team sieht es -> status update.
3. National game import -> planbar.
4. Tournament import -> planbar.
5. Konfliktwarnung vor Planabschluss.
6. Readonly kann keine Writes ausführen.

### Gate

- Alle E2E grün in CI.
- Flaky Rate <2%.

---

## Sprint 2 (Woche 3-4): Nutzbarkeit, Qualität, Betrieb

## 6) Team-Übersicht/Abdeckung produktionsreif (P1)

### Tasks

- Dashboard-Kacheln:
  - Wer ist heute/wochenweise unterwegs
  - Doppelt besetzte Spiele
  - Priorisierte Teams/Ligen offen
  - Letzte Sichtung je Team/Jahrgang
- Filter: Zeitraum, Jahrgang, Liga, Scout.

### Tests

- Aggregations-Unit-Tests.
- UI-Integrations-Tests.

## 7) Lifecycle nach "gesehen" finalisieren (P1)

### Tasks

- Nach "gesehen" direkte CTAs:
  - Bericht anlegen
  - Spieler highlighten
  - Follow-up erstellen
- Statusfluss konsistent: `planned -> seen -> reported/followup`.

### Tests

- Lifecycle-Transitions + passende Feed-Events.
- Rechteprüfung bei nachgelagerten Aktionen.

## 8) Konfliktlogik ausbauen (P1)

### Tasks

- Reise-/Zeitkonflikte realistischer modellieren.
- Pufferzeiten konfigurierbar.
- Warnstufen (`info`, `warn`, `hard-conflict`) definieren.

### Tests

- Deterministische Falltests je Warnstufe.

## 9) Imports robust machen (P1)

### Tasks

- DFB/Kreis/Turnier Parser härten.
- Preview + Confirm konsistent für alle Importpfade.
- Duplicate-Matching-Regeln dokumentieren.
- Import-Metriken je Quelle.

### Tests

- Fixture-basierte Parser-Regressions-Tests.
- Fehlerfälle mit teildefekten Inputs.

## 10) Betrieb/Observability/Runbooks abschließen (P1)

### Tasks

- Metrics:
  - API latency/error rate
  - import success/failure
  - feed event lag
  - SSE active + reconnects
- Alerts:
  - 5xx spike
  - import failure burst
  - queue/backlog (falls Worker aktiv)
- Runbooks:
  - Incident handling
  - Datenkorrektur
  - Rollback
  - Backup restore

---

## P2 direkt nach Go-Live

1. Echte Web Push Zustellung (VAPID) zusätzlich zu SSE.
2. Mention-System und feinere Feed-Filter.
3. Erweiterte Delegations-/Rechtefälle.
4. iOS-Parität (nach separater Freigabe).

---

## Empfohlene Aufteilung

- Backend: Notifications, Auth hardening, Rechte, Migrationen, Imports.
- Frontend: Feed UX, Lifecycle CTAs, Teamübersicht/Coverage.
- QA: E2E-Matrix, Regression, Flaky-Management.
- Ops: Monitoring, Alerts, Backup/Restore, Release-Gates.

---

## Harte Release-Gates (Go/No-Go)

1. Alle P0-Tests grün (unit/integration/e2e).
2. Keine offenen P0-Sicherheitslücken.
3. Restore drill erfolgreich.
4. Monitoring + Alerts live.
5. Rechte-Matrix dokumentiert und per Tests abgedeckt.
