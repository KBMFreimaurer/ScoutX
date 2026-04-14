import { STORAGE_KEYS } from "../config/storage";

const KNOWN_TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function normalizeLookup(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeIsoDate(value) {
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

function normalizeTime(value) {
  const text = String(value || "").trim();
  return KNOWN_TIME_RE.test(text) ? text : "--:--";
}

function normalizeVenue(value) {
  return normalizeLookup(value || "sportanlage");
}

function normalizeGameSignature(game) {
  return [
    normalizeLookup(game?.home),
    normalizeLookup(game?.away),
    normalizeIsoDate(game?.date) || normalizeIsoDate(game?.dateObj),
    normalizeTime(game?.time),
    normalizeVenue(game?.venue),
  ].join("|");
}

export function buildScheduleFingerprint(games) {
  const safeGames = Array.isArray(games) ? games : [];
  if (safeGames.length === 0) {
    return "";
  }

  return safeGames
    .map(normalizeGameSignature)
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right))
    .join("\n");
}

export function buildScheduleScopeKey({ kreisId, jugendId, fromDate, toDate }) {
  const kreis = String(kreisId || "").trim();
  const jugend = String(jugendId || "").trim();
  const from = normalizeIsoDate(fromDate);
  const to = normalizeIsoDate(toDate) || from;

  if (!kreis || !jugend || !from) {
    return "";
  }

  return `${kreis}|${jugend}|${from}|${to}`;
}

export function readScheduleWatchState() {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.scheduleWatch);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    return parsed;
  } catch {
    return {};
  }
}

export function writeScheduleWatchState(state) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEYS.scheduleWatch, JSON.stringify(state || {}));
  } catch {
    // Ignore optional localStorage write errors.
  }
}
