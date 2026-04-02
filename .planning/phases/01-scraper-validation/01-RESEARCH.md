# Phase 1: Scraper Validation - Research

**Researched:** 2026-04-02
**Domain:** fussball.de scraper hardening — Node.js ESM, fetch concurrency, HTML regex parsing, Vitest
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DATA-01 | Adapter liefert echte Spieldaten von fussball.de für eine gewählte Kalenderwoche | Live `wam_base.json` confirmed returning `currentSaison: "2526"`. Scraper pipeline fully traced: `wam_base` → `wam_kinds` → `wam_competitions` → `ajax.fixturelist` → per-match detail pages. |
| DATA-02 | Spieldaten enthalten Spielzeit, Heim-/Gastmannschaft, Jugendklasse und Spielort/Adresse | `extractMatchDetails()` in `fussballde.js` already parses `<h3>Anpfiff</h3>`, `<div class="team-name">`, and `<a class="location">`. Venue defaults to `"Sportanlage"` when not found — the address regex pattern must be validated against the live site. |
| DATA-03 | Spiele werden nach Kreis, Jugendklasse und Datumsbereich gefiltert | `filterGames()` in `games.js` handles kreisId, jugendId, fromDate/toDate. Unit tests exist and pass. Smoke test must confirm scraped games carry correct `kreisId`/`jugendId` fields so filters work end-to-end. |
| DATA-05 | Scraper-Concurrency ist auf produktionstaugliche Werte reduziert (max 3 parallel) | Current defaults are `PAGE_CONCURRENCY=4`, `MATCH_CONCURRENCY=6` — both exceed the 3-parallel requirement. Must set via env vars and add jitter to the retry delay. |
</phase_requirements>

---

## Summary

Phase 1 targets the `adapter-service/scripts/fetch-week.fussballde.mjs` exporter and its supporting library `adapter-service/lib/fussballde.js`. The scraper already exists and has a working multi-step pipeline: it fetches `wam_base.json` for the current season, discovers competitions via `wam_kinds` and `wam_competitions` JSON endpoints, fetches fixture lists per Staffel, then enriches each match by fetching its individual detail page. The live `wam_base.json` was verified today and returns `currentSaison: "2526"` — confirming the API is live and the data model is intact.

Two concrete problems must be resolved: (1) The current concurrency defaults (`PAGE_CONCURRENCY=4`, `MATCH_CONCURRENCY=6`) exceed the required maximum of 3 simultaneous requests and have no inter-request jitter — this is a straight-line HTTP 429 risk. (2) The `FUSSBALLDE_SAISON` environment variable is not set anywhere in the codebase; the scraper falls back to `wam_base.currentSaison` at runtime, meaning a silent season rollover could return zero games with no error surfaced. Both issues are already scoped to env-var changes and small code patches.

The test infrastructure is healthy: Vitest 2.1.9 with `globals: true` runs 30 tests in ~1.7s. There are five existing test files in `adapter-service/lib/` covering `fussballde.js`, `games.js`, `week.js`, `loader.js`, and `dynamicSources.js`. The critical missing piece is a live smoke-test fixture capturing real fussball.de HTML for the regex parsers — the STATE.md explicitly flags: "fussball.de current HTML structure unverified against live site — first task is a live scraper run to confirm regex parsers still work."

**Primary recommendation:** Run the scraper live against a known Kreis/Jugendklasse first (plan 01-01), capture real HTML as test fixtures, then harden concurrency and season config (plans 01-02 and 01-03).

---

## Standard Stack

### Core (already in use — do not change)

| Library / Tool | Version | Purpose | Why Standard |
|----------------|---------|---------|--------------|
| Node.js built-in `fetch` | Node 18+ | HTTP requests to fussball.de | Already in use; no extra dependency |
| Vitest | 2.1.9 | Unit and integration tests | Already configured; `npm test` works |
| ESM modules (`type: "module"`) | — | Adapter service module system | Entire project is ESM; do not mix CJS |
| Node.js `child_process.exec` (promisified) | built-in | Runs the exporter script as subprocess | `dynamicSources.js` already uses this |

### Supporting (already in use)

