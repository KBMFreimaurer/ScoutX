# ScoutX Gap Analysis

Stand: 2026-04-23

## Priorität 1 - Fundament

| Bereich | Ist-Zustand | MVP-Lücke | Entscheidung |
| --- | --- | --- | --- |
| Domainmodelle | Games, PlanHistory, PlayerSheets verteilt | Keine gemeinsame Scouting-Domain | Zentrale Domain-Service-Schicht für Reports, Watchlists, Assignments, Notifications, Rollen |
| Rollen/Sichtbarkeit | Keine Produktrollen | Private/team/read-only nicht abgesichert | Zentraler Permission-Check in Domain-Service und UI-Filterung |
| Reporting | Plantext und einfacher Spielerbogen | Keine strukturierten Reports mit Sections, Ratings, Status | Flexibles Reportmodell mit Templates, Versionen und AI-Analyse |
| Suche/Filter | Games sortierbar, Club-Suche | Keine globale Suche | Lokaler Suchindex über Produktobjekte und Games |
| Dashboard | Historien-Dashboard | Kein echter Start für Tagesarbeit | Neuer Scouting-Hub mit Aufgaben, Reports, Watchlists, Terminen, Notifications |

## Priorität 2 - Kernnutzung

| Bereich | Ist-Zustand | MVP-Lücke | Entscheidung |
| --- | --- | --- | --- |
| Watchlists | Favoriten/Team-Hinweise | Keine Shortlists je Spieler | Persistente Watchlists mit Einträgen, Status, Priorität, Labels |
| Kalender/Assignments | ICS-Export, Plan-Präsenz | Keine Zuweisungen und Tasks | Assignment-Modell mit Datum, Status, Owner und Verknüpfungen |
| Notifications | Spielplanänderungen | Keine generischen Produktmeldungen | Notification-Store mit Assignment-, Report- und Statusereignissen |
| Match-/Gebietssuche | Adapter-Games + Distanz | Kein gespeicherter Planungsworkflow | Hub nutzt vorhandene Games, Filter und Assignment-Erstellung |
| Detail-/Verknüpfungen | Begrenzte Plan-Historie | Objekte kaum verlinkt | Report-, Watchlist- und Assignment-Objekte referenzieren Spieler/Games/Reports |

## Priorität 3 - Intelligenz und Feinschliff

| Bereich | Ist-Zustand | MVP-Lücke | Entscheidung |
| --- | --- | --- | --- |
| KI-Auswertung | Nicht implementiert | Keine Zusammenfassungen/Checks | Deterministische lokale Analyse als nicht-destruktive MVP-Grundlage; später API austauschbar |
| Vergleich | Dashboard-Aggregate | Keine Spieler-/Report-Vergleiche | Such- und Reportdaten so strukturieren, dass Vergleichsansicht folgen kann |
| Export/API | PDF/CSV/JSON einzeln | Kein Gesamt-Export | Domain-Objekte normalisiert und versioniert speichern |
| UX | Bestehender Flow okay | Neue Workflows fehlen | Hub statt verstreuter Demo-Seiten |

## Blocker für "vorzeigbar"

- Ohne zentrale Produktdomain bleibt jede weitere Funktion eine isolierte lokale Page.
- Ohne Rollenmodell kann Sichtbarkeit nicht glaubwürdig umgesetzt werden.
- Ohne Hub startet die App nicht als Scouting-Arbeitsplatz.
- Ohne Domain-Tests wären neue Kernlogiken nicht belastbar.

## Nicht-Ziele für diesen MVP-Zyklus

- Kein 1:1-Nachbau externer Scouting-Produkte.
- Keine echte Multiuser-Authentifizierung ohne Backend.
- Keine externe KI-Anbindung, solange kein sicherer Provider- und Secrets-Fluss existiert.
- Kein umfassender Designsystem-Umbau.
