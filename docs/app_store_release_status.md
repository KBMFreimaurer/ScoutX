# ScoutX App Store Release Status

Stand: 2026-05-05

## Phase 1: Product And Release Strategy

Erledigt:
- v1-Positionierung festgelegt: ScoutX als Fußball-Scouting- und Match-Planungs-App.
- Packaging-Ansatz festgelegt: Capacitor/WebKit-Shell mit nativen iOS-Integrationen.
- v1-Kernflows bestätigt: Setup, Spiele, Plan, Scout Sheet, Dashboard/Export.
- Monetarisierungsentscheidung für Submission-Start gesetzt: kostenlos (ohne In-App-Purchase-Entitlements).
- Zielplattform für v1 gesetzt: iPhone + iPad (Device Family `1,2`).

Offene Risiken:
- Monetarisierungsstrategie für spätere Premium-Funktionen ist noch nicht finalisiert (IAP/B2B-Abgrenzung).

Nächste Schritte:
- Vor erstem kommerziellen Rollout verbindliche IAP-/B2B-Policy entscheiden und UI/Metadata entsprechend einfrieren.

## Phase 2: iOS Project Foundation

Erledigt:
- Capacitor + iOS-Plattform ins Repo integriert (`ios/App/App.xcodeproj`).
- Bundle Identifier gesetzt (`com.scoutx.app`).
- Deployment Target aktuell auf iOS 18.0 gesetzt (`MinimumOSVersion=18.0`, Capacitor 8/SPM-Projektstand).
- Versioning gesetzt (`MARKETING_VERSION=1.0`, `CURRENT_PROJECT_VERSION=1`).
- iOS-Sync/Build-Befehl dokumentiert (`npm run ios:sync`).
- URL-Scheme für Deeplinks registriert (`scoutx://`).
- Build-iOS-Apps-Plugin konfiguriert und Simulator-Build auf iOS 26.4 erfolgreich ausgeführt.
- Capacitor-SPM-Manifest stabilisiert: `experimental.ios.spm.swiftToolsVersion=6.0`, damit `.iOS(.v18)` auf Xcode 26.4 auflösbar ist.

Offene Risiken:
- TestFlight-spezifische eigene Build-Konfiguration ist noch nicht separat angelegt (aktuell Debug/Release).
- iOS-18-Mindestversion ist technisch konsistent mit dem aktuellen Capacitor-8/SPM-Stand, reduziert aber die Geräteabdeckung gegenüber dem früher dokumentierten iOS-16-Ziel.

Nächste Schritte:
- Entscheiden, ob iOS 18.0 als v1-Mindestversion akzeptiert wird oder ob ein Downgrade-Pfad mit älterem Capacitor-/iOS-Setup geplant werden soll.
- Bei Bedarf zusätzliche TestFlight-Config ergänzen.

## Phase 3: Native App Quality

Erledigt:
- Deeplink-Routing in der App implementiert (`scoutx://setup`, `games`, `plan`, `scout-sheet`, `dashboard`).
- Export-Pfade auf iOS Share Sheet erweitert (ICS/CSV/JSON via Capacitor Share mit Download-Fallback).
- Admin-Oberfläche für Release standardmäßig ausgeblendet (`VITE_ENABLE_ADMIN`).
- Support- und Datenschutz-Seiten in App-Navigation ergänzt.
- Simulator-Smoke-Test auf iPhone 17 Pro / iOS 26.4 bestanden: App startet, WebView rendert Cockpit, Dashboard und Scout-Bewertungsbogen.
- Native WebView-Startfläche gehärtet: Vite-Assets werden relativ gebaut (`base: "./"`), `index.html` setzt eine dunkle Shell-Hintergrundfarbe.

Offene Risiken:
- Vollständiger On-Device-Accessibility-Check (VoiceOver, Dynamic Type, Touch Targets) steht aus.
- Vollständige Offline-/Timeout-UX auf realem Gerät steht noch aus.

