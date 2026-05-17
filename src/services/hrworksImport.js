import { STORAGE_KEYS } from "../config/storage";

const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
export const HRWORKS_IMPORT_STATUSES = ["draft", "ready", "imported", "failed", "skipped", "needs_review"];

function truncateText(value, maxLength = 80) {
  const text = String(value || "").trim();
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}…`;
}

function redactSensitiveText(value) {
  const text = String(value || "");
  if (!text.trim()) {
    return "";
  }

  return text
    .replace(/(password\s*[=:]\s*)(\S+)/gi, "$1[redacted]")
    .replace(/(passwort\s*[=:]\s*)(\S+)/gi, "$1[redacted]")
    .replace(/(bearer\s+)([a-z0-9._~+/=-]+)/gi, "$1[redacted]")
    .replace(/(token\s*[=:]\s*)(\S+)/gi, "$1[redacted]")
    .replace(/\b[a-z0-9._~+/=-]{20,}\b/gi, "[redacted]")
    .trim();
}

function anonymizeActor(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }
  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return `${parts[0][0]}***`;
  }
  return `${parts[0][0]}*** ${parts[parts.length - 1][0]}***`;
}

function toDateOnly(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const text = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(text)) {
    const [dd, mm, yyyy] = text.split(".");
    return `${yyyy}-${mm}-${dd}`;
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return parsed.toISOString().slice(0, 10);
}

function toMinutes(timeValue) {
  const text = String(timeValue || "").trim();
  if (!TIME_RE.test(text)) {
    return null;
  }
  const [hour, minute] = text.split(":").map(Number);
  return hour * 60 + minute;
}

function normalizeTime(timeValue) {
  const text = String(timeValue || "").trim();
  return TIME_RE.test(text) ? text : "";
}

function calcRange(games) {
  const sorted = [...games].sort((a, b) => {
    const da = new Date(a.date).getTime();
    const db = new Date(b.date).getTime();
    if (da !== db) {
      return da - db;
    }
    return (toMinutes(a.startTime) ?? Number.MAX_SAFE_INTEGER) - (toMinutes(b.startTime) ?? Number.MAX_SAFE_INTEGER);
  });

  const first = sorted[0] || null;
  const last = sorted[sorted.length - 1] || null;
  if (!first || !last) {
    return { date: "", startTime: "", endTime: "", destinationLocation: "" };
  }

  return {
    date: first.date,
    startTime: first.startTime,
    endTime: last.endTime || first.endTime,
    destinationLocation: first.destinationLocation || "",
  };
}

function buildSourceGames(games) {
  return [...games]
    .map((game, index) => {
      const date = toDateOnly(game?.dateObj || game?.date);
      const startTime = normalizeTime(game?.time);
      const endTime = normalizeTime(game?.endTime || game?.timeEnd);
      return {
        id: String(game?.id || `game-${index}`),
        home: String(game?.home || "").trim(),
        away: String(game?.away || "").trim(),
        venue: String(game?.venue || "").trim(),
        date,
        startTime,
        endTime,
      };
    })
    .filter((game) => game.date);
}

export function buildHrworksImportPayload({
  planId,
  employeeName,
  games,
  startLocation,
  costCenter,
  note,
  purpose,
  breakStart,
  breakEnd,
  intermediateStops,
}) {
  const sourceGames = buildSourceGames(games);
  const withEnd = sourceGames.map((game) => {
    if (game.endTime) {
      return game;
    }
    const startMinutes = toMinutes(game.startTime);
    if (!Number.isFinite(startMinutes)) {
      return game;
    }
    const endMinutes = Math.min(startMinutes + 120, 23 * 60 + 59);
    const h = String(Math.floor(endMinutes / 60)).padStart(2, "0");
    const m = String(endMinutes % 60).padStart(2, "0");
    return { ...game, endTime: `${h}:${m}` };
  });

  const range = calcRange(
    withEnd.map((game) => ({
      ...game,
      destinationLocation: game.venue,
    })),
  );

  const gameLabels = withEnd.map((game) => `${game.home} - ${game.away}`).filter(Boolean);
  const nowIso = new Date().toISOString();
  const fallbackPurpose = gameLabels.length > 0 ? `Sichtung / (${gameLabels.join(" - ")})` : "Sichtung";
  const fallbackNote = gameLabels.length > 0 ? `Sichtung / (${gameLabels.join(" → ")})` : "Sichtung";

  const rawHours = Number.isFinite(toMinutes(range.endTime)) && Number.isFinite(toMinutes(range.startTime))
    ? ((toMinutes(range.endTime) - toMinutes(range.startTime)) / 60)
    : null;

  return {
    planId: String(planId || "").trim() || `plan-${nowIso}`,
    employeeName: String(employeeName || "").trim(),
    date: range.date,
    startTime: range.startTime,
    endTime: range.endTime,
    breakStart: normalizeTime(breakStart),
    breakEnd: normalizeTime(breakEnd),
    workHours: Number.isFinite(rawHours) && rawHours > 0 ? Number(rawHours.toFixed(2)) : null,
    purpose: String(purpose || "").trim() || fallbackPurpose,
    note: String(note || "").trim() || fallbackNote,
    departureLocation: String(startLocation || "").trim(),
    destinationLocation: String(range.destinationLocation || "").trim(),
    intermediateStops: Array.isArray(intermediateStops)
      ? intermediateStops.map((item) => String(item || "").trim()).filter(Boolean)
      : withEnd.slice(1, -1).map((game) => game.venue).filter(Boolean),
    costCenter: String(costCenter || "").trim(),
    travelExpenseRequired: true,
    receiptsRequired: false,
    sourceGames: withEnd,
    status: "draft",
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export function validateHrworksImportPayload(payload, existingImports = [], options = {}) {
  const errors = [];
  const normalized = payload && typeof payload === "object" ? payload : {};
  const required = options?.requiredFields && typeof options.requiredFields === "object"
    ? options.requiredFields
    : {};

  if (!toDateOnly(normalized.date)) {
    errors.push("Datum fehlt oder ist ungültig.");
  }
  if (!TIME_RE.test(String(normalized.startTime || ""))) {
    errors.push("Beginn fehlt oder ist ungültig (HH:mm).");
  }
  if (!TIME_RE.test(String(normalized.endTime || ""))) {
    errors.push("Ende fehlt oder ist ungültig (HH:mm).");
  }

  const startMinutes = toMinutes(normalized.startTime);
  const endMinutes = toMinutes(normalized.endTime);
  if (Number.isFinite(startMinutes) && Number.isFinite(endMinutes) && startMinutes >= endMinutes) {
    errors.push("Beginn muss vor Ende liegen.");
  }

  const hours = Number(normalized.workHours);
  if (!Number.isFinite(hours)) {
    errors.push("Arbeitsstunden sind nicht berechenbar.");
  } else if (hours < 0) {
    errors.push("Arbeitsstunden dürfen nicht negativ sein.");
  }

  if (required.purpose !== false && !String(normalized.purpose || "").trim()) {
    errors.push("Zweck fehlt.");
  }
  if (required.note !== false && !String(normalized.note || "").trim()) {
    errors.push("Bemerkung fehlt.");
  }
  if (required.departureLocation !== false && !String(normalized.departureLocation || "").trim()) {
    errors.push("Abfahrtsort fehlt.");
  }
  if (required.destinationLocation !== false && !String(normalized.destinationLocation || "").trim()) {
    errors.push("Zielort fehlt.");
  }
  if (required.costCenter !== false && !String(normalized.costCenter || "").trim()) {
    errors.push("Kostenstelle fehlt.");
  }

  const duplicate = findDuplicateImport(normalized, existingImports);
  if (duplicate) {
    errors.push(`Möglicher Duplikat-Import gefunden (${duplicate.importedAt || duplicate.createdAt || "unbekannt"}).`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    duplicate,
  };
}

export function findDuplicateImport(payload, existingImports = []) {
  const planId = String(payload?.planId || "").trim();
  const date = toDateOnly(payload?.date);
  const startTime = normalizeTime(payload?.startTime);
  const endTime = normalizeTime(payload?.endTime);

  if (!planId || !date || !startTime || !endTime) {
    return null;
  }

  return (Array.isArray(existingImports) ? existingImports : []).find((entry) => {
    const entryPlanId = String(entry?.planId || "").trim();
    const entryDate = toDateOnly(entry?.date);
    const samePlanSameDay = entryPlanId === planId && entryDate === date;
    const sameTimeWindow = entryDate === date
      && normalizeTime(entry?.startTime) === startTime
      && normalizeTime(entry?.endTime) === endTime;
    return samePlanSameDay || sameTimeWindow;
  }) || null;
}

export function readHrworksImportLog() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.hrworksImports);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function appendHrworksImportLog(entry) {
  if (typeof window === "undefined") {
    return;
  }

  const current = readHrworksImportLog();
  const status = String(entry?.hrworksStatus || "draft");
  const normalizedStatus = HRWORKS_IMPORT_STATUSES.includes(status) ? status : "draft";
  const next = [
    {
      id: String(entry?.id || `${Date.now()}-${Math.random()}`),
      planId: String(entry?.planId || ""),
      date: toDateOnly(entry?.date),
      startTime: normalizeTime(entry?.startTime),
      endTime: normalizeTime(entry?.endTime),
      purpose: truncateText(entry?.purpose, 120),
      hrworksStatus: normalizedStatus,
      importedAt: String(entry?.importedAt || new Date().toISOString()),
      executedBy: anonymizeActor(entry?.executedBy),
      technicalResult: truncateText(redactSensitiveText(entry?.technicalResult), 240),
      errorMessage: truncateText(redactSensitiveText(entry?.errorMessage), 240),
      hrworksReference: truncateText(entry?.hrworksReference, 120),
    },
    ...current,
  ].slice(0, 200);

  window.localStorage.setItem(STORAGE_KEYS.hrworksImports, JSON.stringify(next));
}
