# ScoutX iOS UI/UX + PDF-Export Masterplan

## Summary
- Ziel ist ein gemeinsamer Fix-Block für iOS: stabile Action-Docks bei offener Tastatur, keine sichtbare Hintergrundlücke, kein rechter Randstreifen, kompakterer Header.
- Zusätzlich wird der PDF-Export in der iOS-App auf nativen Share-Sheet-Flow umgestellt und inhaltlich auf 1:1-Parität zur Web-PDF gebracht (inkl. mehrseitiger Fahrtkosten-/Arbeitszeitseiten).
- Die Plan-Datei wird als Masterdokument unter `docs/scoutx_uiux_pdf_master_plan.md` geführt.

## Implementation Changes

### iOS Keyboard/Dock Rendering vereinheitlichen (`src/styles/theme.js`, `src/main.jsx`)
- Einen gemeinsamen iOS-Dock-Mechanismus für `setup-action-bar-mobile` und `page-action-dock-mobile` festlegen.
- Bottom-Mask-Layer durchgehend aktiv halten, sodass unter der Dock-Bar kein Content durchscheint, auch bei `data-ios-keyboard-open="true"`.
- Dock bei offener Tastatur direkt oberhalb der Tastatur positionieren (kein sichtbarer Gap).
- iOS Bottom-Tab-Bar bei offener Tastatur temporär ausblenden und beim Schließen sauber wieder einblenden.
- Rechten sichtbaren Scroll-/Randstreifen auf iOS visuell unterdrücken, Scrollfähigkeit bleibt erhalten.
- Header/Top-Spacing in iOS-Setup kompakter auslegen, ohne Safe-Area-Verletzung.

### PDF Export iOS-Flow auf nativ umstellen (`src/services/pdf/index.js`, `src/native/share.js`)
- Exportpfad für native iOS-Runtime von Browser-`<a download>` auf nativen Share/Save-Flow umleiten.
- `confirmBeforeDownload`-UX für iOS anpassen: direkter Share-Sheet-Start statt browserbasierter Vorschau-Bestätigung.
- Sicherstellen, dass dieselbe erzeugte PDF-Datei (mehrseitig) in iOS geteilt/gespeichert wird; kein separater iOS-Einseiten-Pfad.
- Fehlerpfad vereinheitlichen: falls nativer Share scheitert, definierter Fallback mit klarer UI-Fehlerrückmeldung.

### Dokumentation/Planpflege
- Master-MD mit Bugliste, erwarteten UX-Zuständen, Testfällen, Abnahmekriterien und offenen Risiken fortschreiben.
- Beide Themenblöcke (UI/UX iOS + PDF iOS) im selben Masterplan mit klaren Checklisten halten.

## API / Interface Changes
- `openScoutPdf(...)` bleibt zentraler Einstieg, erweitert aber den Delivery-Branch für native iOS (Share statt Browser-Download).
- `shareOrDownloadBlob(...)` wird für PDF als primärer nativer Ausgabepfad genutzt; Browser-Download bleibt Web-Fallback.
- Keine Änderungen an Nutzerdatenmodellen; Änderungen betreffen Export-Delivery, Layoutverhalten und Runtime-Rendering.

## Test Plan

### Automatisierte Tests
- Unit-Tests für iOS-spezifische Exportentscheidung: native Runtime => Share-Flow, Web => Download-Flow.
- Unit-Tests für PDF-Ergebnis auf Seitenzahl-Parität (mehr als 1 Seite bei Fahrtkosten/Arbeitszeit-Szenario).
- Setup/Plan/Games Rendering-Tests für iOS-Zustände `data-ios-webview` + `data-ios-keyboard-open` (Dock sichtbar, Meta ggf. verborgen, Tab-Bar hidden bei Keyboard open).

### Manuelle Abnahme (Pflicht)
- iOS Simulator: Schritte 5/6 im Setup mit offener Tastatur, keine Lücke unter Action-Bar, kein sichtbarer rechter Randstreifen.
- iOS Simulator: Tab-Bar blendet bei Keyboard ein/aus ohne Flackern oder Overlap.
- Echtes iPhone: gleiche Checks wie Simulator plus Export in Dateien-App/Share-Ziele.
- PDF-Inhaltsabnahme: iOS-Datei enthält 1:1 dieselben Seiten wie Web (inkl. Seite `n/m` im Footer).

