# Project Research Summary

**Project:** ScoutX (ScoutPlan)
**Domain:** Youth football scouting match-day planner — fussball.de data ingestion, dark-theme PDF export, Docker + Ollama/Qwen deployment
**Researched:** 2026-04-02
**Confidence:** HIGH (stack and architecture), MEDIUM (Ollama sizing)

## Executive Summary

ScoutX is a single-user internal tool for youth football scouts that fetches game schedules from fussball.de, surfaces a prioritized match list, generates an AI scouting plan via a locally-hosted Qwen LLM, and exports a dark-theme PDF. The codebase is significantly further along than a blank project: the scraper, adapter service, React SPA, PDF component, and Docker Compose skeleton all exist. The research milestone is not "what to build" but "what to harden and activate." The recommended approach is incremental validation moving through a strict dependency chain: scraper first, then adapter integration, then PDF overhaul, then Ollama deployment, and finally full VPS production deployment.

The key technology decisions are settled at HIGH confidence. The existing native-`fetch` + regex scraper should not be replaced — only hardened with reduced concurrency (`MATCH_CONCURRENCY=3`) and jitter. PDF export should be replaced with `@react-pdf/renderer@^3.4.0`, which eliminates the current `window.open()` / `document.write()` XSS vulnerability, removes the print-dialog UX friction, and delivers a real dark-theme PDF as a direct download. Ollama should be added to Docker Compose as a named-volume container running `qwen2.5:7b` (or `3b` if RAM is constrained), accessed via the existing `network_mode: "host"` setup.

The primary risks are: (1) fussball.de HTML/JSON schema fragility — the existing unit tests with saved fixtures must be expanded before any live deployment; (2) Qwen model OOM on the VPS — VPS RAM must be confirmed before model selection; (3) team name fuzzy-match silent dropping — the frontend can silently show 0 games when scraped names differ from `kreise.js` names. All three risks are mitigable with explicit checks and documented fallback strategies.

---

## Key Findings

### Recommended Stack

The existing technology choices are correct and should not be changed. The scraper uses Node.js 22 native `fetch()` with regex HTML parsing — no Puppeteer, no Cheerio, no axios. This is the right approach because fussball.de serves its competition and fixture data through semi-public JSON endpoints that do not require browser execution. Puppeteer would add 300MB+ to the Docker image for zero benefit.

The one significant addition to the stack is `@react-pdf/renderer@^3.4.0` (MIT, ~150KB gzipped) replacing the current `window.open() + document.write()` pattern. This library renders JSX components directly to a PDF Blob in a Web Worker — no print dialog, no XSS, full dark-theme StyleSheet support. It should be lazy-loaded via `React.lazy()` to avoid impacting initial page load.

**Core technologies:**
- `native fetch()` + regex (Node.js built-in): fussball.de scraping — no new dependencies needed, already works
- `@react-pdf/renderer@^3.4.0`: PDF generation — replaces broken/insecure window.open pattern with real PDF Blob download
- `ollama/ollama:latest` Docker image: AI inference — adds Qwen capability without native install complexity
- `qwen2.5:7b` (or `3b`): LLM model — RAM-constrained choice, must confirm VPS hardware before commit
- Nginx Alpine + Node.js 22 Alpine: existing containers, unchanged

**What NOT to add:** Puppeteer, Playwright, Cheerio, axios, jsPDF, Redis, PostgreSQL, Traefik.

### Expected Features

The dependency chain determines build order: the scraper feeds the adapter, which feeds the frontend, which feeds the PDF. There is no value in polishing the PDF until real data flows. AI prioritization is the only major differentiator and it is correctly deferred behind the working data pipeline.

**Must have (table stakes):**
- Real game data from fussball.de filtered by Kreis, Jugendklasse, and date range — the core value proposition
- Team filtering — scouts only care about their tracked teams
- Venue/address in every game row — scouts need to know where to drive
- Dark-theme PDF with direct download — the current light-theme print dialog is not fit for production

**Should have (competitive):**
- AI-powered game prioritization via Ollama/Qwen — differentiates from a manual spreadsheet
- One-click PDF download with no print dialog — professional UX

