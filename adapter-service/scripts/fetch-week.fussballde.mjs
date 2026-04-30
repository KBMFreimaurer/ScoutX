#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  KREIS_AREA_KEYWORDS,
  JUGEND_TO_TEAM_LABEL,
  JUGEND_TO_TEAM_TYPE,
  buildDateRange,
  extractCompetitionEntries,
  extractKickoffFromTeamPageHtml,
  extractMatchDetails,
  extractMatchesFromDatePage,
  extractStaffelId,
  formatIsoDate,
  getValueByFlexibleKey,
  normalizeLookup,
  parseIsoDate,
  pickAreaIdsForLeague,
  resolveFussballDeRegionParams,
  toAbsoluteFussballUrl,
  uniqueBy,
} from "../lib/fussballde.js";
import { isLikelyTeamMatch } from "../lib/games.js";

const BASE_URL = process.env.FUSSBALLDE_BASE_URL || "https://www.fussball.de";
const REQUEST_TIMEOUT_MS = Number(process.env.FUSSBALLDE_REQUEST_TIMEOUT_MS || 15000);
const PAGE_CONCURRENCY = Math.max(1, Number(process.env.FUSSBALLDE_PAGE_CONCURRENCY || 4));
const MATCH_CONCURRENCY = Math.max(1, Number(process.env.FUSSBALLDE_MATCH_CONCURRENCY || 6));
const MAX_COMPETITIONS = Math.max(1, Number(process.env.FUSSBALLDE_MAX_COMPETITIONS || 80));
const MAX_MATCHES = Math.max(1, Number(process.env.FUSSBALLDE_MAX_MATCHES || 600));
const FETCH_RETRY_DELAYS_MS = [1000, 2000, 4000];
const DEBUG = process.env.SCOUTPLAN_DEBUG_EXPORTER === "true";
const USER_AGENT_POOL = Object.freeze([
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:137.0) Gecko/20100101 Firefox/137.0",
  "ScoutXAdapter/1.0 (+https://www.fussball.de)",
]);
const CIRCUIT_THRESHOLD = Math.max(1, Number(process.env.FUSSBALLDE_CIRCUIT_THRESHOLD || 3));
const CIRCUIT_COOLDOWN_MS = Math.max(60000, Number(process.env.FUSSBALLDE_CIRCUIT_COOLDOWN_MS || 10 * 60 * 1000));
const ROBOTS_CHECK_ENABLED = process.env.FUSSBALLDE_ROBOTS_CHECK !== "false";
const ROBOTS_CACHE_TTL_MS = Math.max(60 * 60 * 1000, Number(process.env.FUSSBALLDE_ROBOTS_TTL_MS || 24 * 60 * 60 * 1000));
const DEFAULT_STATE_FILE = fileURLToPath(new URL("../data/fussballde.fetch-state.json", import.meta.url));
const STATE_FILE = process.env.FUSSBALLDE_STATE_FILE || DEFAULT_STATE_FILE;
const STRICT_REGION_MAPPING = process.env.SCOUTPLAN_STRICT_REGION_MAPPING !== "false";
const STRICT_RESULT_FILTER = process.env.SCOUTPLAN_STRICT_RESULT_FILTER !== "false";

