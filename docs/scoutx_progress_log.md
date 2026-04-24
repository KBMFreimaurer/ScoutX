# ScoutX Progress Log

## 2026-04-23 - Audit und MVP-Fundament gestartet

### Umgesetzte Arbeit

- Codebasis strukturell analysiert: React/Vite-SPA, Context-State, Adapter-Service, lokale Persistenz, Tests, Routing, UI-Schicht.
- Baseline-Lint gestartet und sauber abgeschlossen.
- Baseline-Testlauf initial mit falscher Jest-Option blockiert; erneuter Vitest-Lauf gestartet.
- Audit-, Gap-, Zielarchitektur- und Implementierungsplan-Dokumente angelegt.

### Geänderte Dateien

- `docs/scoutx_feature_expansion_audit.md`
- `docs/scoutx_gap_analysis.md`
- `docs/scoutx_target_architecture.md`
- `docs/scoutx_implementation_plan.md`
- `docs/scoutx_progress_log.md`

### Technische Entscheidungen

- Kein Komplettumbau der bestehenden Planungs-App.
- Neue MVP-Domain wird additiv, zentral validiert und lokal persistiert.
- Rollen/Sichtbarkeit werden zentral als Produktregel implementiert und später API-fähig gehalten.
- KI-Auswertung wird im MVP deterministisch und nicht-destruktiv implementiert, damit UX und Datenmodell sofort testbar sind.

### Offene Punkte

- Product-Domain-Service und Context implementieren.
- Hub-Route ergänzen.
- Domain-Tests schreiben.
- Lint/Test/Build nach Implementierung erneut ausführen.

### Nächste konkrete Schritte

1. `src/services/scoutxDomain.js` erstellen.
2. `src/context/ScoutXProductContext.jsx` erstellen.
3. `src/pages/ScoutingHubPage.jsx` erstellen und Route/Navi integrieren.
4. Tests für Domainlogik ergänzen.

## 2026-04-23 - MVP-Produktdomain und Scouting-Hub implementiert

### Umgesetzte Arbeit

- Zentrale Product-Domain in `src/services/scoutxDomain.js` implementiert:
  - Rollen: Admin, Koordinator, Scout, Gast.
  - Sichtbarkeit: privat, team, geteilt.
  - Reports mit Typen, Status, Ratings, Sections, Versionen und nicht-destruktiver AI-Analyse.
  - Watchlists mit Einträgen, Priorität, Labels, Status und Notizen.
  - Assignments mit Status, Fälligkeit, Assignee und Links zu Reports/Games.
  - Notifications als generische In-App-Grundlage.
  - Globale Suche über Reports, Watchlists, Assignments, PlayerSheets, Games und PlanHistory.
  - Dashboard-Aggregation für offene Aufgaben, fällige Aufgaben, ungelesene Meldungen und Prioritätsspieler.
- React Product Context mit lokaler Persistenz unter `scoutx.product.v1` ergänzt.
- Neue Route `/hub` als echte Startansicht implementiert und Root-Fallback darauf umgestellt.
- Desktop-Rail und mobile Zusatznavigation um "Cockpit" erweitert.
- Scouting-Hub-UI implementiert:
  - Rollenwechsel.
  - Kennzahlen.
  - globale Suche mit Typ-/Statusfiltern.
  - Report-Erfassung mit strukturierten Feldern und Ratings.
  - KI-Assist mit Loading/Error/Retry-Grundlage.
  - Watchlist-Erstellung und Spieleraufnahme.
  - Aufgaben-/Kalender-Grundlage.
  - Benachrichtigungen mit gelesen-Status.
- Regressionstest für Root-Start auf Scouting-Cockpit ergänzt.

### Geänderte Dateien

- `src/services/scoutxDomain.js`
- `src/services/scoutxDomain.test.js`
- `src/context/ScoutXProductContext.jsx`
- `src/pages/ScoutingHubPage.jsx`
- `src/app.jsx`
- `src/app.integration.test.jsx`
- `src/config/storage.js`
- `eslint.config.js`
- `docs/scoutx_progress_log.md`

### Technische Entscheidungen