| Library / Tool | Version | Purpose | When to Use |
|----------------|---------|---------|-------------|
| `node:fs/promises` | built-in | Writing captured fixture files | In `loader.js`; use same pattern for fixture capture |
| `node:os.tmpdir()` | built-in | Temp directory in tests | Already used in `loader.test.js` for isolation |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Built-in `fetch` + `mapLimit` | `p-limit` npm package | `p-limit` is cleaner but adds a dep; existing `mapLimit` is tested and sufficient |
| Regex HTML parsing | `cheerio` or `node-html-parser` | Parsing library would be more robust but adds a dep and risk; use regex fixes if selectors drift |

**Installation:** No new packages needed. All tools are already in `package.json` or Node built-ins.

---

## Architecture Patterns

### Project Structure (relevant to this phase)

```
adapter-service/
├── scripts/
│   └── fetch-week.fussballde.mjs   # Main scraper entry point (env-driven)
├── lib/
│   ├── fussballde.js               # HTML parsing, URL builders, area/competition helpers
│   ├── fussballde.test.js          # Unit tests for parsing functions
│   ├── games.js                    # normalizeGame(), filterGames(), dedupeGames()
│   ├── games.test.js               # Unit tests for filtering and normalization
│   ├── week.js                     # getWeekRange(), isDateInRange(), shouldRefreshWeek()
│   ├── week.test.js                # Unit tests for week logic
│   ├── dynamicSources.js           # runExportCommand(), fetchWeekTemplateGames()
│   └── dynamicSources.test.js      # Unit tests
├── data/
│   └── games.store.json            # Persisted game store (written by writeStore())
└── server.mjs                      # HTTP server (not touched in this phase)
```

### Pattern 1: Env-Driven Scraper Execution

The scraper reads all config from environment variables. The server invokes it via `runExportCommand()` which injects:

```javascript
// Source: adapter-service/lib/dynamicSources.js
const env = {
  ...process.env,
  SCOUTPLAN_FROM_DATE: String(params.fromDate || ""),
  SCOUTPLAN_TO_DATE:   String(params.toDate   || ""),
  SCOUTPLAN_KREIS_ID:  String(params.kreisId  || ""),
  SCOUTPLAN_JUGEND_ID: String(params.jugendId || ""),
  // ...
};
const { stdout } = await exec(command, { env, timeout: Number(timeoutMs || 30000) });
```

For the smoke test in plan 01-01, invoke the script directly via shell with explicit env vars:

```bash
SCOUTPLAN_FROM_DATE=2026-04-05 \
SCOUTPLAN_TO_DATE=2026-04-05 \
SCOUTPLAN_KREIS_ID=moenchen \
SCOUTPLAN_JUGEND_ID=d-jugend \
FUSSBALLDE_PAGE_CONCURRENCY=2 \
FUSSBALLDE_MATCH_CONCURRENCY=2 \
SCOUTPLAN_DEBUG_EXPORTER=true \
node adapter-service/scripts/fetch-week.fussballde.mjs | jq .
```

### Pattern 2: fussball.de Request Chain

The scraper follows a 4-step chain, each step's output feeding the next:

```
Step 1: GET /wam_base.json
        → currentSaison ("2526"), defaultCompetitionType ("1"), Mandant ("22")

Step 2: GET /wam_kinds_{mandant}_{season}_{compType}.json
        → Spielklasse (leagueIds by teamType), Gebiet (areaMap by leagueId)

Step 3: GET /wam_competitions_{mandant}_{season}_{compType}_{teamType}_{leagueId}_{areaId}.json
        → staffel URLs under /spieltagsuebersicht/

Step 4: GET /ajax.fixturelist/-/staffel/{id}/datum-von/{from}/datum-bis/{to}/max/500/offset/0
        → HTML table rows with team names + /spiel/ match links

Step 5: GET /spiel/{match-slug}/-/spiel/{matchId}
        → Full match page with <h3>Anpfiff</h3>, <a class="location">, <div class="team-name">
```

**Confirmed live:** Step 1 (`wam_base.json`) returns `currentSaison: "2526"` as of 2026-04-02.

### Pattern 3: mapLimit Concurrency Control

