import { JUGEND_KLASSEN, KICKOFF_ZEITEN } from "../data/altersklassen";
import { VENUES_JE_KREIS } from "../data/kreise";

export const DATA_SOURCE_LABELS = {
  csv: "CSV/JSON Import",
  adapter: "Live-Adapter (HTTP)",
  scraper: "Scraper (nicht konfiguriert)",
  openliga: "OpenLiga (nicht konfiguriert)",
  mock: "Demo (Zufallsdaten)",
};

const PROFI_KEYWORDS = ["(U)", "Borussia", "Fortuna", "Rot-Weiss", "MSV", "RW Oberhausen"];
const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const UNKNOWN_TIME_RE = /^(?:--:--|\*{2}(?::\*{2})?|k\.?\s*a\.?|n\/a|unbekannt)$/i;
const ADAPTER_TIMEOUT_MS = Number(import.meta.env?.VITE_ADAPTER_TIMEOUT_MS || 15000);
const PROVIDER_RETRY_DELAYS_MS = [1000, 2000, 4000];
const SKIP_RETRY_WAIT = import.meta.env?.MODE === "test";
const GENERIC_TEAM_TOKENS = new Set([
  "sv",
  "sc",
  "fc",
  "tsv",
  "vfb",
  "vfl",
  "tus",
  "ssv",
  "spvg",
  "sg",
  "djk",
  "bv",
  "u",
]);

function toLookupKey(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function toTeamSearchKey(value) {
  return toLookupKey(value)
    .replace(/\bschwarz weiss\b/g, "sw")
    .replace(/\brot weiss\b/g, "rw")
    .replace(/\bu ?(13|14|15|16|17|18|19)\b/g, "u")
    .replace(/\bjunioren?\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeTeam(value) {
  return toTeamSearchKey(value)
    .split(" ")
    .filter((token) => token && !GENERIC_TEAM_TOKENS.has(token));
}

function countTokenOverlap(leftTokens, rightTokens) {
  const rightSet = new Set(rightTokens);
  let overlap = 0;

  for (const token of leftTokens) {
    if (rightSet.has(token)) {
      overlap += 1;
    }
  }

  return overlap;
}

function isLikelyTeamMatch(left, right) {
  const leftKey = toTeamSearchKey(left);
  const rightKey = toTeamSearchKey(right);

  if (!leftKey || !rightKey) {
    return false;
  }

  if (leftKey === rightKey) {
    return true;
  }

  if ((leftKey.includes(rightKey) || rightKey.includes(leftKey)) && Math.min(leftKey.length, rightKey.length) >= 6) {
    return true;
  }

  const leftTokens = tokenizeTeam(leftKey);
  const rightTokens = tokenizeTeam(rightKey);

  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return false;
  }

  const overlap = countTokenOverlap(leftTokens, rightTokens);
  const minTokenCount = Math.min(leftTokens.length, rightTokens.length);

  if (minTokenCount <= 2) {
    return overlap === minTokenCount;
  }

  return overlap >= minTokenCount - 1;
}

function createTimeoutController(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}

async function fetchWithTimeout(url, options, timeoutMs, errorPrefix) {
  const { signal, clear } = createTimeoutController(timeoutMs);

  try {
    return await fetch(url, { ...options, signal });
  } catch (error) {
    const message = String(error?.message || "");
    const isNetworkError =
      error instanceof TypeError ||
      error?.name === "TypeError" ||
      /load failed|failed to fetch|networkerror/i.test(message);

    if (error?.name === "AbortError") {
      throw new Error(`${errorPrefix} Timeout nach ${timeoutMs}ms`);
    }
    if (isNetworkError) {
      throw new Error(`${errorPrefix} nicht erreichbar (${url}). Prüfe Endpoint/Proxy/CORS.`);
    }
    throw error;
  } finally {
    clear();
  }
}

function addDays(isoDate, days) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day + days);
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDateStrict(isoDate) {
  const match = String(isoDate || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error("Ungültiges Startdatum. Bitte Format YYYY-MM-DD verwenden.");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw new Error("Ungültiges Startdatum. Bitte Format YYYY-MM-DD verwenden.");
  }

  return date;
}

function getWeekRange(isoDate) {
  const date = parseIsoDateStrict(isoDate);
  date.setHours(0, 0, 0, 0);

  const weekday = (date.getDay() + 6) % 7;
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - weekday);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  return {
    fromDate: toIsoDate(weekStart),
    toDate: toIsoDate(weekEnd),
  };
}

