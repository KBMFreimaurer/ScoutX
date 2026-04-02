# Coding Conventions

**Analysis Date:** 2026-04-02

## Naming Patterns

**Files:**
- Components: PascalCase with `.jsx` extension - `StepNav.jsx`, `ErrorBoundary.jsx`, `Buttons.jsx`
- Services/utilities: camelCase with `.js` extension - `llm.js`, `dataProvider.js`, `useWindowWidth.js`
- Data/constants: camelCase with `.js` extension - `constants.js`, `kreise.js`, `altersklassen.js`
- Tests: Match source name with `.test.js` or `.test.jsx` suffix - `llm.test.js`, `StepNav.test.jsx`

**Functions:**
- React components: PascalCase - `export function StepNav()`, `export function ErrorBoundary()`
- Regular functions: camelCase - `readStorage()`, `formatDate()`, `callLLM()`
- Hooks: camelCase with `use` prefix - `useWindowWidth()`, `useScoutPlan()`
- Private functions: camelCase with no special prefix - `toLookupKey()`, `toTeamSearchKey()`, `tokenizeTeam()`
- Callback handlers in components: camelCase with descriptive name - `onStepChange`, `onError`, `onResize`

**Variables:**
- State variables: camelCase - `kreisId`, `selectedTeams`, `uploadedGames`, `llmType`
- Constants (module-level): UPPER_CASE_WITH_UNDERSCORES - `STEPS`, `STORAGE_KEYS`, `JUGEND_KLASSEN`, `KICKOFF_ZEITEN`, `GENERIC_TEAM_TOKENS`
- Object properties: camelCase - `uploadSummary.stats.totalRows`, `result.source`, `report.games`
- Loop indices: Standard conventions - `i`, `index`

**Types:**
- No TypeScript; JSDoc rarely used
- Parameter objects documented via JSDoc comment in `dataProvider.js` (line 531): "DataProvider Interface: fetchGames..."
- Shape conventions inferred from usage patterns (see Data Flow section)

## Code Style

**Formatting:**
- Prettier 3.4.2 with configuration in `.prettierrc`:
  - `semi: true` - Statements end with semicolons
  - `singleQuote: false` - Use double quotes for strings
  - `trailingComma: "all"` - Trailing commas in all multi-line structures
  - `printWidth: 120` - Line wrapping at 120 characters
- Run formatting: `npm run format`
- Check formatting: `npm run format:check`

**Linting:**
- ESLint 9.22.0 via flat config in `eslint.config.js`
- Rules enforced:
  - `react-refresh/only-export-components: warn` - Components should be default exports or simple named exports
  - `react/react-in-jsx-scope: off` - Modern React doesn't require React import
  - `react/jsx-uses-react: off` - Modern React doesn't require React.createElement
  - `react/prop-types: off` - No runtime prop validation (no TypeScript/PropTypes)
  - `no-unused-vars: warn` - Unused variables warned; parameters prefixed with `_` are ignored
- Run linting: `npm run lint`

**Indentation:**
- 2-space indentation (configured via Prettier)
- No tabs

## Import Organization

**Order:**
1. React/React Router imports at top
2. Internal component imports
3. Service/utility imports
4. Data/constant imports
5. Styles/theme imports

**Pattern from `app.jsx` (lines 1-15):**
```javascript
import { useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { BMGBadge } from "./components/BMGBadge";
import { StepNav } from "./components/StepNav";
import { ScoutPlanProvider } from "./context/ScoutPlanContext";
import { C, GCSS } from "./styles/theme";
import { useWindowWidth } from "./hooks/useWindowWidth";
import { KREISE, VEREINE_JE_KREIS } from "./data/kreise";
import { JUGEND_KLASSEN } from "./data/altersklassen";
import { fetchGamesWithProviders, parseUploadedGamesReport } from "./services/dataProvider";
import { callLLM, testConnection } from "./services/llm";
import { STORAGE_KEYS, LLM_PRESETS } from "./data/constants";
import { SetupPage } from "./pages/SetupPage";
import { GamesPage } from "./pages/GamesPage";
import { PlanPage } from "./pages/PlanPage";
```

**Path Aliases:**
- No path aliases configured; relative imports used throughout (e.g., `"../styles/theme"`, `"./components/StepNav"`)

## Error Handling

**Patterns:**
- Try-catch blocks for error-prone operations (storage access, network calls, parsing):
  ```javascript
  try {
    const item = window.localStorage.getItem(key);
    return item ? { ...fallback, ...JSON.parse(item) } : fallback;
  } catch {
    return fallback;
  }
  ```
