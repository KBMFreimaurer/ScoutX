Du bist Senior Fullstack Engineer, Product Architect und QA Lead für mein Projekt **ScoutX**.

ScoutX ist eine Fußball-Scouting-Plattform zur Planung, Organisation und Dokumentation von Spielbesuchen. Bestehende Funktionen dürfen nicht beschädigt werden. Arbeite produktionsreif, sauber strukturiert und mit klarer Trennung zwischen Datenmodell, Backend-Logik, UI/UX und Tests.

Deine Aufgabe ist es, ScoutX um die folgenden Features zu erweitern — aber nur, sofern sie noch nicht sinnvoll implementiert sind. Prüfe zuerst den aktuellen Codebestand, dokumentiere den Ist-Zustand und entscheide dann, welche Funktionen ergänzt, verbessert oder refaktoriert werden müssen.

==================================================
0. ARBEITSWEISE
==================================================

Arbeite in einem iterativen Engineering-Loop:

1. Codebase analysieren
2. Bestehende Features identifizieren
3. Fehlende Features planen
4. Datenmodell/API/UI-Konzept ableiten
5. Feature schrittweise implementieren
6. Tests schreiben oder bestehende Tests erweitern
7. Fehler beheben
8. Dokumentation aktualisieren
9. Am Ende eine klare Zusammenfassung liefern:
   - Was wurde implementiert?
   - Was war bereits vorhanden?
   - Was wurde bewusst nicht umgesetzt und warum?
   - Welche offenen Risiken gibt es?

Erstelle oder aktualisiere eine Datei:

`SCOUTX_FEATURE_EXPANSION_PROGRESS.md`

Darin dokumentierst du:
- aktuellen Fortschritt
- getroffene Architekturentscheidungen
- offene Fragen
- erledigte Features
- noch offene Features
- bekannte technische Schulden

==================================================
1. ZIEL DER ERWEITERUNG
==================================================

ScoutX soll von einem reinen Planungs- und PDF-orientierten Tool zu einer teamfähigen Scouting-Zentrale erweitert werden.

Ziel ist:

- bessere Spielplanung
- bessere Priorisierung von Spielen, Ligen, Mannschaften und Jahrgängen
- Teamarbeit mit mehreren Accounts
- Nachverfolgung, wer welche Spiele gesehen hat oder sehen wird
- Dokumentation von Randnotizen und Spieler-/Team-Highlights
- Integration offizieller und inoffizieller Spiele
- Unterstützung für Turniere und Länderspiele
- bessere Erreichbarkeitslogik
- Push-Benachrichtigungen bei relevanten Änderungen

==================================================
2. FEATURE-LISTE
==================================================

Implementiere oder ergänze folgende Funktionen, sofern sie noch nicht vorhanden sind:

--------------------------------------------------
2.1 Randnotizen bei Spielen
--------------------------------------------------

Ermögliche Randnotizen direkt an Spielen.

Anforderungen:
- User kann zu jedem Spiel eine oder mehrere Notizen erfassen.
- Notizen sollen optional privat oder teamweit sichtbar sein.
- Notizen enthalten:
  - Text
  - Autor
  - Zeitstempel
  - optional Kategorie, z. B. "Spieler", "Taktik", "Organisation", "Anfahrt", "Sonstiges"
- Notizen müssen im Spiel-Detail sichtbar sein.
- Notizen sollen auch nach dem Spiel abrufbar bleiben.
- Falls bereits ein Notizsystem existiert, erweitere es sauber statt ein zweites System zu bauen.

--------------------------------------------------
2.2 Spieler highlighten und mit Randnotizen versehen
--------------------------------------------------

Ermögliche das Markieren auffälliger Spieler.

Anforderungen:
- Ein Scout kann Spieler bei einem Spiel highlighten.
- Zu einem Spieler-Highlight können Notizen gespeichert werden.
- Falls keine Spielerlisten vorhanden sind, muss zumindest eine manuelle Eingabe möglich sein:
  - Name
  - Mannschaft
  - Trikotnummer optional
  - Jahrgang optional
  - Position optional
  - Kommentar/Notiz
- Mehrere Scouts sollen sehen können, welche Spieler bereits markiert wurden, sofern teamweit freigegeben.
- Vermeide doppelte Spieler-Einträge, soweit sinnvoll möglich.

--------------------------------------------------
2.3 Länderspiele / DFB.de-Option
--------------------------------------------------

