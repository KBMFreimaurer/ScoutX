import { CONTENT_TOP, sortGamesByDateTime } from "./layout";
import { buildFileName } from "./styles";
import { calculateDirectStartRoutes, calculateRouteWithDriving } from "../../utils/geo";
import { drawGamesOverviewPage, drawFahrtkostenPage, drawHeaderFooter } from "./sections";
import {
  applyAuthoritativeGameCorrections,
  fetchAuthoritativeGamesForSync,
  isAdapterSyncContext,
} from "../liveConsistency";

export { applyAuthoritativeGameCorrections };

const URL_REVOKE_DELAY_MS = 60 * 1000;
const PREVIEW_URL_REVOKE_DELAY_MS = 10 * 60 * 1000;
const ROUTE_REFRESH_TIMEOUT_MS = Number(import.meta.env?.VITE_PDF_ROUTE_REFRESH_TIMEOUT_MS || 60000);
const AUTHORITATIVE_SYNC_TIMEOUT_MS = Math.max(2000, Number(import.meta.env?.VITE_PDF_SYNC_TIMEOUT_MS || 8000));
const activeBlobUrls = new Set();
let jsPdfCtorPromise = null;

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

async function prepareGamesForPdf(games, syncContext) {
  if (!isAdapterSyncContext(syncContext)) {
    return { games: Array.isArray(games) ? games : [], correctedCount: 0 };
  }

  const authoritativeGames = await withTimeout(fetchAuthoritativeGamesForSync(syncContext), AUTHORITATIVE_SYNC_TIMEOUT_MS, []);
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
  drawFahrtkostenPage(doc, state, normalizedGames, cfgWithBuild);
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

function trackBlobUrl(url, delayMs = URL_REVOKE_DELAY_MS) {
  activeBlobUrls.add(url);
  window.setTimeout(() => {
    revokeTrackedBlobUrl(url);
  }, delayMs);
}

export function revokeTrackedBlobUrl(url) {
  if (activeBlobUrls.has(url)) {
    URL.revokeObjectURL(url);
    activeBlobUrls.delete(url);
  }
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
      : withTimeout(
          calculateDirectStartRoutes(startLocation, routeGames, directExpectedCount),
          ROUTE_REFRESH_TIMEOUT_MS,
          [],
        ),
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

export async function openScoutPdf(games, _plan, cfg, popupWindow = null, syncContext = null, options = null) {
  try {
    const previewMode = String(options?.mode || "").toLowerCase() === "preview";
    const prepared = await prepareGamesForPdf(games, syncContext);
    const JsPdfCtor = await loadJsPdfCtor();
    const routeEnrichedCfg = await enrichPdfRouteData(cfg, prepared.games);
    const doc = buildPdf(JsPdfCtor, prepared.games, routeEnrichedCfg);
    const blob = doc.output("blob");
    const blobUrl = URL.createObjectURL(blob);
    const fileName = buildFileName(routeEnrichedCfg);

    trackBlobUrl(blobUrl, previewMode ? PREVIEW_URL_REVOKE_DELAY_MS : URL_REVOKE_DELAY_MS);

    if (previewMode) {
      return {
        ok: true,
        correctedCount: prepared.correctedCount,
        previewUrl: blobUrl,
        fileName,
        download: () => triggerDownload(blobUrl, fileName),
        revoke: () => revokeTrackedBlobUrl(blobUrl),
      };
    }

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
