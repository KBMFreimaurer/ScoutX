# ScoutX Dateninventar (P6)

Stand: 2026-05-17

## 1) Verarbeitete Datenkategorien

1. Account- und Teamdaten
- Benutzer-ID, Anzeigename, Rolle, Teamzuordnung, Aktiv-Status
- Zweck: Teamzugang, Rollen-/Rechteprüfung, Zusammenarbeit
- Speicherort: Adapter-Team-State/DB

2. Planungs- und Scoutingdaten
- Spiele, Sichtungen, Feed-Einträge, Follow-up-Notizen, Team-Ziele
- Zweck: Kernfunktion der App (Planen, Sichten, Teamkoordination)
- Speicherort: Adapter-Team-State/DB, teilweise lokaler Zustand im Client

3. Benachrichtigungsdaten
- Notification-Typ, Titel/Text, Event-ID, optional Empfänger-ID, Read-Status
- Zweck: Team-Events/Statusänderungen anzeigen
- Speicherort: Adapter-Team-State/DB, Push-Outbox/Subscriptions

4. Export-/Dateidaten
- erzeugte PDF/ICS/CSV/JSON-Dateien, temporäre Datei-URIs (iOS Share)
- Zweck: Export/Weitergabe von Plan-/Reportdaten
- Speicherort: lokaler App-Container (temporär/per Exportziel)

5. Technische Diagnosedaten
- Health/Readiness/Metrics auf Serverebene (aggregiert)
- Zweck: Betriebssicherheit/Monitoring
- Speicherort: Server-Metrikendpunkte, Logs

## 2) Nicht erhobene Daten

- Kein IDFA-basiertes Werbetracking.
- Keine Hintergrund-Standortverfolgung.
- Keine biometrischen, Gesundheits- oder Finanzdaten.

## 3) Datenflüsse

- App ⇄ Adapter-Service: HTTPS-API für Team- und Scouting-Funktionen
- App ⇄ iOS Share Sheet/Dateien: Nutzerinitiierter Export
- Optional externe Datenquellen: Spiel-/Vereinsdatenimporte (zweckgebunden)

## 4) Aufbewahrung/Löschung

- Team-/Scoutingdaten bleiben bis zur aktiven Löschung im Team-Kontext erhalten.
- Lösch-/Support-Anfragen laufen über: `support@scoutx.app`.
- Exportdateien unterliegen dem vom Nutzer gewählten Zielspeicher.

## 5) Sicherheits-/Privacy-Kontrollen

- HttpOnly-Session-Cookies, CSRF-Checks auf Write-Routen.
- Rollenbasierte Zugriffskontrolle für Team-Write-Aktionen.
- `PrivacyInfo.xcprivacy` vorhanden (`NSPrivacyTracking=false`, accessed API reasons gesetzt).
