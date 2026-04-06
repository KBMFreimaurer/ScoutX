function formatUtcIcs(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

function toEventStart(game) {
  const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(String(game?.date || "")) ? String(game.date) : "";
  if (!safeDate) {
    return new Date();
  }

  const kickoff = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(game?.time || "").trim()) ? String(game.time) : "12:00";
  return new Date(`${safeDate}T${kickoff}:00`);
}

function escapeIcs(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function inferReason(game) {
  const priority = Number(game?.priority || 0);
  if (priority >= 5) {
    return "Sehr hohe Scouting-Relevanz.";
  }
  if (priority >= 4) {
    return "Gute Scouting-Relevanz.";
  }
  return "Ergänzungsspiel zur Tagesbeobachtung.";
}

export function buildScoutCalendarIcs(games, cfg = {}) {
  const topGames = [...(Array.isArray(games) ? games : [])]
    .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0))
    .slice(0, 5);

  const dtStamp = formatUtcIcs(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ScoutX//Scouting Kalender//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const game of topGames) {
    const start = toEventStart(game);
    const end = new Date(start.getTime() + 90 * 60 * 1000);
    const uid = `${String(game.id || `${game.home}-${game.away}-${game.date}`)}@scoutx`;
    const summary = `${game.home} vs ${game.away}`;
    const description = `Priorität ${Number(game.priority || 0)} · ${inferReason(game)}${
      cfg?.kreisLabel ? ` · Kreis: ${cfg.kreisLabel}` : ""
    }`;

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${escapeIcs(uid)}`);
    lines.push(`DTSTAMP:${dtStamp}`);
    lines.push(`DTSTART:${formatUtcIcs(start)}`);
    lines.push(`DTEND:${formatUtcIcs(end)}`);
    lines.push(`SUMMARY:${escapeIcs(summary)}`);
    lines.push(`LOCATION:${escapeIcs(game.venue || "Sportanlage")}`);
    lines.push(`DESCRIPTION:${escapeIcs(description)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadCalendarIcs(games, cfg = {}) {
  const icsContent = buildScoutCalendarIcs(games, cfg);
  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const fileName = `ScoutX-Kalender-${new Date().toISOString().slice(0, 10)}.ics`;

  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
