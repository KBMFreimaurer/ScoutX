import { fetchGamesWithProviders, formatDate } from "./dataProvider";

const KNOWN_TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const UNKNOWN_TIME_RE = /^(?:--:--|\*{2}(?::\*{2})?|k\.?\s*a\.?|n\/a|unbekannt)$/i;

function normalizeLookup(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeTime(value) {
  const text = String(value || "").trim();
  if (KNOWN_TIME_RE.test(text)) {
    return text;
  }
  if (UNKNOWN_TIME_RE.test(text) || !text) {
    return "--:--";
  }
  return "--:--";
}

function toIsoDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }

  const text = String(value || "").trim();
  if (!text) {
    return "";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  if (/^\d{2}\.\d{2}\.\d{4}$/.test(text)) {
    const [day, month, year] = text.split(".").map(Number);
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
}

function parseIsoDate(isoDate) {
  const match = String(isoDate || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function normalizeKreisIdsForSync(syncContext) {
  const ids = [];
  const seen = new Set();
  const values = Array.isArray(syncContext?.kreisIds) ? syncContext.kreisIds : [];

  for (const value of values) {
    const id = String(value || "").trim();
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    ids.push(id);
  }

  const fallback = String(syncContext?.kreisId || "").trim();
  if (ids.length === 0 && fallback) {
    ids.push(fallback);
  }

  return ids;
}

function buildAuthoritativeMergeKey(game, fallbackIndex) {
  const home = normalizeLookup(game?.home);
  const away = normalizeLookup(game?.away);
  const date = toIsoDate(game?.date) || toIsoDate(game?.dateObj);
  const time = normalizeTime(game?.time);
  const venue = normalizeLookup(game?.venue);

  if (!home || !away || !date) {
    return `fallback-${fallbackIndex}`;
  }

  return `${home}|${away}|${date}|${time}|${venue}`;
}

function mergeAuthoritativeGames(gamesByKreis) {
  const mergedByKey = new Map();
  let fallbackIndex = 0;

  for (const games of Array.isArray(gamesByKreis) ? gamesByKreis : []) {
    for (const game of Array.isArray(games) ? games : []) {
      const key = buildAuthoritativeMergeKey(game, fallbackIndex);
      fallbackIndex += 1;
      if (!mergedByKey.has(key)) {
        mergedByKey.set(key, game);
      }
    }
  }

  return Array.from(mergedByKey.values());
}

function getWeekRange(isoDate) {
  const date = parseIsoDate(isoDate);
  if (!date) {
    throw new Error("Ungültiges Startdatum für Live-Abgleich.");
  }

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

function gameKey(game) {
  return `${normalizeLookup(game?.home)}|${normalizeLookup(game?.away)}|${toIsoDate(game?.date) || toIsoDate(game?.dateObj)}`;
}

function reverseGameKey(game) {
  return `${normalizeLookup(game?.away)}|${normalizeLookup(game?.home)}|${toIsoDate(game?.date) || toIsoDate(game?.dateObj)}`;
}

function toUiDate(isoDate) {
  const parsed = parseIsoDate(isoDate);
  return parsed ? formatDate(parsed) : isoDate;
}

function describeFieldChange(field, beforeValue, afterValue) {
  if (field === "time") {
    return `Anstoßzeit: ${beforeValue || "--:--"} -> ${afterValue || "--:--"}`;
  }

  if (field === "date") {
    return `Datum: ${toUiDate(beforeValue || "")} -> ${toUiDate(afterValue || "")}`;
  }

  if (field === "venue") {
    return `Spielort: ${beforeValue || "-"} -> ${afterValue || "-"}`;
  }

  return `${field}: ${beforeValue || "-"} -> ${afterValue || "-"}`;
}

export function isAdapterSyncContext(syncContext) {
  return String(syncContext?.source || "")
    .toLowerCase()
    .trim() === "adapter";
}

export function applyAuthoritativeGameCorrections(games, authoritativeGames) {
  const safeGames = Array.isArray(games) ? games : [];
  const safeAuthoritativeGames = Array.isArray(authoritativeGames) ? authoritativeGames : [];

  const byId = new Map();
  const byKey = new Map();
  for (const game of safeAuthoritativeGames) {
    const id = String(game?.id || "").trim();
    if (id) {
      byId.set(id, game);
    }
    byKey.set(gameKey(game), game);
    byKey.set(reverseGameKey(game), game);
  }

  const changes = [];
  let missingCount = 0;
  const correctedGames = safeGames.map((game) => {
    const id = String(game?.id || "").trim();
    const authoritative =
      (id ? byId.get(id) : null) || byKey.get(gameKey(game)) || byKey.get(reverseGameKey(game)) || null;

    if (!authoritative) {
      missingCount += 1;
      return game;
    }

    const patched = { ...game };
    const before = {
      time: normalizeTime(game?.time),
      date: toIsoDate(game?.date) || toIsoDate(game?.dateObj),
      venue: String(game?.venue || "").trim(),
    };

    const expectedTime = normalizeTime(authoritative?.time);
    const expectedDate = toIsoDate(authoritative?.date) || toIsoDate(authoritative?.dateObj);
    const expectedVenue = String(authoritative?.venue || "").trim();

    const changedFields = [];

    if (expectedTime !== before.time) {
      patched.time = expectedTime;
      changedFields.push("time");
    }

    if (expectedDate && expectedDate !== before.date) {
      const nextDateObj = parseIsoDate(expectedDate);
      patched.date = expectedDate;
      if (nextDateObj) {
        patched.dateObj = nextDateObj;
        patched.dateLabel = formatDate(nextDateObj);
      }
      changedFields.push("date");
    }

    if (expectedVenue && expectedVenue !== before.venue) {
      patched.venue = expectedVenue;
      changedFields.push("venue");
    }

    if (changedFields.length === 0) {
      return game;
    }

    const after = {
      time: normalizeTime(patched?.time),
      date: toIsoDate(patched?.date) || toIsoDate(patched?.dateObj),
      venue: String(patched?.venue || "").trim(),
    };

    changes.push({
      id: String(game?.id || "").trim(),
      home: String(game?.home || "").trim(),
      away: String(game?.away || "").trim(),
      changedFields,
      details: changedFields.map((field) => describeFieldChange(field, before[field], after[field])),
      before,
      after,
    });

    return patched;
  });

  const correctedCount = changes.length;
  return {
    games: correctedGames,
    correctedCount,
    changes,
    missingCount,
    checkedCount: safeGames.length,
  };
}

export async function fetchAuthoritativeGamesForSync(syncContext) {
  const adapterEndpoint = String(syncContext?.adapterEndpoint || "").trim();
  const kreisIds = normalizeKreisIdsForSync(syncContext);
  const jugendId = String(syncContext?.jugendId || "").trim();
  const fromDate = String(syncContext?.fromDate || "").trim();
  const toDate = String(syncContext?.toDate || "").trim();
  const adapterToken = String(syncContext?.adapterToken || "").trim();
  const teams = Array.isArray(syncContext?.teams) ? syncContext.teams : [];

  if (!adapterEndpoint || kreisIds.length === 0 || !jugendId || !fromDate) {
    throw new Error("Live-Abgleich unvollständig konfiguriert (Adapter/Kreis/Jugend/Datum).");
  }

  const weekRange = getWeekRange(fromDate);
  const requestedToDate = toDate || weekRange.toDate;

  const results = await Promise.all(
    kreisIds.map((kreisId) =>
      fetchGamesWithProviders({
        mode: "adapter",
        kreisId,
        jugendId,
        fromDate,
        toDate: requestedToDate,
        teams,
        uploadedGames: [],
        adapterEndpoint,
        adapterToken,
        turnier: Boolean(syncContext?.turnier),
        retryDelaysMs: [],
      }),
    ),
  );

  return mergeAuthoritativeGames(results.map((result) => (Array.isArray(result?.games) ? result.games : [])));
}

function withTimeout(promise, timeoutMs, fallbackValue) {
  const safeTimeout = Number(timeoutMs);
  if (!Number.isFinite(safeTimeout) || safeTimeout <= 0) {
    return Promise.resolve(promise).catch(() => fallbackValue);
  }

  return new Promise((resolve) => {
    let settled = false;
    const timer = globalThis.setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(fallbackValue);
    }, safeTimeout);

    Promise.resolve(promise)
      .then((value) => {
        if (settled) {
          return;
        }
        settled = true;
        globalThis.clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        if (settled) {
          return;
        }
        settled = true;
        globalThis.clearTimeout(timer);
        resolve(fallbackValue);
      });
  });
}

export async function checkPlanConsistency(games, syncContext, timeoutMs = 9000) {
  if (!isAdapterSyncContext(syncContext)) {
    return {
      ok: false,
      reason: "unsupported-source",
      message: "Konsistenzprüfung ist nur für Live-Adapter-Pläne verfügbar.",
    };
  }

  const authoritativeGames = await withTimeout(fetchAuthoritativeGamesForSync(syncContext), timeoutMs, null);
  if (!Array.isArray(authoritativeGames)) {
    throw new Error(`Live-Abgleich Timeout nach ${timeoutMs}ms.`);
  }

  const result = applyAuthoritativeGameCorrections(games, authoritativeGames);
  return {
    ok: true,
    checkedAt: new Date().toISOString(),
    authoritativeCount: authoritativeGames.length,
    ...result,
  };
}
