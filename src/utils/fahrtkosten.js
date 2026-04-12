function formatDateFromKey(dateKey) {
  const text = String(dateKey || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return "";
  }

  const [year, month, day] = text.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}

function gameDateLabel(game) {
  if (game?.dateObj instanceof Date && !Number.isNaN(game.dateObj.getTime())) {
    return game.dateObj.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
  }

  const text = String(game?.date || "").trim();
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(text)) {
    const [day, month] = text.split(".");
    return `${day}.${month}.`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [, month, day] = text.split("-");
    return `${day}.${month}.`;
  }
  return "";
}

function toFinite(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function buildFahrtkostenRows(games, routeOverview) {
  const routeLegs = Array.isArray(routeOverview?.legs) ? routeOverview.legs : [];
  const routeRows = routeLegs
    .map((leg, index) => {
      const distanceKm = toFinite(leg?.distanceKm);
      if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
        return null;
      }
      return {
        id: `leg-${index}`,
        dateLabel: formatDateFromKey(leg?.dateKey),
        label: `${String(leg?.from || "").trim()} → ${String(leg?.to || "").trim()}`.trim(),
        baseKm: distanceKm,
      };
    })
    .filter(Boolean);

  if (routeRows.length > 0) {
    return {
      mode: "route",
      rows: routeRows,
    };
  }

  const gameRows = (Array.isArray(games) ? games : [])
    .map((game, index) => {
      const distanceKm = toFinite(game?.distanceKm);
      if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
        return null;
      }
      return {
        id: String(game?.id || `game-${index}`),
        dateLabel: gameDateLabel(game),
        label: `${String(game?.home || "–").trim()} – ${String(game?.away || "–").trim()}`.trim(),
        baseKm: distanceKm,
      };
    })
    .filter(Boolean);

  return {
    mode: "per_game_roundtrip",
    rows: gameRows,
  };
}
