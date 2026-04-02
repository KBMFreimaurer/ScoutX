# Roadmap: ScoutX

## Overview

ScoutX already has significant working infrastructure — scraper, adapter service, React SPA, PDF component, and Docker Compose skeleton all exist. This roadmap hardens and activates those components in strict dependency order: validate the data source first, wire up the adapter, overhaul the PDF, deploy Ollama/Qwen, then ship to production. Each phase produces a verifiable, standalone capability. Real fussball.de data does not flow until Phase 1 ships; nothing else is worth polishing until it does.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Scraper Validation** - Harden the fussball.de scraper to reliably produce real game data with venue and concurrency controls
- [ ] **Phase 2: Adapter Integration** - Wire the scraper to the adapter REST API and surface real filtered data in the React SPA
- [ ] **Phase 3: PDF Overhaul** - Replace the broken PDF implementation with @react-pdf/renderer delivering a dark-theme, downloadable PDF
- [ ] **Phase 4: Ollama Deployment** - Install and validate Qwen via Ollama on the VPS, accessible from the frontend
- [ ] **Phase 5: Production Deployment** - Ship the full stack to the VPS via Docker Compose with security hardening

## Phase Details

### Phase 1: Scraper Validation
**Goal**: The fussball.de scraper reliably returns real competition and match data including venue/address, with rate-limit hardening and documented concurrency settings
**Depends on**: Nothing (first phase)
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-05
**Success Criteria** (what must be TRUE):
  1. Running the scraper against live fussball.de for a known Kreis/Jugendklasse returns at least one real game with Uhrzeit, Heim, Gast, Jugendklasse and Spielort/Adresse fields populated
  2. Scraper completes a full week fetch without triggering HTTP 429 errors (max 3 parallel requests, jitter applied)
  3. Game results can be filtered by Kreis, Jugendklasse, and a date range and return only matching games
  4. FUSSBALLDE_SAISON is explicitly set in config so season rollover does not silently break the data pipeline
**Plans**: TBD

Plans:
- [ ] 01-01: Live scraper smoke test and fixture capture against fussball.de
- [ ] 01-02: Concurrency hardening and venue/address field validation
- [ ] 01-03: Date-range filtering validation and season config lockdown

### Phase 2: Adapter Integration
**Goal**: The adapter REST API endpoint returns real fussball.de games filtered by the teams the scout selected in the UI, with team alias resolution surfacing correct results
**Depends on**: Phase 1
**Requirements**: DATA-04
**Success Criteria** (what must be TRUE):
  1. Selecting teams in the React wizard and submitting causes the adapter to return real games for those teams (not mock data)
  2. When a scraped team name differs slightly from the kreise.js name (e.g. "JSG Brüggen/Bracht D1" vs "JSG Brüggen/Bracht"), the game still appears in results — not silently dropped
  3. A diagnostic warning is visible in adapter logs when filtered game count falls below 30% of raw count, preventing silent empty results
**Plans**: TBD

Plans:
- [ ] 02-01: Adapter subprocess wiring and end-to-end data flow validation
- [ ] 02-02: Fuzzy team name matching and silent-drop diagnostic

### Phase 3: PDF Overhaul
**Goal**: The scout can download a dark-theme PDF directly from the browser (no print dialog) containing real game data with time, teams, Jugendklasse, and venue — formatted A4, legible, no XSS
**Depends on**: Phase 2
**Requirements**: PDF-01, PDF-02, PDF-03, PDF-04, PDF-05
**Success Criteria** (what must be TRUE):
  1. Clicking the PDF button triggers a direct browser download of a `.pdf` file — no print dialog, no popup
  2. The downloaded PDF has a dark background, BMG-Grün accent color, and light text matching the app's dark theme
  3. Each game row in the PDF shows Uhrzeit, Heim vs. Gast, Jugendklasse, and Spielort/Adresse
  4. Games are ordered chronologically within the PDF
  5. The PDF renders A4 with font sizes legible when printed
**Plans**: TBD

Plans:
- [ ] 03-01: Replace PDFExport.jsx with @react-pdf/renderer implementation
- [ ] 03-02: Dark theme styling, A4 layout, and print validation

### Phase 4: Ollama Deployment
**Goal**: Qwen is running via Ollama on the VPS and the React SPA can successfully send a prompt and receive a German-language scout analysis response
**Depends on**: Phase 2
**Requirements**: DEPL-02
**Success Criteria** (what must be TRUE):
  1. `curl http://152.53.147.185:11434/api/generate` with a Qwen model name returns a valid response (model is loaded and responsive)
  2. The React SPA sends a prompt constructed from real game data and displays the Qwen response without errors
  3. Ollama does not OOM-kill during a typical scout analysis request (model size validated against confirmed VPS RAM)
**Plans**: TBD

Plans:
- [ ] 04-01: VPS hardware check and Qwen model size selection
- [ ] 04-02: Ollama Docker Compose service definition and model pull validation

### Phase 5: Production Deployment
**Goal**: ScoutX runs on the VPS at 152.53.147.185:8090 with all components healthy, the adapter protected by token auth, CORS locked to the frontend origin, and no unnecessary ports exposed
**Depends on**: Phase 3, Phase 4
**Requirements**: DEPL-01, DEPL-03, DEPL-04, DEPL-05
**Success Criteria** (what must be TRUE):
  1. Opening http://152.53.147.185:8090/ in a browser loads the ScoutX wizard and shows real game data after configuration
  2. Requests to the adapter from any origin other than the frontend origin are rejected with a CORS error
  3. Adapter requests without the correct ADAPTER_TOKEN header return 401 — the adapter is not openly accessible
  4. Port 8787 (adapter) is not publicly reachable from outside the server — only the frontend Nginx proxy can reach it
**Plans**: TBD

Plans:
- [ ] 05-01: Production Docker Compose hardening (CORS, token auth, port restrictions)
- [ ] 05-02: Full end-to-end smoke test on VPS

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Scraper Validation | 0/3 | Not started | - |
| 2. Adapter Integration | 0/2 | Not started | - |
| 3. PDF Overhaul | 0/2 | Not started | - |
| 4. Ollama Deployment | 0/2 | Not started | - |
| 5. Production Deployment | 0/2 | Not started | - |