export function formatDate(dateValue) {
  return dateValue.toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function calcPriority(teamName) {
  const name = String(teamName || "");
  if (PROFI_KEYWORDS.some((keyword) => name.includes(keyword))) {
    return 5;
  }

  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }

  return 3 + (hash % 2);
}

function normalizeDate(rawDate, fallbackIso) {
  if (!rawDate) {
    return { value: new Date(`${fallbackIso}T00:00:00`), fallback: true };
  }

  const dateText = String(rawDate).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    return { value: new Date(`${dateText}T00:00:00`), fallback: false };
  }

  if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateText)) {
    const [day, month, year] = dateText.split(".").map(Number);
    return { value: new Date(year, month - 1, day), fallback: false };
  }

  const parsed = new Date(dateText);
  if (Number.isNaN(parsed.getTime())) {
    return { value: new Date(`${fallbackIso}T00:00:00`), fallback: true };
  }

  return { value: parsed, fallback: false };
}

function normalizeTime(rawTime, options = {}) {
  const allowUnknown = Boolean(options.allowUnknown);
  const fallbackTime = TIME_RE.test(String(options.fallbackTime || "")) ? String(options.fallbackTime) : "10:00";

  if (rawTime === undefined || rawTime === null || String(rawTime).trim() === "") {
    if (allowUnknown) {
      return { value: "--:--", fallback: false, unknown: true };
    }
    return { value: fallbackTime, fallback: true, unknown: false };
  }

  const timeText = String(rawTime).trim();
  if (TIME_RE.test(timeText)) {
    return { value: timeText, fallback: false, unknown: false };
  }

  if (allowUnknown && UNKNOWN_TIME_RE.test(timeText)) {
    return { value: "--:--", fallback: false, unknown: true };
  }

  return { value: fallbackTime, fallback: true, unknown: false };
}

function timeSortKey(value) {
  const timeText = String(value || "").trim();
  return TIME_RE.test(timeText) ? timeText : "99:99";
}

function compareGamesByDateTime(left, right) {
  const dateDelta = left.dateObj - right.dateObj;
  if (dateDelta !== 0) {
    return dateDelta;
  }
  return timeSortKey(left.time).localeCompare(timeSortKey(right.time));
}

function parseKm(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(String(value).replace(/,/g, ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableProviderError(error) {
  const message = String(error?.message || "").toLowerCase();
  return /timeout|network|failed|nicht erreichbar|http 5\d\d|econn|etimedout|fetch/.test(message);
}

async function runProviderWithRetry(providerName, providerFn, context) {
  let lastError = null;

  for (let attempt = 0; attempt <= PROVIDER_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await providerFn(context);
    } catch (error) {
      lastError = error;
      const canRetry = attempt < PROVIDER_RETRY_DELAYS_MS.length && isRetryableProviderError(error);
      if (!canRetry) {
        break;
      }

      await sleep(SKIP_RETRY_WAIT ? 0 : PROVIDER_RETRY_DELAYS_MS[attempt]);
    }
  }

  throw lastError ?? new Error(`Provider fehlgeschlagen: ${providerName}`);
}

function toBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return false;
  }

  return ["1", "true", "ja", "yes", "y"].includes(value.toLowerCase().trim());
}