Nächste Schritte:
- Screen-by-Screen QA mit Accessibility-Checkliste durchführen (Setup, Spiele, Plan, Scout Sheet, Dashboard, Export/Share, Offline/API-Ausfall).

## Phase 4: App Intents And System Integration

Erledigt:
- Erste Intent-Suite implementiert (`OpenScoutXDestinationIntent`, `OpenNextScoutingGameIntent`, `StartScoutSheetIntent`).
- `AppShortcutsProvider` ergänzt (deutsche Phrasen, kein fremdes Branding).
- Zentraler Handoff über `scoutx://`-Deeplinks eingebaut.

Offene Risiken:
- Runtime-Verifikation der Intents in Shortcuts/Siri steht bis zum funktionierenden Simulator aus.

Nächste Schritte:
- Intent-Ausführung auf Simulator/Gerät testen und ggf. Phrase-Tuning für bessere Discoverability vornehmen.

## Phase 5: Backend And Data

Erledigt:
- Release-seitig kritische Frontend-Härtung: harter Client-Fallback-Token entfernt.

Offene Risiken:
- Produktions-HTTPS-Endpoint, Monitoring, IPv6-only-Test und Review-stabiler Demo-Modus sind noch nicht final verifiziert.

Nächste Schritte:
- Live-Review-Backend verbindlich festlegen und mit Health-/Fallback-Szenarien dokumentieren.

## Phase 6: Privacy, Security And Legal

Erledigt:
- `PrivacyInfo.xcprivacy` erstellt und im Xcode-Projekt eingebunden.
- In-App Datenschutz-/Support-Flows ergänzt (`/privacy`, `/support`).
- Statische öffentliche Seiten vorbereitet (`public/privacy-policy.html`, `public/support.html`).
- Hardcoded produktiver Frontend-Token entfernt.

Offene Risiken:
- Vollständige App Privacy Details (App Store Connect Formular) noch nicht befüllt.
- Drittanbieter-/Datenquellen-Rechteprüfung muss finalisiert werden.

Nächste Schritte:
- Dateninventar final auflisten und mit App Privacy Labels 1:1 abgleichen.

## Phase 7: App Store Metadata

Erledigt:
- Baseline-Namen/Positionierung für `ScoutX` und v1-Feature-Umfang intern definiert.

Offene Risiken:
- Finale ASC-Metadaten (Subtitle, Description, Keywords, Rating, Screenshots, Review Notes) noch nicht in ASC eingetragen.

Nächste Schritte:
- Metadata-Paket in deutscher und englischer Review-tauglicher Fassung finalisieren.

## Phase 8: QA And TestFlight

Erledigt:
- `npm run lint`: bestanden.
- `npm run test`: bestanden (35 Dateien, 222 Tests).
- `npm run build`: bestanden.
- `npx cap sync ios`: erfolgreich.
- `npm run ios:sync`: erfolgreich am 2026-05-05 erneut ausgeführt.
- Build-iOS-Apps-Plugin:
  - `build_sim`: bestanden für Scheme `App`.
  - `build_run_sim`: bestanden auf iPhone 17 Pro / iOS 26.4.
  - Smoke-Test: Cockpit, Dashboard und Scout-Bewertungsbogen visuell geprüft.

Offene Risiken:
- Vollständiger Kernflow-Smoke-Test ist noch nicht abgeschlossen (Setup, Spiele, Plan, Export/Share, Offline/API-Ausfall).
- Echtes Gerät und TestFlight-Installation stehen noch aus.

Nächste Schritte:
- Vollständigen Kernflow-Smoke-Test auf Simulator durchführen und Screenshots/Notizen für App Store Metadata ableiten.
- Danach echten Geräte-Test und TestFlight-Internal-Testing vorbereiten.

## Phase 9: Submission

Erledigt:
- Noch keine Submission-Aktionen ausgeführt.

Offene Risiken:
- Archive/Upload/Compliance/Privacy/Review Notes in App Store Connect stehen aus.

Nächste Schritte:
- Nach abgeschlossener Simulator-/Geräte-QA Release Candidate archivieren und in ASC einreichen.