- Die neue Produktdomain ist bewusst lokal-persistent, aber API-fähig modelliert: normalisierte Objekte, Versionierung und zentrale Permission-Regeln.
- Die KI-Auswertung ist im MVP lokal deterministisch, damit keine Secrets oder externen Provider in die SPA eingebaut werden.
- `/hub` ist jetzt Startpunkt, während Setup/Games/Plan unverändert als spezialisierter Spielplan-/PDF-Flow erhalten bleiben.
- Gastzugriff bleibt schreibgeschützt; Schreibfehler werden im Hub als Produktfehler angezeigt statt die App zu crashen.

### Validierung

- `npm run lint`: bestanden.
- `npm run test`: bestanden, 32 Testdateien / 177 Tests.
- `npm run build`: bestanden.

### Offene Punkte

- Keine echte serverseitige Authentifizierung oder Multiuser-Persistenz; Rollen/Sichtbarkeit sind MVP-Produktlogik im Client.
- Vergleichsansichten und echte externe KI-Anbindung sind vorbereitet, aber noch nicht umgesetzt.

### Nächste konkrete Schritte

1. Report-Detailbearbeitung und Watchlist-Entry-Statusupdates vertiefen.
2. Export der neuen Produktdomain als JSON/CSV ergänzen.
3. Echte serverseitige Authentifizierung/API-Persistenz planen.

## 2026-04-23 - Persistenz- und Auth-Fundament bereinigt

### Umgesetzte Arbeit

- `SetupContext` stellt persistierte Setup-Wizard-Daten wieder her statt sie beim Start zu löschen.
- Setup-Persistenz speichert Kreis, Jugend, Teams, Zeitraum, Unterstufen, Startort und Favoriten versioniert unter bestehendem Key.
- Frontend nutzt keinen eingebauten Adapter-Token mehr; `VITE_ADAPTER_TOKEN` bleibt optional.
- Adapter-Service aktiviert Auth nur noch, wenn `ADAPTER_TOKEN` gesetzt ist.
- Setup-Regressionstest an das dokumentierte Persistenzverhalten angepasst.

### Geänderte Dateien

- `src/context/SetupContext.jsx`
- `src/pages/SetupPage.test.jsx`
- `adapter-service/server.mjs`
- `docs/scoutx_progress_log.md`

### Technische Entscheidungen

- Lokale Setup-Persistenz ist für Mobile-Nutzung und echte Feldarbeit wichtiger als ein immer leer startender Wizard.
- Adapter-Auth ohne gesetztes Secret bleibt deaktiviert; damit gibt es keinen impliziten Projekt-Shared-Secret mehr im Code.

### Validierung

- Gezielte Tests: `src/pages/SetupPage.test.jsx`, `src/services/scoutxDomain.test.js`, `src/app.integration.test.jsx` bestanden.
- `npm run lint`: bestanden.
- `npm run test`: bestanden, 32 Testdateien / 177 Tests.
- `npm run build`: bestanden.
- Dev-Server erreichbar: `http://127.0.0.1:5173/hub`.

### Offene Punkte

- Rollen/Sichtbarkeit sind im MVP zentral und konsistent, aber noch keine echte Security-Grenze ohne Backend-Auth.
- Externe KI-Anbindung, Vergleichsansichten und Produktdomain-Export bleiben nächste Ausbauschritte.

## 2026-04-24 - Funktionale Cockpit-Erweiterung vor UX-Pass

### Umgesetzte Arbeit

- Report-Workflow erweitert:
  - Statuswechsel für Entwurf, Review, Geteilt und Archiv.
  - Review-Kommentare mit Autor, Zeitstempel und Notification.
  - Versionierung bleibt bei Status-/Report-Änderungen erhalten.
- Watchlist-Workflow erweitert:
  - Einträge können direkt priorisiert werden.
  - Eintragsstatus kann geändert werden.
  - Einträge können entfernt werden.
- Suche erweitert:
  - Such-/Filterkombinationen können als Saved Filter gespeichert, angewendet und gelöscht werden.
- Spielerprofile ergänzt:
  - Profile werden aus PlayerSheets, Reports, Watchlists und Assignments aggregiert.
  - Kennzahlen: Rating, Reportanzahl, Shortlistanzahl, Aufgabenanzahl, Priorität.
  - Spieler-zu-Spieler-Vergleich mit Metriken.
- Kalender-/Planungsgrundlage erweitert:
  - Aufgaben werden nach Fälligkeit gruppiert.
  - Offene Aufgaben je Datum werden sichtbar.
