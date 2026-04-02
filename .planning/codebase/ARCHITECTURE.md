# Architecture

**Analysis Date:** 2026-04-02

## Pattern Overview

**Overall:** Three-layer client-server SPA with plugin architecture for data providers and LLM backends.

**Key Characteristics:**
- React-based SPA with React Router for multi-step wizard navigation
- Context-based state management (no Redux/Zustand)
- Pluggable data provider system (CSV import, HTTP adapter, mock data)
- Pluggable LLM backend system (Ollama, OpenAI, LM Studio)
- Modular business logic separated into discrete services
- Primarily inline styling with a centralized theme constants layer

## Layers

**Presentation (UI):**
- Purpose: Render user interface and handle user interactions
- Location: `src/components/`, `src/pages/`
- Contains: React functional components, page layouts, UI reusable components
- Depends on: React Router, Context (ScoutPlanContext), Theme (C, GCSS)
- Used by: Main app rendering, user interaction flows

**State Management:**
- Purpose: Hold and provide application state to components
- Location: `src/context/ScoutPlanContext.jsx`, `src/app.jsx` (for centralized state)
- Contains: React Context provider, global state (setup params, games, plan, LLM config)
- Depends on: React hooks (useState, useEffect)
- Used by: All page and component layers via useScoutPlan hook

**Business Logic (Services):**
- Purpose: Handle data transformations, API calls, and core functionality
- Location: `src/services/` (dataProvider.js, llm.js)
- Contains: Game data fetching/parsing, LLM interactions, team matching logic
- Depends on: Data constants, normalization utilities
- Used by: App.jsx for data flow orchestration, components via context

**Data Layer:**
- Purpose: Define application constants and reference data
- Location: `src/data/` (kreise.js, altersklassen.js, constants.js)
- Contains: Static configuration (regions, age groups, LLM presets, colors)
- Depends on: None
- Used by: Services, app state initialization

**Styling:**
- Purpose: Centralize design tokens and CSS
- Location: `src/styles/theme.js`
- Contains: Color constants (C), global CSS (GCSS), input/label/card object styles (inp, lbl, secH, card)
- Depends on: `src/data/constants.js` for color values
- Used by: All components for consistent styling

## Data Flow

**User Setup Flow:**

1. User lands on `/setup` (SetupPage)
2. Selects: Kreis → Jugendklasse → Teams → Date range → Focus
3. Selects data source: CSV import, live adapter, or mock
4. Optionally configures LLM: endpoint, model, API key
5. Clicks "Build" → `onBuildAndGo()` in app.jsx

**Game Fetching Flow:**

1. App calls `fetchGamesWithProviders()` from `dataProvider.js`
2. Provider chain executes in order: CSV → Adapter → Mock
3. Each provider:
   - Validates parameters (kreisId, jugendId, teams, date range)
   - Fetches/generates games
   - Normalizes game objects
   - Filters by selection criteria
4. First successful provider returns games + source
5. Games stored in state, user navigates to `/games`

**Game Display Flow:**

1. GamesPage displays games from context
2. Shows mobile-friendly cards OR desktop table (CSS media queries)
3. Displays "Top 5" prioritized games (sorted by priority DESC)
4. User can trigger AI plan generation

**AI Planning Flow:**

1. User clicks "Generate Plan with AI"
2. App constructs detailed prompt:
   - Context: Kreis, Jugendklasse, age/cohort, focus
   - Game list: 380-game formatted list with priority markers
   - Scouting criteria specific to age group
3. `callLLM()` sends prompt to configured endpoint
   - Detects protocol (Ollama `/api/generate` vs OpenAI `/v1/chat/completions`)
   - Adds auth header if apiKey provided
4. LLM returns scouting plan (top 5 games + route + observations)
5. Plan stored in state, user navigates to `/plan`

**Plan Display Flow:**

1. PlanPage shows:
   - LLM-generated plan (text format)
   - Games table/cards for reference
   - PDF export button
2. User can export to PDF or reset

**State Management:**

- Setup state persists to localStorage (`scoutplan.setup.v1`)
- LLM config persists to localStorage (`scoutplan.llm.v1`)
- LLM API key: either in localStorage (if "remember" checked) OR sessionStorage (if temporary)
- Games state: in-memory only (cleared on setup reset)
- Plan state: in-memory only (cleared on games reset)

## Key Abstractions

