# ScoutX

ScoutX ist eine React-SPA für die Konfiguration, Sichtung und Planung von Fußball-Scouting.

## Architektur

- Frontend: React 19, Vite, React Router v6
- Haupt-Routen: `/hub`, `/setup`, `/games`, `/plan`, `/scout-sheet`, `/dashboard`, `/admin`
- State: `SetupContext`, `GamesContext`, `PlanContext`, `ScoutXProductContext` + `ScoutXContext`
- Adapter: Node.js-Service unter `adapter-service/server.mjs`

## Schnellstart

```bash
npm install
npm run adapter:dev
npm run dev
```

- Frontend: `http://localhost:5173`
- Adapter Health: `http://127.0.0.1:8787/health`

## Qualitätschecks

```bash
npm run lint
npm run test
npm run build
```

## Adapter-Betrieb

- Frontend verwendet standardmäßig `/api/games` (Proxy über Vite/Nginx).
- Optionales Override: `VITE_ADAPTER_ENDPOINT=https://dein-host/api/games`
- Optionaler Bearer-Token:
  - Frontend: `VITE_ADAPTER_TOKEN=<token>`
  - Adapter: `ADAPTER_TOKEN=<token>`

Details: [adapter-service/README.md](/Users/playboiiboggos/.openclaw/workspace/ScoutX/adapter-service/README.md)

## Google Maps (optional)

Ohne API-Key nutzt ScoutX OSRM/Haversine-Fallbacks.

Für Google-Geocoding/Routes:

```bash
VITE_GOOGLE_MAPS_API_KEY=your-key-here
VITE_GOOGLE_MAPS_STRICT=false
```

- `VITE_GOOGLE_MAPS_STRICT=false` ist der Default.
- Runtime-Key kann in der Setup-UI lokal gespeichert werden.

## Docker

```bash
docker compose --profile dev up --build
docker compose --profile prod up --build
```
