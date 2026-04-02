# Codebase Concerns

**Analysis Date:** 2026-04-02

## Tech Debt

### Massive App Component State Management

- **Issue:** `src/app.jsx` manages 30+ state variables directly, creating a monolithic god component (736 lines). State includes UI state, data state, form state, and configuration all mixed together.
- **Files:** `src/app.jsx`
- **Impact:** Makes testing individual state transitions difficult, increases cognitive load for developers, makes refactoring risky. Any state change requires modifying the main component. Difficult to share state patterns across features.
- **Fix approach:** Extract state management into custom hooks (useSetup, useDataSource, useLLMConfig) or migrate to a lightweight state management library (Zustand, Jotai). Move context provider logic into separate file. Consider splitting App into smaller page-layout components.

### LocalStorage / SessionStorage Direct Usage

- **Issue:** Raw `localStorage` and `sessionStorage` calls scattered throughout `src/app.jsx` (lines 154-189). No centralized storage abstraction, making it hard to change storage strategy or add persistence validation.
- **Files:** `src/app.jsx` (lines 154-189, 180-182)
- **Impact:** Difficult to migrate to IndexedDB or other storage. No way to serialize/validate before persisting. Hard to test localStorage interactions. API key storage (`llmKey`) is saved to localStorage when `rememberApiKey` is true (line 179), which is a security concern even if user-initiated.
- **Fix approach:** Create `src/services/storage.ts` with abstraction layer (`getSetupConfig`, `getLLMConfig`, etc.). Add schema validation before persist. Document when/why persistence happens. Consider deprecating API key localStorage storage—store only in sessionStorage instead.

### Loose Error Handling in Data Provider

- **Issue:** `src/services/dataProvider.js` catches errors silently in fallback chain (lines 563-574). Last error is thrown but intermediate errors are lost. No error categorization or user-facing messages.
- **Files:** `src/services/dataProvider.js` (lines 563-577)
- **Impact:** Hard to debug why a specific data provider failed. Users see generic "Keine Spieldaten verfügbar" message even if specific provider has actionable error (e.g., bad adapter endpoint, invalid token).
- **Fix approach:** Create error types (AdapterError, CSVError, MockError) with categorized messages. Log intermediate failures for debugging. Return structured error object with provider name and detailed message for user UI.

### Missing API Key Validation

- **Issue:** LLM API key (`llmKey`) is stored in localStorage when `rememberApiKey` is checked (line 179 in `app.jsx`). No encryption or obscuration. Password input field is used but value is plain text in storage.
- **Files:** `src/app.jsx` (lines 102-107, 178-179), `src/components/LLMConfig.jsx` (lines 114-135)
- **Impact:** Security risk if localStorage is ever compromised (e.g., XSS, malicious extension). API keys to external services stored in plain text.
- **Fix approach:** Never store API keys in localStorage. Use sessionStorage only (already done for non-remembered keys). Add warning label in UI. Consider implementing secure storage pattern (e.g., backend session token instead of client-side API key). Document that users should use environment variables for production.

### Hardcoded Configuration Values

- **Issue:** Hardcoded defaults scattered: default adapter endpoint `http://127.0.0.1:8787/api/games` (lines 74, 480), default Ollama endpoint `/ollama` (line 80), default model `qwen` (line 79), Vite proxy config (vite.config.js line 8).
- **Files:** `src/app.jsx` (lines 74, 80, 480), `vite.config.js` (line 8), `src/data/constants.js`
- **Impact:** Hard to change endpoints without code changes. Development/production config tied to source code. Hard to test with different services.
- **Fix approach:** Move all defaults to `src/data/constants.js` with clear documentation. Create `.env.example` with all required variables. Read from environment variables at startup. Make Vite proxy config dynamic based on env.

### Duplicate Date/Time Normalization Logic

- **Issue:** `getWeekRange()` function defined twice: in `src/app.jsx` (lines 42-57) and in `src/services/dataProvider.js` (lines 114-129). Nearly identical implementations.
- **Files:** `src/app.jsx` (lines 42-57), `src/services/dataProvider.js` (lines 114-129)
- **Impact:** If date calculation logic needs to change, must update in two places. Risk of divergence between implementations.
- **Fix approach:** Move `getWeekRange()` to shared utility `src/utils/dateHelpers.js` and import in both places. Apply same treatment to other date utilities (`formatDate`, `toIsoDate`, `addDays`).

### Fuzzy Team Matching Heuristics

- **Issue:** Team name matching logic in `src/services/dataProvider.js` (lines 69-100) uses regex-based fuzzy matching. Multiple transformation layers (toLookupKey, toTeamSearchKey, tokenizeTeam) with hand-crafted rules. Test coverage exists but heuristics are fragile.
- **Files:** `src/services/dataProvider.js` (lines 12-100)
- **Impact:** Team names from adapter may not match user selections correctly. False negatives (teams filtered out) worse than false positives. Adding new team name variations requires code changes.
- **Fix approach:** Move team matching to separate service. Add more test cases for edge cases (umlauts, abbreviations, multi-word teams). Consider using a proper fuzzy matching library (e.g., fuse.js) instead of hand-rolled regex. Document matching rules clearly.