function normalizeUploadedGame(rawGame, index, context) {
  const home =
    rawGame.home ?? rawGame.heim ?? rawGame.heimteam ?? rawGame.team1 ?? rawGame.team_home ?? rawGame.teamHome;
  const away =
    rawGame.away ?? rawGame.gast ?? rawGame.gastteam ?? rawGame.team2 ?? rawGame.team_away ?? rawGame.teamAway;

  if (!home || !away) {
    return { game: null, issues: ["Heim- oder Gastteam fehlt."] };
  }

  const issues = [];
  const date = normalizeDate(rawGame.date ?? rawGame.datum, context.fromDate);
  const time = normalizeTime(rawGame.time ?? rawGame.uhrzeit ?? rawGame.anstoss ?? rawGame.kickoff, {
    allowUnknown: Boolean(context.allowUnknownTime),
    fallbackTime: context.defaultFallbackTime || "10:00",
  });

  if (date.fallback) {
    issues.push("Datum ungültig/fehlend, Fallback auf Startdatum.");
  }

  if (time.fallback) {
    issues.push(`Anstoßzeit ungültig/fehlend, Fallback auf ${time.value}.`);
  }

  const venue = rawGame.venue ?? rawGame.spielort ?? rawGame.ort ?? rawGame.location ?? "Sportanlage";
  const matchUrl = String(
    rawGame.matchUrl ?? rawGame.match_url ?? rawGame.sourceUrl ?? rawGame.source_url ?? rawGame.url ?? rawGame.link ?? "",
  ).trim();
  const jugendId =
    rawGame.jugendId ?? rawGame.jugend ?? rawGame.altersklasse ?? rawGame.ageGroup ?? context.jugendId ?? "";
  const kreisId = rawGame.kreisId ?? rawGame.kreis ?? rawGame.district ?? context.kreisId ?? "";

  return {
    issues,
    game: {
      id: `csv-${index}-${String(home).slice(0, 4)}-${String(away).slice(0, 4)}`,
      home: String(home).trim(),
      away: String(away).trim(),
      dateObj: date.value,
      dateLabel: formatDate(date.value),
      time: time.value,
      venue: String(venue).trim(),
      matchUrl,
      km: parseKm(rawGame.km ?? rawGame.distanz ?? rawGame.distance),
      priority: Number(rawGame.priority) || calcPriority(String(home)),
      turnier: toBoolean(rawGame.turnier) || context.turnier,
      jugendId,
      kreisId,
    },
  };
}

function splitDelimitedLine(line, delimiter) {
  const cells = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function parseCsvRows(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const delimiter = lines[0].includes(";") ? ";" : ",";
  const headers = splitDelimitedLine(lines[0], delimiter).map((header) => header.toLowerCase());

  return lines.slice(1).map((line) => {
    const values = splitDelimitedLine(line, delimiter);
    const row = {};

    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });

    return row;
  });
}

export function parseUploadedGamesReport(fileText, fileTypeHint, context) {
  const type = fileTypeHint.toLowerCase();
  let rows = [];

  if (type.includes("json")) {
    const parsed = JSON.parse(fileText);
    rows = Array.isArray(parsed) ? parsed : parsed.games ?? [];
  } else {
    rows = parseCsvRows(fileText);
  }

  const games = [];
  const warnings = [];
  const seen = new Set();
  let skippedRows = 0;

  rows.forEach((row, index) => {
    const { game, issues } = normalizeUploadedGame(row, index, context);
    if (!game) {
      skippedRows += 1;
      if (issues.length) {
        warnings.push(`Zeile ${index + 2}: ${issues.join(" ")}`);
      }
      return;
    }

    const dupeKey = `${game.home}|${game.away}|${game.dateObj.toISOString().slice(0, 10)}|${game.time}`;
    if (seen.has(dupeKey)) {
      warnings.push(`Zeile ${index + 2}: doppeltes Spiel erkannt (${game.home} vs ${game.away}).`);
    }
    seen.add(dupeKey);

    if (issues.length) {
      warnings.push(`Zeile ${index + 2}: ${issues.join(" ")}`);
    }

    games.push(game);
  });

  games.sort(compareGamesByDateTime);

  return {
    games,
    stats: {
      totalRows: rows.length,
      validRows: games.length,
      skippedRows,
      warnings: warnings.slice(0, 8),
    },
  };
}

export function parseUploadedGames(fileText, fileTypeHint, context) {
  return parseUploadedGamesReport(fileText, fileTypeHint, context).games;
}

function filterGamesBySelection(games, { kreisId, jugendId, fromDate, toDate }) {
  const fromDateObj = new Date(`${fromDate}T00:00:00`);
  const toDateObj = toDate ? new Date(`${toDate}T23:59:59`) : null;

  return games
    .filter((game) => {
      if (game.kreisId && game.kreisId !== kreisId) {
        return false;
      }

      if (game.jugendId && game.jugendId !== jugendId) {
        return false;
      }

      if (game.dateObj < fromDateObj) {
        return false;
      }

      if (toDateObj && game.dateObj > toDateObj) {
        return false;
      }

      return true;
    })
    .sort(compareGamesByDateTime);
}

function buildMockTeams(kreisId, count = 10) {
  const prefix = kreisId ? `Team ${kreisId.toUpperCase()}` : "Team";
  return Array.from({ length: count }, (_, index) => `${prefix} ${index + 1}`);
}

