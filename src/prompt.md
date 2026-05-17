Du arbeitest als Senior Fullstack Engineer, Browser-Automation Engineer und Produktentwickler an meinem Projekt ScoutX.

Ziel:
ScoutX soll um eine HRworks-Import-Funktion erweitert werden. Nutzer sollen aus einem in ScoutX erstellten Sichtungsplan bzw. Arbeitszeit-/Abrechnungsplan heraus per Button die relevanten Daten automatisch in HRworks eintragen können. Aktuell muss der Nutzer alles manuell in HRworks übertragen. Die neue Funktion soll diesen Prozess kontrolliert, nachvollziehbar und möglichst fehlerfrei automatisieren.

Wichtiger Kontext:
Ich stelle dir Screenshots aus HRworks und eine Excel-Datei mit Arbeitszeitdokumentation bereit. Die Excel-Datei zeigt das Ziel-Datenmodell für die Arbeitszeiterfassung. Die HRworks-Screenshots zeigen die relevanten Eingabefelder und Navigation.

HRworks-Zielmaske laut Screenshots:
1. Dashboard → Reisemanagement → Reisekostenabrechnung
2. Neue Reisekostenabrechnung anlegen
3. Bereich „Reisedaten“
4. Relevante Felder:
   - Zweck
   - Bemerkung
   - Zeitraum / Reisedatum
   - Beginn Uhrzeit
   - Ende Uhrzeit
   - Abfahrtsort
   - Zielort
   - Zwischenorte
   - Kostenstelle
   - 3-Monatsregel
   - Speichern
   - Weiter zu den digitalen Belegen

Beispielinhalt aus dem HRworks-Screenshot:
- Zweck: „Sichtung / (Spiel 1 - Spiel 2 - Spiel 3 usw.)“
- Bemerkung: „Sichtung / (Spiel 1 → Spiel 2 → Spiel 3 usw.)“
- Zeitraum: 20.04.2026 - 20.04.2026
- Beginn Uhrzeit: 08:00
- Ende Uhrzeit: 17:00
- Abfahrtsort: Sternbuschweg 326
- Kostenstelle: Junioren allgemein (321000)

Excel-/Arbeitszeitmodell:
Die Datei enthält eine Arbeitszeitdokumentation mit folgenden fachlichen Feldern:
- Name
- Monat
- Tag
- Datum
- Beginn
- Ende
- Ruhezeit von
- Ruhezeit bis
- Arbeitsstunden
- Vermerk
- Gesamtstunden

ScoutX soll daraus strukturierte Importdaten ableiten können.

Aufgabe:
Implementiere in ScoutX eine neue Funktion „In HRworks importieren“ bzw. „HRworks-Export/Import vorbereiten“.

Die Funktion soll folgende Phasen haben:

==================================================
1. Analyse der vorhandenen ScoutX-Datenstruktur
==================================================

Untersuche zuerst das bestehende ScoutX-Projekt.

Finde heraus:
- Wo Sichtungspläne gespeichert werden
- Welche Daten pro Plan vorhanden sind
- Ob es bereits Spiel-/Termin-/Ort-/Zeitdaten gibt
- Ob Abfahrtsort, Zielort, Zwischenorte, Kostenstelle oder Bemerkung bereits existieren
- Ob eine Abrechnung oder Arbeitszeiterfassung bereits modelliert ist
- Welche UI-Komponente für Plan-Details geeignet ist, um den neuen Button einzubauen

Erstelle danach eine kurze technische Notiz in einer Markdown-Datei:

/docs/hrworks-import-plan.md

Diese Datei soll dokumentieren:
- gefundene Datenquellen in ScoutX
- fehlende Pflichtfelder
- geplantes Datenmodell
- geplante UI-Änderungen
- geplante Browser-Automation
- offene Risiken

==================================================
2. HRworks-Import-Datenmodell erstellen
==================================================

Erstelle ein internes normalisiertes Datenmodell, z. B.:

HrworksImportPayload:
- planId
- employeeName
- date
- startTime
- endTime
- breakStart
- breakEnd
- workHours
- purpose
- note
- departureLocation
- destinationLocation
- intermediateStops[]
- costCenter
- travelExpenseRequired
- receiptsRequired
- sourceGames[]
- status
- createdAt
- updatedAt

