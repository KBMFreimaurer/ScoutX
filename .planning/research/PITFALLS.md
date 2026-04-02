# PITFALLS — ScoutX (ScoutPlan)

**Research Type:** Project Research — Pitfalls dimension
**Milestone Context:** Subsequent — scraping fussball.de, generating PDFs, and deploying Docker+Ollama
**Date:** 2026-04-02

---

## Summary

This document captures specific, actionable pitfalls for the three active milestone areas: fussball.de scraping, client-side PDF generation, and deploying Ollama on a resource-constrained VPS. Each pitfall includes warning signs detectable early in implementation, a concrete prevention strategy, and the phase where the risk is highest.

---

## Domain 1: Scraping fussball.de

### PITFALL-1: WAM JSON endpoint format changes silently break competition discovery

**What goes wrong:** The scraper relies on undocumented JSON endpoints (`wam_base.json`, `wam_kinds_*.json`, `wam_competitions_*.json`). When fussball.de updates their season data, the schema for `Spielklasse` and `Gebiet` keys changes — most commonly by adding or removing the leading underscore prefix (`_`) on JSON property names. The codebase already accommodates this via `stripLeadingUnderscore()` and `getValueByFlexibleKey()`, but any new nesting level or renamed top-level property will silently return empty results rather than throwing an error.

**Warning signs:**
- `discoverCompetitions()` returns 0 competitions without error
- `warn("No area mapping found ...")` appears in adapter logs but no exception is raised
- Games array is empty after a successful HTTP 200 cycle in CI

**Prevention strategy:**
- After fetching `wam_kinds_*.json`, assert that the payload has at least one key under `Spielklasse` before proceeding. Throw if empty.
- Log the raw JSON shape (key count per level) at `DEBUG` level so anomalies are visible without full payload dump.
- Pin a fixture snapshot of a real `wam_kinds_*.json` response in `fussballde.test.js` to detect schema drift between test runs.
- Accept the current season from `wam_base.json` but also allow a manual `FUSSBALLDE_SAISON` override as a fast recovery path when the season rolls over (the env var already exists — document it explicitly).

**Phase:** fussball.de adapter implementation and every season boundary (typically July/August).

---

### PITFALL-2: IP rate-limiting blocks high-concurrency scrape runs

**What goes wrong:** The fetch script runs up to 4 page-concurrent and 6 match-concurrent requests (`PAGE_CONCURRENCY=4`, `MATCH_CONCURRENCY=6`). On the VPS with a single shared IP, sending 6 simultaneous requests to `www.fussball.de` within milliseconds triggers their Cloudflare/CDN rate limiter. The response switches to HTTP 429 or a redirect to a CAPTCHA page. `fetchText()` treats a non-2xx response as a thrown error and retries immediately, which makes the burst worse.

**Warning signs:**
- `fetchText()` retry warnings (`[fussballde-export][warn] ... -> HTTP 429`) appear in bursts
- Retry exponential backoff `250ms * attempt` is too short to escape a 60-second rate window
- Log shows many competition fetches failing while the first few succeed

**Prevention strategy:**
- Reduce `PAGE_CONCURRENCY` to `2` and `MATCH_CONCURRENCY` to `3` as production defaults in Docker Compose env. Higher values are only safe on residential IPs with rotating proxies.
- Change the retry backoff from `250ms * attempt` to at least `1500ms * attempt` (currently lines 84 of `fetch-week.fussballde.mjs`) for 429 responses specifically.
- Add a `jitter` factor (`Math.random() * 500`) to prevent synchronized worker retry collisions.
- Log the HTTP status code in warn messages to distinguish 429 from 5xx from network errors.

**Phase:** First live run against fussball.de in the adapter integration phase.

---

### PITFALL-3: Fixturelist AJAX endpoint returns empty HTML for date ranges that span a Spieltag boundary

**What goes wrong:** The `ajax.fixturelist` endpoint (`buildFixtureListUrl`) accepts `datum-von` / `datum-bis` and `max/500`. When the date range crosses a week with no scheduled Spieltag (e.g., winter break, tournament weeks), the response returns an HTML fragment with zero `<tr>` rows containing `club-name`. `extractMatchesFromDatePage()` returns an empty array silently. The caller logs "Match candidates: 0" and exits with an empty games array — with no differentiation between "no games this week" and "wrong URL / parsing failed".