```javascript
// Source: adapter-service/scripts/fetch-week.fussballde.mjs
async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const current = cursor++;
      if (current >= items.length) return;
      results[current] = await mapper(items[current], current);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}
```

To reduce concurrency to ≤ 3, set env vars:
- `FUSSBALLDE_PAGE_CONCURRENCY=3` (default was 4)
- `FUSSBALLDE_MATCH_CONCURRENCY=3` (default was 6)

### Pattern 4: Jitter in Retry Delay

The current retry backoff is deterministic (`250 * (attempt + 1)` ms). Add jitter to avoid synchronized bursts from concurrent workers:

```javascript
// In fetchText(), replace:
await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));

// With:
const base = 250 * (attempt + 1);
const jitter = Math.random() * base;
await new Promise((resolve) => setTimeout(resolve, base + jitter));
```

### Anti-Patterns to Avoid

- **Hardcoding the season string:** Never write `"2526"` in code. Always read from `FUSSBALLDE_SAISON` env var (with fallback to `wam_base.currentSaison`). The season rolls over in July and the fallback works — but explicit config prevents surprise.
- **Parsing the full match page with a single broad regex:** The existing regexes target narrow patterns (`<h3>\s*Anpfiff\s*</h3>`, `<a[^>]*class="location"[^>]*>`). Do not replace them with generic HTML parsers unless the narrow patterns fail on live HTML — adding a DOM parser adds risk without benefit given the existing test coverage.
- **Running the full scraper inside a Vitest test:** The live HTTP scraper must NOT run in the unit test suite (no `fetch` mocking overhead, no network in CI). Use a dedicated smoke test script and captured HTML fixtures for unit tests.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Parallel request throttling | Custom semaphore or promise pool | Existing `mapLimit()` + env vars `FUSSBALLDE_PAGE_CONCURRENCY` / `FUSSBALLDE_MATCH_CONCURRENCY` | Already implemented, tested, sufficient |
| Season discovery | Parse `wam_base.json` at runtime | Set `FUSSBALLDE_SAISON=2526` in env — with `wam_base.currentSaison` as runtime fallback | `wam_base.json` is live-confirmed; explicit env is the reliability improvement |
| Date range logic | Write date iteration | `buildDateRange()` in `fussballde.js` — already tested | Inclusive range, handles swapped from/to |
| Area/Kreis mapping | New keyword tables | `KREIS_AREA_KEYWORDS` + `pickAreaIdsForLeague()` in `fussballde.js` | Already maps Niederrhein Kreise to fussball.de area IDs |
| Deduplication | Set-based dedup | `dedupeGames()` in `games.js` | Uses composite key (home+away+date+time+kreis+jugend) |

**Key insight:** The scraper is functionally complete. Phase 1 is about hardening configuration and validating against the live site — not new features.

---

## Common Pitfalls

### Pitfall 1: Season Rollover Silent Failure
**What goes wrong:** After July, `wam_base.currentSaison` changes from `"2526"` to `"2627"`. The `wam_kinds` and `wam_competitions` URL patterns embed the season string. If the new season's JSON files aren't yet populated by DFB/fussball.de, the requests return 404 and the scraper returns zero games — silently, because 404 is caught and returns `[]`.
**Why it happens:** The season string is embedded in every WAM JSON URL. The runtime fallback works when the new season is populated, but there's a transition window of days/weeks where the new season URL returns 404 and the old season URL is no longer valid.
**How to avoid:** Explicitly set `FUSSBALLDE_SAISON=2526` in `.env` / Docker Compose env. Add a `warn()` log when the season is taken from `wam_base` (not from explicit env) so the operator sees it on next deploy.
**Warning signs:** `competitions.length === 0` with no HTTP error in logs; `wam_kinds` returning 404.

