# ScoutX Web P1 Completion (Sprint 2)

Stand: 2026-05-17

Referenz: [scoutx_go_live_roadmap.md](./scoutx_go_live_roadmap.md), [scoutx_go_live_progress.md](./scoutx_go_live_progress.md)

## Scope-Abschluss (Roadmap Punkte 6-10)

1. Team-Übersicht/Abdeckung:
- Hub-Übersicht zeigt aktive Scouts (Tag/Woche), Doppelbelegung, Konflikte, Überplanung, offene Abdeckung.
- Team-Ziele (Lieblingsteams/-vereine, Liga, Jahrgang) fließen in Coverage-Bewertung ein.

2. Lifecycle nach "gesehen":
- Aktionen nach Sichtung verfügbar: Bericht, Highlight, Follow-up.
- Sichtungsnotizen (Randnotizen) werden gespeichert und teamweit synchronisiert.
- Statuskette `planned -> seen -> report/followup` ist im Domain- und Backend-Flow verankert.

3. Konfliktlogik:
- Konflikterkennung für Zeitüberlappung und Reisepuffer aktiv.
- Warnstufen im Produktfluss vereinheitlicht: `info`, `warn`, `hard-conflict`.

4. Imports:
- Robuste Quellenpfade für `official`, `manual`, `tournament`, `national`.
- Kreis-PDF als Preview/Confirm mit Token-/TTL-Absicherung.

5. Betrieb/Observability:
- Monitoring-Runbook vorhanden.
- Restore-/Drill-Runbooks vorhanden.
- Reproduzierbares P1-Release-Gate vorhanden.

## Verifikation

- Lokales P1-Gate:
  - `npm run release:p1:gate`
- Enthaltene Kernprüfungen:
  - Lint
  - Domain-/Flow-/Adapter-Tests
  - Build
  - Runbook-/Ops-Artefakt-Checks

## Ergebnis

- P1 für Web ist abgeschlossen und als Gate reproduzierbar.
- Nächster Schritt ist P2 (Web Push, Mentions/Filter, feinere Delegation/Rechte, iOS-Parität separat).
