# External Integrations

**Analysis Date:** 2026-04-02

## APIs & External Services

**Large Language Models (LLM):**
- Ollama (local inference engine) - Scouting report generation via AI
  - SDK/Client: Native Fetch API with Ollama endpoint
  - Auth: Optional Bearer token via `apiKey` parameter
  - Default endpoint: `/ollama` (proxied via Vite dev server)
  - Production: Configurable via LLMConfig UI
  - Supported endpoints: Both Ollama native API and OpenAI-compatible APIs

- OpenAI-compatible APIs - Alternative to Ollama
  - SDK/Client: Native Fetch API (drop-in replacement for Ollama)
  - Auth: API Key via `llmKey` (Bearer token in Authorization header)
  - Endpoint: Configurable via UI, supports any OpenAI-compatible provider

**Data Adapters:**
- Custom Adapter Service (local HTTP) - Live game schedule data
  - Location: `adapter-service/` (separate Node.js service)
  - Port: 8787 (configurable via `ADAPTER_PORT`)
  - Endpoint: `/api/games` (POST)
  - Auth: Optional Bearer token via `ADAPTER_TOKEN`
  - Format: JSON request/response
  - Features: Weekly refresh, caching, team aliasing, import support

**External Data Sources (via Adapter):**
- Fussball.de - German soccer league data (optional)
  - Script: `adapter-service/scripts/fetch-week.fussballde.mjs`
  - Trigger: Weekly auto-refresh configured via adapter
  - Auth: Configurable token via `ADAPTER_WEEK_SOURCE_TOKEN`

## Data Storage

**Databases:**
- Not applicable - No database integration

**File Storage:**
- Local filesystem (Client-side)
  - CSV/JSON import: Files parsed client-side in `src/services/dataProvider.js`
  - Format: CSV with optional headers (semicolon or comma delimited) or JSON arrays
  - Supported fields: home, away, date, time, venue, km, priority, turnier, jugendId, kreisId

- Adapter Service local storage:
  - `adapter-service/data/games.sample.json` - Sample game data
  - `adapter-service/data/games.store.json` - Persistent game cache
  - `adapter-service/imports/` - Directory for file imports
  - `adapter-service/data/team-aliases.json` - Team name normalization

**Caching:**
- Browser localStorage - User configuration and game selections
  - Keys: `STORAGE_KEYS` (defined in `src/data/constants.js`)
  - Data: LLM settings, adapter endpoint, last selected teams/districts
  - Persistence: Auto-save on config changes

- Browser sessionStorage - Temporary session data
  - LLM API key (if `rememberApiKey` is false, uses session-only)
  - Cleared on browser close

- Adapter service in-memory cache - Game data with TTL
  - Weekly cache: 300 seconds (configurable via `ADAPTER_WEEK_REFRESH_TTL_SEC`)
  - Auto-refresh: Enabled by default (`ADAPTER_AUTO_REFRESH_WEEK`)

## Authentication & Identity

**Auth Provider:**
- Custom/None - No centralized authentication system

**Access Control:**
- Optional Bearer token for Adapter Service
  - Header: `Authorization: Bearer {token}`
  - Environment variable: `ADAPTER_TOKEN`
  - Used to gate `/api/admin/` endpoints (refresh, test, etc.)

- Optional API Key for LLM
  - Header: `Authorization: Bearer {apiKey}`
  - Can be remembered locally or session-only via UI toggle
  - Only required for OpenAI-compatible LLM providers

## Monitoring & Observability

**Error Tracking:**
- Not detected - No external error tracking service

**Logs:**
- Console logging - Client-side errors and info messages
- Adapter service: Built-in Node.js console logging
- No log aggregation or persistence

## CI/CD & Deployment

**Hosting:**
- Docker containers (configurable deployment target)
  - Dev: Node.js 22 Alpine with Vite dev server (port 5173)
  - Prod: Nginx Alpine serving pre-built static assets (port 80)
  - Adapter: Node.js 22 Alpine with custom service (port 8787)

**CI Pipeline:**
- Not detected - No CI/CD configuration files (GitHub Actions, etc.)

**Build Process:**
- Vite build to static output (`dist/` directory)
- Multi-stage Docker build: Node.js for build, Nginx for production serve
- Nginx proxy configuration in `nginx.conf`

## Environment Configuration

**Required env vars:**
- `OLLAMA_HOST` - Ollama service endpoint (default: http://localhost:11434/)
- `ADAPTER_PORT` - Adapter service port (default: 8787)
- `ADAPTER_HOST` - Adapter service bind address (default: 0.0.0.0)
- `CORS_ORIGIN` - CORS allowed origin for adapter (default: *)

**Optional env vars:**
- `ADAPTER_TOKEN` - Bearer token for adapter authentication
- `ADAPTER_EXPORT_COMMAND` - Command to fetch external data (default: fetch-week.fussballde.mjs)
- `ADAPTER_WEEK_SOURCE_URL_TEMPLATE` - External data source URL template
- `ADAPTER_WEEK_SOURCE_TOKEN` - Token for external data source
- `ADAPTER_REMOTE_URL` - Alternative remote adapter endpoint
- `ADAPTER_REMOTE_TOKEN` - Token for remote adapter

**Secrets location:**
- Docker Compose: Environment variables in `docker-compose.yml` (not .env file)
- Client-side: Optional localStorage persistence (user configurable)
- Session-only: sessionStorage for temporary API keys

## Webhooks & Callbacks

**Incoming:**
- Adapter refresh endpoint: `POST /api/admin/refresh`
  - Triggers manual data refresh
  - Curl example: `curl -X POST http://127.0.0.1:8787/api/admin/refresh`
  - npm script: `npm run adapter:refresh`

**Outgoing:**
- None detected - No outbound webhooks

## Data Flow

**Game Data Sources (Priority Order):**

1. **CSV/JSON Import (User Upload)**
   - Client-side parsing via `parseUploadedGamesReport()`
   - Formats: CSV (auto-detect ; or ,) or JSON array
   - Storage: In-memory during session
   - Client location: `src/services/dataProvider.js`

2. **Live Adapter Service**
   - Remote fetch via `fetchGamesAdapter()`
   - Endpoint: Configurable, default `http://127.0.0.1:8787/api/games`
   - Optional Bearer token authentication
   - Adapter service: `adapter-service/server.mjs`
   - Client location: `src/services/dataProvider.js`

3. **Mock/Demo Mode**
   - Fallback generator via `buildMockSchedule()`
   - Deterministic random data based on teams and dates
   - No external calls
   - Client location: `src/services/dataProvider.js`

**Scouting Plan Generation:**

1. User selects teams, dates, and leagues via UI
2. Frontend calls LLM endpoint via `callLLM()` in `src/services/llm.js`
3. Supports both Ollama native and OpenAI-compatible APIs
4. Response parsed and displayed in plan view
5. Client location: `src/services/llm.js`

---

*Integration audit: 2026-04-02*
