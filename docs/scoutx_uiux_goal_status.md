# ScoutX UI/UX Stabilisierung - Statusprotokoll (iOS)

Stand: 2026-05-06
Quelle: `/Users/playboiiboggos/Desktop/scoutx_uiux_goal.md`

Ergaenzende Analyse:
- `docs/scoutx_web_ios_adapter_parity.md` (Web-vs-iOS Adapter-Paritaetsmatrix)

## 1) Root Cause je Bug

### Bug A/B: Scrollen waehlt Elemente versehentlich aus, CTA nicht immer stabil erreichbar
- Touch-Events auf Auswahlkarten wurden beim Scrollen als Tap interpretiert.
- Setup-Action-Bar war mobil nicht konsequent fixed/keyboard-aware.

### Bug C: iOS Zoom/Viewport Instabilitaet
- iOS WebView verhaelt sich bei Input-Focus/Viewport-Aenderungen empfindlich.
- Fehlende iOS-spezifische Viewport/Keyboard-Guards und Input-Zoom-Prävention.

### Bug D: Plan-Erstellung Fehler "The string did not match the expected pattern"
- Adapter-Antworten konnten in iOS-Faellen nicht robust als JSON verarbeitet werden.
- Relative Endpunkte (`/api/games`) sind in nativer Runtime fehleranfaelliger.

## 2) Umgesetzte Loesungen

### Scroll-Tap-Guard (gegen Vor-Auswahl beim Scrollen)
- Neuer Hook: `src/hooks/useScrollTapGuard.js`
- Aktiv in:
  - `src/components/StateSelector.jsx`
  - `src/components/KreisSelector.jsx`
  - `src/components/AgeGroupSelector.jsx`

### Setup-Persistenz in nativer Runtime deaktiviert
- In nativer Runtime wird Setup-Auswahl nicht aus `localStorage` geladen.
- Setup-Persistenz wird dort nicht geschrieben und aktiv entfernt.
- Datei: `src/context/SetupContext.jsx`

### iOS UX-Stabilisierung (CTA/Viewport/Zoom)
- Keyboard-/Viewport-Offset-Guard in `src/main.jsx`
- Mobile Setup-CTA-Bar fixed mit Safe-Area + Keyboard-Offset in `src/styles/theme.js`
- iOS Input-Font-Guard (`16px`) und Touch-Action-Anpassung in `src/styles/theme.js`

### Plan-Erstellung/Adapter robust gemacht
- iOS-native Endpoint-Kandidaten (localhost/127.0.0.1) bei `/api/games`
- Striktes JSON-Parsing mit klarer Fehlermeldung
- Datei: `src/services/dataProvider.js`
- UI-Fehlermeldung normalisiert in `src/context/GamesContext.jsx`

## 3) Testnachweise

### Lokal erfolgreich
- `npm run lint`
- `npm run test -- src/pages/SetupPage.test.jsx`
- `npm run test -- src/app.integration.test.jsx`
- `npm run test -- src/services/dataProvider.test.js`
- `npm run build`
- `npm run ios:sync`

### Simulator erfolgreich
- iOS Simulator Build/Run erfolgreich via XcodeBuildMCP (`build_sim`, `build_run_sim`).

## 4) Mapping zur Ziel-Checkliste

- [x] Wizard/Mehrschritt-Flow mit langem Inhalt getestet (automatisiert + Simulator-Sichtcheck)
- [~] Keyboard offen: CTA weiterhin erreichbar (technisch umgesetzt, reales iPhone noch offen)
- [~] Kalender mehrfach geoeffnet/bedient ohne Zoom-Haenger (Guards umgesetzt, reales iPhone noch offen)
- [x] Plan mit gueltigen Daten erstellt (Integration/Flow-Tests + Adapterpfad)
- [x] Plan mit fehlerhaften Daten liefert verstaendliches Feedback (Adapter-Error-Handling + Tests)
- [~] App-Neustart: erstellter Plan verfuegbar (Historie/Flow getestet, reales iPhone-Retest empfohlen)

## 5) Offene Restpunkte

- Reales iPhone Smoke-Protokoll final dokumentieren:
  1. Setup-Flow mit offenem Keyboard
  2. Kalender-Interaktion mehrfach (Zoom-Verhalten)
  3. Plan erstellen, App neu starten, Verfuegbarkeit pruefen

Bis diese drei Real-Device-Punkte bestaetigt sind, ist die Definition of Done aus der Desktop-Datei nicht vollstaendig abgehakt.

