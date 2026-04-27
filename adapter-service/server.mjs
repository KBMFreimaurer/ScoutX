import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { dedupeGames, filterGames, isLikelyTeamMatch, normalizeGames } from "./lib/games.js";
import { extractClubSearchResults } from "./lib/fussballde.js";
import { readStore, refreshStore, writeStore } from "./lib/loader.js";
import { fetchWeekTemplateGames, runExportCommand } from "./lib/dynamicSources.js";
import { buildWeekCacheKey, getWeekRange, isDateInRange, shouldRefreshWeek } from "./lib/week.js";

const HOST = process.env.ADAPTER_HOST || "0.0.0.0";
const PORT = Number(process.env.ADAPTER_PORT || 8787);
const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || "*";
const AUTH_TOKEN = String(process.env.ADAPTER_TOKEN || "").trim();
const MAX_BODY_BYTES = (() => {
  const configured = Number(process.env.ADAPTER_MAX_BODY_BYTES || 1024 * 1024);
  if (!Number.isFinite(configured) || configured <= 0) {
    return 1024 * 1024;
  }
  return Math.min(configured, 1024 * 1024);
})();
const MAX_TOKEN_BYTES = (() => {
  const configured = Number(process.env.ADAPTER_MAX_TOKEN_BYTES || 4096);
  if (!Number.isFinite(configured) || configured <= 0) {
    return 4096;
  }
  return Math.min(configured, 64 * 1024);
})();

const SAMPLE_FILE =
  process.env.ADAPTER_DATA_FILE || fileURLToPath(new URL("./data/games.sample.json", import.meta.url));
const STORE_FILE =
  process.env.ADAPTER_STORE_FILE || fileURLToPath(new URL("./data/games.store.json", import.meta.url));
const CLUB_CATALOG_FILE =
  process.env.ADAPTER_CLUB_CATALOG_FILE || fileURLToPath(new URL("./data/clubs.catalog.json", import.meta.url));
const CLUB_LOGOS_DIR =
  process.env.ADAPTER_CLUB_LOGOS_DIR || fileURLToPath(new URL("./data/logos", import.meta.url));
const IMPORT_DIR =
  process.env.ADAPTER_IMPORT_DIR || fileURLToPath(new URL("./imports", import.meta.url));
const ALIASES_FILE =
  process.env.ADAPTER_ALIASES_FILE || fileURLToPath(new URL("./data/team-aliases.json", import.meta.url));
const REMOTE_URL = process.env.ADAPTER_REMOTE_URL || "";
const REMOTE_TOKEN = process.env.ADAPTER_REMOTE_TOKEN || "";
const REMOTE_TIMEOUT_MS = Number(process.env.ADAPTER_REMOTE_TIMEOUT_MS || 10000);
const REFRESH_INTERVAL_SEC = Number(process.env.ADAPTER_REFRESH_INTERVAL_SEC || 0);

// Fully automatic week refresh for every scouting request
const AUTO_REFRESH_WEEK = process.env.ADAPTER_AUTO_REFRESH_WEEK !== "false";
const WEEK_REFRESH_TTL_SEC = Number(process.env.ADAPTER_WEEK_REFRESH_TTL_SEC || 300);
const WEEK_SOURCE_TEMPLATE = process.env.ADAPTER_WEEK_SOURCE_URL_TEMPLATE || "";
const WEEK_SOURCE_TOKEN = process.env.ADAPTER_WEEK_SOURCE_TOKEN || "";
const DEFAULT_EXPORT_SCRIPT = fileURLToPath(new URL("./scripts/fetch-week.fussballde.mjs", import.meta.url));
const EXPORT_COMMAND =
  process.env.ADAPTER_EXPORT_COMMAND !== undefined ? process.env.ADAPTER_EXPORT_COMMAND : `node "${DEFAULT_EXPORT_SCRIPT}"`;
const WEEK_COMMAND_TIMEOUT_MS = Number(process.env.ADAPTER_WEEK_COMMAND_TIMEOUT_MS || 60000);
const WEEK_EXTERNAL_TIMEOUT_MS = 60000;

