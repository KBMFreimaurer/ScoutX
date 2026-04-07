import { CONTENT_TOP, sortGamesByDateTime } from "./layout";
import { buildFileName } from "./styles";
import {
  drawAnalysisPage,
  drawCover,
  drawGameDetails,
  drawHeaderFooter,
  drawRouteOverview,
  drawScheduleTable,
  extractReasonMap,
  parseRouteStops,
  sanitizePlanText,
} from "./sections";

const URL_REVOKE_DELAY_MS = 60 * 1000;
const activeBlobUrls = new Set();
let jsPdfCtorPromise = null;

export function buildPdf(JsPdfCtor, games, plan, cfg) {
  const normalizedGames = sortGamesByDateTime(Array.isArray(games) ? games : []);
  const topGames = [...normalizedGames].sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0)).slice(0, 5);
  const cleanedPlanText = sanitizePlanText(plan);
  const routeStops = parseRouteStops(cleanedPlanText, normalizedGames);
  const reasonMap = extractReasonMap(cleanedPlanText);
  const createdAt = new Date().toLocaleString("de-DE");

  const doc = new JsPdfCtor({
    unit: "mm",
    format: "a4",
    compress: true,
    putOnlyUsedFonts: true,
  });

  const state = { y: CONTENT_TOP, sections: ["Überblick"] };

  drawCover(doc, state, cfg, createdAt, normalizedGames, topGames, routeStops, reasonMap);
  drawRouteOverview(doc, state, cfg?.routeOverview, cfg?.startLocationLabel || cfg?.startLocation?.label || "Startort");
  drawScheduleTable(doc, state, normalizedGames, reasonMap);
  drawGameDetails(doc, state, normalizedGames);
  drawAnalysisPage(doc, state, cleanedPlanText);
  drawHeaderFooter(doc, state, cfg, createdAt);

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

export async function openScoutPdf(games, plan, cfg, popupWindow = null) {
  try {
    const JsPdfCtor = await loadJsPdfCtor();
    const doc = buildPdf(JsPdfCtor, games, plan, cfg);
    const blob = doc.output("blob");
    const blobUrl = URL.createObjectURL(blob);
    const fileName = buildFileName(cfg);

    trackBlobUrl(blobUrl);
    triggerDownload(blobUrl, fileName);

    if (popupWindow && !popupWindow.closed) {
      try {
        popupWindow.location.href = blobUrl;
        popupWindow.focus();
        return { ok: true };
      } catch {
        // Fall through to plain download-only behavior.
      }
    }

    return { ok: true };
  } catch (error) {
    const message = String(error?.message || error || "Unbekannter Fehler");
    return { ok: false, error: message };
  }
}