**Defer (v2+):**
- Route optimization between venues
- Multi-scout coordination and assignment
- Historical scouting records and player tracking
- User accounts and authentication

### Architecture Approach

ScoutX has a clean 5-component architecture: React SPA (Vite build, Nginx prod serve), Adapter Service (Node.js 22, port 8787), fussball.de Scraper (subprocess invoked by adapter via `child_process`), PDF Export (client-side React component), and Ollama (Docker container, port 11434). All components use `network_mode: "host"` on the Linux VPS, which is intentional and correct — it allows the React SPA to reach Ollama at `localhost:11434` via Nginx proxy without Docker bridge networking complications.

The data flow is: user configures scout parameters in SetupPage → React POSTs to adapter → adapter spawns scraper subprocess → scraper emits JSON to stdout → adapter normalizes and caches to `games.store.json` → adapter returns filtered games → React displays list → user clicks PDF → `@react-pdf/renderer` generates Blob → direct download. AI flow is parallel: React constructs prompt from top games and POSTs directly to Ollama `/api/generate`.

**Major components:**
1. React SPA (`src/`) — wizard UI, game display, PDF trigger, Ollama prompt construction
2. Adapter Service (`adapter-service/`) — scraper orchestration, caching, game normalization, REST API
3. fussball.de Scraper (`adapter-service/scripts/fetch-week.fussballde.mjs`) — subprocess, stdout JSON, stateless
4. PDF Export (`src/components/PDFExport.jsx`) — client-side only, no backend calls
5. Ollama (`ollama/ollama` container) — HTTP API at 11434, Qwen model, Docker named volume

### Critical Pitfalls

1. **WAM JSON schema silent empty results** — `discoverCompetitions()` returns 0 competitions without error when fussball.de renames JSON keys at season rollover. Prevention: assert payload has at least 1 `Spielklasse` entry before proceeding; log raw key count at DEBUG level; pin `FUSSBALLDE_SAISON` explicitly in Docker Compose rather than relying on `wam_base.json` auto-detection.

2. **IP rate-limiting on high-concurrency scrape** — Default `MATCH_CONCURRENCY=6` triggers Cloudflare 429s. Prevention: set `MATCH_CONCURRENCY=3` and `PAGE_CONCURRENCY=2` in production Docker Compose env; increase retry backoff from `250ms * attempt` to `1500ms * attempt` for 429 responses; add `Math.random() * 500ms` jitter.

3. **Qwen model OOM on VPS** — `qwen2.5:7b` at Q4_K_M requires ~4.5GB RAM. If the VPS has 4-8GB total with other containers running, OOM kill or swap thrash will occur. Prevention: run `free -h` on VPS before model selection; start with `qwen2.5:1.5b` for initial testing; set `OLLAMA_MAX_LOADED_MODELS=1` and `OLLAMA_KEEP_ALIVE=5m`.

4. **XSS in PDF popup from scraped data** — `PDFExport.jsx` injects game fields verbatim into `document.write()` HTML. With real fussball.de data this is a live XSS vector. Prevention: either add `esc()` HTML-entity function to the existing component (fast path) OR migrate to `@react-pdf/renderer` (correct path — eliminates the issue entirely).

5. **Team name fuzzy-match silently dropping games** — Scraped team names from fussball.de (`"JSG Brüggen/Bracht D1"`) may not match `kreise.js` names (`"JSG Brüggen/Bracht"`), causing the frontend to silently filter out games. Prevention: surface a diagnostic warning when filtered count is < 30% of raw count; document `team-aliases.json` as the canonical resolution mechanism.

---

## Implications for Roadmap

Based on combined research, the natural phase structure follows the data dependency chain. Each phase is a prerequisite gate for the next.

### Phase 1: Scraper Validation and Hardening

**Rationale:** The fussball.de scraper is the root of the entire data pipeline. Every downstream component depends on it producing correct, non-empty output. It exists but has never been tested against live fussball.de data in the context of this codebase. All other phases produce mock data until this works.

**Delivers:** A validated scraper that reliably returns real competition and match data, with rate-limit hardening and test fixtures.