ScoutX soll auch Länderspiele und Nachwuchs-Nationalmannschaften berücksichtigen können, z. B. U15, U16, U17, U18, U19.

Anforderungen:
- Prüfe, ob bereits eine Datenquelle für DFB.de existiert.
- Falls nicht, entwerfe eine Adapter-Struktur für DFB.de.
- Die Länderspiel-Option soll getrennt von fussball.de-Spielen aktivierbar sein.
- User soll gezielt auswählen können:
  - U15
  - U16
  - U17
  - U18
  - U19
  - weitere Altersklassen, wenn später möglich
- Implementiere die Architektur so, dass später weitere Quellen ergänzt werden können.
- Wenn keine stabile technische Abrufmöglichkeit vorhanden ist, baue zumindest die interne Datenstruktur und eine manuelle Eingabe-/Importmöglichkeit.

--------------------------------------------------
2.4 Kreisauswahl per PDF hochladen
--------------------------------------------------

ScoutX soll Kreis- oder Spielplan-PDFs hochladen und verwerten können.

Anforderungen:
- User kann eine PDF hochladen.
- PDF wird analysiert und relevante Informationen werden extrahiert, soweit technisch möglich:
  - Kreis
  - Liga
  - Mannschaft
  - Spielort
  - Datum
  - Uhrzeit
  - Heimteam
  - Auswärtsteam
- Wenn automatisches Parsing unsicher ist, sollen die Daten in einer Review-Maske angezeigt und manuell korrigierbar sein.
- Importierte Spiele müssen als solche gekennzeichnet werden.
- Verhindere doppelte Spiele durch Duplikatsprüfung.
- Architektur so bauen, dass später OCR oder KI-gestütztes Parsing ergänzt werden kann.

--------------------------------------------------
2.5 Mehrere Jugenden / Jahrgänge hinterlegen
--------------------------------------------------

ScoutX soll mehrere Altersklassen und Jahrgänge gleichzeitig abdecken können.

Anforderungen:
- User kann vor der Planerstellung mehrere Jugenden/Jahrgänge auswählen.
- Beispiele:
  - U11
  - U12
  - U13
  - U14
  - U15
  - U16
  - U17
  - U19
- Zusätzlich soll es möglich sein, konkrete Jahrgänge zu hinterlegen, z. B. 2010, 2011, 2012.
- Spiele sollen nach Jugend/Jahrgang filterbar sein.
- Planung soll mehrere Jahrgänge gleichzeitig berücksichtigen können.
- Bestehende Einzelauswahl nicht zerstören, sondern erweitern.

--------------------------------------------------
2.6 Push-Benachrichtigungen bei Spielabsage
--------------------------------------------------

ScoutX soll bei Spielabsagen oder relevanten Spieländerungen benachrichtigen.

Anforderungen:
- Prüfe, ob Push-Infrastruktur bereits existiert.
- Wenn nicht, entwerfe ein sauberes Benachrichtigungssystem.
- Relevante Events:
  - Spiel abgesagt
  - Spiel verlegt
  - Uhrzeit geändert
  - Spielort geändert
  - Priorisiertes/Favorisiertes Team betroffen
- Benachrichtigungen sollen nur an relevante User/Teams gehen.
- Verhindere Notification-Spam durch Änderungsprüfung.
- Falls echte Push Notifications noch nicht möglich sind, implementiere zunächst ein internes Notification-Center.

--------------------------------------------------
2.7 Erreichbarkeitswarnung / nicht pünktlich erreichbar
--------------------------------------------------

ScoutX soll anzeigen, wenn Spiele zeitlich nicht realistisch erreichbar sind.

Anforderungen:
- Für geplante Spielbesuche soll berechnet werden, ob das nächste Spiel pünktlich erreichbar ist.
- Berücksichtige:
  - Spielende/angenommene Spieldauer
  - Entfernung zwischen Spielorten
  - geschätzte Fahrzeit
  - Pufferzeit
  - Abfahrtsort
- Wenn ein Spiel nicht rechtzeitig erreichbar ist, muss ScoutX warnen.
- Die Warnung soll sichtbar sein:
  - in der Planansicht
  - im PDF-Export
  - optional in der Detailansicht
- Konfigurierbare Mindestpufferzeit einbauen.

--------------------------------------------------
2.8 Mannschaften favorisieren
--------------------------------------------------

User sollen Mannschaften als Favoriten markieren können.

