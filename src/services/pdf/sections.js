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
  const lines = String(planText || "").split("\n").map((line) => line.trim());
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
    const venue = matchGame ? toSafeString(matchGame.venue || "Sportanlage") : toSafeString(matchup[3] || "Sportanlage");

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
  const kickoffWindow = times.length > 0 ? `${formatMinutes(times[0])}–${formatMinutes(times[times.length - 1])}` : "--:--";

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
        doc.text(sanitizePdfText(`Fahrtfenster bis nächster Stopp: ca. ${travelWindow} Minuten`), textX, state.y + 17.7);
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
  const minutesLabel = Number.isFinite(routeOverview.estimatedMinutes) ? `${routeOverview.estimatedMinutes} Min` : "unbekannt";
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

function weatherText(game) {
  if (!game?.weather) {
    return "Wetter: unbekannt";
  }

  const temperature = Number.isFinite(game.weather.temperatureC) ? `${Math.round(game.weather.temperatureC)}°C` : "n/a";
  const precipitation = Number.isFinite(game.weather.precipitationProbability)
    ? `${Math.round(game.weather.precipitationProbability)}%`
    : "n/a";
  return `Wetter: ${temperature} · Niederschlag ${precipitation}`;
}

export function drawGameDetails(doc, state, games) {
  addPage(state, doc, "Spiel-Details");
  drawSectionTitle(doc, state, "Spiel-Details (Wetter & Notizen)", "Spiel-Details");

  if (!Array.isArray(games) || games.length === 0) {
    writeText(doc, state, "Keine Spiele verfügbar.", { fontSize: 9.5, color: COLORS.muted });
    return;
  }

  for (const game of games) {
    ensureSpace(doc, state, 20, "Spiel-Details");
    writeText(doc, state, `${toSafeString(game.home)} vs ${toSafeString(game.away)} (${formatKickoffLabel(game.time)})`, {
      fontSize: 9.2,
      style: "bold",
      color: COLORS.text,
      lineHeight: 4.4,
      sectionOnNewPage: "Spiel-Details",
    });
    writeText(doc, state, weatherText(game), {
      fontSize: 8.7,
      color: COLORS.muted,
      lineHeight: 4.1,
      sectionOnNewPage: "Spiel-Details",
    });
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
    const footerLeft = `${toSafeString(cfg?.kreisLabel) || "-"} · ${toSafeString(cfg?.jugendLabel) || "-"} · Export ${createdAt}`;
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

function truncatePlain(text, maxChars) {
  const safe = toSafeString(text);
  if (safe.length <= maxChars) {
    return safe;
  }
  return `${safe.slice(0, Math.max(0, maxChars - 3))}...`;
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
  const meta = `Erstellt: ${createdAt} · ab ${toSafeString(cfg?.fromDate) || "-"}`;
  doc.text(sanitizePdfText(meta), MARGIN_X, state.y);
  state.y += 6;

  drawSectionTitle(doc, state, `Spielübersicht (${games.length} Spiele)`, "Spielübersicht");

  const headers = [
    { key: "nr", label: "Nr.", width: 10 },
    { key: "date", label: "Datum", width: 26 },
    { key: "time", label: "Anstoß", width: 16 },
    { key: "match", label: "Begegnung", width: 62 },
    { key: "venue", label: "Spielort", width: 72 },
  ];
  const tableX = MARGIN_X;
  let rowIndex = 0;

  drawGamesTableHeader(doc, state, headers, "Spielübersicht (Fortsetzung)");

  for (let i = 0; i < games.length; i += 1) {
    const game = games[i];
    const row = {
      nr: String(i + 1),
      date: formatGameDate(game),
      time: kickoffText(game.time),
      match: `${toSafeString(game.home)} vs ${toSafeString(game.away)}`,
      venue: toSafeString(game.venue || "Sportanlage"),
    };

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

    let cursorX = tableX + 1.6;
    for (let c = 0; c < headers.length; c += 1) {
      const lines = lineCollections[c];
      let textY = state.y + 4.1;
      for (const line of lines) {
        doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
        doc.text(sanitizePdfText(line), cursorX, textY);
        textY += 3.8;
      }
      cursorX += headers[c].width;
    }

    state.y += rowHeight;
    rowIndex += 1;
  }
}

function buildDirectRouteRows(routeOverview, games, directRoutes, maxGames = 5) {
  const selectedGames = sortGamesByDateTime(Array.isArray(games) ? games : []).slice(0, maxGames);
  const provided = Array.isArray(directRoutes) ? directRoutes : [];

  return selectedGames.map((game, index) => {
    const providedRow = provided[index] || {};
    const distanceKm = toFiniteNumberOrNull(providedRow.distanceKm);
    const durationMinutes = toFiniteNumberOrNull(providedRow.durationMinutes);
    const fallbackDistance = toFiniteNumberOrNull(game?.fromStartRouteDistanceKm ?? game?.distanceKm);
    const resolvedDistance = distanceKm ?? fallbackDistance ?? null;
    const fallbackMinutes = toFiniteNumberOrNull(game?.fromStartRouteMinutes);
    const resolvedMinutes = durationMinutes !== null
      ? durationMinutes
      : fallbackMinutes !== null
        ? fallbackMinutes
        : estimateMinutes(resolvedDistance);

    return {
      index: index + 1,
      match: `${toSafeString(game.home)} vs ${toSafeString(game.away)}`,
      date: formatGameDate(game),
      time: kickoffText(game.time),
      venue: toSafeString(game.venue || "Sportanlage"),
      distanceKm: resolvedDistance,
      durationMinutes: resolvedMinutes,
    };
  });
}

function buildBetweenGamesRows(routeOverview, directRows) {
  const legs = Array.isArray(routeOverview?.legs) ? routeOverview.legs : [];
  const maxBetweenRows = Math.max(0, directRows.length - 1);
  if (maxBetweenRows === 0) {
    return [];
  }

  return legs.slice(1, 1 + maxBetweenRows).map((leg, index) => ({
    label: `Spiel ${index + 1} → Spiel ${index + 2}`,
    from: toSafeString(leg?.from),
    to: toSafeString(leg?.to),
    distanceKm: toFiniteNumberOrNull(leg?.distanceKm),
    durationMinutes: toFiniteNumberOrNull(leg?.durationMinutes),
  }));
}

export function drawRouteCalculationPage(doc, state, routeOverview, startLocationLabel = "Startort", games = [], directRoutes = []) {
  addPage(state, doc, "Routenberechnung");
  drawSectionTitle(doc, state, "Routenberechnung", "Routenberechnung");

  writeText(doc, state, `Startpunkt: ${toSafeString(startLocationLabel) || "Startort"}`, {
    fontSize: 9.4,
    style: "bold",
    color: COLORS.text,
    lineHeight: 4.4,
    sectionOnNewPage: "Routenberechnung",
  });

  const directRows = buildDirectRouteRows(routeOverview, games, directRoutes, 5);

  writeText(doc, state, "Direkt vom Startpunkt zu Spiel 1-5", {
    fontSize: 9.2,
    style: "bold",
    color: COLORS.accent,
    lineHeight: 4.3,
    sectionOnNewPage: "Routenberechnung",
  });

  if (directRows.length === 0) {
    writeText(doc, state, "Keine Spielrouten verfügbar.", {
      fontSize: 8.8,
      color: COLORS.muted,
      lineHeight: 4.1,
      sectionOnNewPage: "Routenberechnung",
    });
  } else {
    for (const row of directRows) {
      writeText(
        doc,
        state,
        `Spiel ${row.index}: ${row.match} · ${row.date} ${row.time} · ${formatDistanceLabel(row.distanceKm)} · ${formatMinutesLabel(row.durationMinutes)}`,
        {
          fontSize: 8.8,
          color: COLORS.text,
          lineHeight: 4.2,
          sectionOnNewPage: "Routenberechnung",
        },
      );
      writeText(doc, state, `Ort: ${row.venue}`, {
        fontSize: 8.1,
        color: COLORS.muted,
        lineHeight: 3.9,
        sectionOnNewPage: "Routenberechnung",
      });
      state.y += 0.5;
    }
  }

  state.y += 1.5;
  writeText(doc, state, "Zwischen den Spielen (in Reihenfolge)", {
    fontSize: 9.2,
    style: "bold",
    color: COLORS.accent,
    lineHeight: 4.3,
    sectionOnNewPage: "Routenberechnung",
  });

  const betweenRows = buildBetweenGamesRows(routeOverview, directRows);
  if (betweenRows.length === 0) {
    writeText(doc, state, "Keine Zwischenstrecken verfügbar.", {
      fontSize: 8.8,
      color: COLORS.muted,
      lineHeight: 4.1,
      sectionOnNewPage: "Routenberechnung",
    });
  } else {
    for (const row of betweenRows) {
      writeText(
        doc,
        state,
        `${row.label}: ${truncatePlain(row.from, 34)} -> ${truncatePlain(row.to, 34)} · ${formatDistanceLabel(row.distanceKm)} · ${formatMinutesLabel(row.durationMinutes)}`,
        {
          fontSize: 8.8,
          color: COLORS.text,
          lineHeight: 4.2,
          sectionOnNewPage: "Routenberechnung",
        },
      );
    }
  }

  if (routeOverview) {
    state.y += 2;
    writeText(
      doc,
      state,
      `Gesamtstrecke der geplanten Kette: ${formatDistanceLabel(Number(routeOverview.totalKm))} · Fahrzeit ca. ${formatMinutesLabel(Number(routeOverview.estimatedMinutes))}`,
      {
        fontSize: 9,
        style: "bold",
        color: COLORS.text,
        lineHeight: 4.4,
        sectionOnNewPage: "Routenberechnung",
      },
    );
  }
}