- Export ergänzt:
  - Sichtbarkeitsgerechter JSON-Export der Product-Domain inklusive Reports, Watchlists, Assignments, Notifications, Saved Filters, Spielerprofilen, Games und PlanHistory.

### Geänderte Dateien

- `src/services/scoutxDomain.js`
- `src/services/scoutxDomain.test.js`
- `src/context/ScoutXProductContext.jsx`
- `src/pages/ScoutingHubPage.jsx`
- `docs/scoutx_progress_log.md`

### Technische Entscheidungen

- Die funktionalen Erweiterungen bleiben bewusst im bestehenden Cockpit-Layout. Der angekündigte UX-Pass kommt danach, damit visuelle Struktur nicht vor fachlicher Tiefe optimiert wird.
- Spielerprofile sind aggregierte Views statt neue doppelte Persistenzobjekte. Dadurch bleiben Reports, Watchlists und PlayerSheets die Quellen der Wahrheit.
- Export respektiert die aktuell aktive Rolle/Sichtbarkeit.

### Validierung

- Gezielte Tests für Domain und App-Start: bestanden.
- `npm run lint`: bestanden.
- `npm run test`: bestanden, 32 Testdateien / 182 Tests.
- `npm run build`: bestanden.
- Dev-Server erreichbar: `http://127.0.0.1:5173/hub`.

### Offene Punkte

- Detailseiten/Drawer für Reports und Spielerprofile sind funktional vorbereitet, aber visuell noch nicht sauber ausgearbeitet.
- Echte externe KI-Anbindung und serverseitige Persistenz/Auth bleiben spätere Integrationsschritte.
- UX-Pass für Übersichtlichkeit, Symmetrie und Informationsgewichtung steht als nächster grosser Schritt an.

## 2026-04-24 - Cockpit UX-Pass

### Umgesetzte Arbeit

- Cockpit in fokussierte Arbeitsbereiche gegliedert:
  - Heute
  - Reports
  - Shortlists
  - Planung
  - Profile
- Dauerhaft sichtbare Formularfläche reduziert:
  - Report-Erfassung ist einklappbar.
  - Watchlist-Bearbeitung ist einklappbar.
  - Aufgabenanlage ist einklappbar.
- Startbereich gestrafft:
  - kurze Rollen-/Daten-Chips statt langer Beschreibung.
  - symmetrisches Kennzahlenraster mit sechs Kacheln.
- Profile und Vergleich in einen eigenen Arbeitsbereich verschoben.
- Kalender-/Aufgabengruppierung in den Planungsbereich verschoben.
- Suche und Benachrichtigungen bilden den heutigen Arbeitsbereich.

### Geänderte Dateien

- `src/pages/ScoutingHubPage.jsx`
- `docs/scoutx_progress_log.md`

### Technische Entscheidungen

- Keine Domain-Änderung im UX-Pass; alle Funktionen bleiben über die bestehenden Actions erreichbar.
- Tabs wurden lokal in der Page umgesetzt, damit der bestehende Router nicht mit Zwischenrouten überladen wird.
- Formulare bleiben inline, aber eingeklappt. Das ist ein pragmatischer Zwischenschritt vor späteren Drawern/Detailseiten.

### Validierung

- `npm run lint`: bestanden.
- Gezielte Tests für App-Start und Domain: bestanden.
- `npm run test`: bestanden, 32 Testdateien / 182 Tests.
- `npm run build`: bestanden.
- Dev-Server erreichbar: `http://127.0.0.1:5173/hub`.

### Offene Punkte

- Detailseiten oder Side-Drawer für Report- und Spielerprofil-Bearbeitung würden die nächste UX-Stufe bringen.
- Mobile Feinschliff sollte nach realer Nutzung im Browser erfolgen.

## 2026-04-24 - Report- und Profil-Detailflächen

### Umgesetzte Arbeit

- Reports-Arbeitsbereich vertieft:
  - Reportliste und Report-Detailansicht getrennt.
  - Statuswechsel bleiben direkt aus dem Detail heraus möglich.
  - Ratings, strukturierte Sections, Kommentare und KI-Auswertung sind in einer fokussierten Detailfläche sichtbar.
  - KI-Analyse kann aus dem Detailkontext erneut gestartet werden.
