import { toSafeString } from "./styles";

export const PAGE_WIDTH = 210;
export const MARGIN_X = 12;
export const CONTENT_TOP = 31;
export const CONTENT_BOTTOM = 280;

export function parseMinutes(timeValue) {
  const match = toSafeString(timeValue).match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

export function formatMinutes(totalMinutes) {
  if (!Number.isFinite(totalMinutes)) {
    return "--:--";
  }
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function timeSortKey(value) {
  const parsed = parseMinutes(value);
  if (!Number.isFinite(parsed)) {
    return "99:99";
  }
  return formatMinutes(parsed);
}

export function formatKickoffLabel(value) {
  const text = toSafeString(value);
  return Number.isFinite(parseMinutes(text)) ? `${text} Uhr` : "Anstoß offen";
}

export function parseDateValue(game) {
  if (game?.dateObj instanceof Date && !Number.isNaN(game.dateObj.getTime())) {
    return game.dateObj.getTime();
  }
  const raw = toSafeString(game?.date);
  if (raw) {
    const parsed = Date.parse(raw);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return Number.MAX_SAFE_INTEGER;
}

export function formatGameDate(game) {
  if (toSafeString(game?.dateLabel)) {
    return toSafeString(game.dateLabel);
  }
  if (toSafeString(game?.date)) {
    return toSafeString(game.date);
  }
  return "-";
}

export function sortGamesByDateTime(games) {
  return [...games].sort((left, right) => {
    const dateDelta = parseDateValue(left) - parseDateValue(right);
    if (dateDelta !== 0) {
      return dateDelta;
    }
    return timeSortKey(left.time).localeCompare(timeSortKey(right.time));
  });
}

export function addPage(state, doc, sectionTitle) {
  doc.addPage();
  state.y = CONTENT_TOP;
  state.sections[doc.getNumberOfPages() - 1] = sectionTitle;
}

export function ensureSpace(doc, state, requiredHeight, sectionOnNewPage, onPageBreak) {
  if (state.y + requiredHeight <= CONTENT_BOTTOM) {
    return;
  }
  addPage(state, doc, sectionOnNewPage || state.sections[state.sections.length - 1] || "Inhalt");
  if (typeof onPageBreak === "function") {
    onPageBreak();
  }
}