const fromDate = process.env.SCOUTPLAN_FROM_DATE || formatIsoDate(new Date());
const toDate = process.env.SCOUTPLAN_TO_DATE || fromDate;
const kreisId = process.env.SCOUTPLAN_KREIS_ID || "";
const stateCode = process.env.SCOUTPLAN_STATE_CODE || "";
const regionName = process.env.SCOUTPLAN_REGION_NAME || "";
const regionShortCode = process.env.SCOUTPLAN_REGION_SHORT_CODE || "";
const fussballDeMapping = (() => {
  try {
    const parsed = JSON.parse(process.env.SCOUTPLAN_FUSSBALLDE_MAPPING_JSON || "null");
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
})();
const regionParams = resolveFussballDeRegionParams({
  kreisId,
  stateCode,
  regionName,
  regionShortCode,
  mapping: fussballDeMapping,
});
const MANDANT = (() => {
  validateRegionParams(regionParams);
  const normalizedMandant = normalizeMandant(regionParams.mandant);
  if (!normalizedMandant) {
    throw new Error(
      `Ungültiger fussball.de-Mandant für state=${regionParams.stateCode || "(none)"} region=${regionParams.regionName || kreisId || "(none)"}`,
    );
  }
  return normalizedMandant;
})();
const jugendId = process.env.SCOUTPLAN_JUGEND_ID || "";
const fallbackJugendTeamType = JUGEND_TO_TEAM_TYPE[jugendId];
const jugendTeamLabel = JUGEND_TO_TEAM_LABEL[jugendId] || "";
const selectedTeams = (() => {
  try {
    const parsed = JSON.parse(process.env.SCOUTPLAN_TEAMS_JSON || "[]");
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map((item) => String(item || "").trim()).filter(Boolean);
  } catch {
    return [];
  }
})();
const dynamicConcurrency = {
  page: PAGE_CONCURRENCY,
  match: MATCH_CONCURRENCY,
  recoveryCounter: 0,
};
let fetchStateCache = null;

function normalizeMandant(value) {
  const text = String(value || "").trim();
  return /^\d{1,3}$/.test(text) ? text : "";
}

function validateRegionParams(params) {
  if (!STRICT_REGION_MAPPING) {
    return;
  }

  const source = String(params?.source || "");
  const state = String(params?.stateCode || "").trim();
  const region = String(params?.regionName || params?.kreisId || "").trim();
  const mandant = normalizeMandant(params?.mandant);
  const areaKeywords = Array.isArray(params?.areaKeywords) ? params.areaKeywords.filter(Boolean) : [];

  if (!state) {
    throw new Error("Fehlender stateCode für fussball.de-Liveabfrage.");
  }

  if (!region) {
    throw new Error("Fehlender Region-/Kreisname für fussball.de-Liveabfrage.");
  }

  if (source !== "mapping") {
    throw new Error(`Kein fussball.de-Mapping für state=${state} region=${region}.`);
  }

  if (!mandant) {
    throw new Error(`Kein gültiger fussball.de-Mandant im Mapping für state=${state} region=${region}.`);
  }

  if (areaKeywords.length === 0) {
    throw new Error(`Keine Area-Keywords im Mapping für state=${state} region=${region}.`);
  }
}

function toIsoDate(date) {
  return formatIsoDate(date);
}

function nowIso() {
  return new Date().toISOString();
}

function log(message) {
  if (DEBUG) {
    console.error(`[fussballde-export] ${message}`);
  }
}

function warn(message) {
  console.error(`[fussballde-export][warn] ${message}`);
}

function pickUserAgent() {
  const idx = Math.floor(Math.random() * USER_AGENT_POOL.length);
  return USER_AGENT_POOL[idx] || USER_AGENT_POOL[USER_AGENT_POOL.length - 1];
}

function getMandantCircuitKey() {
  return String(MANDANT || "").trim() || "default";
}

async function readJsonFileSafe(filePath, fallback) {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJsonFileSafe(filePath, payload) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function loadFetchState() {
  if (fetchStateCache) {
    return fetchStateCache;
  }

  fetchStateCache = await readJsonFileSafe(STATE_FILE, {
    version: 1,
    updatedAt: "",
    robots: {
      checkedAt: 0,
      baseUrl: "",
      blockedPaths: [],
      status: "unknown",
      error: "",
    },
    circuit: {},
  });
  if (!fetchStateCache.circuit || typeof fetchStateCache.circuit !== "object") {
    fetchStateCache.circuit = {};
  }
  if (!fetchStateCache.robots || typeof fetchStateCache.robots !== "object") {
    fetchStateCache.robots = { checkedAt: 0, baseUrl: "", blockedPaths: [], status: "unknown", error: "" };
  }
  return fetchStateCache;
}

async function persistFetchState() {
  if (!fetchStateCache) {
    return;
  }
  fetchStateCache.updatedAt = nowIso();
  await writeJsonFileSafe(STATE_FILE, fetchStateCache);
}

function maybeRecoverConcurrency() {
  dynamicConcurrency.recoveryCounter += 1;
  if (dynamicConcurrency.recoveryCounter < 20) {
    return;
  }
  dynamicConcurrency.recoveryCounter = 0;
  if (dynamicConcurrency.page < PAGE_CONCURRENCY) {
    dynamicConcurrency.page += 1;
  }
  if (dynamicConcurrency.match < MATCH_CONCURRENCY) {
    dynamicConcurrency.match += 1;
  }
}

function applyRateLimitBackoff(status) {
  if (status !== 429) {
    return;
  }
  const previousPage = dynamicConcurrency.page;
  const previousMatch = dynamicConcurrency.match;
  dynamicConcurrency.page = Math.max(1, Math.floor(dynamicConcurrency.page / 2));
  dynamicConcurrency.match = Math.max(1, Math.floor(dynamicConcurrency.match / 2));
  dynamicConcurrency.recoveryCounter = 0;
  if (previousPage !== dynamicConcurrency.page || previousMatch !== dynamicConcurrency.match) {
    warn(
      `Rate limit detected (429). Reduced concurrency page=${previousPage}->${dynamicConcurrency.page}, match=${previousMatch}->${dynamicConcurrency.match}`,
    );
  }
}

async function ensureCircuitAllowsRequests() {
  const state = await loadFetchState();
  const key = getMandantCircuitKey();
  const entry = state.circuit[key];
  const blockedUntil = Number(entry?.blockedUntil || 0);
  if (blockedUntil > Date.now()) {
    const waitSeconds = Math.ceil((blockedUntil - Date.now()) / 1000);
    throw new Error(`Mandant ${key} circuit-open für ${waitSeconds}s nach wiederholten 403/429`);
  }
}

async function markCircuitSuccess() {
  const state = await loadFetchState();
  const key = getMandantCircuitKey();
  const entry = state.circuit[key];
  if (!entry || (!entry.consecutiveFailures && !entry.blockedUntil)) {
    maybeRecoverConcurrency();
    return;
  }

  state.circuit[key] = {
    ...entry,
    consecutiveFailures: 0,
    blockedUntil: 0,
    lastSuccessAt: nowIso(),
  };
  maybeRecoverConcurrency();
  await persistFetchState();
}

async function markCircuitFailure(status, reason) {
  if (status !== 403 && status !== 429) {
    return;
  }

  const state = await loadFetchState();
  const key = getMandantCircuitKey();
  const entry = state.circuit[key] || {
    consecutiveFailures: 0,
    blockedUntil: 0,
  };
  const nextFailures = Number(entry.consecutiveFailures || 0) + 1;
  const blocked = nextFailures >= CIRCUIT_THRESHOLD ? Date.now() + CIRCUIT_COOLDOWN_MS : 0;

  state.circuit[key] = {
    consecutiveFailures: nextFailures,
    blockedUntil: blocked,
    lastFailureAt: nowIso(),
    lastStatus: status,
    lastError: String(reason || ""),
  };

  await persistFetchState();

  if (blocked) {
    warn(`Circuit breaker opened for mandant=${key} (${nextFailures} consecutive ${status} errors).`);
  }
}

function parseRobotsDisallow(robotsText) {
  const rules = [];
  const lines = String(robotsText || "")
    .split(/\r?\n/)
    .map((line) => line.trim());
  let wildcardActive = false;

  for (const line of lines) {
    if (!line || line.startsWith("#")) {
      continue;
    }
    const [rawKey, ...rest] = line.split(":");
    const key = String(rawKey || "")
      .trim()
      .toLowerCase();
    const value = rest.join(":").trim();
    if (key === "user-agent") {
      wildcardActive = value === "*";
      continue;
    }
    if (wildcardActive && key === "disallow" && value) {
      rules.push(value);
    }
  }

  return rules;
}

function isDisallowed(pathname, disallowRules) {
  return disallowRules.some((rule) => pathname.startsWith(rule));
}

async function ensureRobotsAllowsAccess() {
  if (!ROBOTS_CHECK_ENABLED) {
    return;
  }

  const state = await loadFetchState();
  const robotsState = state.robots || {};
  const stillValid =
    String(robotsState.baseUrl || "") === BASE_URL &&
    Number(robotsState.checkedAt || 0) > 0 &&
    Date.now() - Number(robotsState.checkedAt || 0) < ROBOTS_CACHE_TTL_MS;

  if (stillValid && robotsState.status === "blocked") {
    throw new Error(`robots.txt blockiert Zugriff auf ${robotsState.blockedPaths?.join(", ") || "fussball.de endpoints"}`);
  }
  if (stillValid && robotsState.status === "ok") {
    return;
  }

  const { controller, clear } = createAbortController(Math.min(REQUEST_TIMEOUT_MS, 10000));
  try {
    const robotsUrl = `${BASE_URL}/robots.txt`;
    const response = await fetch(robotsUrl, {
      signal: controller.signal,
      headers: { "user-agent": pickUserAgent(), accept: "text/plain,*/*;q=0.8" },
    });

    if (!response.ok) {
      state.robots = {
        checkedAt: Date.now(),
        baseUrl: BASE_URL,
        blockedPaths: [],
        status: "unknown",
        error: `HTTP ${response.status}`,
      };
      await persistFetchState();
      warn(`robots.txt check unavailable: HTTP ${response.status}`);
      return;
    }

    const robotsText = await response.text();
    const disallowRules = parseRobotsDisallow(robotsText);
    const blockedPaths = ["/ajax.fixturelist/", "/wam_"].filter((path) => isDisallowed(path, disallowRules));
    const blocked = blockedPaths.length > 0;

    state.robots = {
      checkedAt: Date.now(),
      baseUrl: BASE_URL,
      blockedPaths,
      status: blocked ? "blocked" : "ok",
      error: "",
    };
    await persistFetchState();

    if (blocked) {
      throw new Error(`robots.txt blockiert Zugriff auf ${blockedPaths.join(", ")}`);
    }
  } catch (error) {
    if (error?.name === "AbortError") {
      warn("robots.txt check timed out; proceeding with scrape");
      return;
    }
    throw error;
  } finally {
    clear();
  }
}

function createAbortController(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    controller,
    clear: () => clearTimeout(timer),
  };
}

async function fetchText(url, { retries = FETCH_RETRY_DELAYS_MS.length } = {}) {
  await ensureCircuitAllowsRequests();
  let attempt = 0;

  while (attempt <= retries) {
    const { controller, clear } = createAbortController(REQUEST_TIMEOUT_MS);
    const userAgent = pickUserAgent();

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "user-agent": userAgent,
          accept: "text/html,application/json;q=0.9,*/*;q=0.8",
        },
      });

      if (!response.ok) {
        const httpError = new Error(`HTTP ${response.status}`);
        httpError.httpStatus = response.status;
        throw httpError;
      }

      const text = await response.text();
      await markCircuitSuccess();
      return text;
    } catch (error) {
      const status = Number(error?.httpStatus || 0);
      if (status === 403 || status === 429) {
        await markCircuitFailure(status, error.message || error);
      }
      applyRateLimitBackoff(status);

      if (attempt >= retries) {
        throw new Error(`${url} -> ${error.message || error}`);
      }

      const delayMs = FETCH_RETRY_DELAYS_MS[Math.min(attempt, FETCH_RETRY_DELAYS_MS.length - 1)] || 0;
      warn(
        `Request retry ${attempt + 1}/${retries} for ${url}: ${error.message || error} ua=${userAgent} pageC=${dynamicConcurrency.page} matchC=${dynamicConcurrency.match}`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      attempt += 1;
    } finally {
      clear();
    }
  }

  throw new Error(`Unreachable fetch retry branch for ${url}`);
}

