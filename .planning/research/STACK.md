# Stack Research: fussball.de Scraping, PDF Generation, Docker Deployment

**Research Date:** 2026-04-02
**Milestone:** Subsequent — adding real data ingestion, PDF export, and server deployment
**Question:** Best 2025/2026 stack for fussball.de scraping, dark-theme PDF generation, and Docker Compose deployment with React + Node.js + Ollama

---

## Context: What Already Exists

The existing codebase has significant relevant infrastructure already in place:

- **`adapter-service/scripts/fetch-week.fussballde.mjs`** — A complete scraper that uses native `fetch()` to hit fussball.de's JSON endpoints (`wam_base.json`, `wam_kinds_*.json`, `wam_competitions_*.json`) and HTML fixture pages. It does NOT use Puppeteer or a headless browser. This is the right approach.
- **`adapter-service/lib/fussballde.js`** — Regex-based HTML parser for extracting matches, team names, venues, and kickoff times from fussball.de's HTML responses.
- **`src/components/PDFExport.jsx`** — Uses `window.open()` + `document.write()` + `window.print()` popup approach. Light theme only. Has known XSS vulnerability (game field content injected verbatim into HTML).
- **`docker-compose.yml`** — Already has `dev`, `prod`, and `adapter` service profiles. Uses `network_mode: "host"`. No Ollama service defined yet.

**The research focus is on what needs to change or be added, not rebuilding from scratch.**

---

## Dimension 1: Web Scraping — fussball.de

### Situation Assessment

fussball.de serves most competition and fixture data through **semi-public JSON endpoints** (the `wam_*.json` pattern) that do not require authentication. The existing scraper already exploits this correctly. The HTML scraping is used only for match detail pages (venue, kickoff time) — also unauthenticated.

**The key question is not "which scraping library" but rather: does the existing approach work reliably, and what hardening is needed?**

### Current Approach: Native fetch() + Regex HTML Parsing

**Verdict: Keep this approach. It is correct.**

fussball.de does not enforce browser fingerprinting on its `wam_*.json` or `ajax.fixturelist` endpoints. These are CDN-served resources intended for their web frontend. A `fetch()` with a reasonable `User-Agent` header is sufficient.

The existing `fetchText()` function already includes:
- Configurable timeout via `AbortController`
- Retry logic (2 retries with back-off)
- Reasonable User-Agent string

### What Is Missing / Needs Hardening

**Rate limiting and back-off (MEDIUM confidence)**

The current `mapLimit()` implementation runs up to `MATCH_CONCURRENCY=6` parallel requests. This is aggressive for match detail pages. fussball.de has shown rate-limit responses (HTTP 429) in some conditions.

Recommendation: Add jitter to retries and reduce default `MATCH_CONCURRENCY` to 3 for production. The environment variable already exists so no code change is needed — just a configuration change in `docker-compose.yml`.

**User-Agent rotation (LOW priority for now)**

The current `User-Agent` is `ScoutPlanAdapter/1.0 (+https://www.fussball.de)`. This is honest and acceptable. Do not rotate; rotation is a bad-faith signal that complicates debugging. If fussball.de starts blocking, use `Mozilla/5.0` generic browser UA instead.

**HTML structure fragility (KNOWN risk)**

The regex-based parsing in `extractMatchDetails()` and `extractMatchesFromDatePage()` is tied to fussball.de's current HTML structure. fussball.de redesigns periodically. This is not a library problem — it is an inherent scraping risk. Mitigation: unit tests with saved HTML fixture files (already partially in place with `fussballde.test.js`).

### What NOT to Use

| Library | Reason to Avoid |
|---|---|
| **Puppeteer** | Adds ~300MB to Docker image, requires Chrome/Chromium, adds significant startup latency. Not needed since fussball.de JSON APIs do not require JavaScript execution. Would be appropriate only if login-walled content is needed. |
| **Playwright** | Same reasons as Puppeteer. Overkill for this use case. |
| **Cheerio** | Would replace the regex HTML parsing with a jQuery-like API. Reasonable if regex parsing becomes unmaintainable, but adds a dependency. Current regex approach handles the known HTML patterns. Do not add unless existing parsing fails. Cheerio 1.0.0 (stable) available if needed. |
| **axios** | No advantage over native `fetch()` on Node.js 22. Adds dependency without benefit. |
| **got / node-fetch** | Same as axios — Node.js 22 has native fetch. |

### Recommendation Summary