- Errors thrown with descriptive messages in Error constructor:
  ```javascript
  throw new Error("Keine gültigen Spiele erkannt.");
  throw new Error("HTTP 500");
  throw new Error(`Adapter HTTP ${response.status}`);
  ```
- Custom hook guard throws descriptive error:
  ```javascript
  if (!context) {
    throw new Error("useScoutPlan muss innerhalb von ScoutPlanProvider verwendet werden.");
  }
  ```
- React Error Boundary (`ErrorBoundary.jsx`, lines 4-69) captures component tree errors and displays fallback UI with error message
- Network error responses checked via `response.ok` flag; non-200 responses throw with status code
- No global error logger; errors logged to React Error Boundary or caught silently with fallbacks

## Logging

**Framework:** `console` object not used in source code (grep returns 0 matches). Error Boundary uses React lifecycle hooks (`componentDidCatch`, `getDerivedStateFromError`) instead of logging.

**Patterns:**
- No explicit logging; debugging relies on:
  - React DevTools for component state inspection
  - Error Boundary captures render errors with `error.message`
  - Browser console for ad-hoc inspection during development

## Comments

**When to Comment:**
- Minimal; code is generally self-documenting
- Used for intent clarification in complex logic:
  - Line 531 `dataProvider.js`: `/**\n * DataProvider Interface: fetchGames(kreis, jugend, dateRange) -> Game[]\n */` documents function contract
  - Complex regex patterns with inline comments (e.g., `TIME_RE` matches HH:MM format)

**JSDoc/TSDoc:**
- Not used; no TypeScript
- No @param/@return documentation for functions
- Parameter shapes inferred from usage

## Function Design

**Size:**
- Small to medium functions (10-50 lines typical)
- Complex logic broken into helper functions:
  - `dataProvider.js`: Utility functions like `toLookupKey()`, `toTeamSearchKey()`, `tokenizeTeam()` separate concerns
  - `normalizeUploadedGame()` handles one game normalization; `parseCsvRows()` handles parsing; `parseUploadedGamesReport()` orchestrates both

**Parameters:**
- Most functions accept 1-3 explicit parameters
- Complex multi-parameter operations use object parameters:
  ```javascript
  fetchGamesWithProviders({
    mode = "auto",
    kreisId,
    jugendId,
    fromDate,
    toDate,
    teams,
    uploadedGames,
    adapterEndpoint,
    adapterToken,
    turnier,
  })
  ```
- Default parameter values used for optional params (e.g., `mode = "auto"`)
- React components use destructured props:
  ```javascript
  export function StepNav({ currentStep, onStepChange, canAccessGames, canAccessPlan, isMobile })
  ```

**Return Values:**
- Functions return objects with explicit structure:
  ```javascript
  { game: null, issues: ["..."] }
  { games, source: "csv" }
  { ok: true, models: [...] }
  { fromDate, toDate }
  ```
- Async functions return Promises; errors thrown rather than returned
- Void-like behavior (UI updates) relies on React state setters

## Module Design

**Exports:**
- Named exports for utilities and components:
  ```javascript
  export function StepNav() { ... }
  export async function callLLM() { ... }
  export const STEPS = ["setup", "games", "plan"];
  ```
- Context providers exported as named exports:
  ```javascript
  export function ScoutPlanProvider({ value, children }) { ... }
  export function useScoutPlan() { ... }
  ```
- Default export for main App component (`app.jsx` line 59):
  ```javascript
  export default function App() { ... }
  ```

**Barrel Files:**
- Not used; no index.js files aggregating exports
- Direct imports from source files required throughout

## Inline Styles

**Pattern:**
- Inline style objects used extensively in components instead of CSS classes
- Style objects destructured from theme constants (`C` from `styles/theme.js`):
  ```javascript
  style={{
    padding: isMobile ? "5px 9px" : "6px 14px",
    background: active ? C.green : done ? C.greenDim : "transparent",
    color: active ? C.white : done ? C.green : C.grayDark,
    border: `1px solid ${active ? C.green : done ? C.greenDark : C.border}`,
  }}
  ```
- Theme constants centralized in `src/styles/theme.js` (colors, presets)
- Responsive behavior via ternary operators based on viewport width
- No CSS-in-JS library; raw inline objects

---

*Convention analysis: 2026-04-02*