async function fetchJson(url, options = {}) {
  const text = await fetchText(url, options);
  return JSON.parse(text);
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const current = cursor;
      cursor += 1;

      if (current >= items.length) {
        return;
      }

      results[current] = await mapper(items[current], current);
    }
  }

  const workers = [];
  const workerCount = Math.min(limit, items.length);
  for (let i = 0; i < workerCount; i += 1) {
    workers.push(worker());
  }

  await Promise.all(workers);
  return results;
}

function buildWamKindsUrl({ season, competitionType }) {
  return `${BASE_URL}/wam_kinds_${MANDANT}_${season}_${competitionType}.json`;
}

function buildWamCompetitionsUrl({ season, competitionType, teamType, leagueId, areaId }) {
  return `${BASE_URL}/wam_competitions_${MANDANT}_${season}_${competitionType}_${teamType}_${leagueId}_${areaId}.json`;
}

function resolveJugendTeamType(kinds, requestedJugendId, fallbackTeamType) {
  const label = JUGEND_TO_TEAM_LABEL[requestedJugendId] || "";
  const entries = Object.entries(kinds?.Mannschaftsart || {});
  const exact = entries.find(([, value]) => normalizeLookup(value) === normalizeLookup(label));

  if (exact) {
    return exact[0].replace(/^_/, "");
  }

  if (fallbackTeamType && getValueByFlexibleKey(kinds?.Spielklasse, fallbackTeamType)) {
    return fallbackTeamType;
  }

  return "";
}