Wichtig:
Das Modell darf nicht direkt an UI-Feldnamen gekoppelt sein. Es soll als stabile Zwischenschicht zwischen ScoutX und HRworks dienen.

Validierung:
Vor jedem Import muss ScoutX prüfen:
- Datum vorhanden
- Beginn vorhanden
- Ende vorhanden
- Beginn < Ende
- Arbeitsstunden berechenbar
- Zweck/Bemerkung vorhanden
- Abfahrtsort vorhanden
- Zielort vorhanden
- Kostenstelle vorhanden
- keine negativen Stunden
- keine offensichtlichen Duplikate für denselben Tag/Plan

Wenn Daten fehlen, darf der Import nicht blind starten. Stattdessen soll ScoutX dem Nutzer eine klare Fehlerliste anzeigen.

==================================================
3. UI-Erweiterung in ScoutX
==================================================

Baue in der passenden Plan-/Abrechnungsansicht einen Button ein:

„In HRworks importieren“

Beim Klick soll nicht sofort importiert werden. Stattdessen öffnet sich eine Review-Ansicht oder ein Modal:

Titel:
„HRworks-Import prüfen“

Inhalt:
- Datum
- Beginn
- Ende
- berechnete Stunden
- Zweck
- Bemerkung
- Abfahrtsort
- Zielort
- Zwischenorte
- Kostenstelle
- zugehörige Spiele/Sichtungen
- Warnungen bei fehlenden Daten
- Hinweis, dass HRworks im Browser geöffnet wird

Buttons:
- „Abbrechen“
- „Daten bearbeiten“
- „Import starten“

Optional zusätzlich:
- „Nur Exportdatei erstellen“
- „HRworks-Testlauf ohne Speichern“

==================================================
4. Import-Strategie prüfen: API zuerst, Browser-Automation danach
==================================================

Bevor Browser-Automation gebaut wird, prüfe technisch sauber, ob HRworks eine offizielle Import-/API-/CSV-/Schnittstellenmöglichkeit für Reisekostenabrechnungen oder Arbeitszeiten bietet.

Wichtig:
- Keine Annahmen treffen.
- Keine inoffiziellen Endpunkte verwenden, ohne sie zu kennzeichnen.
- Keine Credentials speichern.
- Keine HRworks-Sicherheitsmechanismen umgehen.
- Keine 2FA umgehen.
- Nur mit einem vom Nutzer aktiv eingeloggten HRworks-Account arbeiten.

Wenn eine offizielle HRworks-Schnittstelle existiert:
- dokumentiere sie
- prüfe, ob sie für Reisekosten / Arbeitszeit geeignet ist
- bevorzuge diese Lösung gegenüber Browser-Automation

Wenn keine geeignete Schnittstelle verfügbar ist:
- implementiere browsergestützte Automatisierung mit Playwright oder einer passenden vorhandenen Browser-Automation-Lösung im Projekt

==================================================
5. Browser-Automation mit Nutzer-Login
==================================================

Der Nutzer wird sich selbst manuell in HRworks einloggen.

Die Automation soll:
- keinen Benutzernamen speichern
- kein Passwort speichern
- keine Session-Tokens in ScoutX persistieren
- nur mit einer aktiven Browser-Session arbeiten
- vor dem finalen Speichern eine Review-/Bestätigungsstufe anbieten
- bei UI-Änderungen robust abbrechen statt falsche Daten einzutragen

Implementiere einen kontrollierten Flow:

1. HRworks im Browser öffnen
2. Nutzer loggt sich manuell ein
3. Automation wartet, bis HRworks-Dashboard sichtbar ist
4. Navigation zu Reisemanagement / Reisekostenabrechnung
5. Neue Reisekostenabrechnung öffnen
6. Formularfelder mit dem HrworksImportPayload befüllen
7. Screenshot oder DOM-basierte Prüfung der befüllten Felder durchführen
8. Nutzer bestätigt final
9. Speichern ausführen
10. Ergebnis in ScoutX protokollieren

==================================================
6. Selector-Mapping und Lernmodus
==================================================

Da HRworks eine externe Web-App ist, soll die Automation nicht hart und blind implementiert werden.

Baue einen „HRworks Setup-/Mapping-Modus“:

Ziel:
Ein Entwickler oder Nutzer kann einmalig die HRworks-Felder identifizieren.

Mapping-Datei z. B.:
config/hrworks.selectors.json

