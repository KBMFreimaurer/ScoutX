# Architecture Research

**Research Date:** 2026-04-02
**Milestone:** Deploying existing React+Node.js app with Ollama/Qwen on a VPS via Docker Compose
**Question:** How should fussball.de scraping, PDF generation, and Ollama/Qwen integrate into an existing React SPA + Node.js adapter architecture? What are the deployment components?

---

## Summary

ScoutX already has the structural skeleton for all three integration points. The fussball.de scraper exists as a runnable Node.js script, PDF export exists as a React component, and Ollama integration exists as a fetch-based service. None of the three are production-ready. The deployment target is a VPS at `152.53.147.185:8090` using an existing Docker Compose file with `dev` and `prod` profiles. This document defines the component boundaries, data flow, and build order for making all three production-ready.

---

## Component Boundaries

### Component 1: React SPA (Frontend)

**Location:** `src/` — built by Vite, served by Nginx in production

**Responsibilities:**
- Multi-step wizard UI (Setup → Games → Plan)
- Sends POST to Adapter Service to fetch game data
- Sends POST to Ollama to generate AI scout plans
- Renders games list and top-5 recommendations
- Triggers browser print dialog for PDF export

**External boundaries:**
- Calls `POST /api/games` on Adapter Service (port 8787)
- Calls Ollama HTTP API at `/api/generate` (port 11434, or via Nginx proxy)
- Does NOT call fussball.de directly — that is the adapter's job

**Does not own:**
- Game data persistence
- Scraping
- PDF file generation (uses browser print, not server-side PDF)

---

### Component 2: Adapter Service (Backend)

**Location:** `adapter-service/` — Node.js process, port 8787

**Responsibilities:**
- Receives game data requests from the frontend (`POST /api/games`)
- Triggers the fussball.de scraper script (`fetch-week.fussballde.mjs`) as a subprocess
- Normalizes and deduplicates scraped game objects
- Caches results in `games.store.json` with a configurable TTL (default: 300s)
- Falls back to `games.sample.json` if the scraper fails
- Exposes admin endpoints (`/api/admin/refresh`, `/api/admin/import`, `/api/admin/status`)

**External boundaries:**
- Spawns `fetch-week.fussballde.mjs` as a child process, receives JSON on stdout
- Reads/writes local JSON files (`games.store.json`, `team-aliases.json`)
- Does NOT call Ollama — LLM calls are frontend-to-Ollama directly

**Subprocess interface (fussball.de scraper):**
- Input: env vars (`SCOUTPLAN_FROM_DATE`, `SCOUTPLAN_TO_DATE`, `SCOUTPLAN_KREIS_ID`, `SCOUTPLAN_JUGEND_ID`)
- Output: JSON on stdout — `{ games: [...], meta: { provider, season, fetchedAt, ... } }`
- Exit code 1 on failure; adapter logs warning and uses cached data

---

### Component 3: fussball.de Scraper (Subprocess)

**Location:** `adapter-service/scripts/fetch-week.fussballde.mjs` + `adapter-service/lib/fussballde.js`

**Responsibilities:**
- Discovers competitions for a given `jugendId` and `kreisId` via fussball.de JSON APIs (`wam_base.json`, `wam_kinds_*.json`, `wam_competitions_*.json`)
- Fetches fixture list HTML for each discovered `staffelId` via `ajax.fixturelist`
- Enriches each match by fetching individual match pages to extract kickoff time and venue
- Deduplicates results and emits a JSON array to stdout

**External boundaries:**
- Outbound HTTP to `https://www.fussball.de` (public, no auth)
- No inbound connections — it is a one-shot process

**Rate-limiting / resilience built-in:**
- Concurrency-limited via `mapLimit()` (default: 4 pages / 6 matches at a time)
- Per-request 15s timeout with 2 retries and 250ms backoff
- Hard cap: 80 competitions, 600 matches

**Known gaps (unresolved before this milestone):**
- User-agent string is set but not tested for block detection
- No proxy rotation or IP rotation
- No validation that scraped team names match `src/data/kreise.js` team lists

---

### Component 4: PDF Export (Frontend Component)

**Location:** `src/components/PDFExport.jsx`