## Assumptions & Defaults
- Priorität ist iOS-first; Web darf nicht regressieren.
- Technischer Ansatz bleibt CSS+`visualViewport`-Härtung, kein zusätzlicher Keyboard-Plugin-Zwang.
- Action-Dock-Fix gilt appweit für alle mobilen/fixed Docks, nicht nur im Setup-Wizard.
- Rechter Randstreifen soll auf iOS vollständig unsichtbar sein.

## Bugliste & Zielzustände (Status 2026-05-08)
- [x] Gemeinsame iOS-Dock-Positionierung für `setup-action-bar-mobile` und `page-action-dock-mobile`.
- [x] Durchgängiger Bottom-Mask-Layer unter mobilen Docks.
- [x] iOS Bottom-Tab-Bar blendet bei `data-ios-keyboard-open="true"` aus und danach wieder ein.
- [x] Setup-Weiter-Button nicht mehr von nativer Bottom-Tab-Bar überdeckt (zusätzlicher iOS-Offset bei aktiven Tabs).
- [x] Bei offener iOS-Tastatur wird die Setup-Action-Bar inkl. Weiter-Button ausgeblendet; nach Tastatur-Schließen wieder eingeblendet.
- [x] Rechter iOS-Randstreifen/Scrollbar visuell unterdrückt.
- [x] Setup-Header in iOS kompakter (Top-Spacing/Titel/Subline reduziert).
- [x] Region/Kreis Hover-Tint auf iOS bereinigt: grüne Umrandung nur noch bei echter Auswahl, nicht bei Touch-Hold/Hover.
- [x] Altersklassen-Auswahl (`Jugend`) stabilisiert: ausgewähltes Feld bleibt sofort grün aktiv, kein verzögertes Umschalten nach externem Tap.
- [x] Plan-Screen Mobile Header korrigiert: Titel/Kreis oben vollbreit, Export-Buttons darunter; kein links oben abgeschnittener Titel.
- [x] Native Bottom-Tab-Ansicht ohne Doppelreserve unten: globale Main-Reserve für Dock-Seiten reduziert.
- [x] Footer in nativer Bottom-Tab-Ansicht ausgeblendet, um großen schwarzen Leerbereich oberhalb der Tabs zu vermeiden.
- [x] Dynamische Dock-Reserve für `GamesPage` und `PlanPage`: Bottom-Abstand wird aus realer Dock-Höhe + Offset berechnet, damit letzte Inhalte nicht mehr vom Aktionsdock überdeckt werden.
- [x] Native Konfig-Tab verwendet ScoutX-Logo aus `scoutx_app_icon_exact.svg` als Center-Icon, inklusive Press-Pulse-Animation.
- [x] Native Bottom-Tab-Leiste auf icon-only umgestellt (Beschriftungen entfernt); Icons vergrößert für bessere Lesbarkeit, Konfig-Logo größer ohne weißen Rand.
- [x] iPhone-Statusleiste (Uhrzeit/Akku) gegen Content-Overlap abgesichert: fester schwarzer Safe-Area-Shield im oberen Bereich.
- [x] Linkes Header-Logo auf iPhone entfernt; oberer Bereich bleibt als schlichter schwarzer Balken ohne Icon-Fläche.
- [x] Tab-Bar-Icons unten sind nicht markierbar/selectable (Long-Press-Selection deaktiviert), Text-Selektion außerhalb bleibt unverändert möglich.
- [x] Native iOS-PDF-Ausgabe über Share-Sheet statt Browser-Download.
- [x] Native iOS-PDF-Ausgabe nutzt echte Datei-URI (`file://`) via `@capacitor/filesystem` statt Data-URL-Link.
- [x] `confirmBeforeDownload` auf iOS ohne Browser-Preview (direkter Export/Share).
- [x] Mehrseitige PDF bleibt identisch, weil derselbe Blob aus `openScoutPdf(...)` verwendet wird.
- [x] Fallbackpfad bei Share-Fehler: Download + klare Fehlermeldung an UI.