**No new scraping libraries needed.** The existing native-fetch + regex approach is correct and sufficient. Required changes:
1. Set `FUSSBALLDE_MATCH_CONCURRENCY=3` in `docker-compose.yml` for production (reduce from default 6)
2. Add `FUSSBALLDE_REQUEST_TIMEOUT_MS=20000` explicitly in production config
3. Expand test fixtures in `fussballde.test.js` to cover more HTML variations

**Confidence: HIGH** — fussball.de JSON API approach has been validated as working in the existing code. HTML parsing is fragile by nature but adequately handled.

---

## Dimension 2: PDF Generation — Dark Theme, Client-Side

### Situation Assessment

The current `PDFExport.jsx` uses `window.open()` + `document.write()` + `window.print()`. This is light-theme only and has two known issues:
1. XSS vulnerability: game field content is injected verbatim into HTML string
2. `setTimeout(...print(), 600)` race condition on slow devices
3. Print dialog appearance is browser-controlled — user must manually select "Save as PDF"

The requirement is: dark theme, structured layout, proper PDF output (not browser print).

### Option A: @react-pdf/renderer (Recommended)

**Version:** 3.4.x (latest stable as of mid-2025)
**License:** MIT
**Bundle impact:** ~150KB gzipped (significant but acceptable for this use case)

`@react-pdf/renderer` renders React components directly to PDF using a custom PDF layout engine (based on yoga-layout). It runs entirely client-side in the browser via a Web Worker.

```javascript
import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';
```

**Why this is the right choice:**

1. **Dark theme support**: Full control over `backgroundColor`, `color` on every element via StyleSheet. Dark backgrounds are fully supported.
2. **No popup/print dialog**: Generates a Blob URL that can be downloaded directly or opened in a new tab as a real PDF file.
3. **No XSS risk**: Content is passed as React props and rendered through the PDF engine — no raw HTML string injection.
4. **No setTimeout race condition**: `pdf(<Document>).toBlob()` returns a Promise. Download is triggered only after the Promise resolves.
5. **Structured layout**: Supports flexbox layout, tables, borders, custom fonts. Can replicate the app's dark theme exactly.
6. **Consistent with existing React patterns**: Components are written in JSX, same as the rest of the codebase.

**Font support**: Can embed fonts via `Font.register()`. IBM Plex Sans/Mono (already used in the current popup PDF) can be registered from Google Fonts CDN or bundled locally.

**Implementation pattern:**

```javascript
// PDFExport.jsx — new approach
import { pdf } from '@react-pdf/renderer';
import { ScoutPlanDocument } from './ScoutPlanDocument';

async function downloadPDF(games, cfg) {
  const doc = <ScoutPlanDocument games={games} cfg={cfg} />;
  const blob = await pdf(doc).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `scoutplan-${cfg.kreisLabel}-${cfg.fromDate}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
```

**Dark theme example:**
```javascript
const styles = StyleSheet.create({
  page: { backgroundColor: '#0a1020', color: '#e8eaf0', padding: 32 },
  header: { fontSize: 20, fontFamily: 'IBM Plex Mono', color: '#4ade80', marginBottom: 8 },
  row: { flexDirection: 'row', borderBottom: '1 solid #1e2940', paddingVertical: 6 },
});
```

**Confidence: HIGH**

### Option B: jsPDF + html2canvas (Not Recommended)

`jsPDF` with `html2canvas` takes a DOM screenshot and embeds it as an image in a PDF. This approach:
- Produces rasterized (non-text-searchable) PDFs
- Dark theme works because it screenshots whatever is in the DOM
- BUT: large file sizes, poor print quality at high DPI
- AND: requires a visible DOM element to screenshot (server-side generation not possible)
- AND: two library dependencies instead of one

**Verdict: Avoid for this use case.** Only appropriate when the source content is complex HTML that cannot be reproduced in `@react-pdf/renderer` primitives.

### Option C: Server-Side PDF with Puppeteer/Playwright (Not Recommended)

Generating PDFs server-side by rendering HTML in a headless browser. Produces the highest-fidelity output but:
- Requires adding Puppeteer + Chromium to the adapter service Docker image (+500MB)
- Adds latency (browser startup, render, export)
- Unnecessary for a structured tabular layout

**Verdict: Avoid.** Reserve for complex dashboard/chart PDF exports that `@react-pdf/renderer` cannot handle.

### Option D: Keeping window.open() + document.write() with Dark Theme

The current approach could be patched:
- Add dark theme CSS
- Escape HTML entities to fix XSS
- Replace `setTimeout` with `onload` event

**Verdict: Don't invest further in this pattern.** It still requires user interaction (browser print dialog → Save as PDF). The UX is inferior to a real PDF download. The XSS fix requires careful escaping of every field. `@react-pdf/renderer` solves all issues cleanly.

### Recommendation Summary

**Use `@react-pdf/renderer@^3.4.0`.**

| Criterion | Decision |
|---|---|
| Library | `@react-pdf/renderer` 3.4.x |
| Render location | Client-side (browser, Web Worker) |
| Output | PDF Blob → direct download (no print dialog) |
| Dark theme | Full support via StyleSheet |
| XSS risk | Eliminated (no HTML string injection) |
| Bundle size | ~150KB gzipped — acceptable |
| Font embedding | IBM Plex Mono/Sans via `Font.register()` |

**Confidence: HIGH**

---

## Dimension 3: Docker Deployment — React + Node.js + Ollama

### Situation Assessment

The existing `docker-compose.yml` already defines:
- `dev` profile: Vite dev server with hot reload
- `prod` profile: Nginx static file server
- `adapter` profile: Node.js adapter service on port 8787

Both use `network_mode: "host"` (all containers share host network). This is a valid approach on Linux VPS (the target environment: `152.53.147.185`). On Docker Desktop for Mac/Windows, host networking behaves differently, but production is Linux.

**What is missing: an Ollama service definition.**

### Docker Compose — Adding Ollama

```yaml
# Add to docker-compose.yml
ollama:
  image: ollama/ollama:latest
  network_mode: "host"
  volumes:
    - ollama-data:/root/.ollama
  restart: unless-stopped
  profiles:
    - prod

