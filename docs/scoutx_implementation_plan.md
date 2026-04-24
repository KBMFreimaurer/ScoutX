# ScoutX Implementation Plan

Stand: 2026-04-23

## Phase 1 - MVP-Fundament

1. Zentrale Domain-Service-Datei anlegen.
2. Storage-Key für Produktdomain ergänzen.
3. Product Context implementieren und in `App` einhängen.
4. Hub-Route als echte Startansicht ergänzen.
5. Rollen-/Sichtbarkeitsfilter zentral durchsetzen.
6. Tests für Domainlogik schreiben.

## Phase 2 - Kernflows

1. Reports im Hub erstellen, bearbeiten, analysieren und statusändern.
2. Watchlists erstellen und Spieler priorisieren.
3. Assignments aus Games/Reports/Spielern anlegen.
4. Notifications generieren und als gelesen markieren.
5. Globale Suche und kombinierbare Filter für Domainobjekte nutzbar machen.
6. Dashboard-Kacheln für offene Aufgaben, neue Reports, priorisierte Listen, Termine und letzte Aktivität.

## Phase 3 - Integration und UX

1. Bestehende PlayerSheets und PlanHistory im Hub anzeigen und verlinken.
2. Games aus dem aktuellen Planungsflow für Assignment-Erstellung nutzen.
3. Mobile Hub-Ansicht mit klaren Tabs und kompakten Formularen.
4. Empty-, Loading-, Error- und Retry-States für KI-Analyse.
5. README und Fortschrittslog aktualisieren.

## Phase 4 - Validierung

1. `npm run lint`
2. `npm run test`
3. `npm run build`
4. Manuelle Flow-Validierung:
   - Hub startet.
   - Report anlegen.
   - KI-Analyse erzeugen.
   - Watchlist-Eintrag priorisieren.
   - Assignment anlegen.
   - Rollenwechsel filtert Sichtbarkeit.
   - Suche findet relevante Objekte.

## Akzeptanzkriterien für diesen Zyklus

- Die App besitzt eine belastbare Scouting-Cockpit-Startansicht.
- Reports, Watchlists, Assignments, Notifications, Suche und Rollen sind keine losen Mockups, sondern persistente, validierte Workflows.
- Die bestehende Spielplan-/PDF-Funktion bleibt intakt.
- Kritische Domainlogik ist getestet.
- Lint, Tests und Build sind sauber oder exakt eingegrenzt dokumentiert.