- Profil-Arbeitsbereich vertieft:
  - Spielerprofile können aus der Liste geöffnet werden.
  - Detailfläche zeigt Reportanzahl, Shortlistanzahl, Aufgabenanzahl, Priorität, Notizen und Shortlist-Kontext.
  - Ausgewählte Einträge werden visuell markiert.
- Responsive Layouts angepasst:
  - Desktop nutzt Master-Detail-Raster.
  - Mobile fällt auf eine einspaltige Struktur zurück.

### Geänderte Dateien

- `src/pages/ScoutingHubPage.jsx`
- `docs/scoutx_progress_log.md`

### Technische Entscheidungen

- Detailflächen sind zunächst als inline Master-Detail-Ansichten umgesetzt statt als Router-Unterseiten. Dadurch bleiben Kontextwechsel schnell und die vorhandene Cockpit-Persistenz unverändert.
- Auswahlzustand bleibt lokal in der Page; Domain-State wird nur für echte Datenmutationen verwendet.
- Spielerprofile bleiben aggregierte Views aus bestehenden Objekten und werden nicht separat dupliziert.

### Validierung

- `npm run lint`: bestanden.
- Gezielte Tests für App-Start und Domain: bestanden.
- `npm run test`: bestanden, 32 Testdateien / 182 Tests.
- `npm run build`: bestanden.
- Dev-Server erreichbar: `http://127.0.0.1:5173/hub`.

### Offene Punkte

- Nächster fachlicher Schritt: gespeicherte Filter und Vergleichs-/Export-Interaktionen sichtbarer machen.
- Danach: Mobile-Browser-Check und gezielter UX-Feinschliff für Abstände, Symmetrie und Scanbarkeit.

## 2026-04-24 - Such-, Filter-, Vergleichs- und Export-Workflows sichtbar gemacht

### Umgesetzte Arbeit

- Globale Suche erweitert:
  - Treffer zeigen lesbare Typen statt technischer Keys.
  - Treffer können geöffnet werden und springen in den passenden Arbeitsbereich.
  - Report-Treffer öffnen die Report-Detailfläche.
  - Spieler-Treffer öffnen das aggregierte Spielerprofil.
  - Watchlist-, Aufgaben-, Spiel- und Historien-Treffer springen in Shortlists bzw. Planung.
- Gespeicherte Filter verbessert:
  - Anzeige respektiert aktive Rolle: Admin sieht alle, andere Rollen nur eigene Filter.
  - Aktive Suchmenge zeigt Trefferanzahl und Anzahl gespeicherter Sichten.
  - Filter können mit einem Klick geleert werden.
  - Gespeicherte Filter haben beschreibende Tooltips aus Query, Typ und Status.
- Vergleichsworkflow verbessert:
  - Profil-Detail kann den geöffneten Spieler direkt als Spieler A oder Spieler B in den Vergleich übernehmen.
- Exportworkflow verbessert:
  - Eigene Export-/Arbeitsset-Fläche im Heute-Bereich.
  - Sichtbarer Umfang des rollenbasierten Exports wird vor dem Download angezeigt.
- Kleine Designkorrektur:
  - Negative Letter-Spacing im Cockpit entfernt.

### Geänderte Dateien

- `src/pages/ScoutingHubPage.jsx`
- `docs/scoutx_progress_log.md`

### Technische Entscheidungen

- Suchtreffer bleiben generisch, aber die Page interpretiert Typ und Entity für Navigation. Dadurch muss die Domain-Suche keine UI-Routen kennen.
- Filter-Sichtbarkeit wird in der UI mit derselben Rollenlogik wie der Export gespiegelt; echte Security-Grenzen bleiben später Backend-Aufgabe.
- Export bleibt JSON-basiert und rollenbasiert, damit BI/API-Vorbereitung ohne zusätzliche Formatbindung möglich bleibt.

### Validierung

- `npm run lint`: bestanden.
- Gezielte Tests für App-Start und Domain: bestanden.
- `npm run test`: bestanden, 32 Testdateien / 182 Tests.
- `npm run build`: bestanden.
- Dev-Server erreichbar: `http://127.0.0.1:5173/hub`.

### Offene Punkte

