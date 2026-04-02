# Codebase Structure

**Analysis Date:** 2026-04-02

## Directory Layout

```
ScoutX/
├── src/                              # Main React SPA source
│   ├── main.jsx                      # React root entry point
│   ├── app.jsx                       # Root App component (state orchestration)
│   ├── context/
│   │   └── ScoutPlanContext.jsx      # Global state provider
│   ├── pages/                        # Page-level components (router destinations)
│   │   ├── SetupPage.jsx
│   │   ├── GamesPage.jsx
│   │   └── PlanPage.jsx
│   ├── components/                   # Reusable UI components
│   │   ├── ErrorBoundary.jsx
│   │   ├── Buttons.jsx
│   │   ├── StepNav.jsx
│   │   ├── KreisSelector.jsx
│   │   ├── AgeGroupSelector.jsx
│   │   ├── TeamPicker.jsx
│   │   ├── DateFocusPanel.jsx
│   │   ├── DataSourceConfig.jsx
│   │   ├── LLMConfig.jsx
│   │   ├── GameCards.jsx
│   │   ├── GameTable.jsx
│   │   ├── TopFive.jsx
│   │   ├── GameCards.jsx
│   │   ├── PlanView.jsx
│   │   ├── PDFExport.jsx
│   │   ├── BMGBadge.jsx
│   │   ├── SectionHeader.jsx
│   │   ├── SkeletonLoader.jsx
│   │   └── *.test.jsx                # Component tests (vitest)
│   ├── services/                     # Business logic + API calls
│   │   ├── dataProvider.js           # Game data fetching (CSV, adapter, mock)
│   │   ├── llm.js                    # LLM interaction (Ollama, OpenAI)
│   │   └── *.test.js                 # Service tests (vitest)
│   ├── hooks/                        # Custom React hooks
│   │   └── useWindowWidth.js         # Window width listener for responsive design
│   ├── data/                         # Static constants and reference data
│   │   ├── kreise.js                 # Regions + team lists
│   │   ├── altersklassen.js          # Age groups + kickoff times
│   │   └── constants.js              # LLM presets, colors, storage keys
│   ├── styles/
│   │   └── theme.js                  # Global CSS + design tokens (C, GCSS, inp, lbl, secH, card)
│   ├── test/
│   │   ├── setup.js                  # Vitest setup (jsdom environment)
│   └── (Other test files)
├── adapter-service/                  # Separate Node.js backend for game data
│   ├── server.mjs                    # Express-like HTTP server (port 8787)
│   ├── lib/
│   │   ├── games.js                  # Game normalization + deduplication
│   │   ├── loader.js                 # Data store I/O
│   │   ├── week.js                   # Week range calculations + caching
│   │   ├── dynamicSources.js         # External data fetching (fussball.de scraper)
│   │   ├── fussballde.js             # Fussball.de parsing
│   │   ├── csv.js                    # CSV parsing utilities
│   │   └── *.test.js                 # Service tests
│   ├── scripts/
│   │   ├── fetch-week.fussballde.mjs # External scraper script
│   │   └── fetch-week.example.mjs
│   ├── data/
│   │   ├── games.store.json          # Persistent game data store
│   │   ├── games.sample.json         # Sample/fallback game data
│   │   ├── team-aliases.json         # Team name normalization map
│   │   └── imports/                  # User uploads (CSV/JSON)
│   └── Dockerfile
├── .planning/                        # GSD planning docs
│   └── codebase/                     # Architecture + analysis documents
├── public/                           # Static assets (if any)
├── dist/                             # Vite build output (gitignored)
├── node_modules/                     # Dependencies (gitignored)
├── index.html                        # HTML entry point (loads src/main.jsx)
├── vite.config.js                    # Vite build config + test config
├── eslint.config.js                  # ESLint rules (React, hooks, refresh)
├── .prettierrc                        # Code formatting (120 char width, trailing commas)
├── package.json                      # Dependencies (React, React Router, Vitest)
├── package-lock.json
└── README.md
```

## Directory Purposes