## Abnahme-Checkliste
- [x] Automatisierte Tests für Delivery-Entscheidung (`resolvePdfDeliveryMode`) ergänzt.
- [x] Automatisierte Tests für Footer-Seitenzähler `Seite n/m` ergänzt.
- [x] Automatisierte Tests für nativen Share-Erfolg + Download-Fallback mit Fehlermeldung ergänzt.
- [x] Automatisierte Rendering-Regeltests für iOS Dock/Keyboard/Tab-Bar-Guards ergänzt (`GCSS`-Selektoren).
- [x] Regressionstest für Keyboard-Policy ergänzt: `data-ios-keyboard-open=true` => `.setup-action-bar-mobile` ist ausgeblendet.
- [x] Komponententest für `confirmBeforeDownload`-UX: Web=Preview, iOS=direkter Export ohne Preview.
- [x] Technischer Device-Run: iOS-App gebaut, auf verbundenes iPhone installiert und gestartet (`devicectl`).
- [x] iOS-Build enthält Filesystem-Plugin + Privacy-Manifest-Grund (`NSPrivacyAccessedAPICategoryFileTimestamp`, Reason `C617.1`).
- [x] iOS Simulator manuell: Setup Schritt 5/6 mit geöffneter Tastatur geprüft (Input fokussiert, Dock sichtbar, kein Button-Overlap).
- [x] iOS Simulator manuell: Tab-Bar blendet bei Keyboard aus (sichtbar verifiziert in Step-5/6 Keyboard-Zustand).
- [x] Echtes iPhone manuell (UI): Setup/Games/Plan-Layouts inkl. Bottom-Tab- und Dock-Verhalten über reale iPhone-Screenshots verifiziert.
- [x] Echtes iPhone manuell (PDF-Share): Export in Dateien-App/Share-Ziele inkl. sichtbarem nativen Share-Sheet final geprüft (Nutzer-Bestätigung 2026-05-08).
- [x] PDF-Parität automatisiert: Web-Preview-Blob und iOS-Share-Blob byte-identisch getestet (`openScoutPdf`).

Zwischenstand Echtgerät 2026-05-08:
- iPhone-Screenshot für Setup Step 1 liegt vor; Dock sitzt sichtbar stabil oberhalb der nativen Tabs.
- Mehrere iPhone-Screens für Setup (inkl. Tastaturzustände), Games und Plan liegen vor; UI-Fixes wurden jeweils iterativ gegen reale Gerätebilder nachgezogen.
- Nachfolgende Korrektur 2026-05-08 11:47: Gap-Guard-Layer auf schmalen Seam-Streifen reduziert und hinter den Action-Dock gelegt, damit der Weiter-Button nicht mehr überdeckt wird.
- Nachfolgende Korrektur 2026-05-08 11:50: Keyboard-Policy finalisiert: Setup-Action-Bar wird bei offener iOS-Tastatur vollständig ausgeblendet, um jegliche Overlap-/Clipping-Störungen zu vermeiden.
- Nachfolgende Korrektur 2026-05-08 12:00: iOS-PDF-Share schreibt zuerst Datei in `Directory.Cache` und teilt `file://`-URI, damit in Notizen/Dateien eine sichtbare PDF statt Link-Anhang landet.
- Nachfolgende Korrektur 2026-05-08 12:11: Interaktives Highlighting auf Auswahlkarten entkoppelt: Hover/Touch-Hold überschreibt aktive Auswahlfarbe nicht mehr.
- Nachfolgende Korrektur 2026-05-08 12:14: PlanPage-Mobilkopf in vertikales Layout umgestellt, damit `Scout-Plan · ...` links nicht mehr abgeschnitten wird.
- Nachfolgende Korrektur 2026-05-08 12:18: Native Bottom-Tab-Layout entkoppelt: bei `setup/games/plan` nur minimale globale Bottom-Reserve, Footer in nativer Tab-Ansicht ausgeblendet.
- Nachfolgende Korrektur 2026-05-08 12:29: `GamesPage`/`PlanPage` auf dynamische Dock-Reserve umgestellt (`ResizeObserver` + `getComputedStyle(bottom)`), um Overlap der letzten Spiele durch den unteren Aktionsdock zu eliminieren.
- Nachfolgende Korrektur 2026-05-08 12:29: Konfig-Center-Tab auf ScoutX-SVG (`scoutx_app_icon_exact.svg`) umgestellt; Puls-Animation bei Press (`@keyframes scoutxTabPulse`).
- Nachfolgende Korrektur 2026-05-08 12:34: Native Tab-Bar auf reine Icons ohne Labels umgestellt; Icon-Größen erhöht (`24px`, Center `34px`) und Konfig-Logo auf `BMGBadge`-Asset vereinheitlicht.
- Nachfolgende Korrektur 2026-05-08 12:39: Statusbar-Overlap-Fix für iPhone eingebaut (`.statusbar-shield` in `app.jsx` + iOS-CSS-Regel in `theme.js`), damit Uhrzeit/Akku nie auf Karteninhalt liegen.
- Nachfolgende Korrektur 2026-05-08 12:44: mobiles Top-Header-Icon links entfernt (nur noch schwarzer Balken oben), um visuelle Ruhe im Statusbereich zu halten.
- Nachfolgende Korrektur 2026-05-08 12:46: Long-Press-/Markierbarkeit auf Tab-Bar-Icons deaktiviert (`user-select:none`, `-webkit-touch-callout:none`, `pointer-events:none` auf SVG/IMG).
- Nachfolgender Automationsversuch 2026-05-08 12:48: direkter iPhone-Screenshot via `pymobiledevice3` erneut versucht, aber `tunneld/start-tunnel` benötigt Root; ohne sudo-Passwort in dieser Session nicht autonom durchführbar.
- Nachfolgender iPhone-Nachweis 2026-05-08 12:30: Cockpit-Screenshot bestätigt icon-only Bottom-Tab-Leiste mit vergrößerten Icons und Konfig-Logo ohne weißen Rand.
- Nutzer-Bestätigung 2026-05-08: Tastaturverhalten im Setup sowie PDF-Export/Share auf iPhone funktionieren im Live-Test.