### Pitfall 2: HTML Structure Drift on fussball.de
**What goes wrong:** The regex patterns in `extractMatchDetails()` and `extractMatchesFromDatePage()` were written against a specific HTML snapshot. fussball.de updates their site without notice. A class rename (`team-name` → `team-title`) or whitespace change would cause the regex to return empty strings, but the scraper would not error — it would return games with `venue: "Sportanlage"` (the default) and `time: "10:00"` (the normalizer default).
**Why it happens:** Regex-based HTML parsing is brittle by design; the scraper has no schema validation on its output.
**How to avoid:** The smoke test in plan 01-01 must assert specific non-default field values (`venue !== "Sportanlage"`, `time !== "10:00"`) for at least one game. Save a live HTML fixture during the smoke run so future tests can reproduce the exact parse.
**Warning signs:** All games have `venue: "Sportanlage"` or `time: "10:00"` in smoke test output.

### Pitfall 3: Concurrency Burst Triggering 429
**What goes wrong:** `mapLimit()` starts all workers immediately. With `MATCH_CONCURRENCY=6`, 6 simultaneous fetch requests hit the same fussball.de match-detail domain. If the site has a per-IP sliding window rate limit (common: 10–20 req/s), the burst triggers 429.
**Why it happens:** No inter-request jitter in the current `fetchText()` retry delay; the retry delay is deterministic (`250ms × attempt`), so all retrying workers collide again at the same moment.
**How to avoid:** Lower `FUSSBALLDE_PAGE_CONCURRENCY` and `FUSSBALLDE_MATCH_CONCURRENCY` to 3. Add `Math.random() * base` jitter to the retry sleep.
**Warning signs:** `HTTP 429` errors in `stderr` (`[fussballde-export][warn]` prefix) during a full week fetch.

### Pitfall 4: kreisId/jugendId Not Propagated to Enriched Games
**What goes wrong:** In `enrichMatches()`, the returned game object hardcodes `kreisId` and `jugendId` from the top-level env vars (`const kreisId = process.env.SCOUTPLAN_KREIS_ID`). When the adapter calls the scraper with a specific `SCOUTPLAN_KREIS_ID`, the games get the correct values. But if the env var is empty, all returned games have `kreisId: ""`, making the `filterGames()` kreisId filter a no-op (it only filters when `game.kreisId !== payload.kreisId` — when `game.kreisId` is empty, the condition is false and all games pass through).
**Why it happens:** The `filterGames()` logic in `games.js` skips filtering when `game.kreisId` is empty string: `if (payload.kreisId && game.kreisId && game.kreisId !== payload.kreisId)`. This is intentional for the adapter store (games from multiple districts), but means the smoke test must verify that scraped games actually carry the expected `kreisId`.
**How to avoid:** The smoke test must assert `game.kreisId === "moenchen"` (or whichever Kreis was requested) on the returned games.
**Warning signs:** Filter tests pass but live data returns games from wrong Kreise.