const RATE_LIMIT_WINDOW_MS = Number(process.env.ADAPTER_RATE_LIMIT_WINDOW_MS || 60000);
const RATE_LIMIT_MAX = Number(process.env.ADAPTER_RATE_LIMIT_MAX || 60);
const CLUB_SEARCH_URL = process.env.ADAPTER_CLUB_SEARCH_URL || "https://www.fussball.de/suche";
const CLUB_SEARCH_TIMEOUT_MS = Number(process.env.ADAPTER_CLUB_SEARCH_TIMEOUT_MS || 12000);
const CLUB_SEARCH_MAX_LIMIT = Number(process.env.ADAPTER_CLUB_SEARCH_MAX_LIMIT || 20);
const MANDANT_PROBE_BASE_URL = process.env.FUSSBALLDE_BASE_URL || "https://www.fussball.de";
const MANDANT_PROBE_TIMEOUT_MS = Number(process.env.ADAPTER_MANDANT_PROBE_TIMEOUT_MS || 15000);
const LOGO_CONTENT_TYPES = Object.freeze({
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
});

const rateLimitStore = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  let entry = rateLimitStore.get(ip);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    entry = { windowStart: now, count: 1 };
    rateLimitStore.set(ip, entry);
    return true;
  }

  entry.count += 1;
  return entry.count <= RATE_LIMIT_MAX;
}

// Cleanup stale rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitStore) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
      rateLimitStore.delete(ip);
    }
  }
}, 300000);

const state = {
  games: [],
  clubs: [],
  meta: null,
  aliasMap: {},
  lastRefreshReason: "startup",
  lastError: null,
  weekRefreshCache: {},
  weekRefreshPromises: {},
};

function uniqueNormalizedTeams(values) {
  const seen = new Set();
  const teams = [];

  for (const value of Array.isArray(values) ? values : []) {
    const team = String(value || "").trim();
    if (!team) {
      continue;
    }

    const key = team.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    teams.push(team);
  }

  return teams;
}

function splitTeamValidation(teams, games) {
  const matchedTeams = [];
  const missingTeams = [];

  for (const team of teams) {
    const found = games.some((game) => isLikelyTeamMatch(team, game.home) || isLikelyTeamMatch(team, game.away));
    if (found) {
      matchedTeams.push(team);
    } else {
      missingTeams.push(team);
    }
  }

  return {
    matchedTeams,
    missingTeams,
  };
}

function clampLimit(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function normalizeSearchQuery(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function toLookupKey(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeLogoLocalFileName(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }

  const normalized = text
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/^\.\/+/, "");
  const segments = normalized.split("/").filter(Boolean);
  const fileName = segments[segments.length - 1] || "";
  if (!fileName || fileName === "." || fileName === ".." || fileName.includes("..")) {
    return "";
  }
  return fileName;
}

function normalizeKreisIds(value) {
  const source = Array.isArray(value) ? value : String(value || "").split(/[;,|]/);
  const unique = new Set();

  for (const entry of source) {
    const normalized = String(entry || "").trim().toLowerCase();
    if (normalized) {
      unique.add(normalized);
    }
  }

  return [...unique];
}

function normalizeClubEntry(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const name = String(raw.name || "").trim();
  if (!name) {
    return null;
  }

  const logoUrl = String(raw.logoUrl || raw.logo || "").trim();
  const logoLocal = normalizeLogoLocalFileName(raw.logoLocal || raw.localLogo || raw.logoPath || "");
  const link = String(raw.link || "").trim();
  const location = String(raw.location || "").trim();
  const kreisIds = normalizeKreisIds(raw.kreisIds || raw.kreis || raw.kreise || []);

  return {
    name,
    location,
    logoUrl: logoUrl.startsWith("//") ? `https:${logoUrl}` : logoUrl,
    logoLocal,
    link,
    kreisIds,
  };
}

function dedupeClubEntries(items) {
  const merged = new Map();

  for (const item of Array.isArray(items) ? items : []) {
    const normalized = normalizeClubEntry(item);
    if (!normalized) {
      continue;
    }

    const key = toLookupKey(normalized.name);
    if (!key) {
      continue;
    }

    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, normalized);
      continue;
    }

    merged.set(key, {
      ...existing,
      location: existing.location || normalized.location,
      logoUrl: existing.logoUrl || normalized.logoUrl,
      logoLocal: existing.logoLocal || normalized.logoLocal,
      link: existing.link || normalized.link,
      kreisIds: normalizeKreisIds([...(existing.kreisIds || []), ...(normalized.kreisIds || [])]),
    });
  }

  return [...merged.values()];
}

function scoreClubMatch(name, queryKey) {
  const key = toLookupKey(name);
  if (!key || !queryKey || !key.includes(queryKey)) {
    return -1;
  }

  if (key === queryKey) {
    return 4;
  }
  if (key.startsWith(queryKey)) {
    return 3;
  }
  if (key.split(" ").some((token) => token.startsWith(queryKey))) {
    return 2;
  }
  return 1;
}

