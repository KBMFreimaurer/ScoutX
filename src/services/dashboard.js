const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const WEEKDAY_LABELS = {
  0: "So",
  1: "Mo",
  2: "Di",
  3: "Mi",
  4: "Do",
  5: "Fr",
  6: "Sa",
};

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
    if (parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day) {
      return parsed;
    }
    return null;
  }

  if (/^\d{2}\.\d{2}\.\d{4}$/.test(text)) {
    const [day, month, year] = text.split(".").map(Number);
    const parsed = new Date(year, month - 1, day);
    if (parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day) {
      return parsed;
    }
    return null;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toIsoDateKey(value) {
  const parsed = parseDateInput(value);
  if (!parsed) {
    return "";
  }

  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
}

function toGameDateKey(game) {
  return toIsoDateKey(game?.date) || toIsoDateKey(game?.dateObj);
}

function toGameMonthKey(game) {
  const dateKey = toGameDateKey(game);
  return dateKey ? dateKey.slice(0, 7) : "";
}

function normalizeMonthKey(value) {
  const text = String(value || "").trim();
  return /^\d{4}-\d{2}$/.test(text) ? text : "";
}

function normalizeTeamName(value) {
  return String(value || "").trim();
}

function getEntryManualSelectedGames(entry) {
  const games = Array.isArray(entry?.games) ? entry.games : [];
  const selectedGameIds = Array.isArray(entry?.selectedGameIds)
    ? entry.selectedGameIds.map((value) => String(value || "").trim()).filter(Boolean)
    : [];

  if (selectedGameIds.length === 0) {
    return [];
  }

  const selectedSet = new Set(selectedGameIds);
  return games.filter((game) => selectedSet.has(String(game?.id || "").trim()));
}

function resolveEntryKmRate(entry, defaultRate) {
  const metaRate = toFiniteNumber(entry?.meta?.kmPauschale);
  if (Number.isFinite(metaRate) && metaRate > 0) {
    return metaRate;
  }
  return defaultRate;
}

export function resolveGameDistanceKm(game) {
  const startDistance = toFiniteNumber(game?.fromStartRouteDistanceKm);
  if (Number.isFinite(startDistance) && startDistance > 0) {
    return startDistance;
  }

  const distance = toFiniteNumber(game?.distanceKm);
  if (Number.isFinite(distance) && distance > 0) {
    return distance;
  }

  return null;
}

function buildReportEntry(entry, defaultKmRate, games) {
  const scopedGames = Array.isArray(games) ? games : [];
  const rate = resolveEntryKmRate(entry, defaultKmRate);

  let totalDistanceKm = 0;
  let gamesWithDistance = 0;

  for (const game of scopedGames) {
    const oneWayDistance = resolveGameDistanceKm(game);
    if (!Number.isFinite(oneWayDistance)) {
      continue;
    }
    gamesWithDistance += 1;
    totalDistanceKm += oneWayDistance * 2;
  }

  const dateKeys = scopedGames.map((game) => toGameDateKey(game)).filter(Boolean).sort((left, right) => left.localeCompare(right));
  const fromDateKey = dateKeys[0] || "";
  const toDateKey = dateKeys[dateKeys.length - 1] || "";

  return {
    id: String(entry?.id || ""),
    createdAt: String(entry?.createdAt || ""),
    gameCount: scopedGames.length,
    gamesWithDistance,
    totalDistanceKm: roundTo(totalDistanceKm, 1),
    estimatedCostEur: roundTo(totalDistanceKm * rate, 2),
    jugendLabel: String(entry?.meta?.jugendLabel || "").trim(),
    kreisLabel: String(entry?.meta?.kreisLabel || "").trim(),
    fromDateKey,
    toDateKey,
  };
}

export function buildDashboardModel(planHistory, options = {}) {
  const defaultKmRate = Number.isFinite(options?.defaultKmRate) && Number(options.defaultKmRate) > 0
    ? Number(options.defaultKmRate)
    : 0.3;
  const topTeamLimit = Number.isFinite(options?.topTeamLimit) ? Math.max(1, Number(options.topTeamLimit)) : 8;
  const monthLimit = Number.isFinite(options?.monthLimit) ? Math.max(1, Number(options.monthLimit)) : 6;
  const lowCoverageThreshold = Number.isFinite(options?.lowCoverageThreshold)
    ? Math.max(0, Math.min(100, Number(options.lowCoverageThreshold)))
    : 30;
  const requestedMonthKey = normalizeMonthKey(options?.monthKey);
  const entries = (Array.isArray(planHistory) ? planHistory : [])
    .filter((entry) => entry && typeof entry === "object")
    .sort((left, right) => String(right?.createdAt || "").localeCompare(String(left?.createdAt || "")));

  const fullMonthCounts = {};
  for (const entry of entries) {
    const games = Array.isArray(entry?.games) ? entry.games : [];
    for (const game of games) {
      const monthKey = toGameMonthKey(game);
      if (!monthKey) {
        continue;
      }
      fullMonthCounts[monthKey] = (fullMonthCounts[monthKey] || 0) + 1;
    }
  }

  const fullMonthKeys = Object.keys(fullMonthCounts).sort((left, right) => left.localeCompare(right));
  const scopedMonthKeys = fullMonthKeys.slice(Math.max(0, fullMonthKeys.length - monthLimit));
  const latestMonthKey = scopedMonthKeys[scopedMonthKeys.length - 1] || "";
  const activeMonthKey = scopedMonthKeys.includes(requestedMonthKey) ? requestedMonthKey : latestMonthKey;
  const hasMonthFilter = Boolean(activeMonthKey);

  const allTeams = new Set();
  const manualTeamCounts = {};
  const venueSet = new Set();
  const weekdayCounts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  const allDateKeys = [];
  const latestReports = [];

  let gameCount = 0;
  let totalDistanceKm = 0;
  let estimatedCostEur = 0;
  let withDistanceCount = 0;
  let withoutDistanceCount = 0;

  for (const entry of entries) {
    const games = Array.isArray(entry.games) ? entry.games : [];
    const scopedGames = hasMonthFilter ? games.filter((game) => toGameMonthKey(game) === activeMonthKey) : games;
    if (scopedGames.length === 0) {
      continue;
    }

    const report = buildReportEntry(entry, defaultKmRate, scopedGames);
    latestReports.push(report);
    totalDistanceKm += report.totalDistanceKm;
    estimatedCostEur += report.estimatedCostEur;
    withDistanceCount += report.gamesWithDistance;
    withoutDistanceCount += Math.max(0, report.gameCount - report.gamesWithDistance);

    for (const game of scopedGames) {
      gameCount += 1;

      const home = normalizeTeamName(game?.home);
      const away = normalizeTeamName(game?.away);
      const venue = String(game?.venue || "").trim();

      if (home) {
        allTeams.add(home);
      }
      if (away) {
        allTeams.add(away);
      }
      if (venue) {
        venueSet.add(venue);
      }

      const dateKey = toGameDateKey(game);
      if (!dateKey) {
        continue;
      }

      allDateKeys.push(dateKey);

      const parsed = parseDateInput(dateKey);
      if (!parsed) {
        continue;
      }

      const day = parsed.getDay();
      weekdayCounts[day] = (weekdayCounts[day] || 0) + 1;
    }

    const manualSelectedGames = getEntryManualSelectedGames(entry).filter((game) =>
      hasMonthFilter ? toGameMonthKey(game) === activeMonthKey : true,
    );
    for (const game of manualSelectedGames) {
      const home = normalizeTeamName(game?.home);
      const away = normalizeTeamName(game?.away);

      if (home) {
        manualTeamCounts[home] = (manualTeamCounts[home] || 0) + 1;
      }
      if (away) {
        manualTeamCounts[away] = (manualTeamCounts[away] || 0) + 1;
      }
    }
  }

  const sortedDateKeys = [...allDateKeys].sort((left, right) => left.localeCompare(right));
  const reportCount = latestReports.length;

  const topTeams = Object.entries(manualTeamCounts)
    .map(([team, count]) => ({ team, count }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }
      return left.team.localeCompare(right.team, "de-DE");
    })
    .slice(0, topTeamLimit);

  const weekdayActivity = WEEKDAY_ORDER.map((weekday) => ({
    weekday,
    label: WEEKDAY_LABELS[weekday],
    count: weekdayCounts[weekday] || 0,
  }));

  const monthActivity = scopedMonthKeys
    .map((monthKey) => ({ monthKey, count: fullMonthCounts[monthKey] || 0 }))
    .sort((left, right) => right.monthKey.localeCompare(left.monthKey));

  const distanceCoveragePct = gameCount > 0 ? roundTo((withDistanceCount / gameCount) * 100, 1) : 0;

  return {
    activeMonthKey,
    monthFilterEnabled: hasMonthFilter,
    summary: {
      reportCount,
      gameCount,
      avgGamesPerReport: reportCount > 0 ? roundTo(gameCount / reportCount, 1) : 0,
      uniqueTeamCount: allTeams.size,
      uniqueVenueCount: venueSet.size,
      earliestDateKey: sortedDateKeys[0] || "",
      latestDateKey: sortedDateKeys[sortedDateKeys.length - 1] || "",
      totalDistanceKm: roundTo(totalDistanceKm, 1),
      estimatedCostEur: roundTo(estimatedCostEur, 2),
      withDistanceCount,
      withoutDistanceCount,
      distanceCoveragePct,
      lowDistanceCoverage: gameCount > 0 && distanceCoveragePct < lowCoverageThreshold,
    },
    topTeams,
    weekdayActivity,
    monthActivity,
    latestReports,
  };
}