**Addresses:** Data ingestion (table stakes feature), venue/address per game (requires match detail page scraping)

**Avoids:** PITFALL-1 (WAM JSON schema drift), PITFALL-2 (rate limiting), PITFALL-3 (empty fixture HTML), PITFALL-4 (UA/layout mismatch), PITFALL-5 (season rollover)

**Research flag:** Standard patterns — native fetch scraping is well understood. No additional research needed. Focus is on empirical testing against live fussball.de.

---

### Phase 2: Adapter Integration and End-to-End Data Flow

**Rationale:** Once the scraper produces correct output, the adapter needs to be wired to invoke it, normalize results, and return them correctly to the React SPA. This phase closes the full data loop from UI request to real game data displayed in the browser.

**Delivers:** `POST /api/games` returns real fussball.de games filtered by selected teams; `games.store.json` is correctly populated and cached; team alias resolution is documented and working.

**Addresses:** Adapter integration (existing code, needs validation), team filtering (requires fuzzy match tuning)

**Avoids:** PITFALL-14 (stale `games.store.json` baked into Docker image), PITFALL-15 (team name silent filtering), PITFALL-13 (CORS_ORIGIN=* and exposed adapter port)

**Research flag:** No additional research needed — adapter patterns are well-documented in the codebase.

---

### Phase 3: PDF Export Overhaul

**Rationale:** PDF is the primary deliverable scouts use in the field. The current implementation has three blocking issues: light theme only, XSS vulnerability, and print-dialog UX. This is a pure frontend change that can be parallelized with Phase 2 for development but requires real data for proper validation.

**Delivers:** A dark-theme PDF downloaded directly as a `.pdf` file (no print dialog), containing real game data with venue, time, team names, and optional AI plan text. Fonts self-hosted. No XSS.

**Addresses:** Dark theme PDF (competitive differentiator), one-click download (table stakes UX), XSS fix (security)

**Uses:** `@react-pdf/renderer@^3.4.0`, `Font.register()` for IBM Plex Mono/Sans from `public/fonts/`

**Avoids:** PITFALL-6 (popup blocker), PITFALL-7 (Google Fonts offline failure), PITFALL-8 (XSS in document.write), PITFALL-9 (setTimeout race condition)

**Research flag:** Standard patterns — `@react-pdf/renderer` is well-documented. Implementation is straightforward. No additional research needed.

---

### Phase 4: Ollama / Qwen Deployment

**Rationale:** Ollama is independently deployable from the data pipeline. The AI plan feature has no impact on data ingestion or PDF export. However, meaningful prompt quality requires real game data as input, so this phase benefits from Phases 1-2 being complete.

**Delivers:** Ollama running on the VPS with Qwen model loaded, accessible from the React SPA, generating German-language scout analysis from real game data.

**Addresses:** AI-powered prioritization (key differentiator), Ollama Docker service definition

**Uses:** `ollama/ollama:latest` with named volume, `qwen2.5:7b` or `3b` based on confirmed VPS RAM

**Avoids:** PITFALL-10 (Qwen OOM on VPS), PITFALL-11 (Docker network isolation), PITFALL-12 (partial model pull)

**Research flag:** Needs validation on VPS hardware specs before model selection. The RAM/GPU question must be answered before this phase begins.

---

### Phase 5: Full VPS Production Deployment

**Rationale:** Containerized production deployment should happen after all components are locally validated. This phase activates the full prod Docker Compose stack, hardens security, and runs an end-to-end smoke test.

**Delivers:** ScoutX running at `152.53.147.185:8090`, all components healthy, security hardened, deployment runbook documented.

**Addresses:** Reliable uptime (table stakes), accessible via browser (table stakes)

**Avoids:** PITFALL-13 (CORS_ORIGIN=* and open port 8787), PITFALL-14 (stale Docker image state)

**Research flag:** Standard patterns — Docker Compose prod deployment is well-understood. Nginx + Node.js + Ollama on host network is the documented pattern.

---

### Phase Ordering Rationale

