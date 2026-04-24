# ScoutX Feature Expansion Audit

Stand: 2026-04-23

## Kurzfazit

ScoutX ist heute eine React/Vite-SPA mit gut getesteter Spielplan-, PDF- und Abrechnungslogik plus lokalem Spieler-Bewertungsbogen. Die Codebasis ist lauffähig und besitzt bereits Adapter-, Routing-, Import-, PDF-, Dashboard- und PWA-Grundlagen. Für ein breites Scouting-MVP fehlen aber zentrale Produktfundamente: ein einheitliches Domainmodell für Reports, Watchlists, Assignments, Rollen, Sichtbarkeit, Benachrichtigungen, Suche und KI-Auswertung.

## Projektstruktur

- `src/app.jsx`: Shell, Routing, Lazy Pages, globale Navigationsstruktur.
- `src/context`: Setup-, Games- und Plan-Kontexte als primäre State-Schicht.
- `src/pages`: Setup, Games, Plan, Dashboard, ScoutSheet, Admin.
- `src/services`: Datenprovider, Dashboard-Aggregation, Export, PDF, Live-Konsistenz, Adapter-Admin.
- `src/components`: UI-Bausteine für Tabellen, Karten, PDF, Formulare, ErrorBoundary.
- `src/utils`: Geo/Routing, Kalender-ICS, Fahrtkosten, Arbeitszeit.
- `adapter-service`: Node-HTTP-Service für Spiel- und Vereinsdaten.
- `public`: PWA Manifest, Service Worker, Club-Katalog.

## Architektur

Die App ist eine clientseitige SPA mit lokaler Persistenz (`localStorage`, `sessionStorage`) und einem optionalen Node-Adapter. Es gibt keine TypeScript-Schicht, keine serverseitige App-Domain für ScoutX-Objekte und keine Authentifizierung im Frontend. Die bestehende Architektur ist für das aktuelle Planungs-/PDF-Produkt tragfähig, aber für das Zielbild zu eng: Produktobjekte sind über Page-State, Context-State und Storage-Keys verteilt.

## Frontend-Struktur

Die UI nutzt Inline-Styles und zentrale Farbwerte aus `src/config/colors.js` bzw. `src/styles/theme.js`. Das Layout ist mobile-fähig und besitzt eine Desktop-Rail. Die UX ist für den Setup/Games/Plan-Flow bereits brauchbar, aber neue Scouting-Workflows sind nicht in einer gemeinsamen Arbeitsoberfläche zusammengeführt.

## Backend/API-Struktur

Der Adapter stellt Spiel- und Vereinsdaten bereit und besitzt Auth-Token, Rate-Limiting, Cache-/Refresh-Mechanik und Club-Suche. Er verwaltet noch keine ScoutX-Domainobjekte wie Reports, Watchlists, Assignments oder Rollen. Für das MVP kann die Produktdomain lokal persistiert werden, solange Validierung, Berechtigungen und Exportfähigkeit zentral in einer Domain-Schicht liegen.

## Datenmodelle und Persistenz

Vorhanden:

- Games mit Datum, Zeit, Teams, Venue, Distanz, Priorität, Notiz.
- Plan-Historie mit Meta, Games, Auswahl, Sync-Kontext und Anwesenheit.
- PlayerSheets mit Spielerbasisdaten und Stärkennotiz.
- Schedule-Watch-State für Spielplan-Benachrichtigungen.

Fehlt:

- Report-Objekte mit Typ, Kontext, Sections, Ratings, Status, Versionen.
- Watchlists/Shortlists mit Einträgen, Prioritäten, Labels, Status und Ownern.
- Assignments/Tasks mit Verknüpfung zu Spielern, Spielen und Reports.
- Notifications als generische In-App-Objekte.
- Rollen, Sichtbarkeiten und zentrale Berechtigungsprüfung.
- Globale Suchindizes über Spieler, Reports, Watchlists, Games und Tasks.

## Auth / Rollen / Permissions

Es gibt keine echte Nutzerverwaltung. Adapter-Token sind vorhanden, aber nicht als Produktrollenmodell nutzbar. Sichtbarkeit wird nicht zentral durchgesetzt. MVP-Ziel: lokale Rollen-Simulation mit zentraler Permission-Funktion, damit UI und Services dieselben Regeln nutzen.

## Navigation / Routing

Aktuelle Routen:

- `/setup`
- `/games`
- `/plan`
- `/scout-sheet`
- `/dashboard`
- `/admin`

Die Startansicht leitet aktuell nach `/setup`; ein echtes Dashboard als Arbeitsstart existiert nicht. Für das MVP sollte eine Scouting-Cockpit-Route als Start-/Hub-Ansicht hinzukommen.

## State Management

State liegt in React Contexts und lokalen Page-States. Das ist für die vorhandene App simpel, aber für neue Domainobjekte ohne gemeinsame Abstraktion riskant. MVP-Ziel: ein `ScoutXProductContext` auf Basis einer zentralen Domain-Service-Datei.

## Tests

Vorhanden sind 27 Testdateien: Integration, Context-/Service-Logik, Adapter-Libs, PDF, Dashboard, Geo, Kalender und Komponenten. Die neuen Domainregeln brauchen eigene Service-Tests, weil sie Kernlogik für Reports, Suche, Rollen, Watchlists, Assignments und Notifications tragen.

## Technische Schulden

- App ist JavaScript-only, daher keine statische Typprüfung.
- `SetupContext` entfernt `STORAGE_KEYS.setup` beim Start, obwohl README persistierte Setup-Auswahl beschreibt.
- Hardcoded Adapter-Token existiert weiterhin in Frontend und Adapter.
- Inline-Styles erschweren Skalierung des Designs.
- `StepNav` kennt nur Setup/Games/Plan und ist nicht als globale Navigation ausgelegt.
- Produktlogik ist teilweise an Pages gekoppelt.
- KI ist im README genannt, aber keine echte Auswertungsschicht vorhanden.

## MVP-Relevanz

Die bestehende Basis ist als Match-/Planungsprodukt stark genug. Der schnellste Weg zum belastbaren Scouting-MVP ist kein Komplettumbau, sondern eine additive Domain-Schicht plus Hub-UI, die vorhandene Games, Plan-Historie und PlayerSheets integriert und die fehlenden Kern-Workflows wirklich bedienbar macht.