volumes:
  ollama-data:
```

**Why `ollama/ollama:latest` and not a pinned version?**

For an internal VPS without CI/CD, pulling `latest` is acceptable. The Ollama image is maintained by Ollama, Inc. and has a stable API. Pinning a version (e.g., `ollama/ollama:0.3.12`) is safer in production but requires manual update management. Recommend pinning once a version is validated working with Qwen.

**GPU support (MEDIUM confidence):**

If the VPS has an NVIDIA GPU, add the NVIDIA Container Toolkit to the Ollama service:
```yaml
ollama:
  image: ollama/ollama:latest
  network_mode: "host"
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: 1
            capabilities: [gpu]
  volumes:
    - ollama-data:/root/.ollama
```

If no GPU (CPU-only), remove the `deploy.resources` block. Qwen 2.5 7B runs adequately on CPU for this use case (non-real-time inference).

### Qwen Model Pull — First Deploy

After `docker compose up`, the Ollama container needs the Qwen model pulled. This is a one-time operation:

```bash
docker exec -it <container_id_or_name> ollama pull qwen2.5:7b
```

Or via the Ollama API (the adapter service or a curl command from the host):
```bash
curl -X POST http://localhost:11434/api/pull -d '{"name": "qwen2.5:7b"}'
```

**Recommended Qwen model variants for this server (based on common VPS RAM specs):**
- `qwen2.5:7b` — 4GB RAM minimum, good quality (recommended for 8GB+ RAM VPS)
- `qwen2.5:3b` — 2GB RAM minimum, faster but lower quality (fallback for constrained RAM)
- `qwen2.5:14b` — 8GB RAM minimum, best quality (only if VPS has ample RAM/GPU)

**Confidence: MEDIUM** — Exact model sizing depends on the VPS RAM/GPU spec which is not documented in the project files.

### Port Configuration

The project uses:
- Port `8090`: External app (Nginx serving React SPA)
- Port `8787`: Internal adapter service
- Port `11434`: Ollama (default)

With `network_mode: "host"`, all containers share host ports directly. No `ports:` mapping needed. This is already the pattern in the existing docker-compose.yml.

**One concern:** The current `docker-compose.yml` has `CORS_ORIGIN=*` for the adapter service. In production, this should be set to the specific frontend origin. However, since the adapter is on the same host (`localhost:8787` accessed by the React SPA from the browser), CORS is actually a non-issue for same-origin requests if the adapter is proxied through Nginx. If the adapter is accessed directly from the browser (cross-port), then `CORS_ORIGIN=http://152.53.147.185:8090` should be set.

### Dockerfile Considerations

Current `adapter-service/Dockerfile`:
```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY adapter-service /app
EXPOSE 8787
CMD ["node", "server.mjs"]
```

This is missing `npm install` before running. The adapter service has no `package.json` dependencies currently (uses only Node.js built-ins), so this works. If `@react-pdf/renderer` or any other server-side dependency is added to the adapter, a `RUN npm install` step is required.

The adapter service currently uses **only Node.js built-in modules** (`node:http`, `node:fs`, `node:path`, `node:url`, `node:child_process`, `node:stream`). No `node_modules` needed. This is correct and should be maintained.