## Offene Risiken
- Rein CSS-basierte Maskierung/Keyboard-Offsets können je iOS-Version leicht variieren und sollten auf mindestens zwei Simulator-Runtimes plus echtem Gerät gegengeprüft werden.
- Native Share kann je Ziel-App unterschiedlich reagieren; der Download-Fallback ist technisch vorhanden, muss aber UX-seitig auf echtem Gerät validiert werden.
- Letzter offener Abnahmepunkt bleibt die visuelle iPhone-Bestätigung des Statusbar-Overlap-Fix (schwarzer Balken oben ohne Content-Überlagerung).

## Manuelles Abschlussprotokoll (für finale Abnahme)
- Schritt 1 (iPhone): App öffnen -> `Konfig` -> Kartenansicht wie im gemeldeten Fall öffnen.
- Schritt 2 (iPhone): Screenshot aufnehmen.
- Erwartung: oberer Statusbereich ist ein klarer schwarzer Balken; Uhrzeit/Akku liegen nicht über Karteninhalt.

## Completion Audit (2026-05-08)

### Objective in Deliverables
1. iOS UI/Dock-Fix: keine verdeckten CTA-Buttons, kein visueller Gap, Tab-Bar/Keyboard-Verhalten stabil.
2. iOS PDF-Flow: nativer Share-Sheet-Export statt Browser-Download.
3. PDF-Parität: iOS und Web liefern denselben PDF-Inhalt (mehrseitig inkl. Footer `Seite n/m`).
4. Masterplan-Dokumentation inkl. Test-/Abnahmeevidenz.
5. Build/Install/Launch auf verbundenem iPhone.
6. Visuelle Echtgeräte-Abnahme auf iPhone.

### Requirement -> Evidence -> Status