**Responsibilities:**
- Renders a button that opens a new browser window with HTML structured for print
- Passes games array (sorted by priority, top 5 shown first) and AI plan text to the popup
- Triggers `window.print()` after a 600ms delay

**Integration point:**
- Receives structured game objects (`{ home, away, dateLabel, time, venue, km, priority }`) and `plan` (AI text string) as props
- Currently uses `plan` (raw LLM output text) as a section in the printed page
- Does NOT require a server-side PDF renderer — uses browser print-to-PDF

**Boundaries:**
- No backend calls — entirely client-side
- Depends on `games` array being populated (from Adapter Service or CSV/mock)
- Optionally depends on `plan` string (from Ollama) — if empty, plan section is omitted

**Known gaps (unresolved before this milestone):**
- Uses `document.write()` — XSS risk if game field data contains HTML (low risk for internal use)
- PDF is light-themed (white background); PROJECT.md requires dark theme PDF — this is a pending change
- `setTimeout(print, 600)` is a race condition on slow systems

---

### Component 5: Ollama / Qwen (AI Inference Service)

**Location:** Separate process on the VPS — NOT a Docker Compose service in the current config

**Responsibilities:**
- Serves the Ollama HTTP API at port 11434
- Loads and runs the Qwen model
- Accepts `POST /api/generate` from the React frontend (or via Nginx proxy)

**External boundaries:**
- The React SPA calls `POST /api/generate` with `{ model, prompt, stream: false }`
- Returns `{ response: "..." }` — the generated scout plan text
- Has a `/api/tags` endpoint used for connection testing in the UI

**Deployment constraint:**
- Must be installed natively on the VPS (outside Docker) OR as a separate Docker container with GPU/memory access
- The current `docker-compose.yml` does NOT define an Ollama service — Ollama is referenced via `OLLAMA_HOST=http://localhost:11434/`
- Model size is constrained by VPS RAM/GPU; Qwen 2.5 3B or 7B are viable; 14B+ may be too large

---

### Component 6: Nginx (Reverse Proxy + Static File Server)

**Location:** Production Docker container (`Dockerfile` + `nginx.conf`)

**Responsibilities:**
- Serves the pre-built React SPA static files (from `dist/`)
- Proxies `/ollama` path to `http://localhost:11434` so browser can reach Ollama without CORS issues
- Optionally proxies `/api` to the Adapter Service on port 8787

**Boundaries:**
- Inbound: external traffic on port 8090 (mapped to container port 80)
- Outbound: Adapter Service on port 8787 (host network), Ollama on port 11434 (host network)

---

## Data Flow

### Flow 1: Game Data (fussball.de → PDF)

```
User (browser)
  → [1] Sets up Kreis, Jugendklasse, Teams, date range in SetupPage
  → [2] Clicks "Build"
  → [3] React calls POST /api/games on Adapter Service
          Body: { kreisId, jugendId, teams[], fromDate, toDate }

Adapter Service (port 8787)
  → [4] Checks week cache (weekRefreshCache[cacheKey])
  → [5] If cache stale: spawns fetch-week.fussballde.mjs as child process
          Env: SCOUTPLAN_FROM_DATE, SCOUTPLAN_TO_DATE, SCOUTPLAN_KREIS_ID, SCOUTPLAN_JUGEND_ID

fussball.de Scraper (subprocess)
  → [6] Fetches wam_base.json, wam_kinds_*.json from fussball.de
  → [7] Discovers competition URLs for jugendId + kreisId
  → [8] Fetches fixture lists (HTML) for each competition
  → [9] Fetches individual match pages to extract time + venue
  → [10] Emits { games: [...], meta: {...} } to stdout, exits 0

Adapter Service
  → [11] Receives stdout, normalizes games via lib/games.js
  → [12] Merges with existing store, deduplicates, writes games.store.json
  → [13] Filters games by teams/dates, returns JSON to React

React (GamesPage)
  → [14] Displays games list (cards on mobile, table on desktop)
  → [15] Shows Top 5 sorted by priority DESC

User
  → [16] Navigates to PlanPage
  → [17] Clicks "↓ PDF"

React (PDFExport)
  → [18] Opens browser popup with HTML print template
  → [19] Calls window.print() after 600ms
  → [20] User saves as PDF via browser print dialog
```