**src/**
- Purpose: Main React application source
- Contains: Components, pages, services, hooks, styles, static data
- Key files: `main.jsx` (entry), `app.jsx` (root), `context/`, `pages/`, `components/`, `services/`

**src/pages/**
- Purpose: Page-level components for router destinations
- Contains: SetupPage, GamesPage, PlanPage (full-page layouts)
- Key files: `SetupPage.jsx` (wizard step 1), `GamesPage.jsx` (step 2), `PlanPage.jsx` (step 3)

**src/components/**
- Purpose: Reusable UI components
- Contains: Form inputs, buttons, cards, displays, layout components
- Key files: `Buttons.jsx`, `KreisSelector.jsx`, `TeamPicker.jsx`, `GameTable.jsx`, `PDFExport.jsx`

**src/services/**
- Purpose: Business logic, API calls, data transformations
- Contains: Data provider implementations, LLM backends, normalization utilities
- Key files: `dataProvider.js` (pluggable game data sources), `llm.js` (LLM backends)

**src/hooks/**
- Purpose: Custom React hooks
- Contains: Reusable logic (event listeners, state management patterns)
- Key files: `useWindowWidth.js` (responsive design helper)

**src/data/**
- Purpose: Static constants and reference data
- Contains: Regions, age groups, LLM presets, color scheme, storage keys
- Key files: `kreise.js` (FVN regions), `altersklassen.js` (youth age groups), `constants.js` (presets + colors)

**src/styles/**
- Purpose: Design tokens and global CSS
- Contains: Theme colors, responsive grid CSS, animation keyframes, component-level object styles
- Key files: `theme.js` (exports C colors, GCSS global styles, inp/lbl/card object styles)

**src/context/**
- Purpose: React Context for global state
- Contains: ScoutPlanContext provider and hook
- Key files: `ScoutPlanContext.jsx` (state injection to all pages/components)

**src/test/**
- Purpose: Test setup and fixtures
- Contains: Vitest configuration, test utilities
- Key files: `setup.js` (jsdom environment, test globals)

**adapter-service/**
- Purpose: Separate Node.js backend for game data (microservice)
- Contains: HTTP server, data store, external API integration
- Key files: `server.mjs` (main), `lib/games.js` (normalization)

**adapter-service/lib/**
- Purpose: Business logic for adapter service
- Contains: Game normalization, data I/O, week caching, external scraping
- Key files: `games.js`, `loader.js`, `week.js`, `fussballde.js`

**adapter-service/data/**
- Purpose: Data persistence and imports
- Contains: JSON stores (games, aliases), CSV/JSON user uploads
- Key files: `games.store.json`, `team-aliases.json`

## Key File Locations

**Entry Points:**
- `index.html`: HTML root (loads src/main.jsx via `<script type="module">`)
- `src/main.jsx`: React app initialization (createRoot, render App)
- `src/app.jsx`: Root component (state orchestration, routing, context provision)

**Configuration:**
- `vite.config.js`: Build tool, dev proxy, test framework config
- `eslint.config.js`: Linting rules
- `.prettierrc`: Code formatting rules
- `package.json`: Dependencies and scripts

**Core Logic:**
- `src/app.jsx`: State management, navigation, data orchestration
- `src/services/dataProvider.js`: Game data fetching (pluggable providers)
- `src/services/llm.js`: LLM backends (Ollama, OpenAI)
- `src/context/ScoutPlanContext.jsx`: Global state provider

**Testing:**
- `src/test/setup.js`: Vitest jsdom setup
- `src/**/*.test.jsx`, `src/**/*.test.js`: Component and service tests
- `adapter-service/lib/*.test.js`: Service tests for adapter

**Styling:**
- `src/styles/theme.js`: Design tokens (C), global CSS (GCSS), object styles (inp, lbl, card)
- `src/data/constants.js`: Color scheme (C) + LLM presets

**Static Data:**
- `src/data/kreise.js`: FVN regions, team lists
- `src/data/altersklassen.js`: Youth age groups, kickoff times
- `src/data/constants.js`: LLM presets, storage keys, colors

## Naming Conventions

**Files:**
- Components: PascalCase (e.g., `KreisSelector.jsx`, `GameTable.jsx`)
- Services: camelCase (e.g., `dataProvider.js`, `llm.js`)
- Tests: `*.test.jsx` or `*.test.js` suffix
- Constants: camelCase files, UPPER_CASE exports (e.g., `constants.js` exports `STORAGE_KEYS`)
- Hooks: `use*` prefix (e.g., `useWindowWidth.js`, `useScoutPlan()`)

**Directories:**
- Feature/domain-based: `pages/`, `components/`, `services/`, `data/`, `hooks/`
- Lowercase: All directory names are lowercase with no hyphens
- Adapter service: hyphenated `adapter-service/` to distinguish microservice

**React Components:**
- Functional components, PascalCase names
- Exported directly (named exports)
- Props destructured in function signature
- Custom hooks called via `useScoutPlan()` from context

**Functions:**
- camelCase naming (e.g., `fetchGamesWithProviders()`, `callLLM()`)
- Async functions return Promises
- Private utilities (prefixed with `_` or placed in module scope)

**Variables:**
- State: camelCase (e.g., `selectedTeams`, `loadingAI`)
- Constants: UPPER_SNAKE_CASE (e.g., `STORAGE_KEYS`, `LLM_PRESETS`)
- Objects: camelCase (e.g., `contextValue`, `normalizedGame`)

**CSS Classes:**
- BEM-inspired naming (e.g., `.fu`, `.ghost-btn`, `.pri-btn`, `.team-chip.sel`)
- Primarily inline styles; classes for animations and media query targets

## Where to Add New Code

**New Feature:**
- Primary code: `src/pages/` (if page-level) or `src/components/` (if component-level)
- Logic: `src/services/` (if calling external APIs or transforming data)
- Tests: Co-located `*.test.jsx` or `*.test.js` in same directory
- State: Add properties to context value in `src/app.jsx`, pass via `useScoutPlan()`

**New Component/Module:**
- Implementation: `src/components/FileName.jsx`
- Import theme tokens: `import { C } from "../styles/theme"`
- Import context if needed: `import { useScoutPlan } from "../context/ScoutPlanContext"`
- Export named: `export function ComponentName() { ... }`

**Utilities/Helpers:**
- Shared across services: `src/services/` (e.g., `dataProvider.js` helper functions)
- Shared across components: `src/hooks/` (custom hooks) or inline in `src/services/`
- Domain-specific: Create in relevant service file (avoid separate `utils/` folder)

**New Data/Constants:**
- Reference data (regions, age groups): `src/data/`
- Presets and configuration: `src/data/constants.js`
- Runtime constants: `src/data/constants.js` (LLM_PRESETS, STORAGE_KEYS)

**New Service (Backend):**
- Adapter logic: `adapter-service/lib/` (e.g., new data source processor)
- HTTP endpoint: Add route to `adapter-service/server.mjs`
- Tests: `adapter-service/lib/*.test.js`

**Tests:**
- Unit tests for services: `src/services/*.test.js`
- Component tests: `src/components/*.test.jsx`
- Fixture/mock data: `src/test/` or inline in test files
- Setup: `src/test/setup.js` (Vitest jsdom config)

## Special Directories

**node_modules/:**
- Purpose: Installed dependencies
- Generated: Yes (by npm)
- Committed: No (gitignored)

**dist/:**
- Purpose: Vite production build output
- Generated: Yes (by `npm run build`)
- Committed: No (gitignored)

**.next/ (if applicable):**
- Purpose: Not used (Vite, not Next.js)
- Generated: No
- Committed: N/A

**adapter-service/data/:**
- Purpose: Persistent data stores and imports
- Generated: games.store.json by adapter runtime; imports/ from user uploads
- Committed: Sample data (games.sample.json, team-aliases.json) YES; runtime stores NO (gitignored)

**adapter-service/imports/:**
- Purpose: User-uploaded CSV/JSON files
- Generated: By file upload handler in adapter
- Committed: No (likely gitignored)

**.planning/codebase/:**
- Purpose: GSD architecture and analysis documents
- Generated: No (manually written)
- Committed: Yes

---

*Structure analysis: 2026-04-02*
