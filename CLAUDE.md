# CLAUDE.md

This file provides guidance for working on ScoutX in this repository.

## Project Snapshot

ScoutX is a React 19 SPA (Vite + React Router v6) for football scouting workflows.
User-facing UI text is German.

### Main routes
- `/hub`
- `/setup`
- `/games`
- `/plan`
- `/scout-sheet`
- `/dashboard`
- `/admin`

### Core state architecture
- `SetupContext`
- `GamesContext`
- `PlanContext`
- `ScoutXProductContext`
- `ScoutXContext` as umbrella provider

### Adapter service
- Standalone Node.js HTTP service in `adapter-service/server.mjs`
- Primary endpoint: `POST /api/games`
- Persistent JSON store (`games.store.json`)
- Optional weekly refresh with `fetch-week.fussballde.mjs`

## Commands

```bash
# Development
npm install
npm run dev
npm run adapter:dev

# Quality
npm run lint
npm run format
npm run format:check
npm run test
npm run test:watch
npm run build

# Docker
docker compose --profile dev up --build
docker compose --profile prod up --build
```

## Source of truth locations

- Germany state/region mapping:
  `src/data/germany_regions.js`
- Setup flow and payload handover:
  `src/context/SetupContext.jsx`, `src/pages/SetupPage.jsx`
- Provider chain and adapter fallback logic:
  `src/services/dataProvider.js`
- Adapter HTTP layer:
  `adapter-service/server.mjs`
- fussball.de scraping/export:
  `adapter-service/scripts/fetch-week.fussballde.mjs`
  `adapter-service/lib/fussballde.js`

## Working conventions

- Keep user-facing text in German.
- Prefer extending existing provider and adapter patterns over introducing new architecture.
- Treat `fussballDeMapping` as editable runtime mapping data; avoid hardcoding per-region rules in multiple files.
- Do not document or claim LLM-based planning unless the code path exists.
