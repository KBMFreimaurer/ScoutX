# ScoutX UI/UX Goal Completion Audit

Stand: 2026-05-07  
Quelle: `/Users/playboiiboggos/Desktop/scoutx_uiux_goal.md`

Update 2026-05-08:
- iOS-PDF-Export wurde von Data-URL-Share auf Datei-basierten Share-Flow umgestellt (`@capacitor/filesystem` + `file://`), damit "In Dateien sichern" und Notizen echte PDF-Dateien erhalten.
- iOS-Scrollbar-Indikatoren werden nativ im `AppDelegate` deaktiviert (zusätzlich zu CSS-Guards).
- iOS-App wurde nach den Änderungen erneut synchronisiert, gebaut, installiert und gestartet.

## 1) Objective als konkrete Deliverables

1. Mobile Planerstellung nutzt den Fussball.de-Adapter fachlich wie Web.
2. Fehlerfaelle sind robust abgefangen und fuer Nutzer verstaendlich.
3. End-to-End Planflow ist reproduzierbar grün.
4. Google API Key ist hardcoded in Web + iOS; keine manuelle Key-Eingabe/-Overrides.
5. iOS Wizard UX: persistente Weiter/Zurueck-Bar und direkter Ruecksprung via Schrittleiste.
6. Visual-Bug-Sweep inkl. Simulator und echtes iPhone ist dokumentiert.

## 2) Prompt-to-Artifact Checklist (Requirement -> Evidence)

| Requirement | Evidence | Status |
| --- | --- | --- |
| A) Web-vs-iOS Adapter-Aufruf analysieren und Abweichungen priorisieren | Root-Cause + Abweichungen dokumentiert in `docs/scoutx_uiux_goal_status.md` (Abschnitte 1, 2, 7). Adapter-Aufruf mit Endpoint-Kandidaten, Payload, Headern, Timeout, strict JSON handling in `src/services/dataProvider.js:856` ff. | Teilweise (Analyse dokumentiert, aber keine separate vollständige Gegenüberstellung aller Web-Referenzfälle) |
| B) Adapter-Integration Mobile angleichen | `src/services/dataProvider.js:856-980` (Payload/Response-Handling, 401/HTTP-Fehler, Timeout, Fallback-Endpoint-Kandidaten, strict JSON parse, ensureWeekData). | Erfuellt |
| C) Stabilität/UX im Flow (Lade-/Fehlerzustände, Inkonsistenz vermeiden) | Fehlernormalisierung `src/context/GamesContext.jsx`; Timeout/HTTP/JSON-Fehlerfälle in `src/app.integration.test.jsx`; Scroll-Tap-Guard in `src/hooks/useScrollTapGuard.js` + Selektoren. | Erfuellt |
| D) E2E Plan erstellen -> Adapter -> speichern/anzeigen | Integrationstest `src/app.integration.test.jsx` (Setup -> Games -> Plan, Adapter `/api/games`, Fehlerfälle). | Teilweise (automatisiert grün; reales iPhone E2E offen) |
| E) Google API Key hardcoded (iOS + Web), keine manuelle Hinterlegung | Web-Konstante `src/config/googleMaps.js`; Verwendung in `src/utils/geo.js`; iOS-Konstante in `ios/App/App/AppDelegate.swift`; Entfernt aus `.env.example`, `README.md`, `Dockerfile`, `docker-compose.yml`. | Erfuellt |
| F) Manuelle Key-Logik entfernen (UI/Settings/Env-Override/Storage) | Keine Runtime-Setter/LocalStorage-Key-Funktionen mehr in `src/utils/geo.js`; keine Key-Eingabe-UI in `src/pages/SetupPage.jsx`; keine `VITE_GOOGLE_MAPS_API_KEY`-Pfade im produktiven Code. | Erfuellt |
| G) Persistente Weiter-/Zurück-Buttons sichtbar ohne Scrollen | `setup-action-bar-mobile` und `setup-screen-mobile` in `src/styles/theme.js`; Runtime-Trigger in `src/pages/SetupPage.jsx`; Simulator-Sichtcheck dokumentiert in `docs/scoutx_uiux_goal_status.md`. | Erfuellt (Simulator), Real-Device noch offen |
| H) Direkter Ruecksprung auf fruehere Schritte via Schrittleiste | Klickbare Step-Chips mit `onJumpToStep` in `src/pages/SetupPage.jsx`; Test in `src/pages/SetupPage.test.jsx`. | Erfuellt |
| I) Visual-Bug-Audit iOS | Dokumentierte Fixes + Simulator-Screens in `docs/scoutx_uiux_goal_status.md`. | Teilweise (echtes iPhone fehlt) |
| J) Smoke-Tests Simulator + echtes iPhone | Simulator Build/Run via XcodeBuildMCP erfolgreich; reales iPhone noch nicht belegt. | Teilweise / Blockiert |
| K) iOS-PDF in Notizen/Dateien als echte Datei statt Link | `src/native/share.js` nutzt `Filesystem.writeFile` + `Share.share({ files, url:fileUri })`; Tests in `src/native/share.test.js`; iOS deployt | Erfuellt (technisch), visuelle User-Bestaetigung offen |

## 3) Verifizierte Commands und Ergebnisse (2026-05-07)

- `npm run lint` -> erfolgreich.
- `npm run test -- src/pages/SetupPage.test.jsx src/app.integration.test.jsx src/utils/geo.test.js` -> `3 passed`, `41 passed`.
- `npm run build` -> erfolgreich.
- `npm run ios:sync` -> erfolgreich.
- XcodeBuildMCP `build_sim` / `build_run_sim` fuer Scheme `App` -> erfolgreich.
- Zusatz: `xcodebuild -project ios/App/App.xcodeproj -scheme App -showdestinations` zeigt nur `Any iOS Device` Placeholder (kein konkretes angeschlossenes iPhone-Target).

## 4) Nicht durch Proxy-Signale gedeckte Restluecken

1. Echtes iPhone Smoke-Protokoll fehlt (Keyboard offen, CTA sichtbar, Step-Jump, Plan erstellen, Neustart-Verhalten).
2. Vollstaendige Web-vs-iOS Referenzfall-Matrix (mehrere identische Inputs mit explizitem Ergebnisvergleich) ist nicht separat artefaktiert.

Update 2026-05-07:
- Ein expliziter Paritaetstest wurde ergänzt (`src/services/dataProvider.test.js`):
  - identischer Adapter-Input in Web- und iOS-Runtime liefert gleiches fachliches Ergebnis.
  - Damit ist Punkt 2 teilweise geschlossen; offen bleibt nur die Real-Device-Verifikation.

Update 2026-05-08:
- Verifizierte Test-/Build-Läufe:
  - `npm run test -- src/native/share.test.js src/services/pdf/index.test.js src/styles/theme.test.js src/pages/SetupPage.test.jsx src/components/PDFExport.test.jsx` -> `5 passed`, `34 passed`.
  - `xcodebuild ... build` -> `BUILD SUCCEEDED`.
  - `xcrun devicectl device install app ...` + `launch ...` -> erfolgreich.

## 5) Abschlussbewertung

Der Goal-Umfang ist **noch nicht vollstaendig abgeschlossen**, weil mindestens ein expliziter DoD-Punkt weiterhin unbewiesen ist:

- Real-Device-Nachweis auf echtem iPhone.

Alle repo-intern umsetzbaren und verifizierbaren Punkte wurden nachgezogen; verbleibend ist ein externer Verifikationsblocker.