### Flow 2: AI Plan Generation (Ollama/Qwen)

```
User (PlanPage)
  → [1] Clicks "Generate Plan with AI"

React (app.jsx + llm.js)
  → [2] Constructs prompt: Kreis + Jugendklasse + top games list (formatted text)
  → [3] Calls POST /api/generate on Ollama endpoint
          isOllama=true → URL: {endpoint}/api/generate
          Body: { model: "qwen", prompt, stream: false }

Ollama (port 11434)
  → [4] Runs Qwen inference
  → [5] Returns { response: "..." } — German-language scout analysis

React
  → [6] Stores plan text in context state
  → [7] Displays plan in PlanView component
  → [8] PDFExport can include plan text in PDF if plan is non-empty
```

### Flow 3: Fallback Chain (when fussball.de scraper fails)

```
Adapter Service
  → Scraper fails (timeout, HTTP error, blocked) → logs warning
  → Falls back to cached games.store.json
  → If store empty → returns games.sample.json data

React dataProvider.js
  → Adapter returns no games or request fails
  → Falls back to mock data generator (buildMockSchedule)
  → User sees mock data with clear "Testdaten" indicator
```

---

## Deployment Components

### Docker Compose Services (existing, to be activated)

| Service | Profile | Port | Image |
|---------|---------|------|-------|
| `prod` | prod | host:8090 → container:80 | Nginx + pre-built SPA |
| `adapter` | prod | host:8787 | Node.js 22 Alpine |
| `dev` | dev | host:5173 | Node.js 22 Alpine (Vite HMR) |

### Ollama (outside Docker Compose)

| Component | Location | Port | Notes |
|-----------|---------|------|-------|
| Ollama daemon | Native on VPS | 11434 | Installed via `curl -fsSL https://ollama.com/install.sh` |
| Qwen model | `/root/.ollama/models` | — | Pulled via `ollama pull qwen2.5:3b` or similar |

### Network (host mode)

All Docker services use `network_mode: "host"` — containers share the VPS network stack directly. This means:
- No explicit port mapping barriers between containers and the host
- Adapter on 8787 is reachable from Nginx at `localhost:8787`
- Ollama on 11434 is reachable from all containers at `localhost:11434`
- External traffic enters on port 8090 → Nginx serves SPA and proxies where configured

---

## Build Order (Dependency Analysis)

The components have the following dependency chain for building/testing/deploying:

### Phase 1 — fussball.de Scraper (no external dependencies in codebase)

**Why first:** The scraper (`fetch-week.fussballde.mjs`) is self-contained and currently untested. It calls fussball.de's public APIs and must work before the adapter service can provide real data. All downstream components depend on real game data.

**Tasks:**
1. Test `fetch-week.fussballde.mjs` manually with real `SCOUTPLAN_KREIS_ID` and `SCOUTPLAN_JUGEND_ID` values
2. Verify HTML parsing against current fussball.de page structure (may have changed since code was written)
3. Fix any parsing failures — team names, venue extraction, date/time parsing
4. Confirm output JSON matches the game object schema expected by `adapter-service/lib/games.js`

**Blocking:** Without working scraper, adapter returns sample data; PDF and AI plan cannot use real games.

---

### Phase 2 — Adapter Service Integration (depends on Phase 1)

**Why second:** Once the scraper produces correct output, wire it into the adapter's auto-refresh pipeline and validate end-to-end data flow.

**Tasks:**
1. Configure `ADAPTER_EXPORT_COMMAND` in `docker-compose.yml` to point to the scraper
2. Configure `ADAPTER_WEEK_SOURCE_TOKEN` and `ADAPTER_WEEK_SOURCE_URL_TEMPLATE` if a direct URL source is also desired
3. Test `POST /api/games` with a real request payload (kreisId, jugendId, fromDate, toDate, teams)
4. Validate that team names from scraper match team names in `src/data/kreise.js` (fuzzy matching may need tuning)
5. Confirm `games.store.json` is populated correctly and cache TTL behaves as expected

**Blocking:** Without working adapter, the React SPA has no real game data to display or export.

---

### Phase 3 — PDF Export Update (depends on Phase 2)

