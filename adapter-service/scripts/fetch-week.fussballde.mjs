#!/usr/bin/env node

import {
  KREIS_AREA_KEYWORDS,
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
const MANDANT = process.env.FUSSBALLDE_MANDANT || "22";
const REQUEST_TIMEOUT_MS = Number(process.env.FUSSBALLDE_REQUEST_TIMEOUT_MS || 15000);
const PAGE_CONCURRENCY = Math.max(1, Number(process.env.FUSSBALLDE_PAGE_CONCURRENCY || 4));
const MATCH_CONCURRENCY = Math.max(1, Number(process.env.FUSSBALLDE_MATCH_CONCURRENCY || 6));
const MAX_COMPETITIONS = Math.max(1, Number(process.env.FUSSBALLDE_MAX_COMPETITIONS || 80));
const MAX_MATCHES = Math.max(1, Number(process.env.FUSSBALLDE_MAX_MATCHES || 600));
const FETCH_RETRY_DELAYS_MS = [1000, 2000, 4000];
const DEBUG = process.env.SCOUTPLAN_DEBUG_EXPORTER === "true";

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
const jugendId = process.env.SCOUTPLAN_JUGEND_ID || "";
const jugendTeamType = JUGEND_TO_TEAM_TYPE[jugendId];
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

function createAbortController(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    controller,
    clear: () => clearTimeout(timer),
  };
}

async function fetchText(url, { retries = FETCH_RETRY_DELAYS_MS.length } = {}) {
  let attempt = 0;

  while (attempt <= retries) {
    const { controller, clear } = createAbortController(REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "user-agent": "ScoutXAdapter/1.0 (+https://www.fussball.de)",
          accept: "text/html,application/json;q=0.9,*/*;q=0.8",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.text();
    } catch (error) {
      if (attempt >= retries) {
        throw new Error(`${url} -> ${error.message || error}`);
      }

      const delayMs = FETCH_RETRY_DELAYS_MS[Math.min(attempt, FETCH_RETRY_DELAYS_MS.length - 1)] || 0;
      warn(`Request retry ${attempt + 1}/${retries} for ${url}: ${error.message || error}`);
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
  const keywords = regionParams.areaKeywords?.length ? regionParams.areaKeywords : KREIS_AREA_KEYWORDS[kreisId] || [];
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

  warn("Kreis heuristic filter found no matches. Falling back to unfiltered matches.");
  return games;
}

async function discoverCompetitions({ season, competitionType, teamType, kreis, mappingParams }) {
  const kindsUrl = buildWamKindsUrl({ season, competitionType });
  const kinds = await fetchJson(kindsUrl);

  const leaguesMapRaw = getValueByFlexibleKey(kinds.Spielklasse, teamType) || {};
  const gebietByLeagueRaw = getValueByFlexibleKey(kinds.Gebiet, teamType) || {};

  const leagueIds = Object.keys(leaguesMapRaw).map((leagueId) => leagueId.replace(/^_/, ""));
  if (leagueIds.length === 0) {
    throw new Error(`No Spielklasse entries for teamType=${teamType}`);
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

  const payloads = await mapLimit(leagueAreaRequests, PAGE_CONCURRENCY, async ({ leagueId, areaId }) => {
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

  return uniqueBy(
    payloads
      .flat()
      .slice(0, MAX_COMPETITIONS * 4)
      .filter((entry) => entry.url.includes("/spieltagsuebersicht/")),
    (entry) => entry.url,
  ).slice(0, MAX_COMPETITIONS);
}

async function collectMatchCandidates(competitions, from, to) {
  const tasks = competitions
    .map((competition) => ({
      competition,
      staffelId: extractStaffelId(competition.url),
    }))
    .filter((task) => Boolean(task.staffelId));

  log(`Fixturelist tasks: ${tasks.length}`);

  const rows = await mapLimit(tasks, PAGE_CONCURRENCY, async (task) => {
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

  const details = await mapLimit(matchCandidates, MATCH_CONCURRENCY, async (candidate) => {
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
  if (!jugendTeamType) {
    throw new Error(`Unsupported jugendId: ${jugendId}`);
  }

  const parsedFrom = parseIsoDate(fromDate);
  const parsedTo = parseIsoDate(toDate);
  if (!parsedFrom || !parsedTo) {
    throw new Error(`Invalid from/to date. from=${fromDate}, to=${toDate}`);
  }

  const base = await fetchJson(`${BASE_URL}/wam_base.json`);
  const season = process.env.FUSSBALLDE_SAISON || base.currentSaison;
  const competitionType = process.env.FUSSBALLDE_COMPETITION_TYPE || base.defaultCompetitionType || "1";

  const dateRange = buildDateRangeFromEnv();
  const dateRangeSet = new Set(dateRange);

  log(
    `Range=${dateRange[0]}..${dateRange[dateRange.length - 1]} state=${regionParams.stateCode || "(none)"} region=${regionParams.regionName || kreisId || "(none)"} kreis=${kreisId} jugend=${jugendId} teamType=${jugendTeamType} mapping=${regionParams.source} search=${regionParams.fallbackSearchName || "(none)"} keywords=${regionParams.areaKeywords.join("|")}`,
  );

  const competitions = await discoverCompetitions({
    season,
    competitionType,
    teamType: jugendTeamType,
    kreis: kreisId,
    mappingParams: regionParams,
  });

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
