function normalizeLookup(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(value) {
  return decodeHtml(String(value || "").replace(/<[^>]*>/g, " "));
}

function compactText(value) {
  return String(value || "")
    .replace(/\uFFFD/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeAgeGroup(value) {
  const match = String(value || "").match(/U\s*[- ]?\s*(15|16|17|18|19)/i);
  return match ? `U${match[1]}` : "";
}

function parseGermanDate(value, fallbackYear = "") {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (match) {
    return `${match[3]}-${String(match[2]).padStart(2, "0")}-${String(match[1]).padStart(2, "0")}`;
  }
  const shortMatch = text.match(/^(\d{1,2})\.(\d{1,2})\.$/);
  if (shortMatch && fallbackYear) {
    return `${fallbackYear}-${String(shortMatch[2]).padStart(2, "0")}-${String(shortMatch[1]).padStart(2, "0")}`;
  }
  return "";
}

function parseFlexibleGermanDate(value) {
  const text = String(value || "").trim();
  const match = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (!match) {
    return "";
  }
  return `${match[3]}-${String(match[2]).padStart(2, "0")}-${String(match[1]).padStart(2, "0")}`;
}

function overlapsDateRange(dateFrom, dateTo, filterFrom, filterTo) {
  if (!dateFrom) {
    return false;
  }
  const start = dateFrom;
  const end = dateTo || dateFrom;
  const from = String(filterFrom || "").trim();
  const to = String(filterTo || filterFrom || "").trim();
  if (from && end < from) {
    return false;
  }
  if (to && start > to) {
    return false;
  }
  return true;
}

function slug(value) {
  return normalizeLookup(value).replace(/\s+/g, "-");
}

function absolutizeUrl(value, baseUrl) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }
  const base = String(baseUrl || "").replace(/\/+$/, "");
  return `${base}${raw.startsWith("/") ? raw : `/${raw}`}`;
}

function parseDfbDateRange(dateText) {
  const text = String(dateText || "").replace(/[–—]/g, "-").trim();
  const fullDate = text.match(/^(\d{1,2}\.\d{1,2}\.\d{4})$/);
  if (fullDate) {
    const date = parseGermanDate(fullDate[1]);
    return { date, dateTo: "" };
  }

  const range = text.match(/^(\d{1,2}\.\d{1,2}\.?)\s*-\s*(\d{1,2}\.\d{1,2}\.(\d{4}))$/);
  if (range) {
    return {
      date: parseGermanDate(range[1], range[3]),
      dateTo: parseGermanDate(range[2]),
    };
  }

  const embedded = text.match(/(\d{1,2}\.\d{1,2}\.(\d{4}))/);
  if (embedded) {
    const date = parseGermanDate(embedded[1]);
    return { date, dateTo: "" };
  }

  return { date: "", dateTo: "" };
}

function parseTeamsFromEvent(eventText, ageGroup) {
  const normalizedEvent = compactText(eventText);
  const match = normalizedEvent.match(/^(.*?)?\b(Deutschland\s+U\s*[- ]?\s*(?:15|16|17|18|19))\s*[-:]\s*(.+)$/i);
  if (match) {
    return {
      competitionName: compactText(match[1] || "Länderspiel") || "Länderspiel",
      home: compactText(match[2]).replace(/\s+/g, " "),
      away: compactText(match[3]),
    };
  }
  return {
    competitionName: normalizedEvent,
    home: `Deutschland ${ageGroup}`,
    away: normalizedEvent || "Termin",
  };
}

function splitDfbCells(html) {
  const rows = [];
  const rowMatches = [...String(html || "").matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  for (const rowMatch of rowMatches) {
    const cells = [...rowMatch[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map((cell) => compactText(stripTags(cell[1])))
      .filter(Boolean);
    if (cells.length >= 3 && /\d{1,2}\.\d{1,2}/.test(cells[0])) {
      rows.push(cells);
    }
  }
  if (rows.length > 0) {
    return rows;
  }

  const text = compactText(stripTags(String(html || "").replace(/<br\s*\/?>/gi, "\n")));
  const linePattern =
    /(\d{1,2}\.\d{1,2}\.?\s*(?:[–—-]\s*\d{1,2}\.\d{1,2}\.\d{4}|\d{4}))\s*(?:(\d{1,2}:\d{2})\s*)?(.+?)(?=\d{1,2}\.\d{1,2}\.?\s*(?:[–—-]\s*\d{1,2}\.\d{1,2}\.\d{4}|\d{4})|$)/g;
  return [...text.matchAll(linePattern)].map((match) => [match[1], match[2] || "", compactText(match[3] || "")]);
}

export function parseDfbNationalGamesFromHtml(html, options = {}) {
  const ageGroup = normalizeAgeGroup(options.ageGroup) || normalizeAgeGroup(html);
  if (!ageGroup) {
    return [];
  }

  return splitDfbCells(html)
    .map((cells) => {
      const dateCell = cells[0] || "";
      const timeCell = /^\d{1,2}:\d{2}$/.test(cells[1] || "") ? cells[1] : "";
      const eventCell = timeCell ? cells[2] || "" : cells.slice(1).join(" ");
      const venueCell = timeCell ? cells.slice(3).join(" ") : "";
      const { date, dateTo } = parseDfbDateRange(dateCell);
      if (!date) {
        return null;
      }
      const eventParts = compactText(eventCell).split(/\s{2,}|\s+(?=Sportschule|DFB Campus|Kaiserau|Duisburg|Frankfurt)/);
      const rawEvent = compactText(eventParts[0] || eventCell);
      const venue = compactText(venueCell || eventParts.slice(1).join(" "));
      const teams = parseTeamsFromEvent(rawEvent, ageGroup);
      return {
        id: `dfb-${ageGroup.toLowerCase()}-${date}-${slug(teams.home)}-${slug(teams.away)}`,
        source: "national",
        provider: "dfb.de",
        ageGroup,
        home: teams.home,
        away: teams.away,
        date,
        dateTo,
        time: timeCell ? timeCell.padStart(5, "0") : "--:--",
        venue,
        competitionName: teams.competitionName,
        matchUrl: String(options.sourceUrl || "").trim(),
        url: String(options.sourceUrl || "").trim(),
      };
    })
    .filter(Boolean)
    .filter((game) => overlapsDateRange(game.date, game.dateTo, options.fromDate, options.toDate));
}

function parseJsonPayloadFromMeinturnierplan(html) {
  const match = String(html || "").match(/window\.mapSearchTournaments\s*=\s*(\{[\s\S]*?\});/);
  if (!match || !match[1]) {
    return null;
  }
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function normalizeTournament(raw, options = {}) {
  const name = compactText(raw.name || raw.title);
  const url = absolutizeUrl(raw.url, options.baseUrl);
  const externalId = compactText(raw.externalId || raw.id || url.replace(/^.*[?&]id=([^&#]+).*$/i, "$1"));
  const dateFrom = raw.dateFrom || parseFlexibleGermanDate(raw.startDate || raw.dateText || "");
  const dateTo = raw.dateTo || parseFlexibleGermanDate(raw.endDate || "") || dateFrom;
  const timeFrom = compactText(raw.timeFrom || raw.startTime || "");
  const timeTo = compactText(raw.timeTo || raw.endTime || "");
  const venueParts = [raw.venue, raw.location, raw.address].map(compactText).filter(Boolean);
  const venue = [...new Set(venueParts)].join(", ");

  if (!name || !url || !externalId || !dateFrom) {
    return null;
  }

  return {
    id: `mtp-${externalId}`,
    externalId,
    source: "tournament",
    provider: "meinturnierplan.de",
    name,
    dateFrom,
    dateTo,
    timeFrom,
    timeTo,
    url,
    venue,
    teams: Array.isArray(raw.teams) ? raw.teams.map(compactText).filter(Boolean) : [],
    note: compactText(raw.note || ""),
  };
}

function extractTournamentsFromMapJson(html, options = {}) {
  const json = parseJsonPayloadFromMeinturnierplan(html);
  const features = Array.isArray(json?.features) ? json.features : [];
  return features
    .map((feature) => {
      const props = feature?.properties || {};
      return normalizeTournament(
        {
          id: String(props?.url || "").replace(/^.*[?&]id=([^&#]+).*$/i, "$1"),
          name: props?.name,
          url: props?.url,
          startDate: props?.startDate,
          endDate: props?.endDate,
          startTime: props?.startTime,
          endTime: props?.endTime,
          venue: props?.venue || props?.place || props?.location,
          address: props?.address,
        },
        options,
      );
    })
    .filter(Boolean);
}

function extractTournamentsFromPublicList(html, options = {}) {
  const input = String(html || "");
  const anchorPattern = /<a\b[^>]*href=["']([^"']*showit\.php\?id=[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const anchors = [...input.matchAll(anchorPattern)];
  const tournaments = [];
  for (let index = 0; index < anchors.length; index += 1) {
    const anchor = anchors[index];
    const nextAnchor = anchors[index + 1];
    const href = anchor[1];
    const title = compactText(stripTags(anchor[2]));
    const tail = input.slice(anchor.index + anchor[0].length, nextAnchor?.index ?? input.length);
    const text = compactText(stripTags(tail).replace(/\bPDF\b.*$/i, ""));
    const dateMatch = text.match(/(\d{1,2}\.\d{1,2}\.\d{4})(?:\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2}))?\s*,?\s*(.*)$/);
    if (!dateMatch) {
      continue;
    }
    tournaments.push(
      normalizeTournament(
        {
          id: href.replace(/^.*[?&]id=([^&#]+).*$/i, "$1"),
          name: title,
          url: href,
          dateFrom: parseGermanDate(dateMatch[1]),
          dateTo: parseGermanDate(dateMatch[1]),
          timeFrom: dateMatch[2] || "",
          timeTo: dateMatch[3] || "",
          venue: compactText(dateMatch[4] || "").replace(/\s+PDF\s*$/i, ""),
        },
        options,
      ),
    );
  }
  return tournaments.filter(Boolean);
}

function matchesKeywords(tournament, keywords) {
  const safeKeywords = (Array.isArray(keywords) ? keywords : [])
    .map((keyword) => normalizeLookup(keyword))
    .filter((keyword) => keyword.length >= 2);
  if (safeKeywords.length === 0) {
    return true;
  }
  const haystack = normalizeLookup([tournament.name, tournament.venue, tournament.teams?.join(" ")].filter(Boolean).join(" "));
  return safeKeywords.some((keyword) => haystack.includes(keyword));
}

export function extractMeinturnierplanTournaments(html, options = {}) {
  const tournaments = [...extractTournamentsFromMapJson(html, options), ...extractTournamentsFromPublicList(html, options)];
  const byId = new Map();
  for (const tournament of tournaments) {
    if (!overlapsDateRange(tournament.dateFrom, tournament.dateTo, options.fromDate, options.toDate)) {
      continue;
    }
    if (!matchesKeywords(tournament, options.keywords)) {
      continue;
    }
    byId.set(tournament.id, tournament);
  }
  return [...byId.values()];
}
