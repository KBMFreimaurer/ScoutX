import { CONTENT_TOP, sortGamesByDateTime } from "./layout";
import { fetchGamesWithProviders } from "../dataProvider";
import { buildFileName } from "./styles";
import { calculateDirectStartRoutes, calculateRouteWithDriving } from "../../utils/geo";
import {
  drawGamesOverviewPage,
  drawHeaderFooter,
  drawRouteCalculationPage,
} from "./sections";

const URL_REVOKE_DELAY_MS = 60 * 1000;
const ROUTE_REFRESH_TIMEOUT_MS = Number(import.meta.env?.VITE_PDF_ROUTE_REFRESH_TIMEOUT_MS || 12000);
const activeBlobUrls = new Set();
let jsPdfCtorPromise = null;
const KNOWN_TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const UNKNOWN_TIME_RE = /^(?:--:--|\*{2}(?::\*{2})?|k\.?\s*a\.?|n\/a|unbekannt)$/i;

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

export function hasCompleteRouteOverview(routeOverview, expectedStopCount) {
  if (!routeOverview || !Array.isArray(routeOverview.legs)) {
    return false;
  }
  const expectedLegs = Math.max(1, Math.min(5, expectedStopCount) + 1);
  return routeOverview.legs.length >= expectedLegs;
}

export function hasCompleteDirectRoutes(routeDirectOptions, expectedStopCount) {
  if (!Array.isArray(routeDirectOptions)) {
    return false;
  }
  const expectedRows = Math.max(0, Math.min(5, expectedStopCount));
  return routeDirectOptions.length >= expectedRows;
}

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