function buildFixtureListUrl(staffelId, from, to) {
  return `${BASE_URL}/ajax.fixturelist/-/staffel/${staffelId}/datum-von/${from}/datum-bis/${to}/max/500/offset/0`;
}

function buildDateRangeFromEnv() {
  const range = buildDateRange(fromDate, toDate);
  if (range.length === 0) {
    throw new Error(`Invalid date range: from=${fromDate}, to=${toDate}`);
  }
  return range;
}

function normalizeGames(games) {
  const timeSortKey = (value) => (/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(value || "").trim()) ? String(value) : "99:99");

  return uniqueBy(games, (game) => `${game.date}|${game.time}|${game.home}|${game.away}`)
    .sort((a, b) => {
      const dateDelta = a.date.localeCompare(b.date);
      if (dateDelta !== 0) {
        return dateDelta;
      }

      const timeDelta = timeSortKey(a.time).localeCompare(timeSortKey(b.time));
      if (timeDelta !== 0) {
        return timeDelta;
      }

      return `${a.home}|${a.away}`.localeCompare(`${b.home}|${b.away}`);
    })
    .slice(0, MAX_MATCHES);
}

function extractMatchId(matchUrl) {
  const id = String(matchUrl || "").match(/\/-\/spiel\/([^/?#]+)/i)?.[1] || "";
  return id || undefined;
}

function extractTeamPageUrlsFromMatchHtml(html) {
  const urls = [...String(html || "").matchAll(/<div class="team-name">[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>/gi)]
    .map((entry) => toAbsoluteFussballUrl(entry[1]))
    .filter((url) => url.includes("/mannschaft/"));

  if (urls.length >= 2) {
    return {
      homeTeamUrl: urls[0],
      awayTeamUrl: urls[1],
    };
  }

  const fallback = [...String(html || "").matchAll(/href="((?:https:\/\/www\.fussball\.de)?\/mannschaft\/[^"]+)"/gi)]
    .map((entry) => toAbsoluteFussballUrl(entry[1]));

  return {
    homeTeamUrl: fallback[0] || "",
    awayTeamUrl: fallback[1] || "",
  };
}

async function getTeamPageHtml(url, cache) {
  if (!url) {
    return "";
  }

  if (!cache.has(url)) {
    cache.set(
      url,
      fetchText(url).catch((error) => {
        warn(`Team page fetch failed (${url}): ${error.message || error}`);
        return "";
      }),
    );
  }

  return cache.get(url);
}

async function resolveKickoffFromTeamPages(matchId, homeTeamUrl, awayTeamUrl, cache) {
  if (!matchId) {
    return "";
  }

  for (const url of [homeTeamUrl, awayTeamUrl]) {
    if (!url) {
      continue;
    }

    const html = await getTeamPageHtml(url, cache);
    const kickoff = extractKickoffFromTeamPageHtml(html, matchId);
    if (kickoff) {
      return kickoff;
    }
  }

  return "";
}

function matchesSelectedTeams(home, away) {
  if (selectedTeams.length === 0) {
    return false;
  }

  return selectedTeams.some((team) => isLikelyTeamMatch(team, home) || isLikelyTeamMatch(team, away));
}

function applyKreisHeuristicFilter(games) {
  const preciseKeywords = regionParams.resultKeywords?.length
    ? regionParams.resultKeywords
    : regionParams.primaryAreaKeywords || [];
  const broadKeywords = regionParams.areaKeywords?.length ? regionParams.areaKeywords : KREIS_AREA_KEYWORDS[kreisId] || [];
  const keywords = preciseKeywords.length ? preciseKeywords : broadKeywords;
  if (!kreisId || keywords.length === 0 || games.length === 0) {
    return games;
  }

  const filtered = games.filter((game) => {
    const lookup = normalizeLookup(`${game.home || ""} ${game.away || ""} ${game.venue || ""}`);
    return keywords.some((keyword) => lookup.includes(keyword));
  });

  if (filtered.length > 0) {
    log(`Kreis heuristic filter: ${filtered.length}/${games.length}`);
    return filtered;
  }

  warn(
    `Kreis heuristic filter found no matches for state=${regionParams.stateCode || "(none)"} region=${regionParams.regionName || kreisId || "(none)"}.`,
  );
  if (STRICT_RESULT_FILTER) {
    return [];
  }
  warn("Strict result filter disabled. Falling back to unfiltered matches.");
  return games;
}

async function discoverCompetitions({ season, competitionType, requestedJugendId, fallbackTeamType, kreis, mappingParams }) {
  const kindsUrl = buildWamKindsUrl({ season, competitionType });
  let kinds;
  try {
    kinds = await fetchJson(kindsUrl);
  } catch (error) {
    throw new Error(
      `wam_kinds für mandant=${MANDANT} (verband=${mappingParams?.verband || "?"}) nicht erreichbar: ${error.message || error}.`,
    );
  }

  const teamType = resolveJugendTeamType(kinds, requestedJugendId, fallbackTeamType);
  if (!teamType) {
    throw new Error(
      `Keine Mannschaftsart für jugend=${requestedJugendId} (${JUGEND_TO_TEAM_LABEL[requestedJugendId] || "unbekannt"}) im Verband mandant=${MANDANT} (${mappingParams?.verband || "?"}).`,
    );
  }

  log(`Resolved jugend=${requestedJugendId} label=${JUGEND_TO_TEAM_LABEL[requestedJugendId] || "(none)"} to teamType=${teamType}`);

  const leaguesMapRaw = getValueByFlexibleKey(kinds.Spielklasse, teamType) || {};
  const gebietByLeagueRaw = getValueByFlexibleKey(kinds.Gebiet, teamType) || {};
  const teamTypeKeys = Object.keys(kinds?.Mannschaftsart || {}).map((key) => key.replace(/^_/, ""));
  const spielklasseKeys = Object.keys(kinds?.Spielklasse || {}).map((key) => key.replace(/^_/, ""));

  const leagueIds = Object.keys(leaguesMapRaw).map((leagueId) => leagueId.replace(/^_/, ""));
  log(
    `wam_kinds diagnostics: mandant=${MANDANT} season=${season} competitionType=${competitionType} teamTypesFound=${teamTypeKeys.length} spielklasseKeys=${spielklasseKeys.join("|") || "(none)"} leaguesFound=${leagueIds.length}`,
  );
  if (leagueIds.length === 0) {
    throw new Error(
      `Keine Spielklassen für teamType=${teamType} im Verband mandant=${MANDANT} (${mappingParams?.verband || "?"}). Mandant-Code möglicherweise inkorrekt.`,
    );
  }

  const leagueAreaRequests = [];
  for (const leagueId of leagueIds) {
    const areaMap = getValueByFlexibleKey(gebietByLeagueRaw, leagueId) || {};
    const areaIds = pickAreaIdsForLeague(areaMap, kreis, mappingParams);

    if (areaIds.length === 0) {
      warn(
        `No area IDs for league=${leagueId} and region=${mappingParams?.regionName || kreis || "(none)"} state=${mappingParams?.stateCode || "(none)"}`,
      );
      continue;
    }

    for (const areaId of areaIds) {
      leagueAreaRequests.push({ leagueId, areaId });
    }
  }

  if (leagueAreaRequests.length === 0) {
    throw new Error(
      `No area mapping found for teamType=${teamType} / state=${mappingParams?.stateCode || "(none)"} / region=${mappingParams?.regionName || kreis || "(none)"}`,
    );
  }

  log(`League/area requests: ${leagueAreaRequests.length}`);

  const payloads = await mapLimit(leagueAreaRequests, dynamicConcurrency.page, async ({ leagueId, areaId }) => {
    const url = buildWamCompetitionsUrl({
      season,
      competitionType,
      teamType,
      leagueId,
      areaId,
    });

    try {
      const payload = await fetchJson(url);
      return extractCompetitionEntries(payload).filter((entry) => entry.areaId === areaId || entry.areaId === areaId.replace(/^_/, ""));
    } catch (error) {
      warn(`Competition discovery failed for league=${leagueId}, area=${areaId}: ${error.message || error}`);
      return [];
    }
  });

  return {
    teamType,
    competitions: uniqueBy(
      payloads
        .flat()
        .slice(0, MAX_COMPETITIONS * 4)
        .filter((entry) => entry.url.includes("/spieltagsuebersicht/")),
      (entry) => entry.url,
    ).slice(0, MAX_COMPETITIONS),
  };
}

async function collectMatchCandidates(competitions, from, to) {
  const tasks = competitions
    .map((competition) => ({
      competition,
      staffelId: extractStaffelId(competition.url),
    }))
    .filter((task) => Boolean(task.staffelId));

  log(`Fixturelist tasks: ${tasks.length}`);

  const rows = await mapLimit(tasks, dynamicConcurrency.page, async (task) => {
    const fixtureUrl = buildFixtureListUrl(task.staffelId, from, to);

    try {
      const html = await fetchText(fixtureUrl);
      const matches = extractMatchesFromDatePage(html);

      return matches.map((match) => ({
        ...match,
        competitionUrl: task.competition.url,
        competitionLabel: task.competition.label,
      }));
    } catch (error) {
      warn(`Fixturelist failed (${fixtureUrl}): ${error.message || error}`);
      return [];
    }
  });

  const allCandidates = uniqueBy(rows.flat(), (item) => item.matchUrl);

  if (selectedTeams.length > 0) {
    const matchedCount = allCandidates.filter((candidate) => matchesSelectedTeams(candidate.home, candidate.away)).length;
    log(`Team-hint candidates matched: ${matchedCount}/${allCandidates.length}`);
  }

  // Teams are hints for discovery, not a hard filter.
  return allCandidates;
}

async function enrichMatches(matchCandidates, dateRangeSet) {
  const teamPageCache = new Map();

  const details = await mapLimit(matchCandidates, dynamicConcurrency.match, async (candidate) => {
    try {
      const html = await fetchText(candidate.matchUrl);
      const parsed = extractMatchDetails(html);
      const date = parsed.date || "";

      if (!date || !dateRangeSet.has(date)) {
        return null;
      }

      const matchId = extractMatchId(candidate.matchUrl);
      const { homeTeamUrl, awayTeamUrl } = extractTeamPageUrlsFromMatchHtml(html);
      const kickoff =
        parsed.time || (await resolveKickoffFromTeamPages(matchId, homeTeamUrl, awayTeamUrl, teamPageCache));

      return {
        id: matchId,
        matchUrl: candidate.matchUrl || "",
        home: parsed.home || candidate.home,
        away: parsed.away || candidate.away,
        date,
        time: kickoff || "--:--",
        venue: parsed.venue || "Sportanlage",
        km: 0,
        kreisId,
        stateCode: regionParams.stateCode,
        regionName: regionParams.regionName,
        regionShortCode: regionParams.regionShortCode,
        jugendId,
      };
    } catch (error) {
      warn(`Match detail failed (${candidate.matchUrl}): ${error.message || error}`);
      return null;
    }
  });

  const allDetails = applyKreisHeuristicFilter(details.filter(Boolean));

  if (selectedTeams.length > 0) {
    const matchedCount = allDetails.filter((game) => matchesSelectedTeams(game.home, game.away)).length;
    log(`Team-hint details matched: ${matchedCount}/${allDetails.length}`);
  }

  // Teams are hints for discovery, not a hard filter.
  return allDetails;
}

async function main() {
  if (!jugendTeamLabel && !fallbackJugendTeamType) {
    throw new Error(`Unsupported jugendId: ${jugendId}`);
  }

  const parsedFrom = parseIsoDate(fromDate);
  const parsedTo = parseIsoDate(toDate);
  if (!parsedFrom || !parsedTo) {
    throw new Error(`Invalid from/to date. from=${fromDate}, to=${toDate}`);
  }

  await ensureRobotsAllowsAccess();

  const base = await fetchJson(`${BASE_URL}/wam_base.json`);
  const season = process.env.FUSSBALLDE_SAISON || base.currentSaison;
  const competitionType = process.env.FUSSBALLDE_COMPETITION_TYPE || base.defaultCompetitionType || "1";

  const dateRange = buildDateRangeFromEnv();
  const dateRangeSet = new Set(dateRange);

  log(
    `Range=${dateRange[0]}..${dateRange[dateRange.length - 1]} state=${regionParams.stateCode || "(none)"} region=${regionParams.regionName || kreisId || "(none)"} kreis=${kreisId} jugend=${jugendId} label=${jugendTeamLabel || "(none)"} mapping=${regionParams.source} mandant=${MANDANT} verband=${regionParams.verband || "(none)"} regionalFallback=${regionParams.allowRegionalFallback ? "yes" : "no"} strictMapping=${STRICT_REGION_MAPPING ? "yes" : "no"} strictResultFilter=${STRICT_RESULT_FILTER ? "yes" : "no"} keywords=${regionParams.areaKeywords.join("|")} pageC=${dynamicConcurrency.page} matchC=${dynamicConcurrency.match}`,
  );

  const discovery = await discoverCompetitions({
    season,
    competitionType,
    requestedJugendId: jugendId,
    fallbackTeamType: fallbackJugendTeamType,
    kreis: kreisId,
    mappingParams: regionParams,
  });
  const { teamType: jugendTeamType, competitions } = discovery;

  if (competitions.length === 0) {
    warn("No competitions found for selected filters.");
    process.stdout.write(
      `${JSON.stringify({
        games: [],
        meta: {
          provider: "fussball.de",
          selectedRegion: regionParams,
          warning: "Für diese Region wurden keine Spiele gefunden. Bitte Zeitraum, Altersklasse oder Region ändern.",
        },
      })}\n`,
    );
    return;
  }

  log(`Competitions discovered: ${competitions.length}`);

  const candidates = await collectMatchCandidates(competitions, dateRange[0], dateRange[dateRange.length - 1]);
  log(`Match candidates: ${candidates.length}`);

  if (candidates.length === 0) {
    process.stdout.write(`${JSON.stringify({ games: [] })}\n`);
    return;
  }

  const games = normalizeGames(await enrichMatches(candidates, dateRangeSet));

  process.stdout.write(
    `${JSON.stringify({
      games,
      meta: {
        provider: "fussball.de",
        season,
        competitionType,
        fetchedAt: nowIso(),
        competitions: competitions.length,
        candidates: candidates.length,
        selectedTeamsHintCount: selectedTeams.length,
        selectedTeamsMatchCount: games.filter((game) => matchesSelectedTeams(game.home, game.away)).length,
        selectedRegion: regionParams,
      },
    })}\n`,
  );
}

main().catch((error) => {
  console.error(`[fussballde-export][error] ${error.message || error}`);
  process.exit(1);
});