**Warning signs:**
- Integration test with a hardcoded past date returns 0 candidates on a Sunday (fussball.de fixture calendar is Saturday-heavy)
- Testing during December break or around Easter returns 0 games across all competitions
- No `<section id="matches">` guard fires but html contains the `fixturelist` markup shell

**Prevention strategy:**
- After `collectMatchCandidates()`, if candidates = 0 but competitions > 5, emit a structured warning: "0 match candidates from N competitions — expected empty week or parsing failure."
- Write an integration smoke test (live, skippable via env flag `SKIP_LIVE_TESTS`) that hits one known Staffel for a past Saturday that definitely had games, and asserts > 0 results.
- Document the known seasonal blackout windows (Weihnachtspause, Osterpause) in adapter README so scouts know when live data will be empty.

**Phase:** fussball.de adapter implementation and first production test run.

---

### PITFALL-4: Match detail page HTML structure differs between mobile and desktop UA

**What goes wrong:** `extractMatchDetails()` parses `<h3>Anpfiff</h3><span>` and `<div class="team-name">` using the desktop HTML structure. fussball.de serves a different HTML layout when the `User-Agent` string resembles a mobile browser. The current `User-Agent` header is `ScoutPlanAdapter/1.0 (+https://www.fussball.de)` — a non-standard UA. If fussball.de's CDN categorizes this as a bot and serves a stripped/simplified page, the `time` field will be empty and `venue` will be `""`, causing the fallback `"10:00"` / `"Sportanlage"` values to appear in the output.

**Warning signs:**
- Scraped games consistently show `"10:00"` as kickoff time across all venues (the hardcoded fallback)
- Venue field shows `"Sportanlage"` for most games despite the match page displaying correct venue info in the browser
- `extractMatchDetails()` unit test passes but real-world output has blank `time` fields

**Prevention strategy:**
- Set `User-Agent` to a realistic desktop browser string (Chrome/Firefox on Linux) in production runs. Keep `ScoutPlanAdapter/1.0` only in the `X-Scout-Adapter` custom header for identification.
- Add a diagnostic assertion in `enrichMatches()`: if more than 40% of enriched games have `time === "10:00"` (the fallback), emit a warn-level alert indicating a possible UA/layout mismatch.
- Add a dedicated test fixture for the match-detail HTML format, snapshot the expected parsed fields, and update the fixture when running a live smoke test.

**Phase:** fussball.de adapter implementation and first full enrichment pass.

---

### PITFALL-5: Season rollover breaks `wam_base.json` `currentSaison` value mid-season

**What goes wrong:** The script reads `base.currentSaison` dynamically from `wam_base.json` to build all downstream URLs. At the end of June / beginning of July, fussball.de updates `currentSaison` to the new season (e.g., `2526` -> `2627`) while old season fixtures are still in the system. Overnight the adapter shifts to fetching the new (empty) season's data, returning 0 games. The adapter's 300-second TTL cache means this runs silently for 5 minutes, then floods logs.

**Warning signs:**
- Games count drops to 0 starting late June/early July
- `wam_kinds_*.json` URLs change structure (new season ID in path)
- `FUSSBALLDE_SAISON` env var is not set (overrides are disabled by default)

**Prevention strategy:**
- Always set `FUSSBALLDE_SAISON` explicitly in Docker Compose for the current season (`2526` for the 2025/26 season). Do not rely on auto-detection in production.
- Add a startup log line: `[fussballde-export] Using season=${season} (source: ${process.env.FUSSBALLDE_SAISON ? "env" : "wam_base.json"})`.
- Document the season ID format and update procedure in the adapter service README alongside the Docker Compose env section.

**Phase:** Initial Docker deployment and each subsequent season rollover.

---

## Domain 2: Client-Side PDF Generation

### PITFALL-6: Popup blocker prevents `window.open()` outside user gesture context

**What goes wrong:** `exportToPDF()` calls `window.open("", "_blank")` synchronously inside a click handler. This works in most desktop browsers because it is triggered by a user gesture. However, if the button is clicked during a loading/disabled state (e.g., right after games are fetched and before re-render), or if the user has a browser extension that defers script execution, the popup is blocked. The existing guard `if (!popup) { alert("Pop-up blockiert") }` fires but the `alert()` itself can be blocked in some headless/PWA contexts, causing silent failure with no user feedback.