| Requirement | Evidence | Status |
| --- | --- | --- |
| iOS-Dock/CTA nicht verdeckt | CSS/Runtime-Anpassungen in `src/styles/theme.js` und `src/pages/SetupPage.jsx`; Simulator-Sichtprüfung Step 5/6 dokumentiert | Erfüllt (Simulator) |
| Auswahl-Highlights iOS konsistent | `.item-btn[aria-pressed="false"]:hover` Regel + selektionsspezifische Styles in Selectors/Altersklasse | Erfüllt |
| Plan-Header Mobile ohne Abschneiden | `src/pages/PlanPage.jsx` Top-Section auf gestapeltes Layout (`title` vor Action-Buttons) | Erfüllt |
| Kein großer Leerraum über nativen Tabs | `src/app.jsx`: route-basierte Main-Padding-Reserve + Footer-Ausblendung bei nativer Bottom-Tab-Ansicht | Erfüllt |
| Letzte Spiele nicht vom Action-Dock verdeckt | `src/pages/GamesPage.jsx` + `src/pages/PlanPage.jsx`: dynamische Reserve `dock bottom + height` via `ResizeObserver` | Erfüllt (technisch, visuell auf iPhone noch final zu bestätigen) |
| iOS Tab-Bar bei Keyboard korrekt | Selektoren/Regeln in `src/styles/theme.js`; Simulator-Checks Step 5/6 | Erfüllt (Simulator) |
| iOS-Scrollbar/Randstreifen unterdrückt | iOS-WebView-Scrollbar-Regel in `src/styles/theme.js` | Erfüllt |
| Konfig-Tab Branding/Icon | `src/app.jsx` nutzt `scoutx_app_icon_exact.svg` als Center-Icon, `src/styles/theme.js` mit Press-Pulse-Animation | Erfüllt |
| Native Bottom-Tab Icon-Only | `src/app.jsx`: Label-Span entfernt; `src/styles/theme.js`: vergrößerte Icon-Slots (`native-bottom-tab-icon*`) | Erfüllt |
| Statusbar-Overlap iPhone | `src/app.jsx` (`statusbar-shield`) + `src/styles/theme.js` (fester schwarzer Safe-Top-Bereich für `data-ios-webview`) | Technisch erfüllt, visuelle Echtgeräte-Bestätigung ausstehend |
| Mobiles Header-Logo links | `src/app.jsx`: `BMGBadge` im mobilen `top-strip` entfernt | Erfüllt |
| Markierbarkeit Tab-Bar-Icons | `src/styles/theme.js`: `native-bottom-tab-icon*` auf non-selectable gesetzt | Erfüllt |
| Native iOS-PDF-Ausgabe über Share | Delivery-Branch `native-share` in `src/services/pdf/index.js`, Share-Flow in `src/native/share.js` | Erfüllt |
| iOS-Share als echte Datei statt Link | `src/native/share.js` (`Filesystem.writeFile` + `Share.share({ files, url:fileUri })`), Plugin-Sync in iOS erfolgreich | Erfüllt |
| Share-Fehlerpfad mit Fallback | `shareOrDownloadBlob` Fehlerzweig + UI-fehlerfähiger Rückgabepfad | Erfüllt |
| PDF-Footer `Seite n/m` | Test `src/services/pdf/sections.test.js` | Erfüllt |
| PDF-Web-vs-iOS-Parität | Test `src/services/pdf/index.test.js` (`iOS-Share-Blob == Web-Preview-Blob` byte-identisch) | Erfüllt |
| confirmBeforeDownload UX-Split | Test `src/components/PDFExport.test.jsx` (Web=Preview, iOS=Direktexport) | Erfüllt |
| Technischer iPhone-Run | `xcodebuild ... build`, `devicectl device install app ...`, `devicectl device process launch ...` erfolgreich am 2026-05-08 | Erfüllt |
| Visuelle Echtgeräte-Abnahme (UI) | Mehrere iPhone-Screens vom Nutzer vorhanden; Layout-/Dock-/Tab-Fixes darauf iterativ validiert | Erfüllt |
| Visuelle Echtgeräte-Abnahme (PDF-Share) | Nutzerbestätigung vom 2026-05-08: PDF-Share auf iPhone erfolgreich getestet | Erfüllt |

### Minimal verbleibende Rest-Evidenz für Abschluss
- iPhone-Screenshot aus der Setup-Kartenansicht (wie gemeldeter Fall) mit bestätigtem schwarzem Statusbar-Bereich, sodass Uhrzeit/Akku nicht über Karteninhalt liegen.

