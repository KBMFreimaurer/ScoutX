const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const UNKNOWN_TIME_RE = /^(?:--:--|\*{2}(?::\*{2})?|k\.?\s*a\.?|n\/a|unbekannt)$/i;

function isValidCalendarDateParts(year, month, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }

  const candidate = new Date(year, month - 1, day);
  return candidate.getFullYear() === year && candidate.getMonth() === month - 1 && candidate.getDate() === day;
}

function parseDate(dateText) {
  if (!dateText || typeof dateText !== "string") {
    return null;
  }

  const trimmed = dateText.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split("-").map(Number);
    if (!isValidCalendarDateParts(year, month, day)) {
      return null;
    }
    return new Date(year, month - 1, day);
  }

  if (/^\d{2}\.\d{2}\.\d{4}$/.test(trimmed)) {
    const [day, month, year] = trimmed.split(".").map(Number);
    if (!isValidCalendarDateParts(year, month, day)) {
      return null;
    }
    return new Date(year, month - 1, day);
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
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

function normalizeTeam(value, aliasMap = {}) {
  if (!value) {
    return "";
  }

  const team = String(value).trim();
  const lookup = toLookupKey(team);
  return aliasMap[lookup] || team;
}

function normalizeTime(value) {
  if (value === undefined || value === null) {
    return "--:--";
  }

  const text = String(value).trim();
  if (TIME_RE.test(text)) {
    return text;
  }

  if (UNKNOWN_TIME_RE.test(text)) {
    return "--:--";
  }

  return "--:--";
}

function toIsoDateLocal(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function timeSortKey(value) {
  const normalized = normalizeTime(value);
  return TIME_RE.test(normalized) ? normalized : "99:99";
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

function normalizeGame(raw, index, options = {}) {
  const aliasMap = options.aliasMap || {};

  const home = normalizeTeam(raw.home ?? raw.heim ?? raw.heimteam ?? raw.team1, aliasMap);
  const away = normalizeTeam(raw.away ?? raw.gast ?? raw.gastteam ?? raw.team2, aliasMap);
  if (!home || !away) {
    return null;
  }

  const rawDate = String(raw.date ?? raw.datum ?? "").trim();
  const parsedDate = parseDate(rawDate);
  if (!parsedDate) {
    return null;
  }

  const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : toIsoDateLocal(parsedDate);

  return {
    id: raw.id ?? `adapter-${index}`,
    matchUrl: String(raw.matchUrl ?? raw.match_url ?? raw.sourceUrl ?? raw.source_url ?? raw.url ?? raw.link ?? "").trim(),
    home,
    away,
    date,
    time: normalizeTime(raw.time ?? raw.uhrzeit ?? raw.anstoss ?? raw.kickoff),
    venue: String(raw.venue ?? raw.spielort ?? raw.ort ?? raw.location ?? "Sportanlage").trim(),
    km: Number.isFinite(Number(raw.km)) ? Number(raw.km) : 0,
    kreisId: String(raw.kreisId ?? raw.kreis ?? raw.district ?? "").trim(),
    jugendId: String(raw.jugendId ?? raw.jugend ?? raw.altersklasse ?? raw.ageGroup ?? "").trim(),
    turnier: toBoolean(raw.turnier),
    source: options.source || String(raw.source || "unknown"),
  };
}

function toDateOnly(isoDate) {
  if (!isoDate) {
    return null;
  }

  const parsed = parseDate(String(isoDate));
  if (!parsed) {
    return null;
  }

  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

function sortGames(a, b) {
  const da = toDateOnly(a.date);
  const db = toDateOnly(b.date);
  if (da && db && da.getTime() !== db.getTime()) {
    return da - db;
  }

  const timeDelta = timeSortKey(a.time).localeCompare(timeSortKey(b.time));
  if (timeDelta !== 0) {
    return timeDelta;
  }

  const kreisDelta = String(a.kreisId || "").localeCompare(String(b.kreisId || ""));
  if (kreisDelta !== 0) {
    return kreisDelta;
  }

  return `${a.home}|${a.away}`.localeCompare(`${b.home}|${b.away}`);
}

function gameDedupKey(game) {
  return [
    toLookupKey(game.home),
    toLookupKey(game.away),
    game.date,
    game.time,
    String(game.kreisId || "").toLowerCase(),
    String(game.jugendId || "").toLowerCase(),
  ].join("|");
}

function dedupeGames(games) {
  const map = new Map();

  for (const game of games) {
    const key = gameDedupKey(game);
    if (!map.has(key)) {
      map.set(key, game);
    }
  }

  return [...map.values()].sort(sortGames);
}

function filterGames(games, payload = {}, options = {}) {
  const aliasMap = options.aliasMap || {};
  const selectedTeams = Array.isArray(payload.teams)
    ? payload.teams.map((team) => normalizeTeam(team, aliasMap)).filter(Boolean)
    : [];
  const fromDate = toDateOnly(payload.fromDate);
  const toDate = toDateOnly(payload.toDate);

  return games
    .filter((game) => {
      if (payload.kreisId && game.kreisId && game.kreisId !== payload.kreisId) {
        return false;
      }

      if (payload.jugendId && game.jugendId && game.jugendId !== payload.jugendId) {
        return false;
      }

      if (fromDate) {
        const gameDate = toDateOnly(game.date);
        if (!gameDate || gameDate < fromDate) {
          return false;
        }

        if (toDate && gameDate > toDate) {
          return false;
        }
      }

      if (
        selectedTeams.length > 0 &&
        !selectedTeams.some((team) => isLikelyTeamMatch(team, game.home) || isLikelyTeamMatch(team, game.away))
      ) {
        return false;
      }

      return true;
    })
    .sort(sortGames);
}

function normalizeGames(input, options = {}) {
  const rows = Array.isArray(input) ? input : Array.isArray(input?.games) ? input.games : [];
  return rows.map((row, index) => normalizeGame(row, index, options)).filter(Boolean);
}

export {
  dedupeGames,
  filterGames,
  gameDedupKey,
  isLikelyTeamMatch,
  normalizeGame,
  normalizeGames,
  normalizeTeam,
  parseDate,
  sortGames,
  toTeamSearchKey,
  toDateOnly,
  toLookupKey,
};
