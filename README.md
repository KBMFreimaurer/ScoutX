# ScoutPlan

ScoutPlan ist eine React-SPA für KI-gestützte Jugend-Scouting-Pläne (FVN/Niederrhein).

## Schnellstart (vollautomatisch)

```bash
npm install
npm run adapter:dev
npm run dev
```

- Frontend: `http://localhost:5173`
- Adapter Health: `http://127.0.0.1:8787/health`

## Vollautomatischer Datenfluss

Beim Erstellen eines ScoutPlans ruft das Frontend den Adapter an.
Der Adapter kann dann die angefragte Woche automatisch aktualisieren:

- per `ADAPTER_EXPORT_COMMAND` (standardmäßig: `node /app/scripts/fetch-week.fussballde.mjs`)
- oder per `ADAPTER_WEEK_SOURCE_URL_TEMPLATE` (Remote-Feed)
- `Auto`-Datenmodus nutzt nur echte Quellen (`CSV -> Adapter`), kein stiller Demo-Fallback

Dadurch ist kein manueller Import vor jeder Planung nötig.

Details: [adapter-service/README.md](./adapter-service/README.md)

## Docker Compose

```bash
# Frontend + Adapter (dev profile)
docker compose --profile dev up --build

# Frontend + Adapter (prod profile)
docker compose --profile prod up --build
```

## Qualität

```bash
npm run lint
npm run test
npm run build
```