## Known Bugs

### PDF Export Uses document.write() — Vulnerable to XSS

- **Symptoms:** User exports games/plan to PDF. If any game field contains malicious content (e.g., `<img src=x onerror="alert('xss')">` in venue name), it executes in popup window.
- **Files:** `src/components/PDFExport.jsx` (lines 13-52)
- **Trigger:** Create a game with HTML/script tags in home team, venue, or other fields. Click "↓ PDF" button.
- **Workaround:** None currently. Only safe with trusted internal data.
- **Actual Risk:** Low in current context (internal Borussia team scouting), but medium if adapter feeds external user data.

### setTimeout in PDF Print — Race Condition

- **Symptoms:** PDF print dialog may not appear or closes too quickly if system is slow.
- **Files:** `src/components/PDFExport.jsx` (line 55)
- **Trigger:** Click PDF button on slow device or when page is rendering-heavy. Print dialog may not appear.
- **Workaround:** Click "Print" button again manually.
- **Impact:** Low—nice-to-have feature, not critical path.

### LLM Error Messages May Contain Sensitive Data

- **Symptoms:** When LLM connection fails, error message from server is included in error toast (up to 180 chars truncated). Could leak API endpoint details or internal server errors.
- **Files:** `src/services/llm.js` (lines 14-15)
- **Trigger:** Use custom OpenAI-compatible endpoint with server that returns verbose error messages.
- **Workaround:** Use generic error handler that strips sensitive details.
- **Impact:** Low risk in closed team setting. Medium risk if system exposed to internet.

## Security Considerations

### API Key Storage in Browser Storage

- **Risk:** API keys for LLM services stored in `localStorage` when user checks "remember API key" checkbox. No encryption, no TTL.
- **Files:** `src/app.jsx` (lines 102-107, 169-189), `src/components/LLMConfig.jsx` (lines 113-135)
- **Current mitigation:** Checkbox labeled "nur wenn nötig" (only if needed). SessionStorage used by default. Users educated to use Ollama (local) instead.
- **Recommendations:** (1) Remove localStorage API key storage entirely—sessionStorage only. (2) Add security warning modal when user first tries to save API key. (3) Implement auto-clear on window unload. (4) Document secure patterns in README.

### CORS Proxy Configuration in Dev Mode

- **Risk:** Vite dev server proxies `/ollama` requests to `http://localhost:11434`. If modified to point to external services, enables CORS bypass for any request.
- **Files:** `vite.config.js` (lines 7-12)
- **Current mitigation:** Only proxies to localhost by default. Not deployed to production (Vite is dev-only tool).
- **Recommendations:** Add environment variable to control proxy target. Document that proxy should never point to untrusted services. Add warning in dev-only code.

### Adapter Endpoint Accepts User Input with No Validation

- **Risk:** User can enter any adapter endpoint URL. No HTTPS requirement, no domain validation. Could be tricked into connecting to malicious server.
- **Files:** `src/app.jsx` (lines 92, 539), `src/components/DataSourceConfig.jsx` (lines 44-50)
- **Current mitigation:** None. User controls the endpoint completely.
- **Recommendations:** (1) Add HTTPS-only validation in production. (2) Whitelist known adapter hosts. (3) Show warning when user enters non-HTTPS endpoint. (4) Add adapter endpoint documentation/examples.

### Missing CSRF Protection for Adapter Calls

- **Risk:** Adapter endpoint is called via POST from browser. No CSRF token, no SameSite cookie validation. If adapter is on different domain, no Origin check.
- **Files:** `src/services/dataProvider.js` (lines 488-498)
- **Current mitigation:** POST body includes auth token (optional Bearer token). But no CSRF-specific protection.
- **Recommendations:** Add optional CSRF token to POST payload if adapter supports it. Validate response headers match expected adapter. Document CSRF prevention in adapter spec.

## Performance Bottlenecks

### Large Games List Rendering Without Virtualization

- **Problem:** If 100+ games are returned (tournament with many matches), entire list is rendered to DOM. No pagination, no virtual scrolling.
- **Files:** `src/pages/GamesPage.jsx`, `src/components/GameTable.jsx` (122 lines, renders full list)
- **Cause:** React renders all game rows to DOM even if user scrolls past them. Table component has no lazy loading.
- **Improvement path:** (1) Implement windowing/virtualization (react-window, react-virtualized). (2) Add pagination (10-20 games per page). (3) Add search/filter to reduce visible games. For now, acceptable since typical tournaments have 20-30 matches.

