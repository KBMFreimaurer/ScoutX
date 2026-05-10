# ScoutX App Store Release Goal

Stand: 2026-05-05  
Ziel: ScoutX als stabile iOS-App bis zur App-Store-Einreichung fertig bauen und gegen die offiziellen Apple App Store Review Guidelines absichern.

Offizielle Referenzen:

- Apple App Store Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Apple Human Interface Guidelines: https://developer.apple.com/design/human-interface-guidelines/
- App Store Connect Help: https://developer.apple.com/help/app-store-connect/
- App Intents Documentation: https://developer.apple.com/documentation/appintents/

Aktueller Umsetzungsstand:

- Siehe [docs/app_store_release_status.md](/Users/playboiiboggos/.openclaw/workspace/ScoutX/docs/app_store_release_status.md)

## /goal Prompt

Arbeite dieses Ziel sequenziell ab: Baue ScoutX aus dem aktuellen React/Vite/PWA-Stand zu einer veröffentlichungsreifen iOS-App aus, bereite TestFlight und App Store Connect vor und erfülle die offiziellen Apple App Store Review Guidelines. Priorisiere App-Store-Akzeptanz, technische Stabilität, Datenschutz, echte native App-Qualität und Review-Nachvollziehbarkeit. Verändere keine fremden, nicht relevanten Dateien. Nach jeder Phase: dokumentiere erledigte Punkte, offene Risiken und die konkreten nächsten Schritte in diesem Dokument oder in einem passenden Statusdokument.

## Definition of Done

- ScoutX läuft als iOS-App auf echten Geräten und Simulatoren ohne Crash im Kernfluss.
- Die App ist keine bloße Website-Hülle, sondern bietet eine erkennbare iOS-App-Erfahrung mit stabilem Navigation-, Storage-, Export- und Offline-/Fehlerverhalten.
- Backend/API ist produktionsfähig, per HTTPS erreichbar und während Apple Review stabil verfügbar.
- App Review bekommt vollständigen Zugang: Demo-Modus oder Demo-Daten, Review Notes, Support-Kontakt und Testanleitung.
- Datenschutz ist fertig: Privacy Policy, App Privacy Details, Permission-Purpose-Strings, Datenlöschung/Supportweg und Privacy Manifest.
- App Store Connect ist vollständig: Name, Subtitle, Beschreibung, Kategorie, Altersfreigabe, Screenshots, Support URL, Marketing URL optional, Review Notes.
- Monetarisierung ist Apple-konform: kein externer Unlock digitaler Funktionen ohne passende StoreKit/IAP- oder Entitlement-Strategie.
- TestFlight-Build ist geprüft und ein Release Candidate ist über App Store Connect eingereicht.

## Current ScoutX Baseline

- Frontend: React 19, Vite, React Router.
- App-Charakter: SPA/PWA mit `public/manifest.webmanifest`, Service Worker und lokalen Daten.
- Backend: Node Adapter-Service unter `adapter-service/`.
- Hauptfunktionen: Setup, Spiele, Plan, Scout Sheet, Dashboard, PDF/Export, Admin.
- Aktuelles Release-Risiko: Es gibt noch kein iOS-Projekt im Repo. Größte Apple-Risiken sind Guideline 4.2 Minimum Functionality, Privacy 5.1, App Completeness 2.1, Backend-Verfügbarkeit und Payment-Konformität.

## Apple Guideline Mapping

### Safety

- 1.5 Developer Information: In App und Support URL muss klar erkennbar sein, wie Nutzer Support erreichen.
- 1.6 Data Security: Personen-, Vereins-, Standort-, Planungs- und Exportdaten müssen angemessen geschützt werden.
- ScoutX-Aktion: Support/Kontaktbereich ergänzen, HTTPS erzwingen, keine Secrets im Client, klare Fehlerzustände statt Datenlecks.

### Performance

- 2.1 App Completeness: Keine Platzhalter, keine kaputten URLs, keine Review-blockierenden Logins, Backend live.
- 2.3 Accurate Metadata: Screenshots, Beschreibung und Review Notes müssen echte ScoutX-Funktionen zeigen.
- 2.5 Software Requirements: Nur öffentliche APIs, App-Daten im Container, IPv6-only, Background-Tasks nur mit erlaubtem Zweck, WebKit bei WebView.
- ScoutX-Aktion: On-device QA, TestFlight, Review-Demo, IPv6/HTTPS/API-Test, Release-Build ohne Dev/Admin-Lecks.

### Business

