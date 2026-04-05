# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ScoutX is a React SPA for AI-powered youth football scouting plans, built for Borussia Mönchengladbach's NLZ in the Niederrhein/FVN region. The UI and all user-facing text are in German.

## Commands

```bash
# Development
npm install
npm run dev              # Vite dev server at http://localhost:5173
npm run adapter:dev      # Node.js adapter service at http://127.0.0.1:8787

# Quality
npm run lint             # ESLint
npm run format           # Prettier (semi, double quotes, trailing commas, 120 width)
npm run format:check     # Check formatting only
npm run test             # Vitest (run once)
npm run test:watch       # Vitest (watch mode)
npm run build            # Production build

# Docker
docker compose --profile dev up --build   # Dev with hot reload
docker compose --profile prod up --build  # Prod with Nginx
```

## Architecture

### Three-Step Workflow
`/setup` → `/games` → `/plan` (React Router v6, catch-all redirects to `/setup`)

1. **Setup** – Select district (Kreis), age group (Jugendklasse), teams, dates, scout focus, data source, LLM config
2. **Games** – Fetched games displayed as table (desktop) or cards (mobile), top 5 prioritized matches
3. **Plan** – AI-generated scout plan with export to PDF

### State Management
- **ScoutXContext** (React Context) wraps the entire app; access via `useScoutX()` hook
- **App.jsx** holds all local state and passes 80+ handler functions through context
- **localStorage**: `scoutplan.setup.v1` (setup state), `scoutplan.llm.v1` (LLM config)
- **sessionStorage**: `scoutplan.llm.sessionKey.v1` (temporary API key)

### Data Flow
```
User Config → fetchGamesWithProviders() → Games[] with priority scoring → callLLM() → Scout Plan text
```

**Data sources** (`dataMode`): `auto` (tries csv→adapter→mock), `csv`, `adapter`, `mock`

### Key Service Files
- `src/services/dataProvider.js` – Game fetching, CSV/JSON parsing, team matching, priority scoring
- `src/services/llm.js` – LLM integration (Ollama default, OpenAI-compatible endpoints)

### Adapter Service (`adapter-service/`)
Standalone Node.js HTTP server (port 8787) with persistent game data, weekly auto-refresh, and fussball.de scraping. Key endpoints: `POST /api/games`, `POST /api/admin/refresh`, `GET /health`.

### Styling
- Dark theme only, inline styles (CSS-in-JS) + global CSS via `theme.js` GCSS string
- Color constants in `src/constants.js` (`C` object, primary green: `#00873E`)
- Barlow / Barlow Condensed fonts
- Responsive breakpoints: 480px, 560px, 600px (table↔cards), 700px

### LLM Integration
Supports Ollama (local, default), OpenAI API, LM Studio, and custom endpoints. Presets defined in `src/constants.js` (`LLM_PRESETS`). Vite proxies `/ollama` to `localhost:11434` in dev.

## Conventions
- All user-facing strings are in German
- Functional components with hooks only (React 19)
- ESM modules throughout (frontend and adapter service)
- District data and team lists are in `src/constants.js` (`KREISE`, `VEREINE_JE_KREIS`)