function searchLocalClubCatalog(catalog, query, limit) {
  const queryKey = toLookupKey(query);
  if (!queryKey) {
    return [];
  }

  const scored = [];
  for (const item of Array.isArray(catalog) ? catalog : []) {
    const score = scoreClubMatch(item?.name, queryKey);
    if (score < 0) {
      continue;
    }
    scored.push({ score, item });
  }

  scored.sort((left, right) => {
    if (left.score !== right.score) {
      return right.score - left.score;
    }
    return String(left.item?.name || "").localeCompare(String(right.item?.name || ""), "de-DE");
  });

  return scored.slice(0, limit).map((entry) => entry.item);
}

function mergeClubResults(primary, fallback, limit) {
  const merged = dedupeClubEntries([...(Array.isArray(primary) ? primary : []), ...(Array.isArray(fallback) ? fallback : [])]);
  return merged.slice(0, Math.max(1, Number(limit) || 8));
}

function getRequestBaseUrl(req) {
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  const forwardedHost = String(req.headers["x-forwarded-host"] || "")
    .split(",")[0]
    .trim();
  const host = forwardedHost || String(req.headers.host || "localhost");
  const proto = forwardedProto === "https" ? "https" : "http";
  return `${proto}://${host}`;
}

function buildLocalLogoUrl(req, logoLocal) {
  const fileName = normalizeLogoLocalFileName(logoLocal);
  if (!fileName) {
    return "";
  }

  const relativePath = `/api/clubs/logo/${encodeURIComponent(fileName)}`;
  try {
    return new URL(relativePath, getRequestBaseUrl(req)).toString();
  } catch {
    return relativePath;
  }
}

function toPublicClubEntry(req, item) {
  const normalized = normalizeClubEntry(item);
  if (!normalized) {
    return null;
  }

  const localLogoUrl = buildLocalLogoUrl(req, normalized.logoLocal);
  return {
    name: normalized.name,
    location: normalized.location,
    logoUrl: localLogoUrl || normalized.logoUrl,
    link: normalized.link,
  };
}

function toPublicClubEntries(req, items) {
  const response = [];
  for (const item of dedupeClubEntries(items)) {
    const entry = toPublicClubEntry(req, item);
    if (entry) {
      response.push(entry);
    }
  }
  return response;
}

function resolveLogoFilePath(fileName) {
  const safeFileName = normalizeLogoLocalFileName(fileName);
  if (!safeFileName) {
    return "";
  }

  const root = resolve(CLUB_LOGOS_DIR);
  const target = resolve(root, safeFileName);
  if (target !== root && !target.startsWith(`${root}${sep}`)) {
    return "";
  }
  return target;
}

function detectLogoContentType(filePath) {
  const extension = extname(String(filePath || "")).toLowerCase();
  return LOGO_CONTENT_TYPES[extension] || "application/octet-stream";
}

async function readClubCatalogFile(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    const clubs = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.clubs) ? parsed.clubs : [];
    return dedupeClubEntries(clubs);
  } catch {
    return [];
  }
}

async function writeClubCatalogFile(filePath, clubs) {
  const normalized = dedupeClubEntries(clubs);
  const payload = {
    updatedAt: new Date().toISOString(),
    count: normalized.length,
    withLogo: normalized.filter((item) => Boolean(item.logoLocal || item.logoUrl)).length,
    clubs: normalized,
  };

  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
  return normalized;
}