- 3.1.1 In-App Purchase: Digitale Feature-Unlocks, Abos oder Premium-Zugänge in der App brauchen StoreKit/IAP, sofern keine erlaubte Ausnahme greift.
- ScoutX-Aktion: Vor Submission entscheiden, ob ScoutX kostenlos, bezahlte App, IAP-Abo oder externer B2B-Zugang ist. App-UI und Metadaten daran anpassen.

### Design

- 4.2 Minimum Functionality: Apple lehnt Apps ab, die nur eine verpackte Website ohne ausreichenden App-Nutzen sind.
- 4.0 Design: App muss sich wie ein hochwertiges iOS-Produkt verhalten.
- ScoutX-Aktion: Native Shell, iOS Navigation, Share Sheet/Files Export, Offline-/Cache-Zustände, App Icons, Launch Screen, adaptive Layouts und möglichst sinnvolle App Intents/Shortcuts.

### Legal

- 5.1 Privacy: Datensammlung, Nutzung, Weitergabe, Löschung und Drittanbieter müssen transparent beschrieben werden.
- 5.1.1 Consent: Nur notwendige Daten erheben, klare Einwilligung für sensible Zugriffe.
- 5.1.5 Location Services: Standort nur nutzen, wenn direkt relevant, mit klarer Erklärung und Consent.
- 5.2 Intellectual Property: Vereins-, Liga-, Karten-, API- und Bilddaten nur nutzen, wenn Rechte/Terms passen.
- ScoutX-Aktion: Privacy Policy schreiben, Dateninventar erstellen, Drittanbieter/Quellen prüfen, App Privacy Labels ausfüllen.

## Phase 1: Product And Release Strategy

Ziel: Klare App-Store-fähige Produktentscheidung treffen.

- [ ] Zielplattform festlegen: iPhone only, iPhone+iPad oder später Mac Catalyst.
- [ ] Packaging-Ansatz entscheiden:
  - Native Swift/SwiftUI App mit eingebettetem Web/Core-Rewrite.
  - Capacitor/WebKit-Shell mit nativen Integrationen.
  - Vollständig native Neuimplementierung ausgewählter Kernflows.
- [ ] App-Store-Positionierung definieren: Scouting-Planer für Fußball/Jugendspiele, kein allgemeines Browser- oder Daten-Scraping-Tool.
- [ ] Kernflows für v1 festlegen:
  - Setup/Kreis/Alter/Team.
  - Spielauswahl.
  - Planerstellung.
  - Scout Sheet.
  - Dashboard/Export.
- [ ] Nicht-v1-Funktionen markieren und aus App Store Metadata heraushalten.
- [ ] Monetarisierung festlegen:
  - Kostenlos.
  - Paid upfront.
  - IAP/Subscription.
  - B2B/Account-Zugang mit Apple-konformer Reader-/Enterprise-/Custom-App-Bewertung.

Exit-Kriterium: Ein schriftlicher v1-Scope und Monetarisierungsmodell liegen vor.

## Phase 2: iOS Project Foundation

Ziel: Ein baubares iOS-Projekt im Repo schaffen.

- [ ] Apple Developer Team, Bundle ID und Signing-Strategie festlegen.
- [ ] Xcode-Projekt anlegen, z. B. `ios/ScoutX/ScoutX.xcodeproj`.
- [ ] Bundle Identifier setzen, z. B. `com.scoutx.app` oder finaler Organisations-Identifier.
- [ ] App Icon Set aus bestehenden ScoutX-Assets erstellen und für alle iOS-Größen prüfen.
- [ ] Launch Screen erstellen.
- [ ] iOS Deployment Target festlegen.
- [ ] Build-Konfigurationen für Debug, TestFlight und Release trennen.
- [ ] Versioning definieren: `CFBundleShortVersionString` und `CFBundleVersion`.
- [ ] CI- oder lokaler Build-Befehl dokumentieren.

Exit-Kriterium: `xcodebuild` bzw. Xcode kann einen Simulator-Build erzeugen.

## Phase 3: Native App Quality

Ziel: ScoutX erfüllt Guideline 4.2 und wirkt nicht wie eine reine Website-Verpackung.

- [ ] App-Shell mit iOS-gerechter Navigation umsetzen.
- [ ] WebView/Capacitor nur verwenden, wenn native Integrationen und App-spezifischer Nutzen sichtbar sind.
- [ ] Deep Links für Kernbereiche definieren:
  - `scoutx://setup`
  - `scoutx://games`
  - `scoutx://plan`
  - `scoutx://scout-sheet`
  - `scoutx://dashboard`