### Pitfall 5: Vitest Picking Up Node_Modules Test Files
**What goes wrong:** Without `exclude` configuration, Vitest 2.x may attempt to run test files in `node_modules` (known issue in vitest-dev/vitest#5943).
**Why it happens:** The `vite.config.js` does not set an explicit `exclude` in the `test` section. The default exclusion pattern covers `node_modules` but edge cases exist with symlinked packages.
**How to avoid:** The current test run passes cleanly (30 tests, 0 failures) so this is not currently an issue. Do not add unnecessary exclude patterns that could mask legitimate test files.
**Warning signs:** Vitest reports tests from paths inside `node_modules/`.

---

## Code Examples

Verified patterns from the existing codebase:

### Running the scraper manually (smoke test invocation)
```bash
# Source: adapter-service/README.md + scripts/fetch-week.fussballde.mjs env vars
SCOUTPLAN_FROM_DATE=2026-04-05 \
SCOUTPLAN_TO_DATE=2026-04-05 \
SCOUTPLAN_KREIS_ID=moenchen \
SCOUTPLAN_JUGEND_ID=d-jugend \
FUSSBALLDE_PAGE_CONCURRENCY=2 \
FUSSBALLDE_MATCH_CONCURRENCY=2 \
FUSSBALLDE_SAISON=2526 \
SCOUTPLAN_DEBUG_EXPORTER=true \
node adapter-service/scripts/fetch-week.fussballde.mjs
```

### Asserting required fields in a smoke test output
```javascript
// Pattern for plan 01-01 fixture validation
const result = JSON.parse(stdout);
assert(result.games.length > 0, "Expected at least one game");
const game = result.games[0];
assert(game.home && game.home !== "", "home must be non-empty");
assert(game.away && game.away !== "", "away must be non-empty");
assert(/^\d{4}-\d{2}-\d{2}$/.test(game.date), "date must be ISO");
assert(game.time && game.time !== "10:00", "time should not be default — venue/time parsing must work");
assert(game.venue && game.venue !== "Sportanlage", "venue must be parsed from live page, not defaulted");
assert(game.jugendId === "d-jugend", "jugendId must be propagated");
```

### Setting explicit season in Docker Compose (plan 01-03)
```yaml
# In docker-compose.yml adapter service environment:
environment:
  FUSSBALLDE_SAISON: "2526"
  FUSSBALLDE_PAGE_CONCURRENCY: "3"
  FUSSBALLDE_MATCH_CONCURRENCY: "3"
```

### Adding jitter to fetchText retry (plan 01-02)
```javascript
// Source: adapter-service/scripts/fetch-week.fussballde.mjs fetchText()
// Replace the deterministic delay with jittered backoff:
const base = 250 * (attempt + 1);
const jitter = Math.random() * base;
await new Promise((resolve) => setTimeout(resolve, base + jitter));
```

### filterGames usage with date range (already works)
```javascript
// Source: adapter-service/lib/games.js filterGames()
const filtered = filterGames(state.games, {
  kreisId: "moenchen",
  jugendId: "d-jugend",
  fromDate: "2026-04-05",
  toDate: "2026-04-11",
});
// Returns only games matching all non-empty criteria within the date window
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| No season lock — reads `wam_base.currentSaison` at runtime only | Explicit `FUSSBALLDE_SAISON=2526` in env, runtime as fallback | Prevents silent season-rollover failures |
| `PAGE_CONCURRENCY=4`, `MATCH_CONCURRENCY=6` (defaults) | `PAGE_CONCURRENCY=3`, `MATCH_CONCURRENCY=3` (hardened) | Stays under HTTP 429 threshold |
| Deterministic retry delay (`250ms × attempt`) | Jittered retry delay (`(250 × attempt) + random(0, 250 × attempt)`) | Avoids synchronized retry bursts |
| No live HTML fixture in test suite | HTML fixtures captured from real fussball.de during smoke run | Future CI can test parser correctness without hitting the network |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9 |
| Config file | `vite.config.js` → `test:` section (`globals: true`, `environment: jsdom`, `setupFiles: ./src/test/setup.js`) |
| Quick run command | `npm test` |
| Full suite command | `npm test` |
| Estimated runtime | ~2 seconds (30 tests currently) |

**Note:** The adapter-service tests run in the `jsdom` environment (because `vite.config.js` sets it globally) but they only use Node.js APIs and Vitest matchers — `jsdom` is irrelevant to them. No change needed.

### Phase Requirements → Test Map

| Req ID | Behavior to Verify | Test Type | Automated Command | File Exists? |
|--------|--------------------|-----------|-------------------|-------------|
| DATA-01 | Scraper returns ≥ 1 game with all fields from live fussball.de | smoke (manual) | `node adapter-service/scripts/fetch-week.fussballde.mjs` with env vars | ✅ script exists — smoke run is plan 01-01 |
| DATA-01 | `extractMatchesFromDatePage()` parses current fussball.de HTML | unit | `npm test -- --reporter=verbose adapter-service/lib/fussballde.test.js` | ❌ Wave 0 gap — needs updated fixture from live site |
| DATA-02 | `extractMatchDetails()` returns non-default venue and time from real HTML | unit | `npm test -- adapter-service/lib/fussballde.test.js` | ❌ Wave 0 gap — existing fixture in test uses synthetic HTML; needs live-captured fixture |
| DATA-03 | `filterGames()` returns only games matching kreisId + jugendId + date range | unit | `npm test -- adapter-service/lib/games.test.js` | ✅ yes — `games.test.js` has a filter test covering this |
| DATA-05 | `FUSSBALLDE_PAGE_CONCURRENCY` and `FUSSBALLDE_MATCH_CONCURRENCY` cap at 3 | smoke (manual) | Run full-week fetch, observe no HTTP 429 in stderr | ❌ Wave 0 gap — no automated concurrency test exists |

### Nyquist Sampling Rate

- **Minimum sample interval:** After every committed task → run: `npm test`
- **Full suite trigger:** Before merging final task (plan 01-03)
- **Phase-complete gate:** Full suite green + smoke test output showing ≥ 1 game with non-default venue and time
- **Estimated feedback latency per task:** ~2 seconds

### Wave 0 Gaps (must be created before implementation)

- [ ] `adapter-service/lib/fussballde.liveFixture.test.js` — unit tests that use real HTML captured from fussball.de match detail page and fixturelist page; covers DATA-01 and DATA-02. Capture the HTML during plan 01-01 smoke run and save as `./__fixtures__/match-detail.html` and `./__fixtures__/fixturelist.html`.
- [ ] `adapter-service/scripts/__fixtures__/` directory — holds captured HTML files from live site for use in regression tests.

---

## Open Questions

1. **Is the `ajax.fixturelist` endpoint returning the `<section id="matches">` section reliably?**
   - What we know: `extractMatchesFromDatePage()` targets `<section id="matches">` and falls back to full HTML if absent. The existing unit test uses synthetic HTML without this section.
   - What's unclear: Whether the live fixturelist response includes this section or just bare table HTML.
   - Recommendation: The smoke test in plan 01-01 should save the raw fixturelist HTML for inspection. The `DEBUG=true` flag logs debug info to stderr during the run.

2. **Does `<a class="location">` contain a full address (street + postal code + city) or just a stadium name on the live site?**
   - What we know: The existing test fixture shows `"Kunstrasenplatz, Kunstrasenplatz 2, Neersener Str. 74, 47877 Willich"` — a full address. DATA-02 requires `Spielort/Adresse`.
   - What's unclear: Whether all match pages have this full address, or whether some have only a stadium name or an empty location anchor.
   - Recommendation: Plan 01-02 should assert `game.venue` contains a postal code pattern (`/\d{5}/`) for at least one game in the smoke output.

3. **Will `FUSSBALLDE_MANDANT=22` continue to map to Niederrhein in the 2025/26 season?**
   - What we know: The README hardcodes mandant 22 for Niederrhein/FVN. `wam_base.json` `Mandanten` field was not fully inspected in this research (only `currentSaison` and `defaultCompetitionType` were confirmed).
   - What's unclear: If mandant IDs can change between seasons.
   - Recommendation: The smoke test should log the mandant used and the Spielklasse/Gebiet entries returned, so any mapping failure is immediately visible.

---

## Sources

### Primary (HIGH confidence)
- Live `https://www.fussball.de/wam_base.json` — confirmed `currentSaison: "2526"`, `defaultCompetitionType: "1"`, Mandanten structure (fetched 2026-04-02)
- `adapter-service/scripts/fetch-week.fussballde.mjs` — full scraper source, all env vars and URL patterns
- `adapter-service/lib/fussballde.js` — all HTML parsing functions and area/competition helpers
- `adapter-service/lib/games.js` — `filterGames()`, `normalizeGame()`, `dedupeGames()` implementations
- `adapter-service/lib/games.test.js`, `fussballde.test.js`, `week.test.js` — existing test coverage
- `adapter-service/README.md` — all env var documentation

### Secondary (MEDIUM confidence)
- WebSearch: HTTP 429 rate limiting best practices — jitter + exponential backoff pattern. Verified by cross-referencing multiple sources (ScrapingBee, Scrape.do, ScraperHero).
- `github.com/api-fussball/api-dart` — confirmed archived 2026-03-31; no longer maintained but validates the WAM API has been publicly documented.

### Tertiary (LOW confidence)
- Per-IP rate limit threshold for fussball.de is not publicly documented. The 3-request ceiling in DATA-05 is a project decision, not a documented fussball.de limit.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all tools are already in the codebase and working
- Architecture: HIGH — scraper fully traced from source code + live API verification
- Pitfalls: MEDIUM — season rollover, HTML drift, and 429 risks are well-reasoned but rate-limit threshold is undocumented

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (30 days — fussball.de WAM API is stable but HTML structure could change at any time; re-verify if smoke test fails)
