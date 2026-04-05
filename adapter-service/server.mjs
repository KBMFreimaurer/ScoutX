import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dedupeGames, filterGames, normalizeGames } from "./lib/games.js";
import { readStore, refreshStore, writeStore } from "./lib/loader.js";
import { fetchWeekTemplateGames, runExportCommand } from "./lib/dynamicSources.js";
import { buildWeekCacheKey, getWeekRange, isDateInRange, shouldRefreshWeek } from "./lib/week.js";

const HOST = process.env.ADAPTER_HOST || "0.0.0.0";
const PORT = Number(process.env.ADAPTER_PORT || 8787);
const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || "*";
const AUTH_TOKEN = process.env.ADAPTER_TOKEN || "";
const MAX_BODY_BYTES = Number(process.env.ADAPTER_MAX_BODY_BYTES || 1024 * 1024);

const SAMPLE_FILE =
  process.env.ADAPTER_DATA_FILE || fileURLToPath(new URL("./data/games.sample.json", import.meta.url));
const STORE_FILE =
  process.env.ADAPTER_STORE_FILE || fileURLToPath(new URL("./data/games.store.json", import.meta.url));
const IMPORT_DIR =
  process.env.ADAPTER_IMPORT_DIR || fileURLToPath(new URL("./imports", import.meta.url));
const ALIASES_FILE =
  process.env.ADAPTER_ALIASES_FILE || fileURLToPath(new URL("./data/team-aliases.json", import.meta.url));
const REMOTE_URL = process.env.ADAPTER_REMOTE_URL || "";
const REMOTE_TOKEN = process.env.ADAPTER_REMOTE_TOKEN || "";
const REFRESH_INTERVAL_SEC = Number(process.env.ADAPTER_REFRESH_INTERVAL_SEC || 0);

// Fully automatic week refresh for every scouting request
const AUTO_REFRESH_WEEK = process.env.ADAPTER_AUTO_REFRESH_WEEK !== "false";
const WEEK_REFRESH_TTL_SEC = Number(process.env.ADAPTER_WEEK_REFRESH_TTL_SEC || 300);
const WEEK_SOURCE_TEMPLATE = process.env.ADAPTER_WEEK_SOURCE_URL_TEMPLATE || "";
const WEEK_SOURCE_TOKEN = process.env.ADAPTER_WEEK_SOURCE_TOKEN || "";
const DEFAULT_EXPORT_SCRIPT = fileURLToPath(new URL("./scripts/fetch-week.fussballde.mjs", import.meta.url));
const EXPORT_COMMAND =
  process.env.ADAPTER_EXPORT_COMMAND !== undefined ? process.env.ADAPTER_EXPORT_COMMAND : `node "${DEFAULT_EXPORT_SCRIPT}"`;
const WEEK_COMMAND_TIMEOUT_MS = Number(process.env.ADAPTER_WEEK_COMMAND_TIMEOUT_MS || 30000);

const state = {
  games: [],
  meta: null,
  aliasMap: {},
  lastRefreshReason: "startup",
  lastError: null,
  weekRefreshCache: {},
  weekRefreshPromises: {},
};

let refreshPromise = null;

function setCorsHeaders(res, origin) {
  const allowOrigin = ALLOWED_ORIGIN === "*" ? "*" : origin || ALLOWED_ORIGIN;
  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Vary", "Origin");
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

  const authHeader = req.headers.authorization || "";
  return authHeader === `Bearer ${AUTH_TOKEN}`;
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
    const params = {
      fromDate: weekRange.fromDate,
      toDate: weekRange.toDate,
      kreisId: payload.kreisId || "",
      jugendId: payload.jugendId || "",
      teams: Array.isArray(payload.teams) ? payload.teams : [],
    };

    const warnings = [];
    const collected = [];

    if (EXPORT_COMMAND) {
      try {
        const cmd = await runExportCommand({
          command: EXPORT_COMMAND,
          timeoutMs: WEEK_COMMAND_TIMEOUT_MS,
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

    await writeStore(STORE_FILE, { games: merged, meta: nextMeta });

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
    lastRefreshReason: state.lastRefreshReason,
    lastError: state.lastError,
    storeFile: STORE_FILE,
    importDir: IMPORT_DIR,
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
    lastRefreshReason: state.lastRefreshReason,
    lastError: state.lastError,
    meta: state.meta,
  };
}

const server = createServer(async (req, res) => {
  const origin = req.headers.origin || "";
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (req.method === "OPTIONS") {
    setCorsHeaders(res, origin);
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "GET" && url.pathname === "/health") {
    sendJson(res, 200, getHealthPayload(), origin);
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
      const requestedTeamCount = Array.isArray(payload.teams) ? payload.teams.filter(Boolean).length : 0;
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
            binding: false,
            fallbackToUnfiltered: teamFilterFallback,
          },
          games,
        },
        origin,
      );
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message || "Unbekannter Fehler" }, origin);
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
      sendJson(res, 500, { ok: false, error: error.message || "Refresh fehlgeschlagen." }, origin);
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

      await writeStore(STORE_FILE, { games: merged, meta });
      state.games = merged;
      state.meta = meta;
      state.lastRefreshReason = replace ? "admin-import-replace" : "admin-import-merge";
      state.lastError = null;

      sendJson(res, 200, { ok: true, imported: importedGames.length, total: merged.length }, origin);
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message || "Import fehlgeschlagen." }, origin);
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

  sendJson(res, 404, { ok: false, error: "Not Found" }, origin);
});

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
  console.log(`[adapter] imports: ${IMPORT_DIR}`);
  console.log(`[adapter] remote: ${REMOTE_URL || "disabled"}`);
  console.log(`[adapter] auto-week: ${AUTO_REFRESH_WEEK ? "enabled" : "disabled"}`);
  console.log(`[adapter] week-source-template: ${WEEK_SOURCE_TEMPLATE ? "configured" : "disabled"}`);
  console.log(`[adapter] export-command: ${EXPORT_COMMAND ? "configured" : "disabled"}`);
  if (REFRESH_INTERVAL_SEC > 0) {
    console.log(`[adapter] auto-refresh every ${REFRESH_INTERVAL_SEC}s`);
  }
});