- Nächster fachlicher Schritt: Planning-/Assignment-Detailfläche mit Match-Kontext und direkter Statusarbeit.
- Danach: Browser-basierter Mobile-/Desktop-UX-Check und Feinschliff.

## 2026-04-24 - Planning- und Assignment-Detailworkflow

### Umgesetzte Arbeit

- Planungsbereich zu einem Master-Detail-Workflow erweitert:
  - Kalendergruppen und Aufgabenlisten können eine Aufgabe öffnen.
  - Ausgewählte Aufgabe wird visuell markiert.
  - Neue Detailfläche zeigt Titel, Fälligkeit, Assignee, Status, Typ, Sichtbarkeit, Kontext und Arbeitsnotiz.
- Statusarbeit verbessert:
  - Aufgabenstatus kann weiterhin in der Liste geändert werden.
  - Aufgabenstatus kann zusätzlich direkt im Detail geändert werden.
- Suchintegration verbessert:
  - Aufgaben-Treffer öffnen die konkrete Aufgabe im Planungsbereich.
  - Spiel-Treffer springen in die Planung, befüllen das Spiel im Aufgabenformular und öffnen die Erfassung.
- Match-/Report-Kontext sichtbar gemacht:
  - Verknüpfte Reports werden im Detail mit Titel angezeigt.
  - Verknüpfte Spiele werden mit Paarung, Datum und Ort angezeigt.

### Geänderte Dateien

- `src/pages/ScoutingHubPage.jsx`
- `docs/scoutx_progress_log.md`

### Technische Entscheidungen

- Assignment-Auswahl bleibt lokaler UI-State, während Statuswechsel weiter über zentrale Domain-Actions laufen.
- Match- und Report-Kontext wird aus bestehenden Quellen aufgelöst statt in Assignment-Objekten dupliziert.
- Der Planungsbereich nutzt dasselbe Master-Detail-Muster wie Reports und Profile, damit die Cockpit-UX konsistent bleibt.

### Validierung

- `npm run lint`: bestanden.
- Gezielte Tests für App-Start und Domain: bestanden.
- `npm run test`: bestanden, 32 Testdateien / 182 Tests.
- `npm run build`: bestanden.
- Dev-Server erreichbar: `http://127.0.0.1:5173/hub`.

### Offene Punkte

- Browser-basierter Mobile-/Desktop-UX-Check steht weiterhin aus.

## 2026-04-24 - UTF-8-Umlaute korrigiert

### Umgesetzte Arbeit

- Deutschsprachige UI-Texte im Scouting-Cockpit auf echte UTF-8-Umlaute umgestellt.
- Domain-Labels, Report-Vorlagen, KI-Auswertungstexte und Beispielinhalte korrigiert.
- ScoutX-MVP-Dokumentation auf korrekte Schreibweise mit Umlauten umgestellt.
- Betroffene Testbeschreibungen und PDF-Texte ebenfalls angepasst.

### Geänderte Dateien

- `src/pages/ScoutingHubPage.jsx`
- `src/services/scoutxDomain.js`
- `src/app.integration.test.jsx`
- `src/components/GameTable.test.jsx`
- `src/components/TeamPicker.test.jsx`
- `src/pages/SetupPage.test.jsx`
- `src/services/pdf/sections.js`
- `docs/scoutx_feature_expansion_audit.md`
- `docs/scoutx_gap_analysis.md`
- `docs/scoutx_implementation_plan.md`
- `docs/scoutx_progress_log.md`
- `docs/scoutx_target_architecture.md`

### Validierung

- `npm run lint`: bestanden.
- `npm run test`: bestanden, 32 Testdateien / 182 Tests.
- `npm run build`: bestanden.
- Dev-Server erreichbar: `http://127.0.0.1:5173/hub`.

## 2026-04-24 - Top-Navigation kontextsensitiv gemacht

### Umgesetzte Arbeit

- Obere Schritt-Navigation vereinfacht:
  - Im Cockpit und außerhalb des Setup-Flows wird nur noch „Konfiguration“ angezeigt.
  - „Spiele“ und „Plan“ erscheinen erst innerhalb des Konfigurationsflows (`/setup`, `/games`, `/plan`).
  - Klick auf „Konfiguration“ führt weiterhin direkt in `/setup`.