function getWeekRange(isoDate) {
  const match = String(isoDate || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error("Ungültiges Startdatum für Live-Abgleich.");
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

function shouldSyncWithAdapter(syncContext) {
  return String(syncContext?.source || "").toLowerCase() === "adapter";
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

  const correctedGames = safeGames.map((game) => {
    const id = String(game?.id || "").trim();
    const authoritative =
      (id ? byId.get(id) : null) || byKey.get(gameKey(game)) || byKey.get(reverseGameKey(game)) || null;

    if (!authoritative) {
      return game;
    }

    const patched = { ...game };
    let changed = false;

    const expectedTime = normalizeTime(authoritative.time);
    const currentTime = normalizeTime(game.time);
    if (expectedTime !== currentTime) {
      patched.time = expectedTime;
      changed = true;
    }

    const expectedVenue = String(authoritative?.venue || "").trim();
    const currentVenue = String(game?.venue || "").trim();
    if (expectedVenue && expectedVenue !== currentVenue) {
      patched.venue = expectedVenue;
      changed = true;
    }

    return changed ? patched : game;
  });

  const correctedCount = correctedGames.reduce((count, game, index) => (game !== safeGames[index] ? count + 1 : count), 0);
  return {
    games: correctedGames,
    correctedCount,
  };
}

async function fetchAuthoritativeGames(syncContext) {
  const adapterEndpoint = String(syncContext?.adapterEndpoint || "").trim();
  const kreisId = String(syncContext?.kreisId || "").trim();
  const jugendId = String(syncContext?.jugendId || "").trim();
  const fromDate = String(syncContext?.fromDate || "").trim();
  const adapterToken = String(syncContext?.adapterToken || "").trim();
  const teams = Array.isArray(syncContext?.teams) ? syncContext.teams : [];

  if (!adapterEndpoint || !kreisId || !jugendId || !fromDate) {
    throw new Error("Live-Abgleich unvollständig konfiguriert (Adapter/Kreis/Jugend/Datum).");
  }
  const weekRange = getWeekRange(fromDate);

  const result = await fetchGamesWithProviders({
    mode: "adapter",
    kreisId,
    jugendId,
    fromDate: weekRange.fromDate,
    toDate: weekRange.toDate,
    teams,
    uploadedGames: [],
    adapterEndpoint,
    adapterToken,
    turnier: Boolean(syncContext?.turnier),
  });

  return Array.isArray(result?.games) ? result.games : [];
}

async function prepareGamesForPdf(games, syncContext) {
  if (!shouldSyncWithAdapter(syncContext)) {
    return { games: Array.isArray(games) ? games : [], correctedCount: 0 };
  }

  const authoritativeGames = await fetchAuthoritativeGames(syncContext);
  return applyAuthoritativeGameCorrections(games, authoritativeGames);
}

export function buildPdf(JsPdfCtor, games, cfg) {
  const normalizedGames = sortGamesByDateTime(Array.isArray(games) ? games : []);
  const createdAt = new Date().toLocaleString("de-DE");
  const buildId =
    typeof globalThis.__SCOUTX_BUILD_ID__ === "string" && globalThis.__SCOUTX_BUILD_ID__.trim()
      ? globalThis.__SCOUTX_BUILD_ID__.trim()
      : "unknown";
  const cfgWithBuild = {
    ...(cfg || {}),
    pdfBuildId: buildId,
  };

  const doc = new JsPdfCtor({
    unit: "mm",
    format: "a4",
    compress: true,
    putOnlyUsedFonts: true,
  });

  const state = { y: CONTENT_TOP, sections: ["Überblick"] };

  drawGamesOverviewPage(doc, state, cfgWithBuild, createdAt, normalizedGames);
  drawRouteCalculationPage(
    doc,
    state,
    cfgWithBuild?.routeOverview,
    cfgWithBuild?.startLocationLabel || cfgWithBuild?.startLocation?.label || "Startort",
    normalizedGames,
    cfgWithBuild?.routeDirectOptions,
  );
  drawHeaderFooter(doc, state, cfgWithBuild, createdAt);

  return doc;
}

export async function loadJsPdfCtor() {
  if (!jsPdfCtorPromise) {
    jsPdfCtorPromise = import("jspdf")
      .then((module) => module.jsPDF)
      .catch((error) => {
        jsPdfCtorPromise = null;
        throw error;
      });
  }

  return jsPdfCtorPromise;
}

function trackBlobUrl(url) {
  activeBlobUrls.add(url);
  window.setTimeout(() => {
    if (activeBlobUrls.has(url)) {
      URL.revokeObjectURL(url);
      activeBlobUrls.delete(url);
    }
  }, URL_REVOKE_DELAY_MS);
}

function triggerDownload(url, fileName) {
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function enrichPdfRouteData(cfg, games) {
  const sortedGames = sortGamesByDateTime(Array.isArray(games) ? games : []);
  const startLocation = cfg?.startLocation;
  if (!startLocation || sortedGames.length === 0) {
    return cfg;
  }

  let nextCfg = { ...(cfg || {}) };
  const directExpectedCount = Math.min(5, sortedGames.length);
  const routeGames = sortedGames.slice(0, directExpectedCount);
  const hasOverview = hasCompleteRouteOverview(nextCfg?.routeOverview, directExpectedCount);
  const hasDirectRoutes = hasCompleteDirectRoutes(nextCfg?.routeDirectOptions, directExpectedCount);

  if (hasOverview && hasDirectRoutes) {
    return nextCfg;
  }

  const [refreshedDirectRows, refreshedOverview] = await Promise.all([
    hasDirectRoutes
      ? Promise.resolve(nextCfg?.routeDirectOptions || [])
      : withTimeout(calculateDirectStartRoutes(startLocation, routeGames, directExpectedCount), ROUTE_REFRESH_TIMEOUT_MS, []),
    hasOverview
      ? Promise.resolve(nextCfg?.routeOverview || null)
      : withTimeout(calculateRouteWithDriving(startLocation, routeGames), ROUTE_REFRESH_TIMEOUT_MS, null),
  ]);

  nextCfg = {
    ...nextCfg,
    routeDirectOptions: Array.isArray(refreshedDirectRows) ? refreshedDirectRows : nextCfg?.routeDirectOptions || [],
    routeOverview:
      refreshedOverview && Array.isArray(refreshedOverview.legs) && refreshedOverview.legs.length > 0
        ? refreshedOverview
        : nextCfg?.routeOverview || null,
  };

  return nextCfg;
}

export async function openScoutPdf(games, _plan, cfg, popupWindow = null, syncContext = null) {
  try {
    const prepared = await prepareGamesForPdf(games, syncContext);
    const JsPdfCtor = await loadJsPdfCtor();
    const routeEnrichedCfg = await enrichPdfRouteData(cfg, prepared.games);
    const doc = buildPdf(JsPdfCtor, prepared.games, routeEnrichedCfg);
    const blob = doc.output("blob");
    const blobUrl = URL.createObjectURL(blob);
    const fileName = buildFileName(routeEnrichedCfg);

    trackBlobUrl(blobUrl);
    triggerDownload(blobUrl, fileName);

    if (popupWindow && !popupWindow.closed) {
      try {
        popupWindow.location.href = blobUrl;
        popupWindow.focus();
        return { ok: true, correctedCount: prepared.correctedCount };
      } catch {
        // Fall through to plain download-only behavior.
      }
    }

    return { ok: true, correctedCount: prepared.correctedCount };
  } catch (error) {
    const message = String(error?.message || error || "Unbekannter Fehler");
    return { ok: false, error: message };
  }
}
