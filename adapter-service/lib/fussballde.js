const JUGEND_TO_TEAM_TYPE = {
  bambini: "350",
  "f-jugend": "349",
  "e-jugend": "348",
  "d-jugend": "347",
  "c-jugend": "346",
  "b-jugend": "345",
  "a-jugend": "344",
};

const JUGEND_TO_TEAM_LABEL = {
  bambini: "G-Junioren",
  "f-jugend": "F-Junioren",
  "e-jugend": "E-Junioren",
  "d-jugend": "D-Junioren",
  "c-jugend": "C-Junioren",
  "b-jugend": "B-Junioren",
  "a-jugend": "A-Junioren",
};

const KREIS_AREA_KEYWORDS = {
  duesseldorf: ["dusseldorf"],
  duisburg: ["duisburg", "mulheim", "dinslak"],
  essen: ["essen"],
  krefeld: ["kempen", "krefeld"],
  moenchen: ["monchengladbach", "viersen"],
  neuss: ["grevenbroich", "neuss"],
  oberhausen: ["oberhausen", "bottrop"],
  viersen: ["viersen", "monchengladbach"],
  wesel: ["moers", "rees", "bocholt", "wesel"],
  kleve: ["kleve", "geldern", "rees", "bocholt"],
};

function normalizeMappingKeywords(values) {
  const source = Array.isArray(values) ? values : [values];
  return source
    .map((value) => normalizeLookup(value))
    .filter(Boolean);
}

function resolveFussballDeRegionParams({ kreisId = "", stateCode = "", regionName = "", regionShortCode = "", mapping = null } = {}) {
  const safeMapping = mapping && typeof mapping === "object" ? mapping : {};
  const searchName = String(safeMapping.searchName || regionName || kreisId || "").trim();
  const kreis = String(safeMapping.kreis || "").trim();
  const region = String(safeMapping.region || "").trim();
  const verband = String(safeMapping.verband || "").trim();
  const verbandLabel = String(safeMapping.verbandLabel || "").trim();
  const mandant = String(safeMapping.mandant || safeMapping.mandantCode || "").trim();
  const allowRegionalFallback = safeMapping.allowRegionalFallback === true;
  const explicitKeywords = normalizeMappingKeywords([
    ...(Array.isArray(safeMapping.areaKeywords) ? safeMapping.areaKeywords : []),
    safeMapping.kreis,
    safeMapping.region,
    safeMapping.searchName,
  ]);
  const legacyKeywords = KREIS_AREA_KEYWORDS[kreisId] || [];
  const fallbackKeywords = normalizeMappingKeywords([regionName, regionShortCode, kreisId]);
  const areaKeywords = [...new Set([...explicitKeywords, ...legacyKeywords, ...fallbackKeywords])];

  return {
    stateCode: String(stateCode || "").trim().toUpperCase(),
    regionName: String(regionName || "").trim(),
    regionShortCode: String(regionShortCode || "").trim(),
    kreisId: String(kreisId || "").trim(),
    searchName,
    verband,
    verbandLabel,
    mandant,
    allowRegionalFallback,
    kreis,
    region,
    areaKeywords,
    resultKeywords: normalizeMappingKeywords(safeMapping.resultKeywords || []),
    slugHints: Array.isArray(safeMapping.slugHints) ? safeMapping.slugHints.map((value) => String(value || "").trim()).filter(Boolean) : [],
    fallbackSearchName: searchName || String(regionName || kreisId || "").trim(),
    source: Object.keys(safeMapping).length > 0 ? "mapping" : "fallback",
  };
}

function warnParser(message) {
  console.warn(`[fussballde-parser] ${message}`);
}

function normalizeLookup(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function decodeHtmlEntities(input) {
  if (!input) {
    return "";
  }

  const named = String(input)
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");

  const decodedNumeric = named
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)));

  return decodedNumeric;
}

