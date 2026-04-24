# ScoutX Target Architecture

Stand: 2026-04-23

## Zielbild

ScoutX bleibt kurzfristig eine robuste React/Vite-SPA mit Adapter-Service für Spiel-/Vereinsdaten. Die MVP-Erweiterung fügt eine zentrale Produktdomain hinzu, die lokal persistiert, validiert, rollenbasiert filtert und später ohne UI-Bruch an eine API angebunden werden kann.

## Schichten

1. `adapter-service`
   - Live-Spielpläne, Vereinsdaten, Club-Suche, Refresh/Admin.
   - Keine ScoutX-Produktdaten im MVP.

2. `src/services/scoutxDomain.js`
   - Normalisierung, Validierung, Berechtigungen.
   - Report-/Watchlist-/Assignment-/Notification-Modelle.
   - Suchindex und AI-Assist-Auswertung.
   - Import-/Export-fähige Snapshots.

3. `src/context/ScoutXProductContext.jsx`
   - React-State für Produktdomain.
   - Persistenz über `localStorage`.
   - Actions für UI-Workflows.

4. `src/pages/ScoutingHubPage.jsx`
   - Echte Arbeitsstartseite für MVP-Flows.
   - Dashboard, globale Suche, Reports, Watchlists, Planung, Benachrichtigungen und Rollensteuerung.

5. Bestehende Contexts/Pages
   - Bleiben für Setup/Games/Plan/PDF erhalten.
   - Liefern Games und PlanHistory in den Hub.

## Domainobjekte

### User / Role

- Rollen: `admin`, `coordinator`, `scout`, `readonly`.
- Permission-Funktion entscheidet `create`, `update`, `delete`, `assign`, `viewPrivate`, `manageRoles`.

### Report

- Typen: `player`, `match`, `tournament`, `note`.
- Felder: Titel, Status, Autor, Owner, Sichtbarkeit, Kontext, Tags, Sections, Ratings, AI-Analyse, Versionen.
- Status: `draft`, `in_review`, `shared`, `archived`.

### Watchlist

- Felder: Name, Owner, Sichtbarkeit, Tags, Einträge.
- Eintrag: Spielerbezug, Priorität, Status, Labels, Notiz, Assignment.

### Assignment

- Typen: `match_observation`, `player_followup`, `report_review`, `general_task`.
- Felder: Titel, Owner, Assignee, Fälligkeit, Status, Links zu Spieler/Game/Report.

### Notification

- Typen: `assignment_created`, `assignment_changed`, `report_shared`, `status_changed`.
- Felder: Titel, Body, Datum, gelesen/ungelesen, Entity-Link.

## Sichtbarkeit

- `private`: nur Owner/Admin.
- `team`: Admin, Coordinator und Teammitglieder.
- `shared`: alle eingeloggten Rollen inkl. Read-only.

Im MVP wird dies lokal durchgesetzt. Das ist keine Security-Grenze gegen manipulierten Browser-State, aber eine saubere zentrale Produktregel und API-Vorbereitung.

## KI-Auswertung

MVP-Ansatz: lokale, nicht-destruktive Analyse aus Report-Texten und Ratings:

- Zusammenfassung.
- Stärken/Schwächen.
- Entwicklungshinweise.
- Trend-/Musterhinweise.
- Widerspruchsprüfung zwischen Rating und Freitext.
- Loading/Error/Retry-fähige Action-Schnittstelle.

Später kann die Funktion hinter derselben Service-Signatur an eine echte KI-API angebunden werden.

## Migration

Neue Storage-Keys werden versioniert (`scoutx.product.v1`). Bestehende Daten bleiben unberührt. PlayerSheets, Games und PlanHistory werden beim Lesen in den Hub integriert, nicht dupliziert migriert.