### Mock Schedule Generation Uses Random Shuffle

- **Problem:** `buildMockSchedule()` shuffles team array every call (line 400 in dataProvider.js). With large team lists, can be slow.
- **Files:** `src/services/dataProvider.js` (lines 396-462)
- **Cause:** `[...teams].sort(() => Math.random() - 0.5)` is inefficient random shuffle. Should use Fisher-Yates.
- **Improvement path:** Replace with proper shuffle algorithm or use lodash `_.shuffle()`. Impact minimal since only affects demo/mock data.

### LLM Prompt Contains All Games as Formatted String

- **Problem:** Prompt in `src/app.jsx` (lines 357-365) formats all games into a string for LLM context. With 100+ games, this becomes a very large prompt.
- **Files:** `src/app.jsx` (lines 357-365)
- **Cause:** All games are concatenated for LLM context. No summarization or chunking.
- **Improvement path:** (1) Filter to top 20-30 games by priority. (2) Implement prompt chunking for large datasets. (3) Add token counting before sending to LLM.

## Fragile Areas

### App.jsx State Dependencies

- **Files:** `src/app.jsx` (lines 119-149)
- **Why fragile:** 30+ state variables with complex interdependencies. `useMemo` calls track specific dependencies. If dependency list is wrong, stale values are used. No TypeScript to catch these errors.
- **Safe modification:** (1) Add comprehensive unit tests for all state transitions. (2) Use TypeScript to catch dependency tracking errors. (3) Extract state management into separate layer with clear interfaces.
- **Test coverage:** Limited—only 8 test files in entire codebase. App.jsx logic not directly tested.

### DataProvider Fallback Chain

- **Files:** `src/services/dataProvider.js` (lines 534-577)
- **Why fragile:** `fetchGamesWithProviders()` iterates through provider order and catches all errors silently. Adding new provider requires editing the order array and provider map. Easy to misconfigure.
- **Safe modification:** (1) Move provider configuration to separate config object. (2) Add schema validation for each provider's return value. (3) Add explicit provider registration instead of inline map.
- **Test coverage:** Good—dataProvider has tests. But edge cases (all providers failing, timeout, partial data) may not be covered.

### Team Matching Heuristics

- **Files:** `src/services/dataProvider.js` (lines 69-100)
- **Why fragile:** Multiple transformation layers (toLookupKey → toTeamSearchKey → tokenizeTeam). Each layer applies regex replacements that could interact unexpectedly. Hard to debug matching failures.
- **Safe modification:** (1) Add comprehensive test cases for all known team name variations. (2) Add debug logging that shows transformation at each step. (3) Consider extracting to separate service with explicit test coverage.
- **Test coverage:** Some coverage in dataProvider.test.js but edge cases are limited (see test lines 101-138).

### LLMConfig Component Props

- **Files:** `src/components/LLMConfig.jsx` (lines 4-20)
- **Why fragile:** Component accepts 12 props with no prop validation. No TypeScript types. If app.jsx doesn't pass a required prop, component silently fails or renders incorrectly.
- **Safe modification:** Add PropTypes or migrate to TypeScript. Break into smaller sub-components (LLMPresets, ProtocolToggle, ConnectionStatus). Test each scenario (testing, ok, error states).
- **Test coverage:** No unit tests for LLMConfig component.

## Scaling Limits

### Mock Schedule Generation Quadratic Complexity