**Why third:** PDF export already works mechanically but renders a light theme. The requirement is dark theme. This is a pure frontend change and can only be validated meaningfully once real game data is flowing.

**Tasks:**
1. Restyle the HTML template inside `exportToPDF()` in `PDFExport.jsx` to use dark background (`#0a1020`) and light text
2. Replace `document.write()` with `popup.document.open()` + `popup.document.write()` + `popup.document.close()` sequence, or switch to `srcdoc` iframe to reduce XSS surface
3. Replace `setTimeout(print, 600)` with `popup.onload = () => popup.print()` to fix race condition
4. Verify PDF layout with real game data (team names, venues, dates from scraper)

**Blocking:** Can be built before Phase 2 is complete (mock data works), but validation requires real data.

---

### Phase 4 — Ollama/Qwen Deployment (partially independent)

**Why fourth:** Ollama itself can be installed and tested independently of the scraper or PDF changes. However, meaningful AI plan generation requires real game data as input to the prompt.

**Tasks:**
1. Install Ollama on the VPS natively
2. Pull the Qwen model (`ollama pull qwen2.5:3b` or appropriate size for available RAM)
3. Verify Ollama is accessible at `http://localhost:11434/api/tags` from inside Docker containers (host network mode)
4. Test connection from React SPA using the LLMConfig UI (`/api/tags` ping)
5. Confirm `OLLAMA_HOST` env var in `docker-compose.yml` matches the actual endpoint

**Blocking for AI plans:** Without Ollama running, AI plan generation fails with a network error. PDF export and game data display work independently.

---

### Phase 5 — Docker Compose Deployment on VPS (depends on Phases 1–4)

**Why last:** Containerized deployment should be done after all components are locally validated.

**Tasks:**
1. Build production Docker images: `docker compose --profile prod build`
2. Start services: `docker compose --profile prod up -d`
3. Verify Nginx serves SPA on port 8090
4. Verify adapter health endpoint: `GET http://152.53.147.185:8787/health`
5. Verify Ollama connection test from within the app UI
6. Run full end-to-end flow: Setup → fetch real games → generate AI plan → export PDF

---

## Integration Risks and Notes

### fussball.de Scraping

- fussball.de has no official public API. The scraper targets JSON endpoints (`wam_base.json`, `wam_kinds_*.json`) and HTML pages. These can change without notice.
- The user-agent is set to `ScoutPlanAdapter/1.0` — this may be blocked by fussball.de's CDN if they implement bot protection.
- The scraper fetches individual match pages to get kickoff time and venue. With 600 match cap and 6 concurrent requests, this can take 2–3 minutes for a large week. The adapter's 30s subprocess timeout (`ADAPTER_WEEK_COMMAND_TIMEOUT_MS`) may be too low for full scraping runs.
- Venue data is extracted from a `<a class="location">` element — this is fragile and may return empty strings.

### PDF Export

- The current PDFExport component uses `document.write()` on a popup window, which is XSS-vulnerable if game data contains HTML. Risk is low for internal use (closed team scouting) but should be noted.
- The browser print dialog is controlled by the user — the app cannot force "save as PDF" automatically. Users must manually select "Save as PDF" in the print dialog.
- Dark theme PDF will require testing across Chrome/Firefox/Safari — print CSS rendering varies.

### Ollama on VPS

- Qwen model size determines response quality and RAM requirement. Qwen 2.5 3B requires ~4GB RAM; 7B requires ~8GB. VPS specs must be confirmed before model selection.
- The LLM prompt sends all game data as formatted text. With 100+ real games, the prompt may exceed the model's context window. The existing `LLM_PROMPT_TOKEN_LIMIT` concern (noted in CONCERNS.md) applies here — filtering to top 20–30 games by priority before sending to Ollama is recommended.
- Ollama is not in the Docker Compose file. It must be managed as a separate systemd service on the VPS, outside Docker.

### Docker Compose `network_mode: host`

- All services use `network_mode: "host"` — this means containers are not isolated from the host network. This is intentional for simplicity (Ollama at `localhost:11434` is accessible from within containers) but reduces container isolation. This is acceptable for a single-user internal tool.

---

*Research by: gsd-project-researcher — 2026-04-02*