Anforderungen:
- Favorisierte Mannschaften sollen vor der Planerstellung definierbar sein.
- Favoriten sollen bei der Planung höher priorisiert werden.
- Favoriten sollen filterbar sein.
- Änderungen an favorisierten Teams sollen Benachrichtigungen auslösen können.
- Favoriten können userbezogen oder teambezogen sein.

--------------------------------------------------
2.9 Lieblingsvereine vor der Planerstellung definieren
--------------------------------------------------

Zusätzlich zu einzelnen Mannschaften sollen ganze Vereine als Lieblingsvereine definiert werden können.

Anforderungen:
- User kann Lieblingsvereine speichern.
- Bei der Planerstellung werden Spiele dieser Vereine bevorzugt angezeigt.
- Falls ein Verein mehrere Jugendmannschaften hat, sollen diese entsprechend berücksichtigt werden.
- Lieblingsvereine sollen nicht zwingend automatisch ausgewählt werden, sondern in der Priorisierung helfen.

--------------------------------------------------
2.10 Ligen spezifizieren und priorisieren
--------------------------------------------------

ScoutX soll Ligen genauer auswählbar und priorisierbar machen.

Anforderungen:
- User kann vor Planerstellung Ligen auswählen.
- User kann Ligen priorisieren, z. B.:
  - sehr wichtig
  - wichtig
  - normal
  - ignorieren
- Planung soll diese Gewichtung berücksichtigen.
- UI muss klar zeigen, welche Ligen aktiv sind.
- Ligen sollen nach Bundesland/Kreis/Jugend filterbar sein.
- Bestehende Kreisauswahl nicht zerstören.

--------------------------------------------------
2.11 Wer hat welche Spiele gesehen?
--------------------------------------------------

ScoutX soll dokumentieren, welcher Scout welches Spiel bereits gesehen hat.

Anforderungen:
- Jedes Spiel kann einen Status erhalten:
  - geplant
  - gesehen
  - abgesagt
  - offen
  - spontan nachgetragen
  - inoffiziell
- Ein Scout kann ein Spiel als gesehen markieren.
- Team kann sehen:
  - wer welches Spiel gesehen hat
  - wann das Spiel gesehen wurde
  - welche Notizen/Highlights dazu existieren
- Optional: Mehrere Scouts pro Spiel erlauben.

--------------------------------------------------
2.12 Wer wird welche Spiele sehen?
--------------------------------------------------

ScoutX soll vorab anzeigen, welcher Scout für welches Spiel eingeplant ist.

Anforderungen:
- Spiele können einem Scout oder mehreren Scouts zugewiesen werden.
- In Teamansicht sichtbar:
  - Scout
  - Spiel
  - Datum/Uhrzeit
  - Status
  - geplante Route/Plan
- Konflikte erkennen:
  - Scout ist zeitgleich doppelt eingeplant
  - Spiel ist nicht erreichbar
  - zu viele Scouts beim selben Spiel, wenn nicht gewünscht

--------------------------------------------------
2.13 Welche Mannschaften wurden schon gesehen?
--------------------------------------------------

ScoutX soll teamweit sichtbar machen, welche Mannschaften bereits beobachtet wurden.

Anforderungen:
- Mannschaften erhalten Scouting-Historie.
- Sichtbar:
  - wie oft gesehen
  - zuletzt gesehen am
  - von welchem Scout gesehen
  - zugehörige Spiele
  - Notizen/Highlights
- Diese Information soll bei der Planung helfen, um Dopplungen zu vermeiden oder bewusst Wiederholungen zu planen.

--------------------------------------------------
2.14 Accounts in Teams
--------------------------------------------------

ScoutX soll Teamfähigkeit unterstützen.

Anforderungen:
- Es muss möglich sein, mehrere Accounts einem Team zuzuordnen.
- Rollenmodell prüfen oder ergänzen:
  - Owner/Admin
  - Scout
  - Viewer
- Teamdaten:
  - gemeinsame Spiele
  - gemeinsame Notizen, sofern freigegeben
  - gemeinsame Favoriten, sofern teambezogen
  - gemeinsame Spielzuweisungen
- Rechte sauber trennen:
  - private Notizen
  - teamweite Notizen
  - Admin-Funktionen
- Falls Auth noch nicht vorhanden ist, erst Architektur vorbereiten und minimal umsetzen.

--------------------------------------------------
2.15 Spontane Spiele nachtragen
--------------------------------------------------

User sollen Spiele nachträglich oder spontan manuell hinzufügen können.