- **Scraper first** because all other phases produce mock data without it. There is no point building the PDF or Ollama integration without validating the data source.
- **Adapter second** because it is the bridge between scraper and frontend. Until this works, the React SPA cannot display real data.
- **PDF third** because it can be developed in parallel with Phase 2 but only validated with real data. Replacing `window.open()` with `@react-pdf/renderer` is a self-contained frontend change.
- **Ollama fourth** because it is orthogonal to data flow but benefits from real games as prompt input for quality testing.
- **Deployment last** because it should wrap already-validated components, not be the first place issues are discovered.

### Research Flags

Phases needing deeper research during planning:
- **Phase 4 (Ollama):** VPS hardware specification (RAM, GPU) must be confirmed before model variant can be selected. Without this, the `qwen2.5:7b` vs `3b` vs `1.5b` decision cannot be made.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Scraper):** Pattern is empirical testing, not research. Run the scraper against live fussball.de, observe failures, fix.
- **Phase 2 (Adapter):** Existing codebase is well-understood. Integration work, not research.
- **Phase 3 (PDF):** `@react-pdf/renderer` is well-documented. Implementation is mechanical.
- **Phase 5 (Deployment):** Docker Compose production patterns are standard.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technology choices are validated against existing working code. `@react-pdf/renderer` is the one new addition — well-documented, MIT licensed, actively maintained. |
| Features | HIGH | Feature set is clearly delineated. Table stakes are obvious for the domain. Deferral decisions (auth, mobile app, social) are appropriate for an internal single-user tool. |
| Architecture | HIGH | Architecture is already built. Component boundaries and data flows are documented in code. Research confirmed the existing patterns are correct. |
| Pitfalls | HIGH | 15 specific pitfalls identified with concrete prevention strategies tied to specific lines of code. Most are observable with early warning signs. |

**Overall confidence:** HIGH

### Gaps to Address

- **VPS hardware spec (RAM/GPU):** The Qwen model size selection (0.5b / 1.5b / 3b / 7b) depends entirely on available VPS RAM. This is not documented anywhere in the codebase. Must be resolved before Phase 4 begins. Action: `ssh root@152.53.147.185 "free -h && nvidia-smi 2>/dev/null || echo 'No GPU'"`.

- **fussball.de current HTML structure:** The regex parsers in `fussballde.js` may be outdated relative to the current fussball.de page layout. This cannot be resolved without running the scraper against live fussball.de. Action: first task in Phase 1 is a live scraper run with known `kreisId` / `jugendId` values.

- **Adapter subprocess timeout:** The current `ADAPTER_WEEK_COMMAND_TIMEOUT_MS` (30s) may be too short for a full scrape run (2-3 minutes for 600 matches). This needs to be set to at least 300000ms (5 minutes) in production Docker Compose. This is a config fix, not a code change.

- **`FUSSBALLDE_SAISON` value:** The current season ID (`2526` for 2025/26 season) must be set explicitly in `docker-compose.yml` rather than relying on `wam_base.json` auto-detection. Action: set this in Phase 1 as part of scraper hardening.

---

## Sources

### Primary (HIGH confidence)
- Existing codebase (`adapter-service/scripts/fetch-week.fussballde.mjs`, `adapter-service/lib/fussballde.js`) — validated working scraper logic and data flow
- Existing codebase (`src/components/PDFExport.jsx`, `docker-compose.yml`) — current state of PDF and deployment components
- `@react-pdf/renderer` documentation (v3.4.x) — PDF generation patterns, StyleSheet API, Font.register()
- Ollama Docker Hub (`ollama/ollama`) — named volume pattern, GPU deploy config, API surface

### Secondary (MEDIUM confidence)
- Community reports on fussball.de scraping approaches — confirms JSON endpoint availability without auth
- Ollama model card for Qwen2.5 variants — RAM requirements per model size

### Tertiary (LOW confidence / needs validation)
- VPS hardware spec at `152.53.147.185` — unknown, assumed 4-8GB RAM based on budget VPS norms
- fussball.de current HTML structure — assumed stable since scraper was written, but unverified against live site

---

*Research completed: 2026-04-02*
*Ready for roadmap: yes*
