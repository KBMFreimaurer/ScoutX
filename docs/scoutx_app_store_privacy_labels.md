# ScoutX App Store Privacy Labels Mapping (P6)

Stand: 2026-05-17

Hinweis: Dieses Dokument ist die Arbeitsgrundlage zum Ausfüllen der App-Privacy-Section in App Store Connect.

## Tracking

- Tracking: **Nein**
- Begründung: Kein Werbe-/Cross-App-Tracking, `NSPrivacyTracking=false` in `PrivacyInfo.xcprivacy`.

## Datentypen (ASC-Mapping)

1. Contact Info
- E-Mail-Adresse: **Support-Kanal**, nicht als Pflichtfeld im Core-Flow erhoben.
- ASC-Eintrag: nur setzen, falls in Produktion aktiv im Account-Modell gespeichert.

2. Identifiers
- User ID (Team-Account-ID): **Ja**
- Verwendungszweck: App-Funktionalität (Teamzugriff, Rollen, Zuordnung)
- Verknüpft mit Nutzer: **Ja**
- Für Tracking: **Nein**

3. User Content
- Notizen/Reports/Scouting-Inputs: **Ja**
- Verwendungszweck: App-Funktionalität
- Verknüpft mit Nutzer: **Ja**
- Für Tracking: **Nein**

4. Diagnostics
- Aggregierte Betriebsmetriken/Fehlerzustände serverseitig: **Ja**
- Verwendungszweck: App-Funktionalität, Wartung
- Verknüpft mit Nutzer: **Nein** (aggregiert)
- Für Tracking: **Nein**

5. Sensitive Data
- Keine speziellen sensitiven Datentypen (Health, Financial, Precise Location etc.) im Scope.

## Privacy Manifest Referenz

- Datei: `ios/App/App/PrivacyInfo.xcprivacy`
- Aktuell gesetzt:
  - `NSPrivacyTracking = false`
  - `NSPrivacyAccessedAPICategoryFileTimestamp` mit Reason `C617.1`

## Finaler ASC-Check vor Submission

1. ASC-Formular 1:1 mit `docs/scoutx_privacy_data_inventory.md` abgleichen.
2. Abweichungen dokumentieren (falls Prod-Konfiguration neue Datentypen aktiviert).
3. Finalen Screenshot/Export der ASC-Privacy-Seite als Release-Artefakt sichern.