### What NOT to Add to Docker Compose

| Addition | Why to Avoid |
|---|---|
| Redis for caching | The existing in-memory week cache (`weekRefreshCache`) is sufficient for a single-VPS deployment. Redis adds operational complexity with no benefit. |
| PostgreSQL | No relational data model needed. JSON file store is appropriate. |
| Watchtower (auto-update) | The project constraint is "manual `docker compose up`". Auto-updating in production without CI/CD is risky. |
| Traefik/Nginx Proxy Manager | One server, one app. Direct Nginx container is sufficient. |

### Recommendation Summary

| Component | Solution |
|---|---|
| Frontend | Existing Nginx Alpine container (prod profile) |
| Adapter API | Existing Node.js Alpine container (adapter profile) |
| Ollama | `ollama/ollama:latest` with named volume for model storage |
| Network | Keep `network_mode: "host"` (Linux VPS is the target) |
| GPU | Add NVIDIA deploy config only if VPS has NVIDIA GPU |
| Model | `qwen2.5:7b` (pull manually after first deploy) |

**Confidence: HIGH** for the Docker Compose structure. **MEDIUM** for GPU and model size (hardware spec not documented).

---

## Decision Summary Table

| Domain | Chosen Approach | Version | Confidence |
|---|---|---|---|
| fussball.de scraping | Native `fetch()` + regex HTML parsing (existing) | Node.js built-in | HIGH |
| Scraping hardening | Reduce `MATCH_CONCURRENCY` to 3, add jitter | Config only | HIGH |
| PDF generation | `@react-pdf/renderer` | ^3.4.0 | HIGH |
| PDF output method | Blob URL → direct download | — | HIGH |
| PDF dark theme | `StyleSheet` with dark colors | — | HIGH |
| PDF fonts | `Font.register()` for IBM Plex Mono/Sans | — | HIGH |
| Docker: Frontend | Existing Nginx Alpine (unchanged) | nginx:alpine | HIGH |
| Docker: Adapter | Existing Node.js Alpine (unchanged) | node:22-alpine | HIGH |
| Docker: Ollama | `ollama/ollama:latest` + named volume | latest | HIGH |
| Ollama model | `qwen2.5:7b` | manual pull | MEDIUM |
| Ollama GPU | Add NVIDIA deploy config if GPU available | depends on VPS | MEDIUM |

---

## What NOT to Add (Summary)

| Library/Tool | Reason |
|---|---|
| Puppeteer / Playwright | Not needed for fussball.de (JSON APIs work without headless browser). Too heavy for Docker. |
| Cheerio | Not needed while existing regex parsers hold. Add only if HTML parsing breaks. |
| jsPDF + html2canvas | Produces rasterized PDFs, inferior quality, requires DOM screenshot |
| axios / got / node-fetch | Node.js 22 has native `fetch()`. No additional HTTP client needed. |
| Redis | Over-engineering for single-VPS, single-user deployment |
| Puppeteer-based PDF | 500MB Docker image bloat for no benefit over `@react-pdf/renderer` |
| Traefik / reverse proxy | Only one service exposed externally. Direct Nginx is sufficient. |

---

## Risks and Open Questions

### Risk 1: fussball.de HTML Structure Change
- **Probability:** Medium (they have redesigned before)
- **Impact:** Venue/kickoff time data silently dropped from matches
- **Mitigation:** Save HTML fixture files as test inputs, monitor scraper output against known games

### Risk 2: fussball.de Rate Limiting
- **Probability:** Low at current scale (max 600 matches per scrape)
- **Impact:** Scrape fails mid-run, partial data
- **Mitigation:** Already has retry logic. Reduce `MATCH_CONCURRENCY=3` in production.

### Risk 3: Ollama Model Size vs VPS RAM
- **Probability:** Medium (VPS spec not documented)
- **Impact:** Qwen model fails to load, OOM kill
- **Mitigation:** Start with `qwen2.5:3b`, test, upgrade to 7b if RAM allows

### Risk 4: @react-pdf/renderer Bundle Size
- **Probability:** Low
- **Impact:** Initial app load +150KB gzipped
- **Mitigation:** Lazy-load the PDF component with `React.lazy()` — only loaded when user clicks PDF export

### Open Question: VPS GPU Availability
- Is the VPS at `152.53.147.185` CPU-only or does it have an NVIDIA GPU?
- This determines which Docker deploy config and which Qwen model variant to use

---

*Research by: gsd-project-researcher | Date: 2026-04-02*
