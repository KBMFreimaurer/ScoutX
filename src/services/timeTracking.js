import { normalizePresenceMinutes } from "../utils/arbeitszeit";

function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function roundTo(value, digits = 1) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function parseDateInput(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }

  const text = String(value || "").trim();
  if (!text) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [year, month, day] = text.split("-").map(Number);
    const parsed = new Date(year, month - 1, day);
    return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day ? parsed : null;
  }

  if (/^\d{2}\.\d{2}\.\d{4}$/.test(text)) {
    const [day, month, year] = text.split(".").map(Number);
    const parsed = new Date(year, month - 1, day);
    return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day ? parsed : null;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toDateKey(value) {
  const parsed = parseDateInput(value);
  if (!parsed) {
    return "";
  }
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
}

function getGameDateKey(game) {
  return toDateKey(game?.date) || toDateKey(game?.dateObj);
}

function getGameMonthKey(game) {
  const dateKey = getGameDateKey(game);
  return dateKey ? dateKey.slice(0, 7) : "";
}

function getKmRate(entry, defaultKmRate) {
  const metaRate = toFiniteNumber(entry?.meta?.kmPauschale);
  if (Number.isFinite(metaRate) && metaRate > 0) {
    return metaRate;
  }
  return Number.isFinite(defaultKmRate) && defaultKmRate > 0 ? defaultKmRate : 0.3;
}

function resolveOneWayDistanceKm(game) {
  const fromStart = toFiniteNumber(game?.fromStartRouteDistanceKm);
  if (Number.isFinite(fromStart) && fromStart > 0) {
    return fromStart;
  }

  const distance = toFiniteNumber(game?.distanceKm);
  if (Number.isFinite(distance) && distance > 0) {
    return distance;
  }

  return null;
}

function formatDateLabel(dateKey) {
  const parsed = parseDateInput(dateKey);
  if (!parsed) {
    return "Ohne Datum";
  }
  return parsed.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatMonthLabel(monthKey) {
  const text = String(monthKey || "").trim();
  if (!/^\d{4}-\d{2}$/.test(text)) {
    return "Ohne Monat";
  }
  const [year, month] = text.split("-").map(Number);
  const parsed = new Date(year, month - 1, 1);
  if (Number.isNaN(parsed.getTime())) {
    return text;
  }
  return parsed.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
}

export function formatDuration(minutes) {
  const normalized = normalizePresenceMinutes(minutes);
  if (!Number.isFinite(normalized)) {
    return "offen";
  }
  const hours = Math.floor(normalized / 60);
  const rest = normalized % 60;
  if (hours <= 0) {
    return `${rest} Min`;
  }
  return rest > 0 ? `${hours} h ${rest} Min` : `${hours} h`;
}

export function formatCurrency(value) {
  const amount = Number.isFinite(Number(value)) ? Number(value) : 0;
  return `${amount.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

export function buildTimeTrackingModel(planHistory, options = {}) {
  const defaultKmRate = Number(options.defaultKmRate);
  const entries = [];
  const monthMap = new Map();

  for (const historyEntry of Array.isArray(planHistory) ? planHistory : []) {
    const games = Array.isArray(historyEntry?.games) ? historyEntry.games : [];
    const presenceByGame = historyEntry?.presenceByGame && typeof historyEntry.presenceByGame === "object" ? historyEntry.presenceByGame : {};
    const rate = getKmRate(historyEntry, defaultKmRate);

    for (const [index, game] of games.entries()) {
      const id = String(game?.id || `game-${index}`).trim();
      const dateKey = getGameDateKey(game);
      const monthKey = getGameMonthKey(game) || "ohne-monat";
      const minutes = normalizePresenceMinutes(presenceByGame[id]);
      const tracked = Number.isFinite(minutes);
      const oneWayDistanceKm = resolveOneWayDistanceKm(game);
      const roundtripKm = Number.isFinite(oneWayDistanceKm) ? oneWayDistanceKm * 2 : null;
      const fuelEur = tracked && Number.isFinite(roundtripKm) ? roundtripKm * rate : 0;
      const item = {
        id: `${historyEntry?.id || "history"}:${id}:${index}`,
        historyId: String(historyEntry?.id || ""),
        gameId: id,
        dateKey,
        dateLabel: formatDateLabel(dateKey),
        monthKey,
        monthLabel: formatMonthLabel(monthKey),
        timeLabel: String(game?.time || "").trim() || "--:--",
        matchLabel: `${String(game?.home || "—").trim()} vs ${String(game?.away || "—").trim()}`,
        venueLabel: String(game?.venue || "Sportanlage").trim() || "Sportanlage",
        scoutName: String(historyEntry?.meta?.scoutName || "").trim(),
        kreisLabel: String(historyEntry?.meta?.kreisLabel || "").trim(),
        jugendLabel: String(historyEntry?.meta?.jugendLabel || "").trim(),
        minutes: tracked ? minutes : null,
        tracked,
        oneWayDistanceKm: Number.isFinite(oneWayDistanceKm) ? roundTo(oneWayDistanceKm, 1) : null,
        roundtripKm: Number.isFinite(roundtripKm) ? roundTo(roundtripKm, 1) : null,
        kmRate: rate,
        fuelEur: roundTo(fuelEur, 2),
        hasDistance: Number.isFinite(roundtripKm),
      };
      entries.push(item);

      const month = monthMap.get(monthKey) || {
        monthKey,
        monthLabel: formatMonthLabel(monthKey),
        sessionCount: 0,
        trackedCount: 0,
        openCount: 0,
        totalMinutes: 0,
        totalRoundtripKm: 0,
        totalFuelEur: 0,
        missingDistanceCount: 0,
      };
      month.sessionCount += 1;
      if (tracked) {
        month.trackedCount += 1;
        month.totalMinutes += minutes;
        month.totalRoundtripKm += Number.isFinite(roundtripKm) ? roundtripKm : 0;
        month.totalFuelEur += fuelEur;
      } else {
        month.openCount += 1;
      }
      if (!Number.isFinite(roundtripKm)) {
        month.missingDistanceCount += 1;
      }
      monthMap.set(monthKey, month);
    }
  }

  const months = [...monthMap.values()]
    .map((month) => ({
      ...month,
      totalRoundtripKm: roundTo(month.totalRoundtripKm, 1),
      totalFuelEur: roundTo(month.totalFuelEur, 2),
    }))
    .sort((left, right) => right.monthKey.localeCompare(left.monthKey));

  const normalizedEntries = entries.sort((left, right) => {
    const dateDelta = String(right.dateKey || "").localeCompare(String(left.dateKey || ""));
    if (dateDelta !== 0) {
      return dateDelta;
    }
    return String(left.timeLabel || "").localeCompare(String(right.timeLabel || ""));
  });

  const summary = months.reduce(
    (acc, month) => ({
      sessionCount: acc.sessionCount + month.sessionCount,
      trackedCount: acc.trackedCount + month.trackedCount,
      openCount: acc.openCount + month.openCount,
      totalMinutes: acc.totalMinutes + month.totalMinutes,
      totalRoundtripKm: roundTo(acc.totalRoundtripKm + month.totalRoundtripKm, 1),
      totalFuelEur: roundTo(acc.totalFuelEur + month.totalFuelEur, 2),
      missingDistanceCount: acc.missingDistanceCount + month.missingDistanceCount,
    }),
    {
      sessionCount: 0,
      trackedCount: 0,
      openCount: 0,
      totalMinutes: 0,
      totalRoundtripKm: 0,
      totalFuelEur: 0,
      missingDistanceCount: 0,
    },
  );

  return {
    summary,
    months,
    latestMonthKey: months[0]?.monthKey || "",
    entries: normalizedEntries,
  };
}
