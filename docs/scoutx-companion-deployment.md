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

### Homeserver im lokalen Netzwerk

Wenn ScoutX von einer privaten Netzwerk-Origin läuft (`localhost`, `127.0.0.1`, `10.x`, `192.168.x`, `172.16-31.x`, `169.254.x` oder `*.local`), darf die Web-App zuerst den same-origin Starter verwenden:

- `POST /api/companion/start`

Damit kann ein Homeserver, der den Starter-Endpunkt bereitstellt, die HRworks-Bridge und Chrome direkt auf dem Homeserver öffnen.

### Externe deployte Instanz

Wenn ScoutX von einer externen produktiven Origin läuft, versucht die Web-App **nicht**, einen Prozess auf dem Server zu starten.

Stattdessen:

1. ScoutX prüft `http://127.0.0.1:8791/health` auf dem Gerät des Users.
2. Wenn der Companion nicht erreichbar ist, versucht ScoutX einen lokalen Protocol-Wakeup:
   - `scoutx-companion://start?capability=hrworks-import`
3. Danach wird `localhost` erneut geprüft.
4. Erst dann wird der HRworks-Flow geöffnet.

## Konsequenz

Der HRworks-Button ist auf einer externen Instanz nur dann vollständig funktionsfähig, wenn auf dem Benutzergerät ein lokaler `ScoutX Companion` läuft oder per Protocol-Wakeup erreichbar ist.

Der lokale Homeserver kann ein HRworks-Automationshost sein, wenn er den Companion-Starter bereitstellt und Chrome/Playwright auf demselben Gerät verfügbar sind.

## Aktueller Stand

- Die Web-App unterstützt bereits die Trennung zwischen lokalem Dev-Starter und lokalem Companion pro User-Gerät.
- Die bestehende Node-/Playwright-Bridge ist der aktuelle technische Vorläufer des Companions.
- Auf macOS kann der lokale Companion per LaunchAgent dauerhaft im Benutzerkontext gestartet werden.
- Für Windows fehlt noch eine installierbare Desktop-Verpackung mit registriertem `scoutx-companion://`-Protocol.

## macOS LaunchAgent

Der LaunchAgent startet die HRworks-Bridge beim Benutzer-Login und hält sie mit `KeepAlive` unter `http://127.0.0.1:8791` erreichbar. Er wird in das Benutzerprofil geschrieben und benötigt keine Systemrechte.

Installation:

```bash
npm run companion:install
```

Status:

```bash
npm run companion:status
```

Entfernen:

```bash
npm run companion:uninstall
```

Die installierte plist liegt unter:

```text
~/Library/LaunchAgents/com.scoutx.hrworks-companion.plist
```

Logs:

```text
~/Library/Logs/ScoutX/hrworks-companion.out.log
~/Library/Logs/ScoutX/hrworks-companion.err.log
```

Wenn Chrome nicht mit Remote-Debugging auf `127.0.0.1:9222` läuft, startet der Companion ein eigenes kontrolliertes Chrome-Profil. Das ist erwartetes Verhalten; HRworks-Login und Import laufen trotzdem lokal auf dem Gerät des Users.

## User-Downloads aus ScoutX

Für Nicht-Entwickler stellt ScoutX Companion-ZIP-Pakete unter `/downloads/` bereit:

```text
/downloads/scoutx-companion-macos.zip
/downloads/scoutx-companion-windows.zip
```

Die Pakete werden gebaut mit:

```bash
npm run companion:packages
```

Der HRworks-Wizard erkennt das lokale Betriebssystem und zeigt bei fehlendem Companion den passenden Download an. Nach Installation prüft der Button `Verbindung erneut prüfen` ausschließlich `http://127.0.0.1:8791/health` auf dem Gerät des Users.

### macOS-Paket

- User entpackt `scoutx-companion-macos.zip`.
- User öffnet `install.command`.
- Installer kopiert die Bridge nach `~/Library/Application Support/ScoutX Companion`.
- Installer installiert npm-Abhängigkeiten lokal im Companion-Verzeichnis.
- Installer registriert `~/Library/LaunchAgents/com.scoutx.hrworks-companion.plist`.

### Windows-Paket

- User entpackt `scoutx-companion-windows.zip`.
- User öffnet `install.bat`.
- Installer kopiert die Bridge nach `%LOCALAPPDATA%\ScoutX Companion`.
- Installer installiert npm-Abhängigkeiten lokal im Companion-Verzeichnis.
- Installer registriert die Aufgabe `ScoutX HRworks Companion` in der Windows-Aufgabenplanung für den Login des Users.

### Einschränkungen der ersten Paketversion

- Node.js/npm müssen auf dem User-Gerät installiert sein.
- Die Pakete sind nicht signiert und haben keinen Auto-Updater.
- Der Companion lauscht nur auf `127.0.0.1`; er darf nicht an `0.0.0.0` oder Netzwerkinterfaces gebunden werden.
- Signierte Installer und Protocol-Handler `scoutx-companion://` bleiben der nächste Produktisierungsschritt.