## 6) Update 2026-05-07: Google API Key Hardcoding abgeschlossen

Hinweis (2026-05-17): Dieser Stand ist superseded. Der Google-Maps-Key wird jetzt wieder ausschließlich über `VITE_GOOGLE_MAPS_API_KEY` injiziert; harte Schlüssel im Web-/iOS-Code wurden entfernt.

Umgesetzte Aenderungen:
- Zentrale Web-Konstante angelegt:
  - `src/config/googleMaps.js`
  - `GOOGLE_MAPS_API_KEY` (historisch als Code-Konstante geführt)
- `src/utils/geo.js` auf reine Code-Quelle umgestellt:
  - Entfernt: ENV-Key-Pfad (`VITE_GOOGLE_MAPS_API_KEY`)
  - Entfernt: Runtime-/localStorage-Key-Pfad (`scoutx.googlemaps.apikey.v1`)
  - Entfernt: Funktionen fuer manuelles Setzen/Loeschen des Runtime-Keys
  - `keySource` ist jetzt deterministisch `code`
- Setup-UI bereinigt:
  - Entfernt: manuelle Key-Eingabe inkl. Speichern/Loeschen-Buttons
  - Entfernt: Hinweise auf `.env`-Key-Hinterlegung fuer Google
  - Beibehalten: Routing-Status/Provider-Anzeige
- Native iOS-Konstante hinterlegt:
  - `ios/App/App/AppDelegate.swift`
  - `ScoutXSecrets.googleMapsApiKey` + Ablage in `UserDefaults` unter `SCOUTX_GOOGLE_MAPS_API_KEY` (historisch)
- Build-/Deploy-Pfade bereinigt:
  - `Dockerfile`: entfernt `VITE_GOOGLE_MAPS_API_KEY` Build-ARG/ENV
  - `docker-compose.yml`: entfernt `VITE_GOOGLE_MAPS_API_KEY` aus `environment`/`build.args`
- Doku/Beispielkonfig bereinigt:
  - `.env.example` und `README.md` enthalten keine manuelle Google-Key-Vorgabe mehr

Verifikation 2026-05-07:
- `npm run lint` ✅
- `npm run test -- src/utils/geo.test.js src/pages/SetupPage.test.jsx src/app.integration.test.jsx` ✅
- `npm run build` ✅
- `npm run ios:sync` ✅
- iOS Simulator Compile (`App`-Scheme) via XcodeBuildMCP `build_sim` ✅

## 7) Update 2026-05-07: Wizard-Navigation iOS nachgezogen

Zusatzfixes fuer Zielpunkt "Navigation ohne Scrollen/Swipen":
- Persistente Setup-CTA-Bar fuer native iOS-Runtime abgesichert:
  - Klassen `setup-screen-mobile` / `setup-action-bar-mobile`
  - Keyboard-/Safe-Area-/Bottom-Tab-Offset beruecksichtigt
  - Fix fuer CSS-Containing-Block-Effekt durch animiertes Parent (`fu`) im Setup-Screen
- Schrittleiste im Setup-Wizard klickbar gemacht:
  - Ruecksprung auf fruehere Schritte per Tap direkt moeglich
  - Implementiert in `src/pages/SetupPage.jsx`
  - Abgesichert in `src/pages/SetupPage.test.jsx`

Verifikation:
- `npm run test -- src/pages/SetupPage.test.jsx src/app.integration.test.jsx src/utils/geo.test.js` ✅
- iOS Simulator Sichtcheck:
  - Setup-CTA-Bar bleibt beim Scrollen sichtbar
  - Ruecksprung ueber obere Schrittleiste funktioniert

## 8) Update 2026-05-07: Web-vs-iOS Paritaetstest erweitert

- Neuer Test in `src/services/dataProvider.test.js`:
  - identischer Adapter-Input in Web-Runtime und iOS-Capacitor-Runtime
  - Erwartung: identisches fachliches Ergebnis (normalisierte Spieleliste)
- Verifikation:
  - `npm run test -- src/services/dataProvider.test.js src/pages/SetupPage.test.jsx src/app.integration.test.jsx src/utils/geo.test.js` ✅ (`66 passed`)

Real-Device-Blocker-Check:
- `xcodebuild -project ios/App/App.xcodeproj -scheme App -showdestinations` zeigt nur `Any iOS Device` Placeholder, kein angeschlossenes konkretes iPhone-Target.
