# ScoutX Companion Deployment

## Zielbild

- Der Homeserver liefert nur die ScoutX-Web-App aus.
- HRworks-Automation läuft nicht auf dem Homeserver, sondern lokal auf dem Gerät des jeweiligen Users.
- Die Web-App spricht dafür über `http://127.0.0.1:8791` mit dem lokalen `ScoutX Companion`.

## Startverhalten

### Lokales Dev-Setup

Wenn ScoutX über `localhost` oder `127.0.0.1` läuft, darf die Web-App den lokalen Dev-Starter verwenden:

- `GET /health`
- `POST /api/companion/start`

Das ist nur für lokale Entwicklung gedacht.

### Deployte Instanz / Homeserver

Wenn ScoutX von einer produktiven Origin läuft, versucht die Web-App **nicht**, einen Prozess auf dem Homeserver zu starten.

Stattdessen:

1. ScoutX prüft `http://127.0.0.1:8791/health` auf dem Gerät des Users.
2. Wenn der Companion nicht erreichbar ist, versucht ScoutX einen lokalen Protocol-Wakeup:
   - `scoutx-companion://start?capability=hrworks-import`
3. Danach wird `localhost` erneut geprüft.
4. Erst dann wird der HRworks-Flow geöffnet.

## Konsequenz

Der HRworks-Button ist auf einer Homeserver-Instanz nur dann vollständig funktionsfähig, wenn auf dem Benutzergerät ein lokaler `ScoutX Companion` läuft oder per Protocol-Wakeup erreichbar ist.

Der Homeserver selbst ist **kein** HRworks-Automationshost.

## Aktueller Stand

- Die Web-App unterstützt bereits die Trennung zwischen lokalem Dev-Starter und lokalem Companion pro User-Gerät.
- Die bestehende Node-/Playwright-Bridge ist der aktuelle technische Vorläufer des Companions.
- Für ein echtes Produkt-Setup fehlt noch eine installierbare Desktop-Verpackung mit registriertem `scoutx-companion://`-Protocol für macOS und Windows.