- [ ] PDF-/Datei-Export über iOS Share Sheet oder Files App anbieten.
- [ ] Offline- und leere Zustände auf iOS sauber gestalten.
- [ ] Netzwerkfehler, API-Ausfälle und Timeouts mit klaren Recovery-Aktionen behandeln.
- [ ] Geräte-Layouts testen: kleine iPhones, große iPhones, optional iPad.
- [ ] Accessibility prüfen: Dynamic Type, VoiceOver Labels, ausreichender Kontrast, Touch Targets.

Exit-Kriterium: Ein Reviewer kann alle v1-Kernflows ohne externes Wissen bedienen.

## Phase 4: App Intents And System Integration

Ziel: Kleine, sinnvolle iOS-Systemintegration hinzufügen, ohne die App künstlich aufzublähen.

- [ ] Erste App Intents auswählen, maximal 1-3:
  - Spielplan öffnen.
  - Nächstes Scouting-Spiel öffnen.
  - Scout Sheet starten.
- [ ] Kleine Entity-Oberfläche definieren:
  - `ScoutXDestination` oder `ScoutXGameSummary`.
- [ ] Einen zentralen Handoff-Pfad zur App-Routing-Schicht bauen.
- [ ] `AppShortcutsProvider` mit klaren deutschen Phrasen hinzufügen.
- [ ] Keine generischen oder fremden Markenbegriffe in Siri-/Shortcut-Phrasen verwenden.
- [ ] Build und Runtime-Handoff auf Simulator und Gerät testen.

Exit-Kriterium: App Intents kompilieren, öffnen die richtigen ScoutX-Bereiche und erfüllen Guideline 2.5.11.

## Phase 5: Backend And Data

Ziel: Review- und Produktionsbetrieb sind stabil.

- [ ] Produktions-API per HTTPS bereitstellen.
- [ ] Keine lokalen Adapter-Abhängigkeiten für App Review.
- [ ] API-Healthcheck und Monitoring einrichten.
- [ ] Timeouts, Retry-Strategie und Offline-Fallbacks definieren.
- [ ] Demo-Daten oder Demo-Modus ohne externe Credentials bereitstellen.
- [ ] Token-/Secret-Strategie überarbeiten: keine festen produktiven Secrets im Client.
- [ ] Datenquellen, Scraping, Vereins-/Liga-Daten und Terms-of-Use prüfen.
- [ ] IPv6-only-Kompatibilität testen.

Exit-Kriterium: App funktioniert während Review mit live erreichbarem Backend oder vollständigem Demo-Modus.

## Phase 6: Privacy, Security And Legal

Ziel: Guideline 5.1 und App Privacy Anforderungen erfüllen.

- [ ] Dateninventar erstellen:
  - lokal gespeicherte Einstellungen.
  - ausgewählte Teams/Vereine.
  - Spiel- und Planungsdaten.
  - Exportdaten.
  - API Logs.
  - optionale Standort-/Routingdaten.
  - Analytics/Crashdaten, falls eingeführt.
- [ ] Privacy Policy schreiben und veröffentlichen.
- [ ] In-App-Link zur Privacy Policy ergänzen.
- [ ] Support-/Löschanfrage-Kanal definieren.
- [ ] App Privacy Details für App Store Connect ausfüllen.
- [ ] `PrivacyInfo.xcprivacy` für iOS-Projekt erstellen.
- [ ] Permission Purpose Strings formulieren, falls benötigt:
  - Location.
  - Files/Photos, falls Export/Speichern darüber läuft.
  - Notifications, falls Spieländerungen gemeldet werden.
- [ ] Drittanbieter prüfen:
  - Karten/Routing/Geocoding.
  - Analytics.
  - Crash Reporting.
  - Backend Hosting.
- [ ] Security-Check durchführen:
  - keine produktiven Tokens im Frontend.
  - HTTPS only.
  - CORS restriktiv.
  - Admin-Routen im Release deaktivieren oder schützen.
  - Input/Export-Daten sanitizen.

Exit-Kriterium: Privacy Policy, App Privacy Labels und technische Privacy-Artefakte sind konsistent.

## Phase 7: App Store Metadata

Ziel: Guideline 2.3 erfüllen und Review beschleunigen.

- [ ] App Name finalisieren: `ScoutX`.
- [ ] Subtitle formulieren, ohne irreführende Claims.
- [ ] Beschreibung schreiben, nur v1-Funktionen nennen.
- [ ] Keywords definieren, ohne fremde Marken oder Spam.
- [ ] Kategorie festlegen.
- [ ] Altersfreigabe beantworten.
- [ ] Support URL live schalten.
- [ ] Privacy Policy URL live schalten.
- [ ] Screenshots erstellen:
  - echte App-Nutzung, nicht nur Splash/Login.
  - iPhone-Größen nach App Store Connect Vorgaben.
  - optional iPad, falls iPad unterstützt wird.