Anforderungen:
- Manuelles Spiel anlegen mit:
  - Datum
  - Uhrzeit
  - Ort
  - Heimteam
  - Auswärtsteam
  - Liga optional
  - Jugend/Jahrgang optional
  - Quelle: manuell/spontan
- Spontane Spiele müssen in Historie, Planung und Teamansicht erscheinen.
- Sie dürfen nicht automatisch mit offiziellen Spielen verwechselt werden.
- Duplikatsprüfung einbauen.

--------------------------------------------------
2.16 Inoffizielle Spiele hinterlegen
--------------------------------------------------

ScoutX soll Spiele erfassen können, die nicht auf fussball.de gelistet sind.

Anforderungen:
- Inoffizielle Spiele manuell anlegen.
- Kennzeichnung als "inoffiziell".
- Sichtbar für Team, wenn freigegeben.
- Nutzbar für Planung, Notizen, Spieler-Highlights und Historie.
- Beispiele:
  - Testspiele
  - Freundschaftsspiele
  - interne Vergleiche
  - Trainingsspiele
  - kurzfristige Spiele

--------------------------------------------------
2.17 Turniere
--------------------------------------------------

ScoutX soll Turniere abbilden können.

Anforderungen:
- Turnier als eigener Event-Typ.
- Turnierdaten:
  - Name
  - Datum oder Zeitraum
  - Ort
  - teilnehmende Mannschaften
  - Altersklasse/Jahrgang
  - Spielplan optional
  - Notizen
- Einzelne Turnierspiele sollen angelegt oder importiert werden können.
- Scouts können Turniere planen und als gesehen markieren.
- Spieler-Highlights sollen auch innerhalb eines Turniers möglich sein.
- Turniere sollen in der Planerstellung berücksichtigt werden können.

--------------------------------------------------
2.18 Erfahrungsgemäße Spielorte bei K/A angeben
--------------------------------------------------

Wenn bei einem Spiel kein genauer Spielort verfügbar ist oder K/A angegeben ist, soll ScoutX erfahrungsgemäße Spielorte anbieten.

Anforderungen:
- Wenn Spielort unbekannt, K/A oder leer ist:
  - zeige bekannte/erfahrungsgemäße Spielorte der Mannschaft/des Vereins
  - markiere diese als nicht verifiziert
- User kann einen vermuteten Spielort bestätigen oder ändern.
- Bestätigte Orte können künftig als Erfahrungswert gespeichert werden.
- Wichtig: Niemals als gesicherte Information darstellen, wenn der Ort nur geschätzt ist.
- Im PDF und UI klar kennzeichnen:
  - "verifiziert"
  - "manuell bestätigt"
  - "erfahrungsgemäß/vermutet"

==================================================
3. DATENMODELL / ARCHITEKTUR
==================================================

Prüfe das bestehende Datenmodell und erweitere es sauber.

Mögliche neue Entitäten oder Tabellen/Collections:

- Team
- TeamMember
- ScoutAssignment
- MatchNote
- PlayerHighlight
- FavoriteClub
- FavoriteTeam
- LeaguePriority
- MatchSource
- ManualMatch
- Tournament
- TournamentMatch
- MatchObservation
- Notification
- ImportedPdf
- VenueHistory
- YouthCategory
- AgeGroup

Achte auf:
- Migrationen
- Rückwärtskompatibilität
- saubere Relationen
- keine Duplikatlogik
- klare Unterscheidung zwischen offiziellen, importierten, manuellen, spontanen und inoffiziellen Spielen

==================================================
4. PLANUNGSLOGIK
==================================================

Die Planerstellung soll folgende Faktoren berücksichtigen können:

- ausgewählte Kreise
- hochgeladene Kreis-/Spielplan-PDFs
- ausgewählte Jugenden
- mehrere Jahrgänge
- Lieblingsvereine
- favorisierte Mannschaften
- priorisierte Ligen
- bereits gesehene Mannschaften
- noch nicht gesehene Mannschaften
- Zuweisungen im Team
- Erreichbarkeit zwischen Spielorten
- Spielabsagen und Änderungen
- Länderspiel-Option
- Turniere
- inoffizielle oder manuelle Spiele

Wichtig:
Die Priorisierung muss transparent sein. User sollen nachvollziehen können, warum ein Spiel vorgeschlagen wird.

==================================================
5. UI/UX-ANFORDERUNGEN
==================================================

