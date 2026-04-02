# Testing Patterns

**Analysis Date:** 2026-04-02

## Test Framework

**Runner:**
- Vitest 2.1.8
- Config: `vite.config.js` (lines 15-20)
- Settings:
  - `globals: true` - Global test functions (`describe`, `it`, `expect`) available without imports
  - `environment: "jsdom"` - DOM API simulation for React component testing
  - `setupFiles: "./src/test/setup.js"` - Loads test utilities before test suite
  - `css: true` - CSS processing in tests

**Assertion Library:**
- Vitest built-in expect with `@testing-library/jest-dom` (v6.6.3) for matchers

**Run Commands:**
```bash
npm test              # Run all tests once
npm run test:watch   # Watch mode with auto-rerun on file changes
```

Coverage command not configured; no coverage reporting in `package.json`.

## Test File Organization

**Location:**
- Co-located with source files using `.test.js` or `.test.jsx` suffix:
  - `src/services/llm.test.js` - alongside `src/services/llm.js`
  - `src/services/dataProvider.test.js` - alongside `src/services/dataProvider.js`
  - `src/components/StepNav.test.jsx` - alongside `src/components/StepNav.jsx`

**Naming:**
- Test files match source name: `SourceFile.js` → `SourceFile.test.js`
- Test directory exists at `src/test/` for shared setup only (setup.js)

**Structure:**
```
src/
├── services/
│   ├── llm.js
│   └── llm.test.js         # Service tests
├── components/
│   ├── StepNav.jsx
│   └── StepNav.test.jsx    # Component tests
└── test/
    └── setup.js            # Shared test configuration
```

## Test Structure

**Suite Organization:**
```javascript
import { describe, expect, it, vi, beforeEach } from "vitest";
import { callLLM, testConnection } from "./llm";

describe("llm service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns ollama response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ response: "Antwort" }),
      }),
    );

    const result = await callLLM({
      endpoint: "http://localhost:11434",
      isOllama: true,
      model: "qwen2.5:7b",
      apiKey: "",
      prompt: "Test",
    });

    expect(result).toBe("Antwort");
  });
});
```

**Patterns:**

1. **Setup:** `beforeEach(() => { vi.restoreAllMocks(); })` - Reset mocks between tests
2. **Mocking Globals:** `vi.stubGlobal("fetch", vi.fn().mockResolvedValue(...))` - Override fetch for network tests
3. **Assertions:** `expect(result).toBe(...)`, `expect(result).toHaveLength(...)`, `expect(report.stats.warnings.length).toBeGreaterThan(0)`
4. **Async Handling:** Test functions marked `async`, `await` used before assertions on promises
5. **Error Testing:** `await expect(...).rejects.toThrow("error message")`

## Mocking

**Framework:** Vitest's `vi` object

**Patterns:**
- Global mocking with `vi.stubGlobal()` for fetch API:
  ```javascript
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ response: "data" }),
  }));
  ```
- Mock restoration in `beforeEach()`:
  ```javascript
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  ```
- Callback function mocking with `vi.fn()` for component prop callbacks:
  ```javascript
  const onStepChange = vi.fn();
  render(<StepNav currentStep="setup" onStepChange={onStepChange} ... />);
  fireEvent.click(screen.getByText(/spiele/i));
  expect(onStepChange).toHaveBeenCalledWith("games");
  ```

**What to Mock:**
- External HTTP calls (`fetch` API) - all network requests mocked in tests
- Callback prop handlers in components - captured with `vi.fn()` to verify calls
- Global browser APIs (`window`, `localStorage`, `sessionStorage`) when testing storage logic

**What NOT to Mock:**
- React Router hooks and context - used directly (e.g., `useLocation` in app tests)
- Internal service functions - imported and tested directly; no mocking of dataProvider functions within component tests
- Test utilities from `@testing-library/react` - always used directly

## Fixtures and Factories

**Test Data:**
Test data created inline using object literals matching component/service contracts:

```javascript
// From StepNav.test.jsx
render(
  <StepNav
    currentStep="setup"
    onStepChange={() => {}}
    canAccessGames={false}
    canAccessPlan={false}
    isMobile={false}
  />,
);

// From dataProvider.test.js
const csv = `date;time;home;away;venue;km;kreisId;jugendId\n2026-05-01;10:00;Team A;Team B;Platz 1;12;duesseldorf;e-jugend`;
const games = parseUploadedGames(csv, "games.csv", {
  kreisId: "duesseldorf",
  jugendId: "e-jugend",
  fromDate: "2026-04-01",
  turnier: false,
});
```

