# ScoutX Web-vs-iOS Adapter Parity

Stand: 2026-05-07

## Kontext

Web und iOS (Capacitor) teilen sich dieselbe Frontend-Logik (`src/services/dataProvider.js`).  
Damit entsteht Paritaet primär durch identische Request-/Response-Logik plus iOS-spezifische Erreichbarkeits-Hardening-Maßnahmen.

## Vergleichsmatrix

| Thema | Web-Flow | iOS-Flow (Capacitor) | Paritaet |
| --- | --- | --- | --- |
| Endpoint | Standard: `/api/games` | Standard: `/api/games`, plus native Fallback-Kandidaten `http://localhost:8787/api/games` und `http://127.0.0.1:8787/api/games` | Ja (fachlich), iOS hat zusaetzliche Connectivity-Hardening-Logik |
| HTTP-Methode | `POST` | `POST` | Ja |
| Header | `Content-Type: application/json`, optional `Authorization: Bearer <token>` | identisch | Ja |
| Payload | `kreisId`, `stateCode`, `regionName`, `regionShortCode`, `fussballDeMapping`, `jugendId`, `fromDate`, `toDate`, `teams`, `ensureWeekData` | identisch | Ja |
| Timeout | `ADAPTER_TIMEOUT_MS` (Default 75s, deckelt auf 90s) | identisch | Ja |
| Error Handling | 401-Fehlertext, HTTP-Fehlerdetail, strict JSON parse, leere Antworten behandelt | identisch | Ja |
| Fallback-Range | Neighbour-range fallback bei leeren Responses (`ensureWeekData: false`) | identisch | Ja |
| Retry/Provider | Gleicher Provider-Runner, adapter-spezifische Retry-Konfiguration | identisch | Ja |

## Relevante Code-Referenzen

- `src/services/dataProvider.js:856` ff. (`fetchGamesAdapter`)
- `src/services/dataProvider.js:178` ff. (`buildAdapterEndpointCandidates`)
- `src/services/dataProvider.js:118` ff. (`fetchWithTimeout`)
- `src/context/GamesContext.jsx` (UI-seitige Fehlernormalisierung)

## Identifizierte historische Abweichungen und Fixstatus

1. **iOS Adapter-Endpoint nicht erreichbar bei rein relativem Pfad**
   - Ursache: Native Runtime mit anderem Networking-Kontext.
   - Fix: Endpoint-Kandidaten fuer `localhost`/`127.0.0.1`.
   - Status: behoben.

2. **iOS-Fehler "The string did not match the expected pattern"**
   - Ursache: fragile Response-Verarbeitung.
   - Fix: strict JSON parsing + konkrete Fehlertexte.
   - Status: behoben.

3. **Inkonsistente Flow-Zustaende bei Fehlern**
   - Ursache: unklare Error-Rueckmeldungen im Wizard.
   - Fix: Fehlernormalisierung und robustere Guard-Logik.
   - Status: behoben.

## Priorisierung (aus Zielvorgabe)

1. Adapter-Abruf/Paritaet: umgesetzt (Code + Tests).
2. E2E-Stabilitaet: umgesetzt in Tests/Simulator; echtes iPhone noch offen.
3. Hardcoded Google Key: umgesetzt.
4. Persistente Navigation: umgesetzt.
5. UX/Fehlerpolish: umgesetzt.
