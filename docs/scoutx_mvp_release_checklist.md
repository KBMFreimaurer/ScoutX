# ScoutX MVP v1 Web - Go/No-Go Release-Checkliste

Referenzbasis: `docs/scoutx_mvp_completion_audit.md`  
Statusziel: **MVP v1 Web freigabefähig für Kundendemo**

## 1) Abnahmebasis festschreiben (Go/No-Go)

- [ ] Audit-Report als verbindliche Abnahmebasis bestätigt: `docs/scoutx_mvp_completion_audit.md`
- [ ] Scope bestätigt: nur Web-MVP, kein iOS-Push im Scope
- [ ] Regression-Commands ausgeführt und grün:
  - `npm run test -- adapter-service/server.test.mjs` (aktuell: 36/36)
  - `npm run test -- src/services/dataProvider.test.js src/pages/GamesPage.test.jsx src/app.integration.test.jsx` (aktuell: 46/46)

Go-Kriterium: alle drei Punkte erfüllt.

## 2) Security-Findings priorisiert (P0)

P0-1 Session-Expiry serverseitig
- Ziel: abgelaufene Team-Sessions werden serverseitig geblockt und bereinigt.
- Nachweis:
  - Implementierung in `adapter-service/server.mjs`
  - Integrationstest in `adapter-service/server.test.mjs`
- Gate: keine Umgehung bei Ablauf möglich.

P0-2 Keine Hash-Daten im Archiv
- Ziel: `passwordHash` darf nie im Team-Archiv landen.
- Nachweis:
  - Sanitizing in `persistTeamState` (`adapter-service/server.mjs`)
  - Test `never writes password hashes into team archive events`
- Gate: Archiv enthält keine sensiblen Hash-Felder.

P0-3 `active`-Flag in Public-Payload
- Ziel: deaktivierte Accounts bleiben in allen Public-Team-Responses konsistent erkennbar.
- Nachweis:
  - Public-Mapping in `adapter-service/lib/teamBackend.js` + `adapter-service/server.mjs`
  - Auth/State-Integrationstests in `adapter-service/server.test.mjs`
- Gate: keine Active/Inaktive-Inkonsistenz im UI-Flow.

Go-Kriterium: alle drei P0-Gates erfüllt und im Audit nachgewiesen.

## 3) Demo-Route (5-7 Minuten)

0:00-0:45 - Setup + Zielbild
- Kurz erklären: geschlossenes Team-Scouting, einheitlicher Lifecycle, Feed + Notifications.

0:45-2:30 - Vier Quellen in einen gemeinsamen Flow
- `official`: offizielles Spiel in den Plan.
- `manual`: inoffizielles Spiel/Kreis-PDF-Import zeigen.
- `tournament`: Turnier + Match hinzufügen.
- `national`: U-Nationalspiel importieren.
- Ergebnis zeigen: alle Quellen erscheinen im gleichen Plan-/Observation-Flow.

2:30-4:00 - Lifecycle live
- Für mindestens 1-2 Spiele: `seen` markieren.
- Direkt danach Anschlussaktionen zeigen:
  - `Spielbericht anlegen`
  - `Spieler highlighten`
  - `Follow-up`
- Feed-Einträge mit Statuskette (`planned -> seen -> reported -> followup`) zeigen.

4:00-5:15 - Teamübersicht + Konflikte
- Konfliktwarnung vor Planabschluss zeigen (Zeit/Erreichbarkeit).
- Teamübersicht im Hub zeigen: Auslastung, Konflikte, Abdeckung offen.

5:15-6:30 - Notifications + Dedupe
- Inbox-Filter (`unread/read`, Typen) zeigen.
- Kritisches Event (z. B. Absage/Follow-up) auslösen.
- Nachweis: identische Event-ID in Feed + Inbox, Push nur für kritische Typen.

6:30-7:00 - Go/No-Go Abschluss
- Kurz auf die zwei grünen Test-Gates und Audit-Referenz verweisen.

## 4) No-Go Bedingungen

- Einer der P0-Security-Gates nicht erfüllt.
- Einer der beiden Regression-Command-Sätze schlägt fehl.
- Vier-Quellen-Flow nicht durchgängig im selben Plan/Observation-Flow demonstrierbar.

## 5) Entscheidungsprotokoll

- Datum:
- Entscheider:
- Ergebnis: `GO` / `NO-GO`
- Begründung:
- Offene Restpunkte (falls NO-GO):