**Location:**
- No separate fixtures directory
- Test data defined within test case blocks as variables
- Constants reused across multiple tests stored as module-level vars:
  - Mock fetch response shapes defined inline in each test

## Coverage

**Requirements:** No coverage enforcement in `package.json` or vitest config

**View Coverage:**
No coverage reporting command configured. To add coverage:
```bash
npm install --save-dev @vitest/coverage-v8
# Then modify vite.config.js to include coverage config
```

## Test Types

**Unit Tests:**
- Scope: Individual functions and services
- Approach: Function inputs → outputs verified with assertions
- Examples:
  - `llm.test.js`: Tests `callLLM()` with mocked fetch for different LLM backends (Ollama, OpenAI)
  - `dataProvider.test.js`: Tests `parseUploadedGames()`, `parseUploadedGamesReport()`, `fetchGamesWithProviders()` with various CSV/JSON inputs
- Isolation: Each test fully independent; mocks reset via `beforeEach()`

**Integration Tests:**
- Scope: Multiple functions working together
- Approach: Test data flows through provider system with fallbacks
- Examples:
  - `dataProvider.test.js` line 39-59: Tests CSV provider auto-detection and fallback chain
  - `dataProvider.test.js` line 101-138: Tests team name fuzzy matching across CSV → adapter flow
  - `dataProvider.test.js` line 140-163: Tests fallback from adapter to mock provider on network error

**Component Tests:**
- Scope: React components with user interactions
- Approach: Render component, find elements by text, simulate events, verify output
- Examples:
  - `StepNav.test.jsx` line 6-20: Tests rendering of step labels and icons
  - `StepNav.test.jsx` line 22-37: Tests step navigation callback firing on click
- Assertion: DOM presence (`expect(screen.getByText(/setup/i)).toBeInTheDocument()`) and callback invocation

**E2E Tests:**
- Not implemented; no Cypress, Playwright, or similar

## Common Patterns

**Async Testing:**
```javascript
it("returns ollama response", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ response: "Antwort" }),
  }));

  const result = await callLLM({
    endpoint: "http://localhost:11434",
    isOllama: true,
    model: "qwen2.5:7b",
    apiKey: "",
    prompt: "Test",
  });

  expect(result).toBe("Antwort");
});
```
- `async` function wraps test
- `await` used before calling async functions
- Assertions occur after promise resolution

**Error Testing:**
```javascript
it("throws on non-200 response", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: false,
    status: 500,
    text: async () => "broken",
  }));

  await expect(
    callLLM({
      endpoint: "http://localhost:11434",
      isOllama: true,
      model: "qwen2.5:7b",
      apiKey: "",
      prompt: "Test",
    }),
  ).rejects.toThrow("HTTP 500");
});
```
- Reject path tested with `expect(...).rejects.toThrow("message")`
- Mock response set to `ok: false` to trigger error path

**Assertion Styles:**
- Equality: `expect(result).toBe("value")` - strict equality check
- Truthiness: `expect(result.ok).toBeTruthy()`
- Collections: `expect(array).toHaveLength(1)`, `expect(set).toBeGreaterThan(0)`
- DOM: `expect(screen.getByText(/pattern/i)).toBeInTheDocument()` - case-insensitive regex matching
- Mocks: `expect(onStepChange).toHaveBeenCalledWith("games")` - verify call signature

**Component Rendering:**
```javascript
import { render, screen, fireEvent } from "@testing-library/react";

it("triggers navigation for accessible steps", () => {
  const onStepChange = vi.fn();

  render(
    <StepNav
      currentStep="setup"
      onStepChange={onStepChange}
      canAccessGames
      canAccessPlan={false}
      isMobile={false}
    />,
  );

  fireEvent.click(screen.getByText(/spiele/i));
  expect(onStepChange).toHaveBeenCalledWith("games");
});
```
- `render()` from `@testing-library/react` mounts component in jsdom
- `screen.getByText()` with regex finds elements (case-insensitive `/i` flag)
- `fireEvent.click()` simulates user interaction
- Callback assertions verify behavior

## Setup

Test setup file at `src/test/setup.js`:
```javascript
import "@testing-library/jest-dom/vitest";
```
- Extends `expect()` with Testing Library matchers (`.toBeInTheDocument()`, etc.)
- Imported automatically by Vitest via `vite.config.js` setupFiles

---

*Testing analysis: 2026-04-02*