function markSelectedTeamGames(games, teams) {
  const selectedTeams = Array.isArray(teams) ? teams.filter(Boolean) : [];
  if (!selectedTeams.length) {
    return games;
  }

  return games.map((game) => {
    const selectedTeamMatch = selectedTeams.some(
      (team) => isLikelyTeamMatch(team, game.home) || isLikelyTeamMatch(team, game.away),
    );

    if (!selectedTeamMatch) {
      return game;
    }

    return {
      ...game,
      selectedTeamMatch: true,
      // Keep selected clubs visible in Top-5 without excluding other matches.
      priority: Math.max(5, Number(game.priority) || 0),
    };
  });
}

function createTeamFilterMeta(games, teams) {
  const requestedTeams = Array.isArray(teams) ? teams.filter(Boolean) : [];
  if (!requestedTeams.length) {
    return {
      requested: false,
      requestedCount: 0,
      matchedCount: 0,
      matchedTeamCount: 0,
      matchedTeams: [],
      missingTeams: [],
      binding: false,
      fallbackToUnfiltered: false,
    };
  }

  const matchedTeams = [];
  const missingTeams = [];

  for (const team of requestedTeams) {
    const found = games.some((game) => isLikelyTeamMatch(team, game.home) || isLikelyTeamMatch(team, game.away));
    if (found) {
      matchedTeams.push(team);
    } else {
      missingTeams.push(team);
    }
  }

  const matchedCount = games.filter((game) =>
    requestedTeams.some((team) => isLikelyTeamMatch(team, game.home) || isLikelyTeamMatch(team, game.away)),
  ).length;

  return {
    requested: true,
    requestedCount: requestedTeams.length,
    matchedCount,
    matchedTeamCount: matchedTeams.length,
    matchedTeams,
    missingTeams,
    binding: false,
    fallbackToUnfiltered: false,
  };
}

export function buildMockSchedule(teams, jugendId, fromDate, kreisId, toDate) {
  const jugend = JUGEND_KLASSEN.find((item) => item.id === jugendId);
  const venues = VENUES_JE_KREIS[kreisId] || ["Sportanlage", "Kunstrasen", "Sportpark"];
  const kickoffs = KICKOFF_ZEITEN[jugendId] || ["13:00", "14:00", "15:00"];
  const shuffled = [...teams].sort(() => Math.random() - 0.5);
  const rangeDays = toDate
    ? Math.max(1, Math.round((new Date(`${toDate}T00:00:00`) - new Date(`${fromDate}T00:00:00`)) / (1000 * 60 * 60 * 24)))
    : 14;

  if (jugend?.turnier) {
    const venue = venues[Math.floor(Math.random() * venues.length)];
    const baseDay = addDays(fromDate, Math.floor(Math.random() * Math.max(1, rangeDays)));
    const result = [];
    let hour = 9;
    let half = false;

    for (let i = 0; i < shuffled.length - 1; i += 2) {
      const time = `${String(hour).padStart(2, "0")}:${half ? "30" : "00"}`;
      result.push({
        id: `g${i}`,
        home: shuffled[i],
        away: shuffled[i + 1],
        dateObj: baseDay,
        dateLabel: formatDate(baseDay),
        time,
        venue,
        km: 3 + Math.floor(Math.random() * 15),
        priority: calcPriority(shuffled[i]),
        turnier: true,
        jugendId,
        kreisId,
      });

      if (half) {
        hour += 1;
      }
      half = !half;
    }

    return result;
  }

  const result = [];

  for (let i = 0; i < shuffled.length - 1; i += 2) {
    const dateObj = addDays(fromDate, Math.floor(Math.random() * Math.max(1, rangeDays)));
    result.push({
      id: `g${i}`,
      home: shuffled[i],
      away: shuffled[i + 1],
      dateObj,
      dateLabel: formatDate(dateObj),
      time: kickoffs[Math.floor(Math.random() * kickoffs.length)],
      venue: venues[Math.floor(Math.random() * venues.length)],
      km: 3 + Math.floor(Math.random() * 28),
      priority: calcPriority(shuffled[i]),
      turnier: false,
      jugendId,
      kreisId,
    });
  }

  return result.sort(compareGamesByDateTime);
}

