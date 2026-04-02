import { parseDate } from "./games.js";

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getWeekRange(fromDateIso) {
  const parsed = parseDate(String(fromDateIso || ""));
  if (!parsed) {
    return null;
  }

  const date = new Date(parsed);
  date.setHours(0, 0, 0, 0);

  // Monday-based week
  const weekday = (date.getDay() + 6) % 7;
  const weekStart = addDays(date, -weekday);
  const weekEnd = addDays(weekStart, 6);

  const fromDate = toIsoDate(weekStart);
  const toDate = toIsoDate(weekEnd);

  return {
    fromDate,
    toDate,
    weekKey: `${fromDate}_${toDate}`,
  };
}

function isDateInRange(dateIso, range) {
  const date = parseDate(String(dateIso || ""));
  if (!date || !range) {
    return false;
  }

  const left = parseDate(range.fromDate);
  const right = parseDate(range.toDate);

  if (!left || !right) {
    return false;
  }

  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  left.setHours(0, 0, 0, 0);
  right.setHours(0, 0, 0, 0);

  return normalized >= left && normalized <= right;
}

function buildWeekCacheKey(payload, range) {
  const kreis = String(payload?.kreisId || "*");
  const jugend = String(payload?.jugendId || "*");
  return `${kreis}|${jugend}|${range?.weekKey || "invalid"}`;
}

function shouldRefreshWeek(lastRefreshMs, nowMs, ttlSec) {
  if (!Number.isFinite(lastRefreshMs) || lastRefreshMs <= 0) {
    return true;
  }

  if (!Number.isFinite(ttlSec) || ttlSec <= 0) {
    return true;
  }

  const ageMs = nowMs - lastRefreshMs;
  return ageMs >= ttlSec * 1000;
}

export { addDays, buildWeekCacheKey, getWeekRange, isDateInRange, shouldRefreshWeek, toIsoDate };