function stripTags(input) {
  return decodeHtmlEntities(String(input || ""))
    .replace(/<[^>]*>/g, " ")
    .replace(/\u200B|\u2060|\uFEFF/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripLeadingUnderscore(value) {
  const text = String(value || "");
  return text.startsWith("_") ? text.slice(1) : text;
}

function toAbsoluteFussballUrl(urlOrPath) {
  const text = String(urlOrPath || "").trim();
  if (!text) {
    return "";
  }

  if (text.startsWith("//")) {
    return `https:${text}`;
  }

  if (text.startsWith("http://") || text.startsWith("https://")) {
    return text;
  }

  return `https://www.fussball.de${text.startsWith("/") ? "" : "/"}${text}`;
}

function extractClubSearchResults(html, limit = 8) {
  const section = String(html || "").match(/<section id="club-search-results">([\s\S]*?)<\/section>/i)?.[1] || "";
  if (!section) {
    return [];
  }

  const safeLimit = Math.max(1, Number(limit) || 8);
  const entries = [...section.matchAll(/<a[^>]*href="([^"]+)"[^>]*class="[^"]*\bimage-wrapper\b[^"]*"[^>]*>([\s\S]*?)<\/a>/gi)];
  const seen = new Set();
  const clubs = [];

  for (const entry of entries) {
    const block = String(entry[2] || "");
    const name = stripTags(block.match(/<p[^>]*class="[^"]*\bname\b[^"]*"[^>]*>([\s\S]*?)<\/p>/i)?.[1] || "");
    if (!name) {
      continue;
    }

    const key = normalizeLookup(name);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    const location = stripTags(block.match(/<p[^>]*class="[^"]*\bsub\b[^"]*"[^>]*>([\s\S]*?)<\/p>/i)?.[1] || "");
    const logo = toAbsoluteFussballUrl(block.match(/<img[^>]*src="([^"]+)"/i)?.[1] || "");
    const link = toAbsoluteFussballUrl(entry[1] || "");

    clubs.push({
      name,
      location,
      logoUrl: logo,
      link,
    });

    if (clubs.length >= safeLimit) {
      break;
    }
  }

  return clubs;
}

function extractStaffelId(competitionUrl) {
  const text = String(competitionUrl || "");
  const match = text.match(/\/-\/staffel\/([^/?#]+)/i);
  return match ? match[1] : "";
}

function toSpieldatumUrl(competitionUrl, isoDate) {
  const base = String(competitionUrl || "").split("#")[0];
  const staffelId = extractStaffelId(base);
  if (!staffelId || !/^\d{4}-\d{2}-\d{2}$/.test(String(isoDate || ""))) {
    return "";
  }

  const playtagBase = base.replace("/spieltagsuebersicht/", "/spieltag/").replace(/\/-\/staffel\/[^/?#]+$/i, "");
  return `${playtagBase}/-/spieldatum/${isoDate}/staffel/${staffelId}`;
}

function parseIsoDate(value) {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return null;
  }

  const [year, month, day] = text.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function formatIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildDateRange(fromDate, toDate) {
  const start = parseIsoDate(fromDate);
  const end = parseIsoDate(toDate || fromDate);

  if (!start || !end) {
    return [];
  }

  const minDate = start <= end ? start : end;
  const maxDate = start <= end ? end : start;
  const dates = [];

  for (const cursor = new Date(minDate); cursor <= maxDate; cursor.setDate(cursor.getDate() + 1)) {
    dates.push(formatIsoDate(cursor));
  }

  return dates;
}

function extractMatchesFromDatePage(html) {
  const text = String(html || "");
  const fromMatchesSection = text.includes('<section id="matches">')
    ? text.split('<section id="matches">')[1]
    : text;
  const scoped = fromMatchesSection.split('<section id="table">')[0];

  const rows = [...scoped.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  if (rows.length === 0) {
    warnParser("Keine Tabellenzeilen in der Spieltagsseite gefunden (Selektor <tr> leer).");
  }

  const matches = [];
  const seen = new Set();
  let rowsWithoutTeams = 0;
  let rowsWithoutLink = 0;

  for (const rowMatch of rows) {
    const row = rowMatch[0];
    const teamNames = [...row.matchAll(/<div class="club-name">([\s\S]*?)<\/div>/gi)].map((m) => stripTags(m[1]));

    if (teamNames.length < 2) {
      rowsWithoutTeams += 1;
      continue;
    }

    const matchLink = row.match(/href="((?:https:\/\/www\.fussball\.de)?\/spiel\/[^"]+)"/i);
    if (!matchLink) {
      rowsWithoutLink += 1;
      continue;
    }

    const matchUrl = toAbsoluteFussballUrl(matchLink[1]);
    if (!matchUrl || !/\/-\/spiel\/[A-Z0-9]+/i.test(matchUrl) || seen.has(matchUrl)) {
      continue;
    }

    seen.add(matchUrl);
    matches.push({
      home: teamNames[0],
      away: teamNames[1],
      matchUrl,
    });
  }

  if (rowsWithoutTeams > 0) {
    warnParser(`${rowsWithoutTeams} Tabellenzeilen ohne Teamnamen erkannt (Selektor .club-name prüfen).`);
  }
  if (rowsWithoutLink > 0) {
    warnParser(`${rowsWithoutLink} Tabellenzeilen ohne Spiel-Link erkannt (Selektor /spiel/... prüfen).`);
  }

  return matches;
}

function parseTimeFromText(value) {
  const text = String(value || "");
  const match = text.match(/([01]?\d|2[0-3]):([0-5]\d)/);
  if (!match) {
    return "";
  }

  const normalized = `${match[1].padStart(2, "0")}:${match[2]}`;
  return normalized === "00:00" ? "" : normalized;
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collectTimesFromMatches(sourceText, regex) {
  const text = String(sourceText || "");
  const candidates = [];

  for (const match of text.matchAll(regex)) {
    const raw = stripTags(match[1] || "");
    const time = parseTimeFromText(raw);
    if (!time) {
      continue;
    }
    candidates.push({
      index: match.index ?? 0,
      time,
    });
  }

  return candidates;
}

function pickNearestPrecedingTime(candidates, anchorIndex, maxDistance) {
  let picked = "";
  let pickedIndex = -1;

  for (const candidate of candidates) {
    if (candidate.index > anchorIndex) {
      continue;
    }

    const distance = anchorIndex - candidate.index;
    if (distance > maxDistance) {
      continue;
    }

    if (candidate.index > pickedIndex) {
      picked = candidate.time;
      pickedIndex = candidate.index;
    }
  }

  return picked;
}

function extractKickoffFromTeamPageHtml(html, matchId) {
  if (!matchId) {
    return "";
  }

  const text = String(html || "");
  if (!text.includes(matchId)) {
    warnParser(`Match-ID ${matchId} nicht in Teamseite gefunden.`);
    return "";
  }

  const positions = [];
  let cursor = text.indexOf(matchId);
  while (cursor >= 0) {
    positions.push(cursor);
    cursor = text.indexOf(matchId, cursor + 1);
  }

  const columnDateTimes = collectTimesFromMatches(
    text,
    /<td[^>]*class="[^"]*\bcolumn-date\b[^"]*"[^>]*>([\s\S]*?)<\/td>/gi,
  );
  const rowHeadlineTimes = collectTimesFromMatches(
    text,
    /<tr[^>]*class="[^"]*\brow-headline\b[^"]*"[^>]*>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<\/tr>/gi,
  );

  for (const index of positions) {
    const fromColumnDate = pickNearestPrecedingTime(columnDateTimes, index, 2200);
    if (fromColumnDate) {
      return fromColumnDate;
    }

    const fromHeadline = pickNearestPrecedingTime(rowHeadlineTimes, index, 2600);
    if (fromHeadline) {
      return fromHeadline;
    }
  }

  const escapedMatchId = escapeRegExp(matchId);
  const cardRegex = new RegExp(
    `<a[^>]*href="[^"]*${escapedMatchId}[^"]*"[^>]*>[\\s\\S]*?<div[^>]*class="match-meta"[^>]*>([\\s\\S]*?)<\\/div>[\\s\\S]*?<\\/a>`,
    "gi",
  );
  const cardTimes = collectTimesFromMatches(text, cardRegex);
  if (cardTimes.length > 0) {
    return cardTimes[0].time;
  }

  warnParser(`Keine Anstoßzeit für Match-ID ${matchId} auf Teamseite gefunden.`);
  return "";
}

function parseIsoDateFromGerman(value) {
  const match = String(value || "").match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (!match) {
    return "";
  }

  return `${match[3]}-${match[2]}-${match[1]}`;
}

function extractMatchDetails(html) {
  const text = String(html || "");

  const dateFromLink = text.match(/\/spieldatum\/(\d{4}-\d{2}-\d{2})\//i)?.[1] || "";
  const dateFromTitle = parseIsoDateFromGerman(text.match(/<title>([^<]+)<\/title>/i)?.[1] || "");

  const kickoffText =
    text.match(/<h3>\s*Anpfiff\s*<\/h3>\s*<span>([^<]+)<\/span>/i)?.[1] ||
    text.match(/<h3>\s*Kickoff\s*<\/h3>\s*<span>([^<]+)<\/span>/i)?.[1] ||
    "";

  const venueBlock = text.match(/<a[^>]*class="location"[^>]*>([\s\S]*?)<\/a>/i)?.[1] || "";

  const teamNames = [...text.matchAll(/<div class="team-name">[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/div>/gi)].map((m) =>
    stripTags(m[1]),
  );

  if (!dateFromLink && !dateFromTitle) {
    warnParser("Spiel-Detailseite ohne Datum erkannt (weder /spieldatum/ noch Titel-Datum).");
  }
  if (!kickoffText) {
    warnParser("Spiel-Detailseite ohne Anpfiff-Block erkannt.");
  }
  if (!venueBlock) {
    warnParser("Spiel-Detailseite ohne Location-Block erkannt.");
  }
  if (teamNames.length < 2) {
    warnParser("Spiel-Detailseite ohne vollständige Teamnamen erkannt (Selektor .team-name).");
  }

  return {
    date: dateFromLink || dateFromTitle,
    time: parseTimeFromText(kickoffText),
    venue: stripTags(venueBlock),
    home: teamNames[0] || "",
    away: teamNames[1] || "",
  };
}

function getValueByFlexibleKey(obj, key) {
  if (!obj || typeof obj !== "object") {
    return undefined;
  }

  const direct = obj[key];
  if (direct !== undefined) {
    return direct;
  }

  return obj[`_${key}`];
}

function normalizeAreas(areaMap) {
  const normalized = {};
  for (const [rawAreaId, areaLabel] of Object.entries(areaMap || {})) {
    normalized[stripLeadingUnderscore(rawAreaId)] = String(areaLabel || "").trim();
  }
  return normalized;
}

function pickAreaIdsForLeague(areaMap, kreisId, regionParams = null) {
  const areas = normalizeAreas(areaMap);
  const entries = Object.entries(areas);
  const legacyKeywords = KREIS_AREA_KEYWORDS[kreisId] || [];
  const keywords = Array.isArray(regionParams?.areaKeywords) && regionParams.areaKeywords.length > 0
    ? regionParams.areaKeywords
    : legacyKeywords;

  if (entries.length === 0) {
    return [];
  }

  if (keywords.length === 0) {
    return entries.map(([areaId]) => areaId);
  }

  const matches = entries
    .filter(([, label]) => {
      const lookup = normalizeLookup(label);
      return keywords.some((keyword) => lookup.includes(keyword));
    })
    .map(([areaId]) => areaId);

  if (matches.length > 0) {
    return matches;
  }

  const verbandLookup = normalizeLookup(regionParams?.verband || "");
  const verbandLabelLookup = normalizeLookup(regionParams?.verbandLabel || "");
  const allowRegionalFallback =
    regionParams?.allowRegionalFallback === true || keywords.length === 0 || legacyKeywords.length > 0;

  const regional = allowRegionalFallback
    ? entries
        .filter(([, label]) => {
          const lookup = normalizeLookup(label);
          const knownRegional = verbandLookup
            ? lookup.includes(verbandLookup) ||
              (verbandLabelLookup && lookup.includes(verbandLabelLookup))
            : lookup.includes("niederrhein");
          return knownRegional && !lookup.includes("kreis");
        })
        .map(([areaId]) => areaId)
    : [];

  if (regional.length > 0) {
    return regional;
  }

  // Kreis is known but no area match found -> skip this league/area combination
  // instead of broadening to unrelated kreise.
  return [];
}

function extractCompetitionEntries(payload) {
  const out = [];

  for (const [rawLeagueId, byArea] of Object.entries(payload || {})) {
    if (!byArea || typeof byArea !== "object") {
      continue;
    }

    const leagueId = stripLeadingUnderscore(rawLeagueId);

    for (const [rawAreaId, competitions] of Object.entries(byArea)) {
      if (!competitions || typeof competitions !== "object") {
        continue;
      }

      const areaId = stripLeadingUnderscore(rawAreaId);

      for (const [rawUrl, label] of Object.entries(competitions)) {
        const url = toAbsoluteFussballUrl(stripLeadingUnderscore(rawUrl));
        if (!url) {
          continue;
        }

        out.push({
          leagueId,
          areaId,
          label: String(label || "").trim(),
          url,
        });
      }
    }
  }

  return out;
}

function uniqueBy(items, keyFn) {
  const map = new Map();

  for (const item of items) {
    const key = keyFn(item);
    if (!map.has(key)) {
      map.set(key, item);
    }
  }

  return [...map.values()];
}

export {
  JUGEND_TO_TEAM_TYPE,
  JUGEND_TO_TEAM_LABEL,
  KREIS_AREA_KEYWORDS,
  buildDateRange,
  extractCompetitionEntries,
  extractClubSearchResults,
  extractKickoffFromTeamPageHtml,
  extractMatchDetails,
  extractMatchesFromDatePage,
  extractStaffelId,
  formatIsoDate,
  getValueByFlexibleKey,
  normalizeLookup,
  parseIsoDate,
  pickAreaIdsForLeague,
  resolveFussballDeRegionParams,
  stripLeadingUnderscore,
  stripTags,
  toAbsoluteFussballUrl,
  toSpieldatumUrl,
  uniqueBy,
};