async function fetchGamesCsv(params) {
  if (!params.uploadedGames?.length) {
    throw new Error("Kein CSV/JSON-Import vorhanden.");
  }

  const filteredGames = filterGamesBySelection(params.uploadedGames, params);
  if (!filteredGames.length) {
    throw new Error("Import enthält keine passenden Spiele für Kreis/Jugend/Datumsbereich.");
  }

  return {
    games: markSelectedTeamGames(filteredGames, params.teams),
    meta: {
      teamFilter: createTeamFilterMeta(filteredGames, params.teams),
    },
  };
}

async function fetchGamesAdapter(params) {
  const adapterEndpoint = String(params.adapterEndpoint || "").trim();
  if (!adapterEndpoint) {
    throw new Error("Adapter-Endpoint fehlt.");
  }

  const headers = { "Content-Type": "application/json" };
  if (params.adapterToken) {
    headers.Authorization = `Bearer ${params.adapterToken}`;
  }

  const weekRange = getWeekRange(params.fromDate);
  const response = await fetchWithTimeout(
    adapterEndpoint,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        kreisId: params.kreisId,
        jugendId: params.jugendId,
        fromDate: weekRange.fromDate,
        toDate: weekRange.toDate,
        teams: params.teams,
        ensureWeekData: true,
      }),
    },
    ADAPTER_TIMEOUT_MS,
    "Adapter",
  );

  if (!response.ok) {
    throw new Error(`Adapter HTTP ${response.status}`);
  }

  const payload = await response.json();
  const rawGames = Array.isArray(payload) ? payload : payload.games ?? [];
  if (!rawGames.length) {
    throw new Error("Adapter lieferte keine Spiele.");
  }

  const report = parseUploadedGamesReport(JSON.stringify(rawGames), "adapter.json", {
    kreisId: params.kreisId,
    jugendId: params.jugendId,
    fromDate: params.fromDate,
    turnier: params.turnier,
    allowUnknownTime: true,
    defaultFallbackTime: "--:--",
  });

  const broadFilteredGames = filterGamesBySelection(report.games, {
    ...params,
    teams: [],
  });

  if (broadFilteredGames.length > 0) {
    const fallbackTeamFilter = createTeamFilterMeta(broadFilteredGames, params.teams);

    return {
      games: markSelectedTeamGames(broadFilteredGames, params.teams),
      meta: {
        teamFilter:
          payload && !Array.isArray(payload) && payload.teamFilter
            ? payload.teamFilter
            : fallbackTeamFilter,
      },
    };
  }

  throw new Error("Adapterdaten passen nicht zur aktuellen Auswahl.");
}

async function fetchGamesMock(params) {
  const inputTeams = Array.isArray(params.teams) ? params.teams.filter(Boolean) : [];
  const seedTeams =
    inputTeams.length >= 2 ? inputTeams : [...inputTeams, ...buildMockTeams(params.kreisId, Math.max(2, 8 - inputTeams.length))];
  const generated = buildMockSchedule(seedTeams, params.jugendId, params.fromDate, params.kreisId, params.toDate);
  const filteredGames = filterGamesBySelection(generated, params);
  return {
    games: markSelectedTeamGames(filteredGames, params.teams),
    meta: {
      teamFilter: createTeamFilterMeta(filteredGames, params.teams),
    },
  };
}

/**
 * DataProvider Interface: fetchGames(kreis, jugend, dateRange) -> Game[]
 */
export async function fetchGamesWithProviders({
  mode = "auto",
  kreisId,
  jugendId,
  fromDate,
  toDate,
  teams,
  uploadedGames,
  adapterEndpoint,
  adapterToken,
  turnier,
}) {
  const context = { kreisId, jugendId, fromDate, toDate, teams, uploadedGames, adapterEndpoint, adapterToken, turnier };

  const providerOrder =
    mode === "mock" ? ["mock"] : mode === "csv" ? ["csv"] : mode === "adapter" ? ["adapter"] : ["csv", "adapter"];

  const providerMap = {
    csv: fetchGamesCsv,
    adapter: fetchGamesAdapter,
    mock: fetchGamesMock,
  };

  let lastError = null;

  for (const providerName of providerOrder) {
    try {
      const providerResult = await runProviderWithRetry(providerName, providerMap[providerName], context);
      const games = Array.isArray(providerResult) ? providerResult : providerResult?.games || [];
      const meta = Array.isArray(providerResult) ? {} : providerResult?.meta || {};
      if (games?.length) {
        return { games, source: providerName, meta };
      }
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("Keine Spieldaten verfügbar.");
}