**Game Object:**
- Purpose: Represent a single match/encounter
- Examples: `src/services/dataProvider.js` (normalizeUploadedGame), `src/components/GameTable.jsx`
- Pattern: Flat object with game, team, venue, time, distance, priority, turnier flag
- Structure: `{ id, home, away, dateObj, dateLabel, time, venue, km, priority, turnier, jugendId, kreisId }`

**Data Provider:**
- Purpose: Pluggable strategy for sourcing game data
- Examples: `fetchGamesCsv()`, `fetchGamesAdapter()`, `fetchGamesMock()`
- Pattern: Each provider is async function that validates params, fetches/generates, filters, returns games[]
- Fallback chain: Attempts CSV → Adapter → Mock until one succeeds

**LLM Backend:**
- Purpose: Pluggable strategy for AI analysis
- Examples: Ollama (`/api/generate`), OpenAI (`/v1/chat/completions`), LM Studio
- Pattern: Dual-path protocol detection; flexible auth header for API keys
- Protocol mapping: `isOllama ? ollama_format : openai_format`

**Normalization Utilities:**
- Purpose: Transform external/user data into canonical game format
- Examples: `normalizeUploadedGame()`, `normalizeDate()`, `normalizeTime()`
- Pattern: Each normalizer validates input, returns `{ value, fallback: bool }` or `{ game, issues }`

**Team Matching:**
- Purpose: Fuzzy-match team names across data sources (CSV, adapter, user selection)
- Examples: `isLikelyTeamMatch()`, `toTeamSearchKey()`, `tokenizeTeam()`
- Pattern: Normalize → key extraction → substring inclusion → token overlap scoring

## Entry Points

**Browser Entry:**
- Location: `index.html`
- Triggers: User navigates to app URL
- Responsibilities: Load index.html, mount React root, include global fonts

**React Root:**
- Location: `src/main.jsx`
- Triggers: DOM ready
- Responsibilities: Render App wrapped in StrictMode, ErrorBoundary, BrowserRouter, ScoutPlanProvider

**App Component:**
- Location: `src/app.jsx`
- Triggers: React render
- Responsibilities:
  - Initialize state from localStorage
  - Manage all state updates
  - Orchestrate data flow (games, plan)
  - Route between Setup/Games/Plan pages
  - Provide context value to all children
  - Handle window resize (for isMobile flag)

**Adapter Service (Separate Process):**
- Location: `adapter-service/server.mjs`
- Triggers: `npm run adapter:dev` or Docker container
- Responsibilities:
  - Expose HTTP endpoints for game data
  - Manage data store + cache
  - Orchestrate week refreshes from external sources
  - Handle CORS, auth tokens
  - Return JSON game arrays

## Error Handling

**Strategy:** Try-catch in async operations; error messages propagated to UI; ErrorBoundary catches render crashes.

**Patterns:**

- **Data Provider Errors:** Each provider wrapped in try-catch; errors logged to console; chain attempts next provider
- **LLM Errors:** HTTP errors caught, status code + partial response logged; user shown error message in UI
- **File Upload Errors:** CSV/JSON parsing errors caught; user shown descriptive error message
- **Validation Errors:** Preconditions checked (kreisId, jugendId, teams); user shown "Bitte..." message

## Cross-Cutting Concerns

**Logging:**
- Ad-hoc console.log() for debugging (no structured logger)
- Consider adding consistent error logging for production

**Validation:**
- Input validation in data providers (filterGamesBySelection checks filters)
- File parsing validation (parseUploadedGamesReport returns warnings)
- Precondition checks in app.jsx (onBuildAndGo validates setup state)

**Authentication:**
- LLM API keys stored in localStorage (if "remember" checked) or sessionStorage
- Adapter token stored in state, passed as Bearer in HTTP Authorization header
- No session-based auth; stateless HTTP calls

**Internationalization:**
- Hardcoded German (de-DE) throughout UI and prompts
- Locale baked into `formatDate()`, date formatting functions
- No i18n framework (would require significant refactoring)

**Responsive Design:**
- Mobile breakpoints: 600px (table visibility), 560px (layout reflow), 480px (grid columns), 400px (header text)
- CSS media queries in theme.js (GCSS)
- isMobile flag passed via context for conditional rendering
- Touch targets enforced (min-height: 44px)

---

*Architecture analysis: 2026-04-02*