**Warning signs:**
- User reports "nothing happens" when clicking PDF button on Firefox or Safari
- Chrome mobile blocks popup: button click produces no visible result
- CI screenshot test shows button clicked but no print dialog

**Prevention strategy:**
- Replace `alert()` with an inline error state rendered in the React component, not a browser-native dialog.
- Consider an alternative approach for the fallback: if `window.open()` returns null, fall back to inserting a hidden `<iframe>` in the main document with the same HTML, and call `iframe.contentWindow.print()` after `onload`. This avoids the popup entirely and is not blocked.
- Document both behaviors in code comments: `window.open()` requires a synchronous user gesture.

**Phase:** PDF export implementation.

---

### PITFALL-7: Google Fonts import fails in print view when offline or on the VPS network

**What goes wrong:** The PDF popup HTML begins with `@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono...')`. When the user's device is offline, on a corporate network with external DNS blocked, or when the VPS is serving the app and the user's browser cannot reach fonts.google.com, the fonts fail silently. The PDF renders in the fallback `sans-serif` / `monospace` stack, which changes table column widths and wraps text unexpectedly — potentially breaking the layout.

**Warning signs:**
- PDF printed in airplane mode has different font rendering
- Characters that relied on IBM Plex Mono's monospace width now overflow table cells
- Column headers and data no longer align after printing

**Prevention strategy:**
- Self-host the fonts by copying the required IBM Plex Mono and IBM Plex Sans subsets into `public/fonts/` and referencing them via relative URLs. The Vite build will include them in the production image.
- Alternatively, use only system fonts for the PDF (`font-family: 'Courier New', monospace` for code columns; `font-family: system-ui, sans-serif` for body). System fonts are guaranteed to load and produce consistent widths.
- Given the dark-theme PDF goal: the current PDF uses a light-background (`background:#fff`; `color:#0a1020`) design, meaning self-hosted fonts are the correct path for visual consistency.

**Phase:** PDF export implementation and Docker production build.

---

### PITFALL-8: `document.write()` in popup injects unsanitized game data (XSS in print view)

**What goes wrong:** The existing `PDFExport.jsx` builds the print HTML via template literals and calls `popup.document.write(html)`. If any game field (`home`, `away`, `venue`) returned from the fussball.de scraper contains a `<script>` tag or an inline event handler (e.g., from a malformed HTML entity decode), it executes in the popup's window context. CONCERNS.md already flags this (line 58). The risk escalates once the adapter feeds real scraped data — previously only mock or user-uploaded data, now external HTML-parsed strings.

**Warning signs:**
- Any game field that comes from `stripTags()` output but still contains raw `<` or `>` after decode
- Venue address fields scraped from `<a class="location">` which may include unescaped characters
- Team names with embedded emoji or special characters that survive the normalization pipeline

**Prevention strategy:**
- Implement a minimal HTML escape function in `PDFExport.jsx`: replace `&`, `<`, `>`, `"`, `'` with their HTML entities before interpolating into the template.
- This is a single, low-effort change: `const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");` and then use `esc(game.home)`, `esc(game.venue)`, etc. throughout the template.
- This must be done before the fussball.de adapter goes live in production.

**Phase:** PDF export hardening, before fussball.de adapter goes live.

---

### PITFALL-9: `setTimeout(() => popup.print(), 600)` race condition on slow devices

**What goes wrong:** A 600ms hardcoded delay is assumed to be enough for the popup DOM to settle before triggering `print()`. On low-power devices (old Android tablets, Raspberry Pi browser), 600ms is insufficient. The print dialog fires before styles have loaded, producing an unstyled PDF. On fast machines, 600ms is wasteful. CONCERNS.md already flags this (line 66).

**Warning signs:**
- PDF on mobile shows unstyled tables
- Print dialog opens but fonts are not yet rendered (visible as Flash Of Unstyled Content)
- Scouts on older Android report "blank PDF" or "PDF without tables"

**Prevention strategy:**
- Replace `setTimeout` with `popup.document.onreadystatechange` or a `window.onload` listener inside the popup. Only call `popup.print()` once `popup.document.readyState === "complete"`.
- If using self-hosted fonts (per PITFALL-7), the load event will also cover font loading.
- Keep a 10-second maximum timeout as a safety net to prevent the popup hanging indefinitely.

**Phase:** PDF export implementation.

---