- Regressionstest ergänzt:
  - Außerhalb des Konfigurationsflows werden Spiele/Plan nicht mehr gerendert.
  - Innerhalb des Konfigurationsflows bleiben alle drei Schritte verfügbar.

### Geänderte Dateien

- `src/components/StepNav.jsx`
- `src/components/StepNav.test.jsx`
- `docs/scoutx_progress_log.md`

### Validierung

- Gezielte Tests für StepNav und App-Integration: bestanden.
- `npm run lint`: bestanden.
- `npm run build`: bestanden.
- Dev-Server erreichbar: `http://127.0.0.1:5173/hub` und `http://127.0.0.1:5173/setup`.

## 2026-04-24 - Setup-Kalender und Mannschaften-Zählung korrigiert

### Umgesetzte Arbeit

- Setup-Zeitraum intelligenter gemacht:
  - Initiales Von-Datum ist jetzt der reale heutige Tag.
  - Bis-Datum läuft automatisch bis zum nächsten Sonntag.
  - Persistierte Setup-Daten mit Startdatum in der Vergangenheit werden beim Laden auf heute bis nächsten Sonntag normalisiert.
  - Bei Änderung des Von-Datums wird das Bis-Datum wieder auf den kommenden Sonntag dieses Startdatums gesetzt.
- Zusammenfassung der optionalen Mannschaften korrigiert:
  - Die Anzeige zählt nur noch explizit vom User eingetragene Mannschaften.
  - Automatisch abgeleitete Unterstufen-Hinweise wie D I/D1 bleiben für die Plansuche nutzbar, erscheinen aber nicht mehr als gesetzte Mannschaften.

### Geänderte Dateien

- `src/context/shared.js`
- `src/context/shared.test.js`
- `src/context/SetupContext.jsx`
- `src/pages/SetupPage.jsx`
- `src/pages/SetupPage.test.jsx`
- `docs/scoutx_progress_log.md`

### Validierung

- Gezielte Tests für Shared-Date-Logik und SetupPage: bestanden, 20 Tests.
- `npm run lint`: bestanden.
- `npm run build`: bestanden.
- `npm run test`: bestanden, 33 Testdateien / 193 Tests.

## 2026-04-24 - Cockpit-Seed-Daten entfernt

### Umgesetzte Arbeit

- Initiale Produktdomain startet jetzt leer:
  - keine Beispielreports
  - keine Beispielshortlists
  - keine Beispielaufgaben
  - keine Beispielbenachrichtigungen
- Cockpit zeigt damit nur noch Daten, die der User selbst angelegt hat oder die aus vorhandenen echten App-Daten wie PlayerSheets, Games und PlanHistory stammen.
- Migration ergänzt:
  - Bereits lokal gespeicherte alte Seed-Daten werden beim Laden erkannt und aus dem Product-State entfernt.
  - User, Rollen und echte selbst angelegte Inhalte bleiben erhalten.
- Domain-Tests angepasst:
  - Tests erzeugen benötigte Reports, Watchlists und Assignments explizit im jeweiligen Test.
  - Regressionstest für das Entfernen alter Seed-Daten ergänzt.

### Geänderte Dateien

- `src/services/scoutxDomain.js`
- `src/services/scoutxDomain.test.js`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run lint`: bestanden.
- `npm run test`: bestanden, 32 Testdateien / 185 Tests.
- `npm run build`: bestanden.
- Dev-Server erreichbar: `http://127.0.0.1:5173/hub`.

## 2026-04-24 - Zeiterfassungen im Cockpit ergänzt

### Umgesetzte Arbeit

- Neuer Cockpit-Tab „Zeiterfassungen“ ergänzt.
- Monatliche Abrechnungsübersicht aus echten PlanHistory-Daten gebaut:
  - Einsätze pro Monat.
  - erfasste und offene Arbeitszeiten.
  - gesamte Arbeitszeit.
  - abrechnungsrelevante Kilometer.
  - erwartetes Tankgeld je Monat.
  - fehlende Kilometerdaten werden sichtbar markiert.
- Detailtabelle je Monat ergänzt:
  - Datum und Uhrzeit.
  - Spielpaarung und Ort.
  - Dauer.
  - Kilometer.
  - Tankgeld.
  - Status „erfasst“ oder „offen“.
- Eigene Service-Schicht `timeTracking` ergänzt, damit die Logik testbar und später exportfähig bleibt.