async function fetchTextWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "ScoutXAdapter/1.0 (+https://www.fussball.de)",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.text();
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`Timeout nach ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchRemoteClubSuggestions(query, limit) {
  const text = normalizeSearchQuery(query);
  if (text.length < 2) {
    return [];
  }

  const searchUrl = new URL(CLUB_SEARCH_URL);
  searchUrl.searchParams.set("text", text);
  searchUrl.searchParams.set("cat", "CLUB_AND_TEAM");

  const html = await fetchTextWithTimeout(searchUrl.toString(), CLUB_SEARCH_TIMEOUT_MS);
  return dedupeClubEntries(extractClubSearchResults(html, limit));
}

let refreshPromise = null;

function setCorsHeaders(res, origin) {
  const allowedOrigins = String(ALLOWED_ORIGIN || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const normalizedOrigin = String(origin || "").trim();

  let allowOrigin = "*";
  if (!(allowedOrigins.length === 1 && allowedOrigins[0] === "*")) {
    const fallbackOrigin = allowedOrigins[0] || "null";
    allowOrigin =
      normalizedOrigin && allowedOrigins.includes(normalizedOrigin)
        ? normalizedOrigin
        : fallbackOrigin;
  }

  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Vary", "Origin");
}

function extractBearerToken(authorizationHeader) {
  const header = String(authorizationHeader || "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function timingSafeTokenEquals(left, right) {
  const leftBuf = Buffer.from(String(left || ""), "utf8");
  const rightBuf = Buffer.from(String(right || ""), "utf8");
  const maxLen = Math.max(leftBuf.length, rightBuf.length);

  if (maxLen > MAX_TOKEN_BYTES) {
    return false;
  }

  const paddedLeft = Buffer.alloc(maxLen);
  const paddedRight = Buffer.alloc(maxLen);
  leftBuf.copy(paddedLeft);
  rightBuf.copy(paddedRight);

  const equal = timingSafeEqual(paddedLeft, paddedRight);
  return equal && leftBuf.length === rightBuf.length;
}

function sendJson(res, statusCode, payload, origin) {
  setCorsHeaders(res, origin);
  const text = JSON.stringify(payload);
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(text);
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;

    req.on("data", (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > MAX_BODY_BYTES) {
        reject(new Error(`Payload zu groß (max ${MAX_BODY_BYTES} Bytes).`));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      try {
        const text = Buffer.concat(chunks).toString("utf8");
        resolve(text ? JSON.parse(text) : {});
      } catch {
        reject(new Error("Ungültiges JSON im Request-Body."));
      }
    });

    req.on("error", reject);
  });
}

function isAuthorized(req) {
  if (!AUTH_TOKEN) {
    return true;
  }

  const providedToken = extractBearerToken(req.headers.authorization || "");
  return timingSafeTokenEquals(providedToken, AUTH_TOKEN);
}

async function writeStoreSafely(reason, payload) {
  try {
    await writeStore(STORE_FILE, payload);
    return true;
  } catch (error) {
    console.error(`[adapter] ${reason} writeStore failed: ${error.message || error}`);
    state.lastError = `Store-Write fehlgeschlagen (${reason}). Vorheriger Stand bleibt aktiv.`;
    return false;
  }
}

async function refreshData(reason = "manual") {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const result = await refreshStore({
        aliasesFile: ALIASES_FILE,
        importDir: IMPORT_DIR,
        sampleFile: SAMPLE_FILE,
        storeFile: STORE_FILE,
        remoteUrl: REMOTE_URL,
        remoteToken: REMOTE_TOKEN,
        remoteTimeoutMs: REMOTE_TIMEOUT_MS,
      });

      state.games = result.games;
      state.meta = result.meta;
      state.aliasMap = result.aliasMap;
      state.lastRefreshReason = reason;
      state.lastError = null;

      return result;
    } catch (error) {
      state.lastError = error.message || "Refresh fehlgeschlagen.";

      const fallbackStore = await readStore(STORE_FILE);
      if (fallbackStore.games.length > 0) {
        state.games = fallbackStore.games;
        state.meta = fallbackStore.meta;
      }

      throw error;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

function filterGamesToWeek(games, range) {
  return games.filter((game) => isDateInRange(game.date, range));
}

function shouldKeepExistingGameForWeek(game, params, weekRange) {
  if (!isDateInRange(game.date, weekRange)) {
    return true;
  }

  if (params.kreisId && game.kreisId && game.kreisId !== params.kreisId) {
    return true;
  }

  if (params.jugendId && game.jugendId && game.jugendId !== params.jugendId) {
    return true;
  }

  return false;
}

async function maybeAutoRefreshWeek(payload) {
  const hasDynamicSource = Boolean(EXPORT_COMMAND || WEEK_SOURCE_TEMPLATE);
  if (!AUTO_REFRESH_WEEK || !hasDynamicSource) {
    return { ran: false, reason: "disabled_or_not_configured" };
  }

  const weekRange = getWeekRange(payload.fromDate);
  if (!weekRange) {
    return { ran: false, reason: "invalid_from_date" };
  }

  const now = Date.now();
  const cacheKey = buildWeekCacheKey(payload, weekRange);
  const lastRefreshMs = state.weekRefreshCache[cacheKey] || 0;

  if (!shouldRefreshWeek(lastRefreshMs, now, WEEK_REFRESH_TTL_SEC)) {
    return { ran: false, reason: "cached", cacheKey, weekRange };
  }

  const pending = state.weekRefreshPromises[cacheKey];
  if (pending) {
    return pending;
  }

  const refreshPromise = (async () => {
    const externalTimeoutMs = Math.min(WEEK_EXTERNAL_TIMEOUT_MS, Math.max(1000, WEEK_COMMAND_TIMEOUT_MS));
    const params = {
      fromDate: weekRange.fromDate,
      toDate: weekRange.toDate,
      kreisId: payload.kreisId || "",
      stateCode: payload.stateCode || "",
      regionName: payload.regionName || "",
      regionShortCode: payload.regionShortCode || "",
      fussballDeMapping: payload.fussballDeMapping || null,
      jugendId: payload.jugendId || "",
      teams: Array.isArray(payload.teams) ? payload.teams : [],
    };

    const warnings = [];
    const collected = [];

    if (EXPORT_COMMAND) {
      try {
        const cmd = await runExportCommand({
          command: EXPORT_COMMAND,
          timeoutMs: externalTimeoutMs,
          params,
          importDir: IMPORT_DIR,
        });

        if (cmd.warnings?.length) {
          warnings.push(...cmd.warnings);
        }

        const normalized = normalizeGames(cmd.games, {
          aliasMap: state.aliasMap,
          source: cmd.source,
        });
        collected.push(...filterGamesToWeek(normalized, weekRange));
      } catch (error) {
        warnings.push(`Export command failed: ${error.message || error}`);
      }
    }

    if (WEEK_SOURCE_TEMPLATE) {
      try {
        const remote = await fetchWeekTemplateGames({
          template: WEEK_SOURCE_TEMPLATE,
          token: WEEK_SOURCE_TOKEN,
          params,
          timeoutMs: externalTimeoutMs,
        });

        if (remote.warnings?.length) {
          warnings.push(...remote.warnings);
        }

        const normalized = normalizeGames(remote.games, {
          aliasMap: state.aliasMap,
          source: remote.source,
        });
        collected.push(...filterGamesToWeek(normalized, weekRange));
      } catch (error) {
        warnings.push(`Week source failed: ${error.message || error}`);
      }
    }

    // Reload import/remote baseline after command execution
    const refreshed = await refreshData("auto-week-base");

    const replaceBaseline =
      collected.length > 0
        ? refreshed.games.filter((game) => shouldKeepExistingGameForWeek(game, params, weekRange))
        : refreshed.games;

    const replaced = refreshed.games.length - replaceBaseline.length;
    const merged = dedupeGames([...replaceBaseline, ...collected]);
    const added = merged.length - refreshed.games.length;

    const weekMeta = {
      week: weekRange,
      cacheKey,
      refreshedAt: new Date().toISOString(),
      added,
      replaced,
      collected: collected.length,
      warnings,
    };

    const nextMeta = {
      ...(state.meta || {}),
      updatedAt: new Date().toISOString(),
      counts: {
        ...(state.meta?.counts || {}),
        total: merged.length,
      },
      weekRefresh: weekMeta,
    };

    const persisted = await writeStoreSafely("auto-week", { games: merged, meta: nextMeta });
    if (!persisted) {
      return {
        ran: false,
        reason: "store_write_failed",
        weekRange,
        cacheKey,
        added: 0,
        replaced: 0,
        collected: collected.length,
        warnings: [...warnings, "Store konnte nicht geschrieben werden."],
      };
    }

    state.games = merged;
    state.meta = nextMeta;
    state.lastRefreshReason = "auto-week";
    state.lastError = warnings.length ? warnings.join(" | ") : null;
    state.weekRefreshCache[cacheKey] = now;

    return {
      ran: true,
      reason: "refreshed",
      weekRange,
      cacheKey,
      added,
      replaced,
      collected: collected.length,
      warnings,
    };
  })();

  state.weekRefreshPromises[cacheKey] = refreshPromise;

  try {
    return await refreshPromise;
  } finally {
    delete state.weekRefreshPromises[cacheKey];
  }
}

function getHealthPayload() {
  return {
    ok: true,
    service: "scoutplan-adapter",
    timestamp: new Date().toISOString(),
    count: state.games.length,
    clubsCount: state.clubs.length,
    lastRefreshReason: state.lastRefreshReason,
    lastError: state.lastError,
    remoteConfigured: Boolean(REMOTE_URL),
    authEnabled: Boolean(AUTH_TOKEN),
    refreshIntervalSec: REFRESH_INTERVAL_SEC,
    autoRefreshWeek: AUTO_REFRESH_WEEK,
    weekSourceConfigured: Boolean(WEEK_SOURCE_TEMPLATE || EXPORT_COMMAND),
    meta: state.meta,
  };
}

function buildAdminMeta() {
  return {
    count: state.games.length,
    clubsCount: state.clubs.length,
    lastRefreshReason: state.lastRefreshReason,
    lastError: state.lastError,
    meta: state.meta,
  };
}

function normalizeUnderscoreKeyMap(raw) {
  const out = {};
  for (const [key, value] of Object.entries(raw || {})) {
    out[String(key || "").replace(/^_/, "")] = value;
  }
  return out;
}

async function fetchMandantProbe({ mandant, season = "", competitionType = "1" }) {
  const normalizedMandant = String(mandant || "").trim();
  if (!/^\d{1,3}$/.test(normalizedMandant)) {
    throw new Error("Ungültiger Mandant. Erwartet wird eine numerische Kennzahl.");
  }

  const baseUrl = String(MANDANT_PROBE_BASE_URL || "").replace(/\/+$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MANDANT_PROBE_TIMEOUT_MS);

  try {
    const baseResponse = await fetch(`${baseUrl}/wam_base.json`, { signal: controller.signal });
    if (!baseResponse.ok) {
      throw new Error(`wam_base HTTP ${baseResponse.status}`);
    }
    const basePayload = await baseResponse.json();
    const effectiveSeason = String(season || basePayload?.currentSaison || "").trim();
    const effectiveCompetitionType = String(competitionType || basePayload?.defaultCompetitionType || "1").trim() || "1";

    if (!effectiveSeason) {
      throw new Error("Keine Saison verfügbar (wam_base.currentSaison leer).");
    }

    const kindsUrl = `${baseUrl}/wam_kinds_${normalizedMandant}_${effectiveSeason}_${effectiveCompetitionType}.json`;
    const kindsResponse = await fetch(kindsUrl, { signal: controller.signal });
    if (!kindsResponse.ok) {
      throw new Error(`wam_kinds HTTP ${kindsResponse.status}`);
    }
    const kindsPayload = await kindsResponse.json();

    const teamTypes = normalizeUnderscoreKeyMap(kindsPayload?.Mannschaftsart || {});
    const spielklasseByType = normalizeUnderscoreKeyMap(kindsPayload?.Spielklasse || {});
    const leagueIds = new Set();

    for (const byLeague of Object.values(spielklasseByType)) {
      const normalized = normalizeUnderscoreKeyMap(byLeague || {});
      for (const leagueId of Object.keys(normalized)) {
        leagueIds.add(leagueId);
      }
    }

    return {
      ok: true,
      mandant: normalizedMandant,
      season: effectiveSeason,
      competitionType: effectiveCompetitionType,
      teamTypeCount: Object.keys(teamTypes).length,
      leagueCount: leagueIds.size,
      teamTypes,
      kindsUrl,
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`Mandant-Probe Timeout nach ${MANDANT_PROBE_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

const server = createServer(async (req, res) => {
  const origin = req.headers.origin || "";
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const clientIp = req.headers["x-real-ip"] || req.socket.remoteAddress || "unknown";

  if (req.method === "OPTIONS") {
    setCorsHeaders(res, origin);
    res.writeHead(204);
    res.end();
    return;
  }

  if (url.pathname !== "/health" && !checkRateLimit(clientIp)) {
    sendJson(res, 429, { ok: false, error: "Zu viele Anfragen. Bitte später erneut versuchen." }, origin);
    return;
  }

  if (req.method === "GET" && url.pathname === "/health") {
    sendJson(res, 200, getHealthPayload(), origin);
    return;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/clubs/logo/")) {
    const encodedName = url.pathname.slice("/api/clubs/logo/".length);
    let decodedName = "";
    try {
      decodedName = decodeURIComponent(encodedName);
    } catch {
      decodedName = "";
    }

    const logoPath = resolveLogoFilePath(decodedName);
    if (!logoPath) {
      setCorsHeaders(res, origin);
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Logo not found");
      return;
    }

    try {
      const logoBuffer = await readFile(logoPath);
      setCorsHeaders(res, origin);
      res.writeHead(200, {
        "Content-Type": detectLogoContentType(logoPath),
        "Cache-Control": "public, max-age=86400",
      });
      res.end(logoBuffer);
    } catch {
      setCorsHeaders(res, origin);
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Logo not found");
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/games") {
    if (!isAuthorized(req)) {
      sendJson(res, 401, { ok: false, error: "Unauthorized" }, origin);
      return;
    }

    try {
      const payload = await readBody(req);
      const autoRefresh = await maybeAutoRefreshWeek(payload);
      const requestedTeams = uniqueNormalizedTeams(payload.teams);
      const requestedTeamCount = requestedTeams.length;
      const gamesWithTeamFilter =
        requestedTeamCount > 0 ? filterGames(state.games, payload, { aliasMap: state.aliasMap }) : [];
      const games = filterGames(
        state.games,
        {
          ...payload,
          teams: [],
        },
        { aliasMap: state.aliasMap },
      );
      const teamFilterFallback = requestedTeamCount > 0 && games.length > gamesWithTeamFilter.length;
      const { matchedTeams, missingTeams } = splitTeamValidation(requestedTeams, games);

      sendJson(
        res,
        200,
        {
          ok: true,
          source: "adapter-store",
          count: games.length,
          autoRefresh,
          teamFilter: {
            requested: requestedTeamCount > 0,
            requestedCount: requestedTeamCount,
            matchedCount: gamesWithTeamFilter.length,
            matchedTeamCount: matchedTeams.length,
            matchedTeams,
            missingTeams,
            binding: false,
            fallbackToUnfiltered: teamFilterFallback,
          },
          games,
        },
        origin,
      );
    } catch (error) {
      console.error("[adapter] /api/games error:", error.message || error);
      sendJson(res, 400, { ok: false, error: "Ungültige Anfrage." }, origin);
    }

    return;
  }

  if (req.method === "GET" && url.pathname === "/api/clubs/search") {
    if (!isAuthorized(req)) {
      sendJson(res, 401, { ok: false, error: "Unauthorized" }, origin);
      return;
    }

    const query = normalizeSearchQuery(url.searchParams.get("q"));
    const limit = clampLimit(url.searchParams.get("limit"), 1, Math.max(1, CLUB_SEARCH_MAX_LIMIT), 8);

    if (query.length < 2) {
      sendJson(res, 200, { ok: true, query, clubs: [] }, origin);
      return;
    }

    const localMatchesRaw = searchLocalClubCatalog(state.clubs, query, limit);
    const localMatches = toPublicClubEntries(req, localMatchesRaw);

    if (localMatches.length >= limit) {
      sendJson(res, 200, { ok: true, query, clubs: localMatches, source: "local-catalog" }, origin);
      return;
    }

    try {
      const remoteMatches = await fetchRemoteClubSuggestions(query, limit);
      const clubs = toPublicClubEntries(req, mergeClubResults(remoteMatches, localMatchesRaw, limit));
      sendJson(res, 200, { ok: true, query, clubs, source: "remote+local" }, origin);
    } catch (error) {
      console.error("[adapter] /api/clubs/search error:", error.message || error);
      sendJson(res, 200, { ok: true, query, clubs: localMatches, source: "local-catalog-fallback" }, origin);
    }

    return;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/refresh") {
    if (!isAuthorized(req)) {
      sendJson(res, 401, { ok: false, error: "Unauthorized" }, origin);
      return;
    }

    try {
      await refreshData("admin-refresh");
      sendJson(res, 200, { ok: true, ...buildAdminMeta() }, origin);
    } catch (error) {
      console.error("[adapter] /api/admin/refresh error:", error.message || error);
      sendJson(res, 500, { ok: false, error: "Refresh fehlgeschlagen." }, origin);
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/import") {
    if (!isAuthorized(req)) {
      sendJson(res, 401, { ok: false, error: "Unauthorized" }, origin);
      return;
    }

    try {
      const payload = await readBody(req);
      if (!Array.isArray(payload.games)) {
        throw new Error("`games` muss ein Array sein.");
      }

      const replace = Boolean(payload.replace);
      const importedGames = normalizeGames(payload.games, {
        aliasMap: state.aliasMap,
        source: "manual-import",
      });

      const merged = replace ? dedupeGames(importedGames) : dedupeGames([...state.games, ...importedGames]);

      const meta = {
        ...(state.meta || {}),
        updatedAt: new Date().toISOString(),
        counts: {
          ...(state.meta?.counts || {}),
          total: merged.length,
          manualImport: importedGames.length,
        },
        warnings: state.meta?.warnings || [],
      };

      const persisted = await writeStoreSafely("admin-import", { games: merged, meta });
      if (!persisted) {
        sendJson(res, 500, { ok: false, error: "Store konnte nicht geschrieben werden." }, origin);
        return;
      }
      state.games = merged;
      state.meta = meta;
      state.lastRefreshReason = replace ? "admin-import-replace" : "admin-import-merge";
      state.lastError = null;

      sendJson(res, 200, { ok: true, imported: importedGames.length, total: merged.length }, origin);
    } catch (error) {
      console.error("[adapter] /api/admin/import error:", error.message || error);
      sendJson(res, 400, { ok: false, error: "Import fehlgeschlagen." }, origin);
    }

    return;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/clubs/import") {
    if (!isAuthorized(req)) {
      sendJson(res, 401, { ok: false, error: "Unauthorized" }, origin);
      return;
    }

    try {
      const payload = await readBody(req);
      if (!Array.isArray(payload.clubs)) {
        throw new Error("`clubs` muss ein Array sein.");
      }

      const replace = Boolean(payload.replace);
      const importedClubs = dedupeClubEntries(payload.clubs);
      const merged = replace ? importedClubs : dedupeClubEntries([...state.clubs, ...importedClubs]);
      const persisted = await writeClubCatalogFile(CLUB_CATALOG_FILE, merged);

      state.clubs = persisted;

      sendJson(
        res,
        200,
        {
          ok: true,
          imported: importedClubs.length,
          total: persisted.length,
          replace,
        },
        origin,
      );
    } catch (error) {
      console.error("[adapter] /api/admin/clubs/import error:", error.message || error);
      sendJson(res, 400, { ok: false, error: "Vereinskatalog-Import fehlgeschlagen." }, origin);
    }

    return;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/status") {
    if (!isAuthorized(req)) {
      sendJson(res, 401, { ok: false, error: "Unauthorized" }, origin);
      return;
    }

    sendJson(res, 200, { ok: true, ...buildAdminMeta() }, origin);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/mandant-probe") {
    if (!isAuthorized(req)) {
      sendJson(res, 401, { ok: false, error: "Unauthorized" }, origin);
      return;
    }

    try {
      const mandant = String(url.searchParams.get("mandant") || "").trim();
      const season = String(url.searchParams.get("season") || "").trim();
      const competitionType = String(url.searchParams.get("competitionType") || "").trim();
      const probe = await fetchMandantProbe({ mandant, season, competitionType });
      sendJson(res, 200, probe, origin);
    } catch (error) {
      console.error("[adapter] /api/admin/mandant-probe error:", error.message || error);
      sendJson(res, 400, { ok: false, error: String(error?.message || "Mandant-Probe fehlgeschlagen.") }, origin);
    }
    return;
  }

  sendJson(res, 404, { ok: false, error: "Not Found" }, origin);
});

try {
  state.clubs = await readClubCatalogFile(CLUB_CATALOG_FILE);
} catch {
  state.clubs = [];
}

try {
  await refreshData("startup");
} catch (error) {
  console.error(`[adapter] initial refresh failed: ${error.message || error}`);
}

if (REFRESH_INTERVAL_SEC > 0) {
  setInterval(() => {
    refreshData("interval").catch((error) => {
      console.error(`[adapter] interval refresh failed: ${error.message || error}`);
    });
  }, REFRESH_INTERVAL_SEC * 1000);
}

server.listen(PORT, HOST, () => {
  const tokenInfo = AUTH_TOKEN ? "enabled" : "disabled";
  console.log(`[adapter] running on http://${HOST}:${PORT} (auth: ${tokenInfo})`);
  console.log(`[adapter] store: ${STORE_FILE}`);
  console.log(`[adapter] club-catalog: ${CLUB_CATALOG_FILE} (${state.clubs.length})`);
  console.log(`[adapter] club-logos: ${CLUB_LOGOS_DIR}`);
  console.log(`[adapter] imports: ${IMPORT_DIR}`);
  console.log(`[adapter] remote: ${REMOTE_URL || "disabled"}`);
  if (REMOTE_URL) {
    console.log(`[adapter] remote-timeout-ms: ${REMOTE_TIMEOUT_MS}`);
  }
  console.log(`[adapter] auto-week: ${AUTO_REFRESH_WEEK ? "enabled" : "disabled"}`);
  console.log(`[adapter] week-source-template: ${WEEK_SOURCE_TEMPLATE ? "configured" : "disabled"}`);
  console.log(`[adapter] export-command: ${EXPORT_COMMAND ? "configured" : "disabled"}`);
  if (REFRESH_INTERVAL_SEC > 0) {
    console.log(`[adapter] auto-refresh every ${REFRESH_INTERVAL_SEC}s`);
  }
});
