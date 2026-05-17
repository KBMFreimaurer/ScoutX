# ScoutX App Store Release Status

Stand: 2026-05-17

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
- Simulator-Runtime erneut verifiziert: `build_run_sim` erfolgreich auf iPhone 17 Pro / iOS 26.4; App-Start inkl. Runtime-Logs stabil.
- Deep-Link-Zielrouting der Intent-URLs testseitig abgesichert (`src/native/deepLinks.test.js`).

Offene Risiken:
- Siri-/Shortcuts-UI-Interaktion auf echtem Gerät steht noch aus (rein funktionale URL-Öffnung ist verifiziert).

Nächste Schritte:
- Phrase-Tuning und echte Siri-/Shortcuts-Ausführung im Device-Testflight-Durchlauf mit dokumentierten Screenshots nachziehen.

## Phase 5: Backend And Data

Erledigt:
- Release-seitig kritische Frontend-Härtung: harter Client-Fallback-Token entfernt.
- Übergang aus Phase 4 erfolgt (Intent-/Deep-Link-Parität verifiziert, App-Shell stabil).
- P5-Backend/Data-Gate als ausführbares Script ergänzt (`ops/check-p5-backend-data-gates.sh`, `npm run release:p5:gate`).
- Gate deckt Test/Build/Health/DB-Readiness/Metrics sowie HTTPS-/IPv6-Smokes und Demo-Artefaktlage ab.

Offene Risiken:
- Externe Produktions-/Staging-Live-Verifikation (echter HTTPS-Host, reales IPv6-Only-Netz) bleibt umgebungsabhängig und muss im Release-Run protokolliert werden.

Nächste Schritte:
- P6 starten: Privacy/Compliance-Details in App Store Connect finalisieren und mit Dateninventar 1:1 abgleichen.

## Phase 6: Privacy, Security And Legal

Erledigt:
- `PrivacyInfo.xcprivacy` erstellt und im Xcode-Projekt eingebunden.
- In-App Datenschutz-/Support-Flows ergänzt (`/privacy`, `/support`).
- Statische öffentliche Seiten vorbereitet (`public/privacy-policy.html`, `public/support.html`).
- Hardcoded produktiver Frontend-Token entfernt.
- Dateninventar finalisiert (`docs/scoutx_privacy_data_inventory.md`).
- App-Store-Privacy-Mapping finalisiert (`docs/scoutx_app_store_privacy_labels.md`).
- Drittanbieter-/Datenquellen-Rechteprüfung dokumentiert (`docs/scoutx_third_party_rights_review.md`).
- P6-Gate ergänzt (`ops/check-p6-privacy-compliance-gates.sh`, `npm run release:p6:gate`).

Offene Risiken:
- ASC-Formulareingabe muss noch operativ im App Store Connect durchgeführt und als Artefakt exportiert werden.

Nächste Schritte:
- P7 starten: App-Store-Metadaten (DE/EN) final paketieren und in ASC eintragen.

## Phase 7: App Store Metadata

Erledigt:
- Baseline-Namen/Positionierung für `ScoutX` und v1-Feature-Umfang intern definiert.
- Metadatenpaket in DE finalisiert (`docs/scoutx_app_store_metadata_de.md`).
- Metadatenpaket in EN finalisiert (`docs/scoutx_app_store_metadata_en.md`).
- Screenshot-/Submission-Checklist finalisiert (`docs/scoutx_app_store_screenshot_checklist.md`).
- P7-Gate ergänzt (`ops/check-p7-app-store-metadata-gates.sh`, `npm run release:p7:gate`).

Offene Risiken:
- Operative ASC-Eingabe und Upload der Screenshots stehen noch aus (manueller Store-Connect-Schritt).

Nächste Schritte:
- P8 starten: vollständige QA-/TestFlight-Durchläufe und Artefaktprotokoll vervollständigen.

## Phase 8: QA And TestFlight

Erledigt:
- `npm run lint`: bestanden.
- `npm run test`: bestanden (aktuell 50 Dateien, 346 Tests inkl. Skips).
- `npm run build`: bestanden.
- `npx cap sync ios`: erfolgreich.
- `npm run ios:sync`: erfolgreich am 2026-05-05 erneut ausgeführt.
- Build-iOS-Apps-Plugin:
  - `build_sim`: bestanden für Scheme `App`.
  - `build_run_sim`: bestanden auf iPhone 17 Pro / iOS 26.4.
  - Smoke-Test: Cockpit, Dashboard und Scout-Bewertungsbogen visuell geprüft.
- Release-E2E-Smoketest ausführbar und im lokalen Modus ohne DB-URL sauber `skipped` (`npm run test:e2e:release`).
- P8-Gate ergänzt (`ops/check-p8-qa-testflight-gates.sh`, `npm run release:p8:gate`).
- P8-Checklist dokumentiert (`docs/scoutx_p8_qa_testflight_checklist.md`).
- P8-Gate auf Strict-Mode gehärtet: kein Sandbox-Fallback, `skipped` im Release-E2E gilt als Fehler.

Offene Risiken:
- Vollständiger Kernflow-Smoke-Test auf physischem Gerät ist noch offen (inkl. Offline/API-Ausfall).
- Internal TestFlight-Durchlauf in ASC ist noch offen.

Nächste Schritte:
- P9 starten: Archive/Upload in App Store Connect, Compliance-Formulare finalisieren und zur Review einreichen.

## Phase 9: Submission

Erledigt:
- Submission-Runbook für ASC erstellt (`docs/scoutx_p9_submission_runbook.md`).
- P9-Readiness-Gate ergänzt (`ops/check-p9-submission-readiness-gates.sh`, `npm run release:p9:gate`).
- Formale P9-Abschlussdoku ergänzt (`docs/scoutx_p9_completion.md`).

Offene Risiken:
- Manuelle ASC-Submission (Archive/Upload/Compliance/Privacy/Review Notes) steht weiterhin aus.

Nächste Schritte:
- Runbook in ASC operativ abarbeiten und Review-Submission auslösen.