Baue die UI so, dass sie nicht überladen wirkt.

Erforderliche Bereiche:

1. Vor Planerstellung:
   - Kreise wählen
   - PDF hochladen
   - Jugenden/Jahrgänge wählen
   - Ligen spezifizieren/priorisieren
   - Lieblingsvereine wählen
   - favorisierte Mannschaften wählen
   - Länderspiel-Option aktivieren
   - Turniere einbeziehen

2. Spiel-Detail:
   - Notizen
   - Spieler-Highlights
   - Status
   - Quelle
   - Scout-Zuweisung
   - gesehen von
   - Erreichbarkeitsstatus
   - Spielort-Verifikation

3. Team-Ansicht:
   - Wer sieht welches Spiel?
   - Wer hat welches Spiel gesehen?
   - Welche Mannschaften wurden schon gesehen?
   - offene Spiele
   - Konflikte

4. Manuelle Erfassung:
   - spontanes Spiel nachtragen
   - inoffizielles Spiel anlegen
   - Turnier anlegen
   - PDF-Import prüfen

==================================================
6. PDF-EXPORT
==================================================

Erweitere vorhandene PDF-Exporte.

PDF soll künftig optional enthalten:

- Randnotizen
- Scout-Zuweisungen
- Erreichbarkeitswarnungen
- favorisierte Mannschaften/Vereine
- Ligenpriorität
- Quelle des Spiels
- Spielortstatus:
  - verifiziert
  - manuell bestätigt
  - erfahrungsgemäß/vermutet
- Turniere
- manuell/spontan/inoffiziell angelegte Spiele

Achte darauf, dass der PDF-Export übersichtlich bleibt.

==================================================
7. BENACHRICHTIGUNGEN
==================================================

Implementiere ein Benachrichtigungskonzept.

Events:
- Spielabsage
- Spielverlegung
- Änderung Spielort
- Änderung Uhrzeit
- favorisierte Mannschaft betroffen
- Scout wurde Spiel zugewiesen
- neues inoffizielles Spiel im Team
- neues Turnier
- PDF-Import abgeschlossen
- Erreichbarkeitskonflikt erkannt

Falls echte Push Notifications technisch noch nicht vorbereitet sind:
- erst internes Notification-Center implementieren
- Architektur für spätere Push Notifications vorbereiten

==================================================
8. TESTS
==================================================

Erstelle oder erweitere Tests für:

- Match Notes
- Player Highlights
- Favorite Teams
- Favorite Clubs
- League Priority
- Multi-youth/multi-age selection
- Manual Matches
- Unofficial Matches
- Tournament creation
- Team assignments
- Seen-by tracking
- Reachability conflict detection
- PDF import flow
- Notification events
- Venue history / estimated venues

Teste insbesondere:
- keine doppelten Spiele
- private vs. teamweite Notizen
- korrekte Sichtbarkeit nach Rollen
- korrekte Planungspriorisierung
- bestehende Features bleiben funktionsfähig

==================================================
9. WICHTIGE REGELN
==================================================

- Keine bestehenden Features zerstören.
- Keine schnellen Hacks.
- Keine doppelten Datenmodelle bauen.
- Bestehende Architektur respektieren.
- Wenn etwas unklar ist, erst Code analysieren und dann sinnvolle Annahmen dokumentieren.
- Wenn eine externe Quelle wie DFB.de oder fussball.de technisch instabil ist, Adapter sauber kapseln.
- Manuelle Eingabe immer als Fallback anbieten.
- Geschätzte Informationen müssen klar als geschätzt markiert werden.
- Offizielle, manuelle, importierte, spontane und inoffizielle Spiele müssen unterscheidbar bleiben.
- Team- und Rechtekonzept muss sauber umgesetzt werden.

==================================================
10. ERGEBNIS
==================================================

Am Ende erwarte ich:

1. Implementierte Features
2. Aktualisierte Datenmodelle/Migrationen
3. Aktualisierte UI
4. Aktualisierte Planungslogik
5. Aktualisierte PDF-Exporte
6. Tests
7. Dokumentation in `SCOUTX_FEATURE_EXPANSION_PROGRESS.md`
8. Abschlussbericht mit:
   - erledigt
   - teilweise erledigt
   - nicht erledigt
   - technische Risiken
   - nächste empfohlene Schritte

Starte jetzt mit der Analyse der Codebase und arbeite die Features nach sinnvoller technischer Reihenfolge ab.