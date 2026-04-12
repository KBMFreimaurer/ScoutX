# ScoutX

ScoutX ist eine React-SPA für KI-gestützte Jugend-Scouting-Pläne (FVN/Niederrhein).

## Schnellstart (vollautomatisch)

```bash
npm install
npm run adapter:dev
npm run dev
```

- Frontend: `http://localhost:5173`
- Adapter Health: `http://127.0.0.1:8787/health`

## Vollautomatischer Datenfluss

Beim Erstellen eines ScoutXs ruft das Frontend den Adapter an.
Der Adapter kann dann die angefragte Woche automatisch aktualisieren:

- per `ADAPTER_EXPORT_COMMAND` (standardmäßig: `node /app/scripts/fetch-week.fussballde.mjs`)
- oder per `ADAPTER_WEEK_SOURCE_URL_TEMPLATE` (Remote-Feed)
- `Auto`-Datenmodus nutzt nur echte Quellen (`CSV -> Adapter`), kein stiller Demo-Fallback
- Frontend-Default für den Adapter ist `/api/games` (Proxy über Vite/Nginx)
- Optionales Frontend-Override: `VITE_ADAPTER_ENDPOINT=https://dein-host/api/games`
- Teamauswahl in ScoutX wird beim Live-Adapter als Such-Hinweis genutzt (nicht als harter Filter): passende Vereins-Spiele werden priorisiert, aber weitere Kreis/Jugend-Spiele bleiben im Plan/PDF enthalten.
- Frisch exportierte Wochen-Daten ersetzen für diese Woche vorhandene Store-Daten (inkl. Sample), damit PDFs reale Ergebnisse enthalten.

Dadurch ist kein manueller Import vor jeder Planung nötig.

Details: [adapter-service/README.md](./adapter-service/README.md)

## Home-Server Zugriff (mehrere Geräte)

Damit andere Geräte im LAN den Live-Adapter zuverlässig nutzen können:

1. Frontend-Endpoint auf Reverse-Proxy lassen: `VITE_ADAPTER_ENDPOINT=/api/games`
2. Nginx muss `/api/` auf den Adapter weiterleiten (siehe `nginx.conf`)
3. Adapter auf allen Interfaces binden: `ADAPTER_HOST=0.0.0.0`
4. Wenn Adapter-Auth aktiv ist (`ADAPTER_TOKEN` gesetzt), zusätzlich im Frontend setzen:
   `VITE_ADAPTER_TOKEN=<token>`

Schnellcheck vom zweiten Gerät:

- Webapp: `http://<server-ip>:5580`
- Adapter über Proxy: `http://<server-ip>:5580/api/games` (POST)
- Health direkt (optional): `http://<server-ip>:8787/health`

## Google Maps API-Key für exakte Routen

Für präzise Entfernungen (Startadresse -> Spiele -> Rückfahrt) inkl. Fahrtkosten-Berechnung:

1. In der Google Cloud Console ein Projekt erstellen: `https://console.cloud.google.com/`
2. Billing für das Projekt aktivieren.
3. APIs aktivieren:
   `Geocoding API` und `Routes API (New)`
4. API-Key anlegen:
   `APIs & Services -> Credentials -> Create credentials -> API key`
5. API-Key absichern:
   Für die aktuelle clientseitige Integration muss der Key ohne Referrer-Zwang funktionieren
   (`Application restrictions: None`) und per `API restrictions` auf `Geocoding API` + `Routes API (New)` begrenzt sein.
   Optional: `Directions API (Legacy)` nur dann aktivieren, wenn du den Legacy-Fallback zusätzlich nutzen willst.
6. Der API-Key ist im Projekt bereits hinterlegt.
   Optional kannst du ihn per `/.env.local` überschreiben:
   `VITE_GOOGLE_MAPS_API_KEY=<DEIN_KEY>`
   `VITE_GOOGLE_MAPS_STRICT=true`
7. Frontend neu starten (`npm run dev`), falls du per ENV überschrieben hast.

Hinweis:
- In der Setup-UI (Startort-Block) wird der Status sichtbar angezeigt (`Google Maps aktiv`, inkl. Key-Quelle).
- Ohne Key nutzt ScoutX nur ungenaue Fallbacks (OSRM/Haversine).

## Docker Compose

Für Server-Builds (Compose) kannst du den Key optional in die Server-`.env` legen (als Override):

```bash
VITE_GOOGLE_MAPS_API_KEY=<DEIN_KEY>
VITE_GOOGLE_MAPS_STRICT=true
```

`docker-compose.yml` übergibt diese Variablen automatisch an Dev und Prod (inkl. Build-Args für Prod).

```bash
# Frontend + Adapter (dev profile)
docker compose --profile dev up --build

# Frontend + Adapter (prod profile)
docker compose --profile prod up --build
```

## Letzte Änderungen

- 2026-04-12: Google Maps API-Key ist direkt im Projekt hinterlegt; ENV/Compose bleibt als optionaler Override aktiv.
- 2026-04-12: Routing nutzt jetzt primär Google Routes API (v2), Legacy-Directions nur noch als Fallback; Geocoding-Fehler zeigen jetzt konkrete Google-Statusmeldungen (z. B. `REQUEST_DENIED`).
- 2026-04-11: Google-Routing-Scaffolding ergänzt: sichtbarer API-Status im Setup, ENV-Vorlage bereinigt, Dokumentation für Key-Setup ergänzt.
- 2026-04-11: Wetterermittlung wurde vollständig entfernt (Enrichment, UI und PDF-Details).
- 2026-04-07: Games-Seite zeigt jetzt einen Live-Hinweis, wenn Entfernungs-Enrichment im Hintergrund noch läuft.
- 2026-04-07: PDF-Generierung hat jetzt kontrolliertes Fehler-Handling mit UI-Feedback und deaktiviertem Erstellen-Button während laufendem Export.
- 2026-04-07: Games-Enrichment läuft jetzt mit begrenzter Parallelität (max. 5 gleichzeitig), um externe Geo-Requests kontrollierter zu staffeln.
- 2026-04-07: Enrichment-Update in Games nutzt jetzt stets aktuelle Favoriten/Notizen, damit zwischenzeitlich gesetzte Spiel-Notizen beim asynchronen Nachladen nicht überschrieben werden.
- 2026-04-07: Setup-Auswahl (Kreis, Jugend, Teams, Startdatum, Fokus, Adapter-Endpoint) wird jetzt in `localStorage` persistiert und nach Reload automatisch wiederhergestellt.
- 2026-04-07: Adapter-Datumsnormalisierung nutzt lokale Kalenderdaten statt UTC-Slice, um Tagesverschiebungen bei `dd.mm.yyyy` zu vermeiden.
- 2026-04-07: CSV-Import verarbeitet nun korrekt quoted Felder mit Trennzeichen und escaped Quotes (`""`).
- 2026-04-07: Ungültige `fromDate`-Werte werden jetzt früh validiert und mit klarer Fehlermeldung abgewiesen (kein stilles `Invalid Date`-Folgeverhalten).
- 2026-04-07: Adapter-Remote-Refresh hat nun Abort-Timeout (`ADAPTER_REMOTE_TIMEOUT_MS`) statt potenziell unbegrenzt zu hängen.

## Qualität

```bash
npm run lint
npm run test
npm run build
```
