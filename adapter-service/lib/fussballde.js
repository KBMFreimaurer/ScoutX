const JUGEND_TO_TEAM_TYPE = {
  bambini: "350",
  "f-jugend": "349",
  "e-jugend": "348",
  "d-jugend": "347",
  "c-jugend": "346",
  "b-jugend": "345",
  "a-jugend": "344",
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

  if (text.startsWith("http://") || text.startsWith("https://")) {
    return text;
  }

  return `https://www.fussball.de${text.startsWith("/") ? "" : "/"}${text}`;
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
  const matches = [];
  const seen = new Set();

  for (const rowMatch of rows) {
    const row = rowMatch[0];
    const teamNames = [...row.matchAll(/<div class="club-name">([\s\S]*?)<\/div>/gi)].map((m) => stripTags(m[1]));

    if (teamNames.length < 2) {
      continue;
    }

    const matchLink = row.match(/href="((?:https:\/\/www\.fussball\.de)?\/spiel\/[^"]+)"/i);
    if (!matchLink) {
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

  return matches;
}

function parseTimeFromText(value) {
  const text = String(value || "");
  const match = text.match(/([01]?\d|2[0-3]):([0-5]\d)/);
  if (!match) {
    return "";
  }

  return `${match[1].padStart(2, "0")}:${match[2]}`;
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

function pickAreaIdsForLeague(areaMap, kreisId) {
  const areas = normalizeAreas(areaMap);
  const entries = Object.entries(areas);
  const keywords = KREIS_AREA_KEYWORDS[kreisId] || [];

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

  const regional = entries
    .filter(([, label]) => {
      const lookup = normalizeLookup(label);
      return lookup.includes("niederrhein") && !lookup.includes("kreis");
    })
    .map(([areaId]) => areaId);

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
  KREIS_AREA_KEYWORDS,
  buildDateRange,
  extractCompetitionEntries,
  extractMatchDetails,
  extractMatchesFromDatePage,
  extractStaffelId,
  formatIsoDate,
  getValueByFlexibleKey,
  normalizeLookup,
  parseIsoDate,
  pickAreaIdsForLeague,
  stripLeadingUnderscore,
  stripTags,
  toAbsoluteFussballUrl,
  toSpieldatumUrl,
  uniqueBy,
};