### Geänderte Dateien

- `src/services/timeTracking.js`
- `src/services/timeTracking.test.js`
- `src/pages/ScoutingHubPage.jsx`
- `docs/scoutx_progress_log.md`

### Technische Entscheidungen

- Zeiterfassung nutzt ausschließlich vorhandene echte Daten aus `planHistory` und `presenceByGame`.
- Tankgeld wird nur für erfasste Einsätze mit vorhandener Distanz berechnet. Offene Zeiten bleiben sichtbar, erhöhen aber noch keine Auszahlungssumme.
- Kilometerbasis ist aktuell die beste vorhandene Spiel-Distanz (`fromStartRouteDistanceKm` vor `distanceKm`) mit Hin- und Rückfahrt.
- Fehlende Kilometer werden bewusst nicht geschätzt, sondern als Abrechnungslücke markiert.

### Validierung

- `npm run lint`: bestanden.
- Gezielte Tests für Zeiterfassung und App-Integration: bestanden.
- `npm run test`: bestanden, 33 Testdateien / 188 Tests.
- `npm run build`: bestanden.
- Dev-Server erreichbar: `http://127.0.0.1:5173/hub`.

## 2026-04-24 - Setup Action-Bar Visual Glitch behoben

### Umgesetzte Arbeit

- Sticky Bottom-Bar im Setup visuell abgedichtet.
- Transparenter Blur-Hintergrund durch deckende Oberfläche ersetzt.
- Untere Maskenfläche ergänzt, damit darunterliegende Kreis-Karten nicht zwischen Buttonleiste und Seitenende durchscheinen.
- Ebenenordnung der Action-Bar erhöht.

### Geänderte Dateien

- `src/styles/theme.js`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run lint`: bestanden.
- `npm run build`: bestanden.
- Dev-Server erreichbar: `http://127.0.0.1:5173/setup`.

## 2026-04-24 - Zeiterfassungen monatsweise bearbeitbar gemacht

### Umgesetzte Arbeit

- Monatswechsel im Zeiterfassungs-Tab klarer gemacht:
  - sichtbarer Monatsumschalter.
  - Monatsliste bleibt als schnelle Auswahl erhalten.
- Inline-Bearbeitung ergänzt:
  - Dauer je Einsatz kann direkt in Minuten angepasst oder geleert werden.
  - einfache Kilometer je Einsatz können direkt angepasst oder geleert werden.
  - Änderungen schreiben zurück in die echte PlanHistory.
  - Monats-Arbeitszeit, Kilometer und Tankgeld berechnen sich danach automatisch neu.

### Geänderte Dateien

- `src/pages/ScoutingHubPage.jsx`
- `docs/scoutx_progress_log.md`

### Validierung

- `npm run lint`: bestanden.
- Gezielte Tests für Zeiterfassung und App-Integration: bestanden.
- `npm run test`: bestanden, 33 Testdateien / 188 Tests.
- `npm run build`: bestanden.
- Dev-Server erreichbar: `http://127.0.0.1:5173/hub`.

## 2026-04-24 - Cockpit-Rücksprung in Top-Navigation ergänzt

### Umgesetzte Arbeit

- Top-Navigation erweitert:
  - „Cockpit“ steht jetzt links vor „Konfiguration“.
  - Im Cockpit werden nur „Cockpit“ und „Konfiguration“ angezeigt.
  - Im Konfigurationsflow werden „Cockpit“, „Konfiguration“, „Spiele“ und „Plan“ angezeigt.
  - Von `/setup`, `/games` und `/plan` kann man über die obere Navigation direkt zurück ins Cockpit wechseln.
- Regressionstests ergänzt:
  - Cockpit ist außerhalb und innerhalb des Konfigurationsflows sichtbar.
  - Klick auf „Cockpit“ löst Navigation zu `hub` aus.

### Geänderte Dateien

- `src/components/StepNav.jsx`
- `src/components/StepNav.test.jsx`
- `docs/scoutx_progress_log.md`

### Validierung

- Gezielte Tests für StepNav und App-Integration: bestanden.
- `npm run lint`: bestanden.
- `npm run build`: bestanden.
- Dev-Server erreichbar: `http://127.0.0.1:5173/hub` und `http://127.0.0.1:5173/setup`.
