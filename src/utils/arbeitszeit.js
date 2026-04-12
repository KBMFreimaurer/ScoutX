const KNOWN_TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function toSortableKickoff(value) {
  const text = String(value || "").trim();
  return KNOWN_TIME_RE.test(text) ? text : "99:99";
}

function toDateSortValue(game) {
  if (game?.dateObj instanceof Date && !Number.isNaN(game.dateObj.getTime())) {
    return game.dateObj.getTime();
  }

  const text = String(game?.date || "").trim();
  if (!text) {
    return Number.MAX_SAFE_INTEGER;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const parsed = new Date(`${text}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? Number.MAX_SAFE_INTEGER : parsed.getTime();
  }

  if (/^\d{2}\.\d{2}\.\d{4}$/.test(text)) {
    const [day, month, year] = text.split(".").map(Number);
    const parsed = new Date(year, month - 1, day);
    return Number.isNaN(parsed.getTime()) ? Number.MAX_SAFE_INTEGER : parsed.getTime();
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? Number.MAX_SAFE_INTEGER : parsed.getTime();
}

function formatDateLabel(game) {
  if (game?.dateObj instanceof Date && !Number.isNaN(game.dateObj.getTime())) {
    return game.dateObj.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  const text = String(game?.date || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [year, month, day] = text.split("-");
    return `${day}.${month}.${year}`;
  }

  if (/^\d{2}\.\d{2}\.\d{4}$/.test(text)) {
    return text;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return parsed.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function normalizePresenceMinutes(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(String(value).replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return Math.round(parsed);
}

export function formatPresenceMinutes(minutes) {
  const normalized = normalizePresenceMinutes(minutes);
  if (!Number.isFinite(normalized)) {
    return "nicht erfasst";
  }

  if (normalized < 60) {
    return `${normalized} Min`;
  }

  const hours = Math.floor(normalized / 60);
  const restMinutes = normalized % 60;
  return restMinutes > 0 ? `${hours} h ${restMinutes} Min` : `${hours} h`;
}

export function buildAttendanceRows(games) {
  const safeGames = Array.isArray(games) ? games : [];

  return [...safeGames]
    .map((game, index) => ({
      id: String(game?.id ?? "").trim() || `game-${index}`,
      dateLabel: formatDateLabel(game),
      timeLabel: KNOWN_TIME_RE.test(String(game?.time || "").trim()) ? String(game.time).trim() : "--:--",
      matchLabel: `${String(game?.home || "—").trim()} vs ${String(game?.away || "—").trim()}`.trim(),
      venueLabel: String(game?.venue || "Sportanlage").trim() || "Sportanlage",
      game,
    }))
    .sort((left, right) => {
      const dateDelta = toDateSortValue(left.game) - toDateSortValue(right.game);
      if (dateDelta !== 0) {
        return dateDelta;
      }
      return toSortableKickoff(left.timeLabel).localeCompare(toSortableKickoff(right.timeLabel));
    })
    .map(({ game: _unused, ...row }) => row);
}