- [ ] App Preview Video optional prüfen.
- [ ] Review Notes schreiben:
  - Demo-Modus oder Account.
  - Kernflows.
  - Backend-Hinweis.
  - nicht offensichtliche Features.
  - keine versteckten Funktionen.

Exit-Kriterium: App Store Connect kann ohne Platzhalter gespeichert werden.

## Phase 8: QA And TestFlight

Ziel: Release Candidate technisch belastbar machen.

- [ ] Web-App Checks laufen lassen:
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `npm run test:e2e`, falls stabil konfiguriert.
- [ ] iOS Simulator Build testen.
- [ ] Echtes Gerät testen:
  - Erststart.
  - Setup.
  - Spielauswahl.
  - Plan.
  - Scout Sheet.
  - Dashboard.
  - Export/Share.
  - Offline.
  - API-Ausfall.
- [ ] Crash-freier Smoke-Test nach Neuinstallation.
- [ ] TestFlight Internal Testing durchführen.
- [ ] TestFlight External Testing optional durchführen.
- [ ] Bekannte Einschränkungen nur akzeptieren, wenn sie nicht gegen Guidelines oder Metadata verstoßen.

Exit-Kriterium: Ein Release Candidate ist als TestFlight-Build validiert.

## Phase 9: Submission

Ziel: App Store Review einreichen.

- [ ] Finalen Archive Build erstellen.
- [ ] Build zu App Store Connect hochladen.
- [ ] Export Compliance beantworten.
- [ ] Content Rights beantworten.
- [ ] IDFA/Tracking beantworten.
- [ ] App Privacy final prüfen.
- [ ] Screenshots und Metadata final prüfen.
- [ ] Review Notes final prüfen.
- [ ] Backend/Demo-Modus für gesamte Review-Zeit aktiv halten.
- [ ] App zur Review einreichen.
- [ ] Bei Rejection: Resolution Center Antwort sachlich mit Guideline-Bezug formulieren und nötige Fixes umsetzen.

Exit-Kriterium: ScoutX ist submitted, approved oder mit klarer Rejection-Fixliste versehen.

## High-Risk Items To Resolve Early

- Guideline 4.2: Eine reine WebView/PWA-Verpackung kann abgelehnt werden. Native Integrationen und echte iOS-UX früh einplanen.
- Guideline 2.1: Ohne Demo-Modus oder aktives Backend wird Review wahrscheinlich blockiert.
- Guideline 5.1: Datenschutz muss vor Submission fertig sein, nicht nachgezogen werden.
- Guideline 3.1.1: Bezahlte digitale Features brauchen eine klare Apple-konforme Strategie.
- Guideline 5.2.2: Drittanbieter-Datenquellen und Vereins-/Liga-Daten müssen rechtlich belastbar sein.
- Secret-Risiko: Feste Tokens im Client sind für eine öffentliche App ungeeignet.
- Admin-Risiko: Admin-Funktionen dürfen im Release nicht offen oder missverständlich sichtbar sein.

## Suggested First Implementation Order

1. Release-Scope und Packaging-Ansatz entscheiden.
2. iOS-Projekt oder Capacitor-Shell anlegen.
3. ScoutX-Kernflow auf iOS lauffähig machen.
4. Demo-Modus und Produktions-Backend absichern.
5. Privacy/Legal-Artefakte fertigstellen.
6. Native iOS-Qualität und App Intents ergänzen.
7. TestFlight-Loop durchführen.
8. App Store Connect Submission vorbereiten.

## Review Notes Draft

ScoutX is a football scouting and match planning app. The reviewer can use the built-in demo mode to test the full flow without external credentials. Suggested review path: open ScoutX, select the demo setup, inspect available games, create a scouting plan, open the scout sheet, view the dashboard, and export the PDF/report through the iOS share sheet. The backend service is live during review; if network access is unavailable, demo data remains available for the core flow.

## App Intents First Pass

Use App Intents only for actions that are useful outside the full UI:

- `OpenScoutXDestinationIntent`: opens Setup, Games, Plan, Scout Sheet or Dashboard.
- `OpenNextScoutingGameIntent`: opens the next planned game, if available.
- `StartScoutSheetIntent`: opens the scout sheet for the active or selected game.

Keep the entity model intentionally small. Do not expose the full ScoutX data model to Shortcuts/Siri/Spotlight.
