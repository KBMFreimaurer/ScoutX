# ScoutX Drittanbieter- und Datenquellen-Rechteprüfung (P6)

Stand: 2026-05-17

## Ziel

Nachweis, dass externe Quellen/Integrationen im Release-Kontext rechtlich und technisch kontrolliert eingebunden sind.

## Quellen/Integrationen im aktuellen Scope

1. Spiel-/Vereinsdatenquellen (Import/Abruf)
- Nutzung: Anzeige/Planung/Teamkoordination
- Risiko: Lizenz-/Nutzungsbedingungen der Datenanbieter
- Maßnahme: Produktionsfreigabe nur mit dokumentierter Erlaubnis/vertragskonformer Nutzung

2. iOS/Capacitor Plattform-APIs
- Nutzung: Share-Sheet, Filesystem, App-Intents/Deep Links
- Risiko: Privacy-Deklaration unvollständig
- Maßnahme: `PrivacyInfo.xcprivacy` und ASC-Privacy konsistent halten

3. Karten-/Routing-Dienste (falls aktiviert)
- Nutzung: Strecken-/Zeitberechnung
- Risiko: API-Key-/ToS-Verstoß
- Maßnahme: Schlüsselverwaltung und Nutzungsbedingungen dokumentieren; keine Hardcoded Secrets im Client

## Freigabekriterien für „compliance ready“

1. Für jede externe Datenquelle liegt ein belastbarer Nutzungsnachweis vor (ToS/Vertrag/Freigabevermerk).
2. Privacy-Dokumente und ASC-Labels spiegeln den tatsächlichen Datenfluss.
3. Keine produktiven Secrets im Frontend-Bundle.
4. Support-/Löschpfad ist öffentlich erreichbar (`support@scoutx.app`, Privacy-Seite).

## Offene Restaufgabe (operativ)

- Juristische Endprüfung der produktiven Datenquellen-Policy vor Submission dokumentieren
  (Ticket/Sign-off mit Datum, Verantwortlichem und Referenz auf Anbieterbedingungen).