Beispielstruktur:
{
  "travelExpenseButton": "...",
  "newTravelExpenseButton": "...",
  "purposeInput": "...",
  "noteTextarea": "...",
  "dateRangeInput": "...",
  "startTimeInput": "...",
  "endTimeInput": "...",
  "departureLocationSelect": "...",
  "destinationLocationSelect": "...",
  "costCenterSelect": "...",
  "saveButton": "...",
  "nextToReceiptsButton": "..."
}

Anforderungen:
- Verwende bevorzugt stabile Selektoren: labels, accessible names, roles, placeholder, data attributes.
- CSS/XPath nur als Fallback.
- Wenn ein Selector nicht gefunden wird, abbrechen und verständliche Fehlermeldung anzeigen.
- Mapping versionieren.
- Mapping dokumentieren.
- Keine sensiblen Nutzerdaten in der Mapping-Datei speichern.

==================================================
7. Excel-Import/Arbeitszeitdaten berücksichtigen
==================================================

Die bereitgestellte Excel-Datei zeigt, welche Arbeitszeitdaten fachlich relevant sind.

Baue, falls sinnvoll, einen Import-Parser oder Mapping-Parser für dieses Format:

Input:
- Excel-Datei mit Arbeitszeitdokumentation

Zu extrahierende Felder:
- Mitarbeitername
- Monat
- Datum
- Beginn
- Ende
- Ruhezeit von
- Ruhezeit bis
- Stunden
- Vermerk

Output:
- strukturierte ScoutX-Arbeitszeiteinträge
- daraus ableitbare HRworksImportPayloads

Wichtig:
- Leere Tage ignorieren
- Nur Tage mit Beginn/Ende/Stunden importieren
- Stunden aus Beginn/Ende plausibilisieren
- Excel-Zeitwerte korrekt in HH:mm umwandeln
- Datum korrekt interpretieren
- Gesamtstunden gegen Summe der Einzelstunden validieren
- Bei Abweichungen Warnung anzeigen

==================================================
8. Duplikatschutz und Audit-Log
==================================================

Implementiere einen lokalen Importstatus.

Für jeden HRworks-Import speichern:
- ScoutX planId
- Datum
- Startzeit
- Endzeit
- Zweck
- HRworks-Status
- Importzeitpunkt
- ausführender Nutzer
- technisches Ergebnis
- Fehlermeldung, falls fehlgeschlagen
- optional HRworks-Referenz, falls auslesbar

Statuswerte:
- draft
- ready
- imported
- failed
- skipped
- needs_review

Vor erneutem Import:
- warnen, wenn derselbe Plan oder derselbe Tag bereits importiert wurde
- Nutzer muss Re-Import explizit bestätigen

==================================================
9. Fehlerbehandlung
==================================================

Die Funktion muss robust abbrechen bei:
- HRworks nicht erreichbar
- Nutzer nicht eingeloggt
- Navigation fehlgeschlagen
- erwartetes Feld nicht gefunden
- Dropdown-Wert nicht gefunden
- Datum/Uhrzeit ungültig
- Kostenstelle nicht vorhanden
- Speichern fehlgeschlagen
- HRworks zeigt Validierungsfehler

Bei jedem Fehler:
- keine weiteren Klicks ausführen
- Fehlermeldung in ScoutX anzeigen
- technischen Logeintrag schreiben
- Nutzer konkrete Handlung nennen

Beispiele:
- „Kostenstelle Junioren allgemein (321000) wurde in HRworks nicht gefunden.“
- „Das Feld Zielort ist leer. Bitte vor dem Import ergänzen.“
- „HRworks-Formularstruktur hat sich geändert. Bitte Selector-Mapping prüfen.“

==================================================
10. Datenschutz und Sicherheit
==================================================

Strikte Vorgaben:
- Keine HRworks-Zugangsdaten speichern
- Keine Passwörter loggen
- Keine Session-Cookies dauerhaft speichern
- Keine personenbezogenen Daten unnötig in Logs schreiben
- Screenshots nur im Debug-Modus und nur nach Nutzerfreigabe speichern
- Logs datensparsam halten
- Import vor finalem Speichern immer durch Nutzer bestätigen lassen

==================================================
11. Tests
==================================================

Implementiere Tests für:

Datenmodell:
- gültiger Importpayload
- fehlendes Datum
- fehlende Startzeit
- fehlende Endzeit
- Ende vor Beginn
- fehlende Kostenstelle
- fehlender Zielort
- Duplikat-Erkennung