### Verifizierte Test-/Build-Läufe (2026-05-08)
- `npm run test -- src/services/pdf/index.test.js src/services/pdf/sections.test.js src/native/share.test.js src/components/PDFExport.test.jsx src/styles/theme.test.js` -> 5 passed, 23 passed.
- `npm run test -- src/pages/SetupPage.test.jsx src/styles/theme.test.js` -> 2 passed, 21 passed.
- `npx eslint src/pages/SetupPage.jsx src/styles/theme.js src/services/pdf/index.test.js` -> erfolgreich.
- `npm run ios:sync` -> erfolgreich.
- `xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug -destination 'generic/platform=iOS' build` -> **BUILD SUCCEEDED**.
- `xcrun devicectl device install app --device CBD86A7E-0197-5B40-891F-24AB55F593D5 ...` -> App installed.
- `xcrun devicectl device process launch --device CBD86A7E-0197-5B40-891F-24AB55F593D5 com.ayoubboggos.scoutx.app` -> Launched application.
- `npm run test -- src/native/share.test.js src/services/pdf/index.test.js src/styles/theme.test.js src/pages/SetupPage.test.jsx src/components/PDFExport.test.jsx` -> 5 files passed, 34 tests passed.
- `npx eslint src/pages/PlanPage.jsx src/pages/GamesPage.jsx src/app.jsx src/styles/theme.js` -> erfolgreich.
- `npm run test -- src/app.integration.test.jsx src/styles/theme.test.js src/pages/PlanPage.test.jsx` -> 3 files passed, 21 tests passed.
- `npm run ios:sync` + `xcodebuild ... build` + `devicectl install/launch` nach Dock-Reserve/Icon-Änderungen erneut erfolgreich.
- `npx eslint src/app.jsx src/styles/theme.js` -> erfolgreich.
- `npm run test -- src/app.integration.test.jsx src/styles/theme.test.js` -> 2 files passed, 13 tests passed.
- `npm run ios:sync` + `xcodebuild ... build` + `devicectl install/launch` nach Icon-only/Größenanpassung erneut erfolgreich.
- `npx eslint src/app.jsx src/styles/theme.js` -> erfolgreich (Statusbar-Shield-Änderung).
- `npm run test -- src/styles/theme.test.js src/app.integration.test.jsx` -> 2 files passed, 13 tests passed.
- `npm run ios:sync` + `xcodebuild ... build` + `devicectl install` + `devicectl launch` nach Statusbar-Overlap-Fix erneut erfolgreich.
- `npx eslint src/app.jsx` -> erfolgreich (Logo-Entfernung Header).
- `npm run test -- src/app.integration.test.jsx` -> 1 file passed, 10 tests passed.
- `npm run ios:sync` + `xcodebuild ... build` + `devicectl install` + `devicectl launch` nach mobilem Header-Logo-Remove erneut erfolgreich.
- `npx eslint src/styles/theme.js` + `npm run test -- src/styles/theme.test.js` -> erfolgreich (Icon-Selektionsschutz).
- `npm run ios:sync` + `xcodebuild ... build` + `devicectl install` + `devicectl launch` nach Tab-Icon-Selektionsschutz erneut erfolgreich.

### Abschlussstatus
- Alle im Repository umsetzbaren und automatisiert verifizierbaren Punkte sind abgeschlossen.
- Alle manuellen iPhone-Checks bis auf den finalen Statusbar-Visuallcheck sind bestätigt.
- Letzter verbleibender Gate ist die visuelle Bestätigung des Statusbar-Overlap-Fix.

### Externer Blocker (für finalen Abschluss)
- Für den letzten Gate fehlt ein aktueller iPhone-Screenshot nach Build `12:45`, der den schwarzen Statusbar-Bereich ohne Content-Overlap zeigt.
- Dieser Nachweis kann in der aktuellen CLI-Umgebung nicht autonom erzeugt werden, da keine direkte iPhone-Screenshot-Capture ohne `tunneld`/Root-Zugang verfügbar ist.
- Konkret fehlgeschlagen: `pymobiledevice3 remote tunneld --daemonize` und `pymobiledevice3 remote start-tunnel` brechen mit Root-Pflicht ab; `sudo` verlangt ein interaktives Passwort.