- **Current capacity:** Works well with ~50 teams (generates ~50 games).
- **Limit:** With 200+ teams, mock generation becomes noticeably slow. Loop runs i < teams.length-1, creates game for each pair.
- **Scaling path:** (1) Implement batch scheduling (group teams into matches, don't generate all permutations). (2) Add pagination to mock data. (3) Cache generated schedules. (4) Set team selection limit (max 30-50 teams).

### LocalStorage Limits

- **Current capacity:** localStorage has ~5-10MB limit. Currently stores setup config (small) + LLM config (small) + session storage for LLM key.
- **Limit:** If uploaded games CSV is very large and parsed into JSON, parsing error messages stored in state could exceed quota.
- **Scaling path:** (1) Implement IndexedDB for large data (uploaded games backup). (2) Add storage quota check before persist. (3) Add clear cache button. (4) Stream CSV parsing instead of loading entire file into memory.

### LLM Prompt Token Size

- **Current capacity:** Works well with ~50 games (prompt ~3-4K tokens).
- **Limit:** With 100+ games, prompt could exceed typical model limits (some models have 2K context). Request fails silently.
- **Scaling path:** (1) Add token counting before sending to LLM (use `js-tiktoken`). (2) Implement smart summarization (group games by venue, reduce duplicate teams). (3) Add UI warning when game count is high. (4) Implement query refinement prompt.

## Dependencies at Risk

### React Router v6.30.1 (Outdated)

- **Risk:** Using 6-month-old version. Current version is 6.31+. No critical vulnerabilities known, but security patches may be missed.
- **Impact:** Potential issues with newer React versions. Inability to use latest router features/improvements.
- **Migration plan:** Update to latest React Router (6.31+). No breaking changes expected. Update package.json, run tests, deploy.

### Vite v6.0.0 (Early Stable)

- **Risk:** Just reached 6.0 stability. Early major version. Some edge cases may exist.
- **Impact:** Build stability, dev server reliability.
- **Migration plan:** Monitor vite changelog. If issues arise, revert to 5.x. Currently acceptable risk.

### vitest v2.1.8 (Rapidly Evolving)

- **Risk:** Version 2.x is recent. Test setup uses vitest globals (line 16 in vite.config.js). Behavior may change.
- **Impact:** Test reliability, false positives/negatives.
- **Migration plan:** Pin to specific version. Monitor changelog. Add test-focused CI checks.

## Missing Critical Features

### No Input Validation for Adapter Requests

- **Problem:** Adapter request payload (fromDate, toDate, teams array) is sent without validation. Adapter could reject request or return malformed data.
- **Blocks:** Cannot trust adapter response structure. No guarantee fromDate < toDate. Teams array could be empty.
- **Impact:** Silent failures, confusing error messages.
- **Recommendation:** Add validation utility that checks: (1) dates are ISO format and fromDate <= toDate, (2) teams array is non-empty, (3) kreisId and jugendId match known values.

### No Connection Retry Logic

- **Problem:** Single fetch attempt for LLM test connection. If network is briefly unavailable, fails immediately.
- **Blocks:** Unreliable in flaky network conditions (mobile, weak WiFi).
- **Recommendation:** Implement exponential backoff retry (3 attempts with 1s/2s/4s delays). Add UI indicator showing "retrying...".

### No Analytics or Logging

- **Problem:** No way to know which providers are used, which errors occur in production, user behavior.
- **Blocks:** Cannot improve UI based on real usage. Cannot detect issues before users report them.
- **Recommendation:** Add structured logging (send to backend or log aggregation service like Sentry). Track: (1) provider success/failure rates, (2) LLM response times, (3) user selections (anonymized).

### No Offline Capability

- **Problem:** App requires network for all data. No service worker, no cached schedules.
- **Blocks:** Users cannot view previously generated plans if offline.
- **Recommendation:** (1) Implement service worker to cache app shell. (2) Store last generated plan/schedule in IndexedDB. (3) Graceful degradation when offline.

## Test Coverage Gaps

### No Unit Tests for App.jsx State Logic

- **What's not tested:** State initialization, state transitions, side effects (localStorage, navigation).
- **Files:** `src/app.jsx` (730 lines of untested state logic)
- **Risk:** High—any state-related change could break silently. Refactoring is risky without test protection.
- **Priority:** High—should have tests for: (1) initial state values, (2) Kreis/Jugend selection reset behavior, (3) error clearing, (4) file upload state management.

### No Component Tests for LLMConfig, DataSourceConfig

- **What's not tested:** UI interactions, validation display, error states, button enables/disables.
- **Files:** `src/components/LLMConfig.jsx` (261 lines), `src/components/DataSourceConfig.jsx` (141 lines)
- **Risk:** Regressions in UI behavior go undetected. Refactoring breaks UI without warning.
- **Priority:** Medium—add snapshot tests + interaction tests for: (1) preset button clicks, (2) connection status display, (3) error message formatting.

### No E2E Tests

- **What's not tested:** Full user flows: select kreis → select jugend → upload CSV → test LLM connection → generate plan.
- **Files:** None—no E2E test suite
- **Risk:** Critical flow breakage discovered only by manual testing or users reporting.
- **Priority:** High—should have E2E suite (Playwright/Cypress) for: (1) complete setup → games → plan flow, (2) adapter fallback scenarios, (3) file upload with validation warnings.

### Error Boundary Component Not Tested

- **What's not tested:** Crash recovery, error message display, user guidance.
- **Files:** `src/components/ErrorBoundary.jsx` (69 lines)
- **Risk:** If error boundary breaks, entire app is unusable with cryptic error.
- **Priority:** Medium—test: (1) error message display, (2) reload functionality, (3) error state recovery.

### Team Matching Edge Cases Undertested

- **What's not tested:** Umlauts in team names, special characters, very short names, very long names.
- **Files:** `src/services/dataProvider.js` (matching logic, lines 69-100)
- **Risk:** Real-world team names fail to match, games filtered out, confusing UX.
- **Priority:** Medium—add tests for: (1) "Schwarz-Weiß" / "SW" variants, (2) "Ü" / "UE" variants, (3) teams with numbers, (4) single-word teams.

---

*Concerns audit: 2026-04-02*