## Domain 3: Deploying Docker + Ollama on a VPS

### PITFALL-10: Qwen model exceeds available VPS RAM, causing OOM kill or swap thrashing

**What goes wrong:** The target VPS (`152.53.147.185`) runs Docker with Ollama + Qwen. A typical Qwen2.5-7B model requires ~4.5GB RAM at 4-bit quantization (Q4_K_M), ~7GB for 8-bit. If the VPS has 4-8GB total RAM and is also running the nginx + adapter containers, the system either OOM-kills the Ollama process or enters catastrophic swap thrash — making inference take 60-120 seconds per response and burning SSD write cycles.

**Warning signs:**
- `docker stats` shows Ollama container memory climbing past 3GB
- `free -h` on host shows < 500MB available
- Ollama API responses arrive in > 30 seconds for short prompts
- `dmesg` shows `oom-kill` events for the `ollama` process

**Prevention strategy:**
- Before pulling the model, run `free -h` on the VPS and confirm at least `(model_size_GB + 1GB buffer)` is available.
- Choose the smallest usable Qwen variant: `qwen2.5:0.5b` (~400MB) or `qwen2.5:1.5b` (~1GB) for initial testing. Only upgrade to 7B if RAM confirms sufficient headroom.
- Set `OLLAMA_MAX_LOADED_MODELS=1` and `OLLAMA_KEEP_ALIVE=5m` in Docker Compose env to prevent model stacking in memory.
- Document the expected model size and VPS requirements in the deployment checklist.

**Phase:** Ollama deployment on VPS.

---

### PITFALL-11: Ollama container is not reachable from the frontend because of Docker network isolation

**What goes wrong:** The docker-compose.yml uses `network_mode: "host"` for all containers. On Linux this works correctly — all containers share the host network and can reach Ollama at `http://localhost:11434`. However, if `network_mode: "host"` is ever removed (e.g., for tighter security) or if the deployment is switched to Docker Desktop on macOS for local testing, `localhost` in the nginx container no longer resolves to the Ollama host. The frontend's AJAX call to `/ollama` proxied by nginx reaches nothing.

**Warning signs:**
- LLM connection test in the UI shows "Verbindungsfehler" on the VPS but works locally
- nginx logs show `502 Bad Gateway` for `/ollama` proxy upstream
- `docker exec nginx curl http://localhost:11434` fails from inside the nginx container without `network_mode: host`

**Prevention strategy:**
- Keep `network_mode: "host"` as the explicit production default and document the reason in `docker-compose.yml` comments.
- Add a health check script to the deployment runbook: `curl http://localhost:11434/api/tags` from the VPS host before starting the frontend service.
- If bridge networking is ever needed, define an explicit Docker network (`scoutx_net`) and use service name resolution (`http://ollama:11434`) instead of `localhost`. Update nginx.conf accordingly.

**Phase:** Docker deployment and Ollama integration.

---

### PITFALL-12: Ollama model pull blocks indefinitely inside Docker container with no progress feedback

**What goes wrong:** Running `docker exec ollama ollama pull qwen2.5:3b` inside a running container on a slow VPS connection (typical budget VPS: 100-500 Mbps shared) downloads 2-7GB. If the terminal session disconnects or the SSH connection drops, the pull is interrupted. The model is left in a partially downloaded state on disk. The next `ollama run` attempt either silently uses the corrupted model (producing garbage output) or fails with a non-obvious error.

**Warning signs:**
- `ollama list` shows the model but `ollama run qwen2.5:3b "test"` hangs or returns empty response
- Disk usage shows partial `~/.ollama/models/blobs/` files (sizes do not match model card)
- `journalctl` shows Ollama checksum error during model load

**Prevention strategy:**
- Pull models outside of Docker exec sessions by creating an Ollama `entrypoint.sh` that runs `ollama pull <model>` on container startup and exits only after the pull completes. Use `docker compose logs -f ollama` to monitor progress.
- Alternatively, pre-build a custom Ollama Docker image that bakes the model in at image build time (`RUN ollama pull qwen2.5:3b`), so the image is self-contained and can be transferred as a tarball if needed.
- After any pull, verify: `ollama run qwen2.5:3b "Sag hallo"` and assert the response is non-empty before declaring deployment complete.

**Phase:** Ollama deployment on VPS.

---

