import {
  CONTENT_BOTTOM,
  MARGIN_X,
  PAGE_WIDTH,
  addPage,
  ensureSpace,
  formatGameDate,
  formatKickoffLabel,
  formatMinutes,
  parseMinutes,
  sortGamesByDateTime,
} from "./layout";
import { COLORS, normalizeLookup, sanitizePdfText, toSafeString, truncateText } from "./styles";
import { buildAttendanceRows, formatPresenceMinutes, normalizePresenceMinutes } from "../../utils/arbeitszeit";
import { resolveGameMatchUrl } from "../../utils/gameLinks";
import { buildFahrtkostenRows } from "../../utils/fahrtkosten";

export function limitToSentences(text, maxSentences = 2) {
  const cleaned = toSafeString(text);
  if (!cleaned) {
    return "";
  }
  const sentences = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length === 0) {
    return cleaned.length > 170 ? `${cleaned.slice(0, 167)}...` : cleaned;
  }
  const selected = sentences.slice(0, maxSentences).join(" ").trim();
  return selected.length > 220 ? `${selected.slice(0, 217)}...` : selected;
}

export function sanitizePlanText(rawPlan) {
  const normalized = String(rawPlan || "")
    .replace(/[#*]/g, "")
    .replace(/\r/g, "")
    .split("\n");

  const result = [];
  let skipObservation = false;

  for (const sourceLine of normalized) {
    const line = sourceLine.replace(/^\s*[-•]\s+/, "").trim();
    const lookup = line.toLowerCase();

    if (/^(?:validierung)$/i.test(line)) {
      continue;
    }

    if (/^(?:wettbewerbsniveau|scout-?niveau)\s*:/i.test(line)) {
      continue;
    }

    if (/beobachtungspunkte/.test(lookup)) {
      skipObservation = true;
      continue;
    }

    if (skipObservation) {
      continue;
    }

    if (!line) {
      result.push("");
      continue;
    }

    if (/^begründung[:\s-]/i.test(line)) {
      const body = line.replace(/^begründung[:\s-]*/i, "");
      result.push(`Begründung: ${limitToSentences(body, 2)}`);
      continue;
    }

    result.push(line);
  }

  return result
    .join("\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractReasonMap(planText) {
  const lines = String(planText || "")
    .split("\n")
    .map((line) => line.trim());
  const map = new Map();

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!/\bvs\.?\b/i.test(line)) {
      continue;
    }

    const matchup = line.match(/(.+?)\s+vs\.?\s+(.+?)(?:\s*\||\s*$)/i);
    if (!matchup) {
      continue;
    }

    const home = toSafeString(matchup[1]);
    const away = toSafeString(matchup[2]);
    if (!home || !away) {
      continue;
    }

    const probe = [line, lines[i + 1] || "", lines[i + 2] || ""].join(" ");
    const reasonMatch = probe.match(/begründung[:\s-]+(.+?)(?=$|\s{2,}|(?:\b[A-ZÄÖÜ][a-zäöü]+:))/i);
    const rawReason = reasonMatch ? reasonMatch[1] : "";
    const reason = limitToSentences(rawReason, 2);
    if (!reason) {
      continue;
    }

    const key = `${normalizeLookup(home)}|${normalizeLookup(away)}`;
    const reverseKey = `${normalizeLookup(away)}|${normalizeLookup(home)}`;
    map.set(key, reason);
    map.set(reverseKey, reason);
  }

  return map;
}

export function fallbackReason(game) {
  const priority = Number(game?.priority || 0);
  if (priority >= 5) {
    return "Hohes NLZ-Potenzial laut Priorisierung und Spielumfeld.";
  }
  if (priority >= 4) {
    return "Attraktives Vergleichsspiel mit relevantem Wettbewerbsniveau.";
  }
  return "Solide Beobachtungsmöglichkeit zur Ergänzung des Scouting-Tages.";
}

export function reasonForGame(game, reasonMap) {
  const key = `${normalizeLookup(game?.home)}|${normalizeLookup(game?.away)}`;
  return reasonMap.get(key) || fallbackReason(game);
}

export function inferBadges(game, reasonText) {
  const tags = [];
  const normalizedReason = normalizeLookup(reasonText);

  if (Number(game?.priority || 0) >= 5) {
    tags.push("NLZ-relevant");
  }

  if (normalizedReason.includes("leistungsklasse")) {
    tags.push("Leistungsklasse");
  } else if (normalizedReason.includes("kreisklasse")) {
    tags.push("Kreisklasse");
  } else {
    tags.push("Niveau unklar");
  }

  if (normalizedReason.includes("gemischt")) {
    tags.push("Jahrgang gemischt");
  } else if (normalizedReason.includes("jahrgang") || normalizedReason.includes("lastig")) {
    tags.push("Jahrgang fokussiert");
  }

  return tags.slice(0, 3);
}

function findMatchingGame(games, home, away) {
  const homeKey = normalizeLookup(home);
  const awayKey = normalizeLookup(away);

  return games.find((game) => {
    const gHome = normalizeLookup(game.home);
    const gAway = normalizeLookup(game.away);
    return (gHome.includes(homeKey) && gAway.includes(awayKey)) || (gHome.includes(awayKey) && gAway.includes(homeKey));
  });
}

export function parseRouteStops(planText, games) {
  const lines = String(planText || "").split("\n");
  const stops = [];
  const seen = new Set();

  for (const raw of lines) {
    const line = raw.trim();
    const timeMatch = line.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
    if (!timeMatch || !/\bvs\.?\b/i.test(line)) {
      continue;
    }

    const time = `${String(timeMatch[1]).padStart(2, "0")}:${timeMatch[2]}`;
    const matchup = line.match(/(.+?)\s+vs\.?\s+(.+?)(?:\s*\|\s*(.+))?$/i);
    if (!matchup) {
      continue;
    }

    const home = toSafeString(matchup[1]).replace(/^[^A-Za-z0-9ÄÖÜäöüß]+/, "");
    const away = toSafeString(matchup[2]);
    const matchGame = findMatchingGame(games, home, away);
    const label = matchGame ? `${matchGame.home} vs ${matchGame.away}` : `${home} vs ${away}`;
    const venue = matchGame
      ? toSafeString(matchGame.venue || "Sportanlage")
      : toSafeString(matchup[3] || "Sportanlage");

    const key = `${time}|${normalizeLookup(label)}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    stops.push({ time, label, venue });
  }

  if (stops.length === 0) {
    const fallbackGames = sortGamesByDateTime(games).slice(0, 3);
    for (const game of fallbackGames) {
      stops.push({
        time: toSafeString(game.time) || "--:--",
        label: `${game.home} vs ${game.away}`,
        venue: toSafeString(game.venue || "Sportanlage"),
      });
    }
  }

  return stops.slice(0, 3);
}

export function writeText(doc, state, text, opts = {}) {
  const fontSize = opts.fontSize || 10;
  const lineHeight = opts.lineHeight || 4.5;
  const style = opts.style || "normal";
  const color = opts.color || COLORS.text;
  const width = opts.width || PAGE_WIDTH - MARGIN_X * 2;
  const lines = doc.splitTextToSize(sanitizePdfText(toSafeString(text)), width);

  doc.setFont("helvetica", style);
  doc.setFontSize(fontSize);
  doc.setTextColor(color[0], color[1], color[2]);

  for (const line of lines) {
    ensureSpace(doc, state, lineHeight + 1, opts.sectionOnNewPage);
    doc.text(line, MARGIN_X, state.y);
    state.y += lineHeight;
  }
}

function writePdfLink(doc, x, y, label, url, color = COLORS.accent) {
  const safeLabel = sanitizePdfText(toSafeString(label));
  if (!safeLabel) {
    return;
  }

  doc.setTextColor(color[0], color[1], color[2]);
  if (typeof doc.textWithLink === "function" && url) {
    doc.textWithLink(safeLabel, x, y, { url });
    return;
  }

  doc.text(safeLabel, x, y);
}

export function drawSectionTitle(doc, state, title, sectionOnNewPage = title) {
  ensureSpace(doc, state, 12, sectionOnNewPage);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(COLORS.accent[0], COLORS.accent[1], COLORS.accent[2]);
  doc.text(sanitizePdfText(title), MARGIN_X, state.y);
  state.y += 4;
  doc.setDrawColor(COLORS.line[0], COLORS.line[1], COLORS.line[2]);
  doc.line(MARGIN_X, state.y, PAGE_WIDTH - MARGIN_X, state.y);
  state.y += 4;
}

function drawBadgeRow(doc, x, y, badges) {
  let cursorX = x;
  let cursorY = y;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  for (const badge of badges) {
    const label = truncateText(badge, 30);
    const width = Math.min(58, doc.getTextWidth(label) + 5);
    if (cursorX + width > PAGE_WIDTH - MARGIN_X) {
      cursorX = x;
      cursorY += 5;
    }
    doc.setFillColor(COLORS.accentLight[0], COLORS.accentLight[1], COLORS.accentLight[2]);
    doc.setDrawColor(COLORS.line[0], COLORS.line[1], COLORS.line[2]);
    doc.roundedRect(cursorX, cursorY - 3.4, width, 4.2, 1.2, 1.2, "FD");
    doc.setTextColor(COLORS.accent[0], COLORS.accent[1], COLORS.accent[2]);
    doc.text(sanitizePdfText(label), cursorX + 2.2, cursorY - 0.5);
    cursorX += width + 2;
  }
  return cursorY + 2.5;
}

export function drawSummaryGrid(doc, state, games, topGames, routeStops) {
  const times = games
    .map((game) => parseMinutes(game.time))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
  const kickoffWindow =
    times.length > 0 ? `${formatMinutes(times[0])}–${formatMinutes(times[times.length - 1])}` : "--:--";

  const items = [
    { title: "Spiele gesamt", value: String(games.length) },
    { title: "Top-Empfehlungen", value: String(topGames.length) },
    { title: "Empf. Route", value: `${routeStops.length} Stopps` },
    { title: "Anstoßfenster", value: kickoffWindow },
  ];

  const boxGap = 4;
  const boxWidth = (PAGE_WIDTH - MARGIN_X * 2 - boxGap) / 2;
  const boxHeight = 15;
  const totalHeight = boxHeight * 2 + boxGap + 1;
  ensureSpace(doc, state, totalHeight, "Überblick");

  for (let i = 0; i < items.length; i += 1) {
    const row = Math.floor(i / 2);
    const col = i % 2;
    const x = MARGIN_X + col * (boxWidth + boxGap);
    const y = state.y + row * (boxHeight + boxGap);
    doc.setFillColor(COLORS.cardBg[0], COLORS.cardBg[1], COLORS.cardBg[2]);
    doc.setDrawColor(COLORS.line[0], COLORS.line[1], COLORS.line[2]);
    doc.roundedRect(x, y, boxWidth, boxHeight, 1.6, 1.6, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
    doc.text(sanitizePdfText(items[i].title), x + 3, y + 5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
    doc.text(sanitizePdfText(items[i].value), x + 3, y + 11.3);
  }

  state.y += totalHeight + 2;
}

export function drawTopCards(doc, state, topGames, reasonMap) {
  drawSectionTitle(doc, state, "Top 5 Empfehlungen", "Top-Empfehlungen");

  if (topGames.length === 0) {
    writeText(doc, state, "Keine Spiele verfügbar.", { fontSize: 9.5, color: COLORS.muted });
    state.y += 2;
    return;
  }

  for (let i = 0; i < topGames.length; i += 1) {
    const game = topGames[i];
    const reason = reasonForGame(game, reasonMap);
    const badges = inferBadges(game, reason);

    const metaLine = `${formatGameDate(game)} · ${formatKickoffLabel(game.time)} · ${truncateText(
      toSafeString(game.venue || "Sportanlage"),
      72,
    )}`;
    const reasonLine = limitToSentences(reason, 2);
    const reasonLines = doc.splitTextToSize(reasonLine, PAGE_WIDTH - MARGIN_X * 2 - 7);

    let cardHeight = 19 + Math.max(0, reasonLines.length - 1) * 4.2;
    if (badges.length > 0) {
      cardHeight += 4.5;
    }

    ensureSpace(doc, state, cardHeight + 1.5, "Top-Empfehlungen");

    doc.setFillColor(COLORS.cardBg[0], COLORS.cardBg[1], COLORS.cardBg[2]);
    doc.setDrawColor(COLORS.line[0], COLORS.line[1], COLORS.line[2]);
    doc.roundedRect(MARGIN_X, state.y, PAGE_WIDTH - MARGIN_X * 2, cardHeight, 2, 2, "FD");

    doc.setFillColor(COLORS.accent[0], COLORS.accent[1], COLORS.accent[2]);
    doc.circle(MARGIN_X + 5, state.y + 5.2, 2.8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(COLORS.white[0], COLORS.white[1], COLORS.white[2]);
    doc.text(String(i + 1), MARGIN_X + 5, state.y + 6.1, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
    doc.text(sanitizePdfText(`${game.home} vs ${game.away}`), MARGIN_X + 10.5, state.y + 6.2);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.4);
    doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
    doc.text(sanitizePdfText(metaLine), MARGIN_X + 10.5, state.y + 10.6);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.9);
    doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
    let reasonY = state.y + 14.7;
    for (const line of reasonLines.slice(0, 3)) {
      doc.text(sanitizePdfText(line), MARGIN_X + 10.5, reasonY);
      reasonY += 4.2;
    }

    if (badges.length > 0) {
      drawBadgeRow(doc, MARGIN_X + 10.5, state.y + cardHeight - 1.6, badges);
    }

    state.y += cardHeight + 2;
  }
}

export function drawRouteTimeline(doc, state, stops) {
  drawSectionTitle(doc, state, "Routenplan (max. 3 Spiele)", "Routenplan");

  if (stops.length === 0) {
    writeText(doc, state, "Keine Route verfügbar.", { fontSize: 9.5, color: COLORS.muted });
    state.y += 2;
    return;
  }

  const baseX = MARGIN_X + 3.5;
  const textX = MARGIN_X + 10;
  const blockHeight = 19;

  for (let i = 0; i < stops.length; i += 1) {
    const stop = stops[i];
    ensureSpace(doc, state, blockHeight + 1.5, "Routenplan");

    if (i < stops.length - 1) {
      doc.setDrawColor(COLORS.line[0], COLORS.line[1], COLORS.line[2]);
      doc.line(baseX, state.y + 5, baseX, state.y + blockHeight - 2);
    }

    doc.setFillColor(COLORS.accent[0], COLORS.accent[1], COLORS.accent[2]);
    doc.circle(baseX, state.y + 5, 1.7, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(COLORS.accent[0], COLORS.accent[1], COLORS.accent[2]);
    doc.text(sanitizePdfText(stop.time), textX, state.y + 4.8);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
    doc.text(sanitizePdfText(truncateText(stop.label, 92)), textX + 17, state.y + 4.8);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.7);
    doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
    doc.text(sanitizePdfText(`Ort: ${truncateText(stop.venue, 95)}`), textX, state.y + 9.3);
    doc.text("Anwesenheit: ca. 45 Minuten", textX, state.y + 13.5);

    if (i < stops.length - 1) {
      const currentMinutes = parseMinutes(stop.time);
      const nextMinutes = parseMinutes(stops[i + 1].time);
      if (Number.isFinite(currentMinutes) && Number.isFinite(nextMinutes)) {
        const travelWindow = Math.max(0, nextMinutes - (currentMinutes + 45));
        doc.text(
          sanitizePdfText(`Fahrtfenster bis nächster Stopp: ca. ${travelWindow} Minuten`),
          textX,
          state.y + 17.7,
        );
      }
    }

    state.y += blockHeight;
  }

  state.y += 2;
}

export function drawRouteOverview(doc, state, routeOverview, startLocationLabel = "Startort") {
  if (!routeOverview || !Array.isArray(routeOverview.legs) || routeOverview.legs.length === 0) {
    return;
  }

  drawSectionTitle(doc, state, "Routenübersicht", "Routenübersicht");
  writeText(doc, state, `Start: ${toSafeString(startLocationLabel) || "Startort"}`, {
    fontSize: 9.2,
    color: COLORS.text,
    lineHeight: 4.4,
    sectionOnNewPage: "Routenübersicht",
  });

  for (const leg of routeOverview.legs) {
    const distanceLabel = Number.isFinite(leg?.distanceKm) ? `${Math.round(leg.distanceKm)} km` : "unbekannt";
    const minutesLabel = Number.isFinite(leg?.durationMinutes) ? `${Math.round(leg.durationMinutes)} Min` : null;
    writeText(
      doc,
      state,
      `${toSafeString(leg?.from)} → ${toSafeString(leg?.to)} · ${distanceLabel}${minutesLabel ? ` · ${minutesLabel}` : ""}`,
      {
        fontSize: 8.8,
        color: COLORS.muted,
        lineHeight: 4.2,
        sectionOnNewPage: "Routenübersicht",
      },
    );
  }

  const totalLabel = Number.isFinite(routeOverview.totalKm) ? `${Math.round(routeOverview.totalKm)} km` : "unbekannt";
  const minutesLabel = Number.isFinite(routeOverview.estimatedMinutes)
    ? `${routeOverview.estimatedMinutes} Min`
    : "unbekannt";
  writeText(doc, state, `Gesamtstrecke: ${totalLabel} · Fahrzeit ca. ${minutesLabel}`, {
    fontSize: 9,
    style: "bold",
    color: COLORS.text,
    lineHeight: 4.4,
    sectionOnNewPage: "Routenübersicht",
  });
  state.y += 2;
}

export function drawScheduleTable(doc, state, games, reasonMap) {
  addPage(state, doc, "Kompletter Spielplan");

  const headers = [
    { key: "nr", label: "Nr.", width: 10 },
    { key: "date", label: "Datum", width: 28 },
    { key: "time", label: "Anstoß", width: 17 },
    { key: "match", label: "Begegnung", width: 55 },
    { key: "venue", label: "Spielort", width: 52 },
    { key: "tags", label: "Tags", width: 22 },
  ];

  const tableX = MARGIN_X;
  const headerHeight = 7;

  function drawTableSectionTitle(label) {
    drawSectionTitle(doc, state, label, "Kompletter Spielplan");
  }

  function drawHeaderRow() {
    ensureSpace(doc, state, headerHeight + 1, "Kompletter Spielplan", () => {
      drawTableSectionTitle("Kompletter Spielplan (Fortsetzung)");
      drawHeaderRow();
    });

    doc.setFillColor(237, 242, 247);
    doc.setDrawColor(COLORS.line[0], COLORS.line[1], COLORS.line[2]);
    doc.rect(tableX, state.y, PAGE_WIDTH - MARGIN_X * 2, headerHeight, "FD");

    let cursorX = tableX + 1.8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
    for (const column of headers) {
      doc.text(sanitizePdfText(column.label), cursorX, state.y + 4.8);
      cursorX += column.width;
    }

    state.y += headerHeight;
  }

  drawTableSectionTitle(`Kompletter Spielplan (${games.length} Spiele)`);
  drawHeaderRow();

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.3);
  let rowIndex = 0;

  for (let i = 0; i < games.length; i += 1) {
    const game = games[i];
    const reason = reasonForGame(game, reasonMap);
    const tags = inferBadges(game, reason).join(" · ");
    const row = {
      nr: String(i + 1),
      date: formatGameDate(game),
      time: formatKickoffLabel(game.time),
      match: `${toSafeString(game.home)} vs ${toSafeString(game.away)}`,
      venue: toSafeString(game.venue || "Sportanlage"),
      tags: tags || "—",
    };

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.3);
    const lineCollections = headers.map((column) =>
      doc
        .splitTextToSize(row[column.key], Math.max(5, column.width - 2))
        .slice(0, column.key === "venue" || column.key === "match" ? 2 : 1),
    );
    const maxLines = Math.max(...lineCollections.map((lines) => lines.length || 1));
    const rowHeight = Math.max(6.8, maxLines * 4 + 2.2);

    if (state.y + rowHeight > CONTENT_BOTTOM) {
      addPage(state, doc, "Kompletter Spielplan");
      drawTableSectionTitle("Kompletter Spielplan (Fortsetzung)");
      drawHeaderRow();
      rowIndex = 0;
    }

    if (rowIndex % 2 === 1) {
      doc.setFillColor(COLORS.tableStripe[0], COLORS.tableStripe[1], COLORS.tableStripe[2]);
      doc.rect(tableX, state.y, PAGE_WIDTH - MARGIN_X * 2, rowHeight, "F");
    }

    doc.setDrawColor(COLORS.line[0], COLORS.line[1], COLORS.line[2]);
    doc.rect(tableX, state.y, PAGE_WIDTH - MARGIN_X * 2, rowHeight, "S");

    let cursorX = tableX + 1.6;
    for (let c = 0; c < headers.length; c += 1) {
      const lines = lineCollections[c];
      let textY = state.y + 4.2;
      for (const line of lines) {
        doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
        doc.text(sanitizePdfText(line), cursorX, textY);
        textY += 3.9;
      }
      cursorX += headers[c].width;
    }

    state.y += rowHeight;
    rowIndex += 1;
  }
}

export function drawGameDetails(doc, state, games) {
  addPage(state, doc, "Spiel-Details");
  drawSectionTitle(doc, state, "Spiel-Details (Notizen)", "Spiel-Details");

  if (!Array.isArray(games) || games.length === 0) {
    writeText(doc, state, "Keine Spiele verfügbar.", { fontSize: 9.5, color: COLORS.muted });
    return;
  }

  for (const game of games) {
    ensureSpace(doc, state, 20, "Spiel-Details");
    writeText(
      doc,
      state,
      `${toSafeString(game.home)} vs ${toSafeString(game.away)} (${formatKickoffLabel(game.time)})`,
      {
        fontSize: 9.2,
        style: "bold",
        color: COLORS.text,
        lineHeight: 4.4,
        sectionOnNewPage: "Spiel-Details",
      },
    );
    writeText(doc, state, `Notiz: ${toSafeString(game.note) || "—"}`, {
      fontSize: 8.7,
      color: COLORS.muted,
      lineHeight: 4.1,
      sectionOnNewPage: "Spiel-Details",
    });
    state.y += 1.5;
  }
}

export function drawAnalysisPage(doc, state, planText) {
  addPage(state, doc, "Scout-Analyse");
  drawSectionTitle(doc, state, "Scout-Analyse (bereinigt)", "Scout-Analyse");

  const cleaned = sanitizePlanText(planText);
  if (!cleaned) {
    writeText(doc, state, "Keine zusätzliche Analyse vorhanden.", { fontSize: 9.5, color: COLORS.muted });
    return;
  }

  const lines = cleaned.split("\n");
  for (const line of lines) {
    if (!line.trim()) {
      state.y += 2;
      continue;
    }

    const isHeading = /^(VALIDIERUNG|SCOUTING|ROUTENPLAN|SCOUTING PLAN|\d+\.)/i.test(line.trim());
    writeText(doc, state, line, {
      fontSize: isHeading ? 10.3 : 9.2,
      style: isHeading ? "bold" : "normal",
      color: isHeading ? COLORS.accent : COLORS.text,
      lineHeight: isHeading ? 4.8 : 4.4,
      sectionOnNewPage: "Scout-Analyse",
    });
  }
}

export function drawCover(doc, state, cfg, createdAt, games, topGames, routeStops, reasonMap) {
  const title = "ScoutX Scouting Report";
  const subtitle = `${toSafeString(cfg?.kreisLabel) || "-"} · ${toSafeString(cfg?.jugendLabel) || "-"} (${toSafeString(cfg?.jugendAlter) || "-"} Jahre)`;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
  doc.text(sanitizePdfText(title), MARGIN_X, state.y);
  state.y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(COLORS.accent[0], COLORS.accent[1], COLORS.accent[2]);
  doc.text(sanitizePdfText(subtitle), MARGIN_X, state.y);
  state.y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.8);
  doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
  const meta = `Erstellt: ${createdAt} · ab ${toSafeString(cfg?.fromDate) || "-"}${
    toSafeString(cfg?.focus) ? ` · Fokus: ${toSafeString(cfg.focus)}` : ""
  }`;
  doc.text(sanitizePdfText(meta), MARGIN_X, state.y);
  state.y += 6;

  drawSummaryGrid(doc, state, games, topGames, routeStops);
  drawTopCards(doc, state, topGames, reasonMap);
  drawRouteTimeline(doc, state, routeStops);
}

export function drawHeaderFooter(doc, state, cfg, createdAt) {
  const pageCount = doc.getNumberOfPages();
  const sectionByPage = state.sections;

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);

    doc.setDrawColor(COLORS.line[0], COLORS.line[1], COLORS.line[2]);
    doc.line(MARGIN_X, 21, PAGE_WIDTH - MARGIN_X, 21);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.8);
    doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
    doc.text("ScoutX", MARGIN_X, 13.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
    const sectionTitle = sectionByPage[page - 1] || "Report";
    doc.text(sanitizePdfText(sectionTitle), PAGE_WIDTH - MARGIN_X, 13.5, { align: "right" });

    doc.line(MARGIN_X, 286.5, PAGE_WIDTH - MARGIN_X, 286.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
    const footerLeft = `${toSafeString(cfg?.kreisLabel) || "-"} · ${
      toSafeString(cfg?.jugendLabel) || "-"
    } · Export ${createdAt}`;
    doc.text(sanitizePdfText(footerLeft), MARGIN_X, 291.3);
    doc.text(`Seite ${page}/${pageCount}`, PAGE_WIDTH - MARGIN_X, 291.3, { align: "right" });
  }
}

function estimateMinutes(distanceKm) {
  if (!Number.isFinite(distanceKm)) {
    return null;
  }
  return Math.max(1, Math.round((distanceKm / 50) * 60));
}

function formatDistanceLabel(distanceKm) {
  return Number.isFinite(distanceKm) ? `${Math.round(distanceKm)} km` : "unbekannt";
}

function formatMinutesLabel(durationMinutes) {
  return Number.isFinite(durationMinutes) ? `${Math.round(durationMinutes)} Min` : "unbekannt";
}

function kickoffText(value) {
  const parsed = parseMinutes(value);
  return Number.isFinite(parsed) ? formatMinutes(parsed) : "--:--";
}

function toFiniteNumberOrNull(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const text = value.trim();
    if (!text) {
      return null;
    }
    const parsed = Number(text.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toRouteDateKey(game) {
  if (game?.dateObj instanceof Date && !Number.isNaN(game.dateObj.getTime())) {
    return `${game.dateObj.getFullYear()}-${String(game.dateObj.getMonth() + 1).padStart(2, "0")}-${String(
      game.dateObj.getDate(),
    ).padStart(2, "0")}`;
  }

  const text = String(game?.date || "").trim();
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

function isSameRouteDate(left, right) {
  return Boolean(left?.dateKey) && Boolean(right?.dateKey) && left.dateKey === right.dateKey;
}

function normalizeRouteNodeLabel(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function truncatePlain(text, maxChars) {
  const safe = toSafeString(text);
  if (safe.length <= maxChars) {
    return safe;
  }
  return `${safe.slice(0, Math.max(0, maxChars - 3))}...`;
}

function normalizeVenueForRoute(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function isPreciseRouteVenueText(value) {
  const text = String(value || "").trim();
  if (!text) {
    return false;
  }

  const normalized = normalizeVenueForRoute(text);
  if (!normalized) {
    return false;
  }

  const hasPostalCode = /\b\d{5}\b/.test(text);
  const hasStreetNumber =
    /(?:str(?:a(?:ss|ß)e)?\.?|weg|allee|gasse|ring|damm|ufer|kamp|pfad|chaussee|wall|promenade)[^,\n]*\d{1,4}[a-z]?/i.test(
      text,
    );

  return hasPostalCode || hasStreetNumber;
}

function drawGamesTableHeader(doc, state, headers, sectionTitleOnBreak) {
  const tableX = MARGIN_X;
  const headerHeight = 7;

  ensureSpace(doc, state, headerHeight + 1, "Spielübersicht", () => {
    drawSectionTitle(doc, state, sectionTitleOnBreak, "Spielübersicht");
  });

  doc.setFillColor(237, 242, 247);
  doc.setDrawColor(COLORS.line[0], COLORS.line[1], COLORS.line[2]);
  doc.rect(tableX, state.y, PAGE_WIDTH - MARGIN_X * 2, headerHeight, "FD");
  let dividerX = tableX;
  for (let index = 0; index < headers.length - 1; index += 1) {
    dividerX += headers[index].width;
    doc.line(dividerX, state.y, dividerX, state.y + headerHeight);
  }

  let cursorX = tableX + 1.8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
  for (const column of headers) {
    doc.text(sanitizePdfText(column.label), cursorX, state.y + 4.8);
    cursorX += column.width;
  }

  state.y += headerHeight;
}

export function drawGamesOverviewPage(doc, state, cfg, createdAt, games) {
  const title = "ScoutX Besuchsplan";
  const subtitle = `${toSafeString(cfg?.kreisLabel) || "-"} · ${toSafeString(cfg?.jugendLabel) || "-"}`;
  const sinceDate = toSafeString(cfg?.fromDate);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
  doc.text(sanitizePdfText(title), MARGIN_X, state.y);
  state.y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(COLORS.accent[0], COLORS.accent[1], COLORS.accent[2]);
  doc.text(sanitizePdfText(subtitle), MARGIN_X, state.y);
  state.y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.8);
  doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
  const meta = `${games.length} Spiele · erstellt ${createdAt}${sinceDate ? ` · ab ${sinceDate}` : ""}`;
  doc.text(sanitizePdfText(meta), MARGIN_X, state.y);
  state.y += 6;

  drawSectionTitle(doc, state, "Spielübersicht", "Spielübersicht");
  writeText(doc, state, "Kompakte Übersicht mit Datum, Uhrzeit, Spiel und Ort.", {
    fontSize: 8.6,
    color: COLORS.muted,
    lineHeight: 4.2,
    sectionOnNewPage: "Spielübersicht",
  });
  state.y += 1;

  const headers = [
    { key: "date", label: "Datum", width: 24 },
    { key: "time", label: "Zeit", width: 15 },
    { key: "match", label: "Spiel", width: 63 },
    { key: "venue", label: "Ort", width: 66 },
    { key: "link", label: "Link", width: 18 },
  ];
  const tableX = MARGIN_X;
  let rowIndex = 0;

  drawGamesTableHeader(doc, state, headers, "Spielübersicht (Fortsetzung)");

  for (let i = 0; i < games.length; i += 1) {
    const game = games[i];
    const shortDate =
      game?.dateObj instanceof Date && !Number.isNaN(game.dateObj.getTime())
        ? game.dateObj.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })
        : truncateText(formatGameDate(game), 10);
    const row = {
      date: shortDate,
      time: kickoffText(game.time),
      match: `${toSafeString(game.home)} vs ${toSafeString(game.away)}`,
      venue: toSafeString(game.venue || "Sportanlage"),
      link: resolveGameMatchUrl(game) ? "Zum Spiel" : "—",
    };
    const matchUrl = resolveGameMatchUrl(game);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.3);
    const lineCollections = headers.map((column) =>
      doc
        .splitTextToSize(row[column.key], Math.max(6, column.width - 2))
        .slice(0, column.key === "venue" || column.key === "match" ? 2 : 1),
    );
    const maxLines = Math.max(...lineCollections.map((lines) => lines.length || 1));
    const rowHeight = Math.max(6.8, maxLines * 3.9 + 2.2);

    if (state.y + rowHeight > CONTENT_BOTTOM) {
      addPage(state, doc, "Spielübersicht");
      drawSectionTitle(doc, state, "Spielübersicht (Fortsetzung)", "Spielübersicht");
      drawGamesTableHeader(doc, state, headers, "Spielübersicht (Fortsetzung)");
      rowIndex = 0;
    }

    if (rowIndex % 2 === 1) {
      doc.setFillColor(COLORS.tableStripe[0], COLORS.tableStripe[1], COLORS.tableStripe[2]);
      doc.rect(tableX, state.y, PAGE_WIDTH - MARGIN_X * 2, rowHeight, "F");
    }

    doc.setDrawColor(COLORS.line[0], COLORS.line[1], COLORS.line[2]);
    doc.rect(tableX, state.y, PAGE_WIDTH - MARGIN_X * 2, rowHeight, "S");
    let dividerX = tableX;
    for (let dividerIndex = 0; dividerIndex < headers.length - 1; dividerIndex += 1) {
      dividerX += headers[dividerIndex].width;
      doc.line(dividerX, state.y, dividerX, state.y + rowHeight);
    }

    let cursorX = tableX + 1.6;
    for (let c = 0; c < headers.length; c += 1) {
      const column = headers[c];
      const lines = lineCollections[c];
      let textY = state.y + 4.1;
      for (const line of lines) {
        if (column.key === "link" && matchUrl) {
          writePdfLink(doc, cursorX, textY, line, matchUrl);
        } else {
          doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
          doc.text(sanitizePdfText(line), cursorX, textY);
        }
        textY += 3.8;
      }
      cursorX += column.width;
    }

    state.y += rowHeight;
    rowIndex += 1;
  }
}

function buildDirectRouteRows(games, directRoutes, maxGames = 5) {
  const selectedGames = sortGamesByDateTime(Array.isArray(games) ? games : []).slice(0, maxGames);
  const provided = Array.isArray(directRoutes) ? directRoutes : [];

  return selectedGames.map((game, index) => {
    const providedRow = provided[index] || {};
    const venue = toSafeString(game.venue || "Sportanlage");
    const routeEligible = isPreciseRouteVenueText(venue) || isPreciseRouteVenueText(game?.venueAddress);
    const distanceKm = toFiniteNumberOrNull(providedRow.distanceKm);
    const durationMinutes = toFiniteNumberOrNull(providedRow.durationMinutes);
    const fallbackDistance = toFiniteNumberOrNull(game?.fromStartRouteDistanceKm ?? game?.distanceKm);
    const resolvedDistance = routeEligible ? (distanceKm ?? fallbackDistance ?? null) : null;
    const fallbackMinutes = toFiniteNumberOrNull(game?.fromStartRouteMinutes);
    const resolvedMinutes = routeEligible
      ? durationMinutes !== null
        ? durationMinutes
        : fallbackMinutes !== null
          ? fallbackMinutes
          : estimateMinutes(resolvedDistance)
      : null;

    return {
      index: index + 1,
      match: `${toSafeString(game.home)} vs ${toSafeString(game.away)}`,
      date: formatGameDate(game),
      dateKey: toRouteDateKey(game),
      time: kickoffText(game.time),
      venue,
      matchUrl: resolveGameMatchUrl(game),
      distanceKm: resolvedDistance,
      durationMinutes: resolvedMinutes,
      routeEligible,
    };
  });
}

function buildBetweenGamesRows(routeOverview, directRows) {
  const legs = Array.isArray(routeOverview?.legs) ? routeOverview.legs : [];
  const usedLegIndexes = new Set();
  const rows = [];

  for (let index = 0; index < directRows.length - 1; index += 1) {
    const left = directRows[index];
    const right = directRows[index + 1];
    if (!isSameRouteDate(left, right)) {
      continue;
    }
    const fromLabel = normalizeRouteNodeLabel(left.match);
    const toLabel = normalizeRouteNodeLabel(right.match);
    const legIndex = legs.findIndex((leg, candidateIndex) => {
      if (usedLegIndexes.has(candidateIndex)) {
        return false;
      }
      const legDateKey = String(leg?.dateKey || "").trim();
      const sameDate = legDateKey ? legDateKey === left.dateKey : true;
      return (
        sameDate &&
        normalizeRouteNodeLabel(leg?.from) === fromLabel &&
        normalizeRouteNodeLabel(leg?.to) === toLabel
      );
    });
    if (legIndex >= 0) {
      usedLegIndexes.add(legIndex);
    }
    const leg = legIndex >= 0 ? legs[legIndex] : null;
    const routeEligible = Boolean(left?.routeEligible) && Boolean(right?.routeEligible);

    rows.push({
      pairIndex: index,
      label: `Spiel ${index + 1} → Spiel ${index + 2}`,
      from: toSafeString(leg?.from) || left.match,
      to: toSafeString(leg?.to) || right.match,
      distanceKm: routeEligible ? toFiniteNumberOrNull(leg?.distanceKm) : null,
      durationMinutes: routeEligible ? toFiniteNumberOrNull(leg?.durationMinutes) : null,
    });
  }

  return rows;
}

function buildRouteStepRows(directRows, betweenRows) {
  const safeDirectRows = Array.isArray(directRows) ? directRows : [];
  const betweenByPair = new Map((Array.isArray(betweenRows) ? betweenRows : []).map((row) => [row.pairIndex, row]));
  const steps = [];

  for (let index = 0; index < safeDirectRows.length; index += 1) {
    const current = safeDirectRows[index];
    const previous = safeDirectRows[index - 1];
    const sameDateAsPrevious = index > 0 && isSameRouteDate(previous, current);

    if (!sameDateAsPrevious) {
      steps.push({
        stepType: "start",
        gameIndex: index,
        match: current?.match || "",
        distanceKm: toFiniteNumberOrNull(current?.distanceKm),
        durationMinutes: toFiniteNumberOrNull(current?.durationMinutes),
        routeEligible: Boolean(current?.routeEligible),
      });
      continue;
    }

    const between = betweenByPair.get(index - 1) || null;
    const routeEligible = Boolean(previous?.routeEligible) && Boolean(current?.routeEligible);

    steps.push({
      stepType: "between",
      gameIndex: index,
      from: toSafeString(between?.from) || previous?.match || `Spiel ${index}`,
      to: toSafeString(between?.to) || current?.match || `Spiel ${index + 1}`,
      distanceKm: routeEligible ? toFiniteNumberOrNull(between?.distanceKm) : null,
      durationMinutes: routeEligible ? toFiniteNumberOrNull(between?.durationMinutes) : null,
      routeEligible,
    });
  }

  return steps;
}

export function computeVisibleChainTotals(directRows, betweenRows) {
  const steps = buildRouteStepRows(directRows, betweenRows);
  if (steps.length === 0) {
    return { totalKm: null, totalMinutes: null };
  }

  let totalKm = 0;
  let totalMinutes = 0;
  let minutesKnown = true;

  for (const step of steps) {
    const legDistance = toFiniteNumberOrNull(step?.distanceKm);
    if (legDistance === null) {
      return { totalKm: null, totalMinutes: null };
    }
    totalKm += legDistance;

    if (minutesKnown) {
      const legMinutes = toFiniteNumberOrNull(step?.durationMinutes);
      if (legMinutes === null) {
        minutesKnown = false;
      } else {
        totalMinutes += legMinutes;
      }
    }
  }

  return {
    totalKm,
    totalMinutes: minutesKnown ? Math.round(totalMinutes ?? 0) : null,
  };
}

export function drawRouteCalculationPage(
  doc,
  state,
  routeOverview,
  startLocationLabel = "Startort",
  games = [],
  directRoutes = [],
) {
  const safeStartLabel = toSafeString(startLocationLabel) || "Startort";
  const directRows = buildDirectRouteRows(games, directRoutes, 5);
  const betweenRows = buildBetweenGamesRows(routeOverview, directRows);
  const routeOverviewLegs = Array.isArray(routeOverview?.legs) ? routeOverview.legs : [];
  const fallbackRouteSteps = buildRouteStepRows(directRows, betweenRows);
  const routeSteps =
    routeOverviewLegs.length > 0
      ? routeOverviewLegs.map((leg, index) => ({
          stepType:
            normalizeRouteNodeLabel(leg?.to) === normalizeRouteNodeLabel(safeStartLabel)
              ? "return"
              : normalizeRouteNodeLabel(leg?.from) === normalizeRouteNodeLabel(safeStartLabel)
                ? "start"
                : "between",
          gameIndex: index,
          from: toSafeString(leg?.from) || "Start",
          to: toSafeString(leg?.to) || "Spiel",
          distanceKm: toFiniteNumberOrNull(leg?.distanceKm),
          durationMinutes: toFiniteNumberOrNull(leg?.durationMinutes),
          routeEligible: true,
        }))
      : fallbackRouteSteps;
  const visibleTotals = computeVisibleChainTotals(directRows, betweenRows);
  const overviewKm = toFiniteNumberOrNull(routeOverview?.totalKm);
  const overviewMinutes = toFiniteNumberOrNull(routeOverview?.estimatedMinutes);
  const totalKm = overviewKm ?? visibleTotals.totalKm;
  const totalMinutes = overviewMinutes ?? visibleTotals.totalMinutes;
  const hasAnyRouteData =
    routeSteps.some((step) => Number.isFinite(step?.distanceKm)) ||
    Number.isFinite(totalKm);

  if (!hasAnyRouteData) {
    return;
  }

  addPage(state, doc, "Route");
  drawSectionTitle(doc, state, "Route", "Route");

  writeText(doc, state, `Startpunkt: ${safeStartLabel}`, {
    fontSize: 9.2,
    style: "bold",
    color: COLORS.text,
    lineHeight: 4.4,
    sectionOnNewPage: "Route",
  });
  writeText(
    doc,
    state,
    `Gesamt: ${formatDistanceLabel(totalKm)} · ${formatMinutesLabel(totalMinutes)} (max. erste 5 Spiele)`,
    {
      fontSize: 8.8,
      style: "bold",
      color: COLORS.accent,
      lineHeight: 4.2,
      sectionOnNewPage: "Route",
    },
  );
  state.y += 1;

  if (routeSteps.length > 0) {
    writeText(doc, state, "Streckenfolge", {
      fontSize: 9,
      style: "bold",
      color: COLORS.text,
      lineHeight: 4.2,
      sectionOnNewPage: "Route",
    });

    for (let index = 0; index < routeSteps.length; index += 1) {
      const step = routeSteps[index];
      const routeText =
        step.stepType === "return"
          ? `${step.from} → ${safeStartLabel}`
          : step.stepType === "start"
            ? `Start → ${truncatePlain(step.to, 56)}`
            : `${truncatePlain(step.from, 40)} → ${truncatePlain(step.to, 40)}`;
      const line = `${index + 1}. ${routeText}: ${formatDistanceLabel(step.distanceKm)} · ${formatMinutesLabel(
        step.durationMinutes,
      )}`;

      writeText(doc, state, line, {
        fontSize: 8.4,
        color: COLORS.text,
        lineHeight: 4,
        sectionOnNewPage: "Route",
      });
    }
  }

  const missingSegments = routeSteps.filter((step) => step.routeEligible && step.distanceKm === null).length;
  if (missingSegments > 0) {
    state.y += 1;
    writeText(doc, state, "Hinweis: Einzelne Strecken konnten nicht eindeutig berechnet werden.", {
      fontSize: 8.1,
      color: COLORS.muted,
      lineHeight: 4,
      sectionOnNewPage: "Route",
    });
  }
}

export function drawFahrtkostenPage(doc, state, games, cfg) {
  const scoutName = String(cfg?.scoutName || "").trim();
  const rate = Number(cfg?.kmPauschale) > 0 ? Number(cfg.kmPauschale) : 0.3;
  const overrides = cfg?.kmOverrides ?? {};
  const presenceOverrides = cfg?.presenceOverrides ?? {};
  const fahrtkostenModel = buildFahrtkostenRows(games, cfg?.routeOverview);
  const attendanceRows = buildAttendanceRows(games);
  const rows = fahrtkostenModel.rows;
  const isRouteMode = fahrtkostenModel.mode === "route";
  const startLocationLabel = toSafeString(cfg?.startLocationLabel || cfg?.startLocation?.label || "Startort") || "Startort";
  const normalizedStartLabel = normalizeRouteNodeLabel(startLocationLabel);
  const routeOverviewLegs = Array.isArray(cfg?.routeOverview?.legs) ? cfg.routeOverview.legs : [];
  const routeRows = routeOverviewLegs
    .map((leg, index) => {
      const from = toSafeString(leg?.from) || "Start";
      const to = toSafeString(leg?.to) || "Spiel";
      const distanceKm = toFiniteNumberOrNull(leg?.distanceKm);
      const durationMinutes = toFiniteNumberOrNull(leg?.durationMinutes);
      const legDateKey = String(leg?.dateKey || "").trim();
      const dateLabel = /^\d{4}-\d{2}-\d{2}$/.test(legDateKey)
        ? `${legDateKey.slice(8, 10)}.${legDateKey.slice(5, 7)}.`
        : "";
      const isReturn = normalizeRouteNodeLabel(to) === normalizedStartLabel;
      const isStartLeg = normalizeRouteNodeLabel(from) === normalizedStartLabel;
      const stage = isReturn ? "Rueckfahrt" : isStartLeg ? "Anfahrt" : "Zwischenfahrt";
      const segment = isReturn
        ? `${truncatePlain(from, 38)} -> Start`
        : isStartLeg
          ? `Start -> ${truncatePlain(to, 38)}`
          : `${truncatePlain(from, 32)} -> ${truncatePlain(to, 32)}`;

      return {
        index: index + 1,
        dateLabel,
        segment: `${stage}: ${segment}`,
        distanceKm,
        durationMinutes,
      };
    })
    .filter((row) => Number.isFinite(row.distanceKm) || Number.isFinite(row.durationMinutes));
  const routeTotalKm = toFiniteNumberOrNull(cfg?.routeOverview?.totalKm);
  const routeTotalMinutes = toFiniteNumberOrNull(cfg?.routeOverview?.estimatedMinutes);
  const presenceMinutesForGame = (gameId) => {
    const id = String(gameId ?? "").trim();
    if (!id) {
      return null;
    }
    return normalizePresenceMinutes(presenceOverrides[id]);
  };

  if (rows.length === 0 && attendanceRows.length === 0) {
    return;
  }

  addPage(state, doc, "Fahrtkosten");
  drawSectionTitle(doc, state, "Fahrtkosten-Abrechnung", "Fahrtkosten");

  writeText(
    doc,
    state,
    [
      scoutName ? `Scout: ${scoutName}` : null,
      `Pauschale: ${rate.toFixed(2).replace(".", ",")} EUR/km`,
      `Datum: ${new Date().toLocaleDateString("de-DE")}`,
    ]
      .filter(Boolean)
      .join(" | "),
    {
      fontSize: 8.8,
      color: COLORS.muted,
      lineHeight: 4.2,
      sectionOnNewPage: "Fahrtkosten",
    },
  );
  state.y += 2;

  if (routeRows.length > 0) {
    writeText(doc, state, `Routenfolge fuer die Abrechnung (Start: ${startLocationLabel})`, {
      fontSize: 9,
      style: "bold",
      color: COLORS.text,
      lineHeight: 4.3,
      sectionOnNewPage: "Fahrtkosten",
    });
    writeText(doc, state, "Nur Fahrten am selben Datum werden verknuepft. Rueckfahrt zum Start ist pro Spieltag enthalten.", {
      fontSize: 8.3,
      color: COLORS.muted,
      lineHeight: 4,
      sectionOnNewPage: "Fahrtkosten",
    });
    writeText(
      doc,
      state,
      `Gesamtroute: ${formatDistanceLabel(routeTotalKm)} | ${formatMinutesLabel(routeTotalMinutes)}`,
      {
        fontSize: 8.6,
        style: "bold",
        color: COLORS.accent,
        lineHeight: 4.1,
        sectionOnNewPage: "Fahrtkosten",
      },
    );
    state.y += 1;

    const routeCols = [10, 18, 98, 24, 36];
    const routeHeaders = ["Nr.", "Tag", "Segment", "km", "Zeit"];
    const routeHeaderHeight = 6;
    const routeTableX = MARGIN_X;

    function drawRouteHeader() {
      ensureSpace(doc, state, routeHeaderHeight + 1, "Fahrtkosten", () => {
        drawSectionTitle(doc, state, "Fahrtkosten-Abrechnung (Fortsetzung)", "Fahrtkosten");
        drawRouteHeader();
      });

      doc.setFillColor(237, 242, 247);
      doc.setDrawColor(COLORS.line[0], COLORS.line[1], COLORS.line[2]);
      doc.rect(routeTableX, state.y, PAGE_WIDTH - MARGIN_X * 2, routeHeaderHeight, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);

      let cursorX = routeTableX + 1.8;
      for (let index = 0; index < routeHeaders.length; index += 1) {
        doc.text(routeHeaders[index], cursorX, state.y + 4.2);
        cursorX += routeCols[index];
      }

      state.y += routeHeaderHeight;
    }

    drawRouteHeader();

    for (const routeRow of routeRows) {
      const values = [
        String(routeRow.index),
        routeRow.dateLabel || "--",
        truncatePlain(routeRow.segment, 72),
        formatDistanceLabel(routeRow.distanceKm),
        formatMinutesLabel(routeRow.durationMinutes),
      ];

      const segmentLines = doc.splitTextToSize(values[2], Math.max(12, routeCols[2] - 2)).slice(0, 2);
      const rowHeight = Math.max(6, segmentLines.length * 3.8 + 2.2);
      ensureSpace(doc, state, rowHeight + 1, "Fahrtkosten", () => {
        drawSectionTitle(doc, state, "Fahrtkosten-Abrechnung (Fortsetzung)", "Fahrtkosten");
        drawRouteHeader();
      });

      doc.setDrawColor(COLORS.line[0], COLORS.line[1], COLORS.line[2]);
      doc.rect(routeTableX, state.y, PAGE_WIDTH - MARGIN_X * 2, rowHeight, "S");

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.1);
      doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);

      let cursorX = routeTableX + 1.8;
      for (let colIndex = 0; colIndex < values.length; colIndex += 1) {
        if (colIndex === 2) {
          let lineY = state.y + 3.8;
          for (const line of segmentLines) {
            doc.text(sanitizePdfText(line), cursorX, lineY);
            lineY += 3.8;
          }
        } else {
          doc.text(sanitizePdfText(values[colIndex]), cursorX, state.y + 3.8);
        }
        cursorX += routeCols[colIndex];
      }

      state.y += rowHeight;
    }

    state.y += 4;
  }

  const cols = [10, 24, 88, 28, 36];
  const headers = ["Nr.", "Datum", "Strecke", "km", "Betrag"];
  const tableX = MARGIN_X;
  const headerHeight = 6.2;

  function drawTableHeader() {
    ensureSpace(doc, state, headerHeight + 1, "Fahrtkosten", () => {
      drawSectionTitle(doc, state, "Fahrtkosten-Abrechnung (Fortsetzung)", "Fahrtkosten");
      drawTableHeader();
    });

    doc.setFillColor(237, 242, 247);
    doc.setDrawColor(COLORS.line[0], COLORS.line[1], COLORS.line[2]);
    doc.rect(tableX, state.y, PAGE_WIDTH - MARGIN_X * 2, headerHeight, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
    let cursorX = tableX + 1.8;
    for (let index = 0; index < headers.length; index += 1) {
      doc.text(headers[index], cursorX, state.y + 4.3);
      cursorX += cols[index];
    }

    state.y += headerHeight;
  }

  let totalHR = 0;
  let totalEur = 0;
  if (rows.length === 0) {
    writeText(doc, state, "Keine abrechenbaren Strecken vorhanden.", {
      fontSize: 8.4,
      color: COLORS.muted,
      lineHeight: 4,
      sectionOnNewPage: "Fahrtkosten",
    });
    state.y += 3;
  } else {
    drawTableHeader();

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const baseKm = Number.isFinite(overrides[row.id]) ? overrides[row.id] : row.baseKm;
      const abrechnungsKm = isRouteMode ? baseKm : baseKm * 2;
      const betrag = abrechnungsKm * rate;
      totalHR += abrechnungsKm;
      totalEur += betrag;

      const dateStr = row.dateLabel || "";

      const values = [
        String(index + 1),
        dateStr,
        truncatePlain(row.label || "-", 64),
        `${abrechnungsKm.toFixed(1).replace(".", ",")} km`,
        `${betrag.toFixed(2).replace(".", ",")} €`,
      ];

      const gameLines = doc.splitTextToSize(values[2], Math.max(8, cols[2] - 2)).slice(0, 2);
      const rowHeight = Math.max(5.4, gameLines.length * 3.8 + 2.2);
      ensureSpace(doc, state, rowHeight + 1, "Fahrtkosten", () => {
        drawSectionTitle(doc, state, "Fahrtkosten-Abrechnung (Fortsetzung)", "Fahrtkosten");
        drawTableHeader();
      });

      if (index % 2 === 1) {
        doc.setFillColor(COLORS.tableStripe[0], COLORS.tableStripe[1], COLORS.tableStripe[2]);
        doc.rect(tableX, state.y, PAGE_WIDTH - MARGIN_X * 2, rowHeight, "F");
      }

      doc.setDrawColor(COLORS.line[0], COLORS.line[1], COLORS.line[2]);
      doc.rect(tableX, state.y, PAGE_WIDTH - MARGIN_X * 2, rowHeight, "S");

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.1);

      let cursorX = tableX + 1.8;
      for (let colIndex = 0; colIndex < values.length; colIndex += 1) {
        if (colIndex === values.length - 1) {
          doc.setTextColor(COLORS.accent[0], COLORS.accent[1], COLORS.accent[2]);
        } else {
          doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
        }
        if (colIndex === 2) {
          let lineY = state.y + 3.8;
          for (const line of gameLines) {
            doc.text(sanitizePdfText(line), cursorX, lineY);
            lineY += 3.8;
          }
        } else {
          doc.text(sanitizePdfText(values[colIndex]), cursorX, state.y + 3.8);
        }
        cursorX += cols[colIndex];
      }

      state.y += rowHeight;
    }

    const summaryHeight = 6;
    ensureSpace(doc, state, summaryHeight + 10, "Fahrtkosten", () => {
      drawSectionTitle(doc, state, "Fahrtkosten-Abrechnung (Fortsetzung)", "Fahrtkosten");
      drawTableHeader();
    });

    doc.setFillColor(COLORS.tableStripe[0], COLORS.tableStripe[1], COLORS.tableStripe[2]);
    doc.setDrawColor(COLORS.line[0], COLORS.line[1], COLORS.line[2]);
    doc.rect(tableX, state.y, PAGE_WIDTH - MARGIN_X * 2, summaryHeight, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.4);
    doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
    doc.text("Gesamt", tableX + 1.8, state.y + 4.2);

    const kmX = tableX + cols.slice(0, 3).reduce((sum, col) => sum + col, 0) + 1.8;
    doc.text(`${totalHR.toFixed(1).replace(".", ",")} km`, kmX, state.y + 4.2);
    doc.setTextColor(COLORS.accent[0], COLORS.accent[1], COLORS.accent[2]);
    doc.text(`${totalEur.toFixed(2).replace(".", ",")} €`, kmX + cols[3], state.y + 4.2);
    state.y += summaryHeight + 6;
  }

  if (attendanceRows.length === 0) {
    writeText(doc, state, "Keine Arbeitszeitdaten vorhanden.", {
      fontSize: 8.4,
      color: COLORS.muted,
      lineHeight: 4,
      sectionOnNewPage: "Fahrtkosten",
    });
    return;
  }

  let recordedGames = 0;
  let totalPresenceMinutes = 0;

  for (const row of attendanceRows) {
    const minutes = presenceMinutesForGame(row.id);
    if (Number.isFinite(minutes)) {
      recordedGames += 1;
      totalPresenceMinutes += minutes;
    }
  }

  const openGames = Math.max(0, attendanceRows.length - recordedGames);
  const totalPresenceLabel = recordedGames > 0 ? formatPresenceMinutes(totalPresenceMinutes) : "nicht erfasst";

  writeText(doc, state, "Arbeitszeit vor Ort", {
    fontSize: 9,
    style: "bold",
    color: COLORS.text,
    lineHeight: 4.2,
    sectionOnNewPage: "Fahrtkosten",
  });
  writeText(
    doc,
    state,
    "Hier kann die tatsächliche Vor-Ort-Dauer pro Spiel dokumentiert werden (z. B. früher gegangen oder länger geblieben).",
    {
      fontSize: 8.2,
      color: COLORS.muted,
      lineHeight: 4,
      sectionOnNewPage: "Fahrtkosten",
    },
  );
  state.y += 1;

  const summaryBoxHeight = 14;
  ensureSpace(doc, state, summaryBoxHeight + 1.5, "Fahrtkosten", () => {
    drawSectionTitle(doc, state, "Fahrtkosten-Abrechnung (Fortsetzung)", "Fahrtkosten");
  });
  doc.setFillColor(COLORS.tableStripe[0], COLORS.tableStripe[1], COLORS.tableStripe[2]);
  doc.setDrawColor(COLORS.line[0], COLORS.line[1], COLORS.line[2]);
  doc.roundedRect(MARGIN_X, state.y, PAGE_WIDTH - MARGIN_X * 2, summaryBoxHeight, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
  doc.text("Erfasst", MARGIN_X + 2.2, state.y + 4.8);
  doc.text("Offen", MARGIN_X + 52, state.y + 4.8);
  doc.text("Gesamt vor Ort", MARGIN_X + 92, state.y + 4.8);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.2);
  doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
  doc.text(`${recordedGames}/${attendanceRows.length} Spiele`, MARGIN_X + 2.2, state.y + 10.1);
  doc.text(String(openGames), MARGIN_X + 52, state.y + 10.1);
  doc.setTextColor(COLORS.accent[0], COLORS.accent[1], COLORS.accent[2]);
  doc.text(totalPresenceLabel, MARGIN_X + 92, state.y + 10.1);

  state.y += summaryBoxHeight + 3;

  const attendanceCols = [10, 22, 14, 86, 22, 28];
  const attendanceHeaders = ["Nr.", "Datum", "Zeit", "Spiel", "Status", "Dauer"];
  const attendanceTableX = MARGIN_X;
  const attendanceHeaderHeight = 6;

  function drawAttendanceHeader() {
    ensureSpace(doc, state, attendanceHeaderHeight + 1, "Fahrtkosten", () => {
      drawSectionTitle(doc, state, "Fahrtkosten-Abrechnung (Fortsetzung)", "Fahrtkosten");
      drawAttendanceHeader();
    });

    doc.setFillColor(237, 242, 247);
    doc.setDrawColor(COLORS.line[0], COLORS.line[1], COLORS.line[2]);
    doc.rect(attendanceTableX, state.y, PAGE_WIDTH - MARGIN_X * 2, attendanceHeaderHeight, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);

    let cursorX = attendanceTableX + 1.8;
    for (let index = 0; index < attendanceHeaders.length; index += 1) {
      doc.text(attendanceHeaders[index], cursorX, state.y + 4.2);
      cursorX += attendanceCols[index];
    }

    state.y += attendanceHeaderHeight;
  }

  drawAttendanceHeader();

  for (let index = 0; index < attendanceRows.length; index += 1) {
    const row = attendanceRows[index];
    const presenceMinutes = presenceMinutesForGame(row.id);
    const isRecorded = Number.isFinite(presenceMinutes);
    const presenceLabel = isRecorded ? formatPresenceMinutes(presenceMinutes) : "nicht erfasst";
    const values = [
      String(index + 1),
      row.dateLabel || "--",
      row.timeLabel || "--:--",
      truncatePlain(row.matchLabel || "-", 58),
      isRecorded ? "Erfasst" : "Offen",
      presenceLabel,
    ];

    const matchLines = doc.splitTextToSize(values[3], Math.max(8, attendanceCols[3] - 2)).slice(0, 2);
    const rowHeight = Math.max(6, matchLines.length * 3.8 + 2.2);
    ensureSpace(doc, state, rowHeight + 1, "Fahrtkosten", () => {
      drawSectionTitle(doc, state, "Fahrtkosten-Abrechnung (Fortsetzung)", "Fahrtkosten");
      drawAttendanceHeader();
    });

    if (index % 2 === 1) {
      doc.setFillColor(COLORS.tableStripe[0], COLORS.tableStripe[1], COLORS.tableStripe[2]);
      doc.rect(attendanceTableX, state.y, PAGE_WIDTH - MARGIN_X * 2, rowHeight, "F");
    }

    doc.setDrawColor(COLORS.line[0], COLORS.line[1], COLORS.line[2]);
    doc.rect(attendanceTableX, state.y, PAGE_WIDTH - MARGIN_X * 2, rowHeight, "S");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.1);

    let cursorX = attendanceTableX + 1.8;
    for (let colIndex = 0; colIndex < values.length; colIndex += 1) {
      const value = values[colIndex];
      if (colIndex === values.length - 1 && !isRecorded) {
        doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
      } else if (colIndex === values.length - 1 || colIndex === values.length - 2) {
        doc.setTextColor(COLORS.accent[0], COLORS.accent[1], COLORS.accent[2]);
      } else {
        doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
      }

      if (colIndex === 3) {
        let lineY = state.y + 3.8;
        for (const line of matchLines) {
          doc.text(sanitizePdfText(line), cursorX, lineY);
          lineY += 3.8;
        }
      } else {
        doc.text(sanitizePdfText(value), cursorX, state.y + 3.8);
      }
      cursorX += attendanceCols[colIndex];
    }

    state.y += rowHeight;
  }

  state.y += 1.8;
  writeText(doc, state, `Status: ${recordedGames}/${attendanceRows.length} erfasst · ${openGames} offen`, {
    fontSize: 8.4,
    color: COLORS.muted,
    lineHeight: 4,
    sectionOnNewPage: "Fahrtkosten",
  });

  writeText(doc, state, `Gesamte Vor-Ort-Dauer: ${totalPresenceLabel}`, {
    fontSize: 8.6,
    style: "bold",
    color: COLORS.text,
    lineHeight: 4,
    sectionOnNewPage: "Fahrtkosten",
  });
}