Excel-Parser:
- Datumserkennung
- Uhrzeitkonvertierung
- leere Zeilen ignorieren
- Gesamtstunden-Abgleich
- Vermerk „Sichtung“ übernehmen

Browser-Automation:
- Mock-/Test-HRworks-Seite verwenden
- Selektoren finden
- Felder korrekt befüllen
- Abbruch bei fehlendem Feld
- Abbruch bei nicht gefundenem Dropdown-Wert
- kein Speichern ohne Bestätigung

UI:
- Button sichtbar
- Review-Modal zeigt Daten
- Fehlerliste bei unvollständigen Daten
- Import nur nach Bestätigung startbar

==================================================
12. Entwicklungsweise
==================================================

Arbeite iterativ:

1. Projekt analysieren
2. Plan in /docs/hrworks-import-plan.md schreiben
3. Datenmodell bauen
4. Validierung bauen
5. Excel-/Plan-Mapping bauen
6. UI-Review-Modal bauen
7. Browser-Automation-Prototyp gegen Mock-Seite bauen
8. Danach erst echte HRworks-Session mit Nutzerlogin testen
9. Tests schreiben
10. Fehler beheben
11. Dokumentation aktualisieren

Nach jedem größeren Schritt:
- Tests ausführen
- Fehler beheben
- Fortschritt in /docs/hrworks-import-plan.md aktualisieren

==================================================
13. Akzeptanzkriterien
==================================================

Die Aufgabe ist erst fertig, wenn:

- ScoutX hat einen sichtbaren Button „In HRworks importieren“
- Der Button öffnet zuerst eine Review-Ansicht
- Importdaten werden aus ScoutX-Plänen sauber abgeleitet
- Excel-Arbeitszeitdaten können zumindest als Referenzmodell verarbeitet oder gemappt werden
- Pflichtfelder werden validiert
- Fehlende Daten blockieren den Import
- Browser-Automation speichert keine Zugangsdaten
- Nutzer loggt sich selbst in HRworks ein
- HRworks-Felder werden robust über Selector-Mapping befüllt
- Vor dem finalen Speichern gibt es eine Nutzerbestätigung
- Jeder Import wird protokolliert
- Re-Importe werden erkannt und gewarnt
- Tests für Datenmodell, Parser, UI und Automation existieren
- Dokumentation existiert
- Keine sensiblen Daten werden geloggt
- Die bestehende ScoutX-Funktionalität wird nicht beschädigt

==================================================
14. Rückfragen vor Umsetzung
==================================================

Falls Informationen fehlen, stelle zuerst gezielte Rückfragen. Besonders wichtig:

1. Gibt es in ScoutX bereits ein Modell für Arbeitszeit, Abrechnung oder nur Sichtungspläne?
2. Soll HRworks pro Sichtungstag eine eigene Reisekostenabrechnung bekommen oder sollen mehrere Sichtungen in einer Abrechnung zusammengefasst werden?
3. Welche HRworks-Felder sind Pflichtfelder in eurem Unternehmen?
4. Welche Kostenstelle ist Standard?
5. Ist „Junioren allgemein (321000)“ immer korrekt oder nur ein Beispiel?
6. Wie soll der Zielort aus einem ScoutX-Spiel abgeleitet werden?
7. Was ist der Standard-Abfahrtsort?
8. Gibt es Pausen/Ruhezeiten oder werden nur Beginn/Ende/Stunden gepflegt?
9. Soll ScoutX auch digitale Belege hochladen oder nur Reisedaten/Arbeitszeiten eintragen?
10. Soll die Automation final selbst auf „Speichern“ klicken oder nur bis zur vorausgefüllten HRworks-Maske gehen?
11. Welche Tech-Stack-Komponenten nutzt ScoutX aktuell für Frontend, Backend und Datenbank?
12. Darf Playwright als Dependency ergänzt werden?
13. Soll die Funktion lokal im Browser des Nutzers laufen oder serverseitig/headless?
14. Gibt es mehrere HRworks-Nutzer oder erstmal nur einen Account?
15. Muss der Import App-Store-/Compliance-tauglich dokumentiert werden?

Arbeite nicht blind weiter, wenn diese Antworten für die korrekte Umsetzung zwingend notwendig sind.