### PITFALL-13: `CORS_ORIGIN=*` adapter setting exposes the adapter service to the public internet

**What goes wrong:** The Docker Compose env sets `CORS_ORIGIN=*` with no `ADAPTER_TOKEN`. If the VPS port 8787 is exposed (either intentionally or because `network_mode: host` exposes all ports by default), any external actor can POST to `/api/games` and read the game schedule, or POST to `/api/admin/refresh` and trigger fussball.de scraping jobs on demand. This burns rate-limit quota and costs CPU/memory during inference.

**Warning signs:**
- Adapter logs show incoming POST requests from IPs other than `127.0.0.1`
- `ADAPTER_TOKEN` is not set in docker-compose.yml (currently commented out: `# - ADAPTER_TOKEN=change-me`)
- VPS firewall (ufw/iptables) does not block port 8787 from external traffic

**Prevention strategy:**
- Set `ADAPTER_TOKEN` to a strong random string in production and require it for all non-health-check endpoints.
- Add `ufw deny 8787` (or equivalent) to the VPS firewall rules, keeping the adapter port internal-only. nginx proxies frontend requests to the adapter via `localhost:8787`, so external access is not needed.
- Set `CORS_ORIGIN` to the specific frontend origin (`http://152.53.147.185:8090`) instead of `*` in production.
- Document the required firewall rules in the deployment checklist.

**Phase:** Docker deployment hardening, before VPS is reachable from outside.

---

### PITFALL-14: Docker build copies `adapter-service/data/games.store.json` into the image, baking stale state

**What goes wrong:** The adapter Docker image is built from the root context (`.`). If `adapter-service/data/games.store.json` contains game data from a previous local run, it is copied into the image. The production container then starts with stale cached data and may not refresh if `ADAPTER_AUTO_REFRESH_WEEK=true` has not triggered yet (the 300s TTL has not expired). Scouts see last week's games instead of the current week.

**Warning signs:**
- After `docker compose up`, the games list shows dates from the previous week
- `games.store.json` in the repo has non-empty content (`git status` shows it as modified)
- `ADAPTER_AUTO_REFRESH_WEEK` refresh does not fire until 300 seconds after container start

**Prevention strategy:**
- Add `adapter-service/data/games.store.json` to `.dockerignore` to prevent it from being baked into the image.
- The volume mount `./adapter-service/data:/app/data` in docker-compose.yml correctly overlays the host directory, but only if the host file is empty/absent. Add a note in the deployment runbook: "Delete `adapter-service/data/games.store.json` on first deploy."
- Set `ADAPTER_REFRESH_INTERVAL_SEC=30` for the first deployment to force an immediate refresh cycle.

**Phase:** First Docker production deployment.

---

## Cross-Cutting Pitfalls

### PITFALL-15: Team name fuzzy matching silently drops games when scraper returns variant spellings

**What goes wrong:** The frontend's `isLikelyTeamMatch()` in `dataProvider.js` uses tokenized substring matching to filter adapter-returned games against user-selected team names. Team names from fussball.de HTML (after `stripTags()`) may differ subtly from the user-visible team names in the Kreis selector: "JSG Brüggen/Bracht D1" vs "JSG Brüggen/Bracht", "Borussia VfL Krefeld" vs "VfL Krefeld". Games are silently dropped rather than shown with a warning. The user sees fewer games than expected and has no indication why.

**Warning signs:**
- Scouts report "missing" known teams from the games list
- Adapter returns games but frontend shows fewer than expected after filtering
- `SCOUTPLAN_DEBUG_EXPORTER=true` log shows games for a team but frontend filters them out

**Prevention strategy:**
- When `fetchGamesAdapter()` returns games and the filtered count is substantially less than the total count (e.g., filtered < 30% of raw), surface a diagnostic warning in the UI: "N games received, M matched your team selection. Are the team names correct?"
- Expose `adapter-service/data/team-aliases.json` as the canonical aliasing mechanism. Document that scouts should add aliases there when fussball.de team names differ from the selection.
- Add test cases in `dataProvider.test.js` for the specific fussball.de naming patterns: "JSG X/Y Z1", "SV X A-Junioren", "FC X 2026 e.V.".

**Phase:** fussball.de adapter integration and first real-data test.

---

*Research conducted: 2026-04-02*
*Scope: Subsequent milestone — fussball.de scraping, PDF generation, Docker+Ollama deployment*
