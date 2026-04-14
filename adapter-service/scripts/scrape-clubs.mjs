#!/usr/bin/env node

/**
 * Scrapes FVN/Niederrhein club data from fussball.de:
 *   - Uses AJAX club search endpoint with pagination
 *   - Searches city/district names per Kreis
 *   - Downloads logos locally to adapter-service/data/logos/
 *   - Writes adapter-service/data/clubs.catalog.json
 *
 * Usage: node adapter-service/scripts/scrape-clubs.mjs
 */

import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const LOGOS_DIR = join(DATA_DIR, "logos");
const OUTPUT_FILE = join(DATA_DIR, "clubs.catalog.json");

const BASE_URL = "https://www.fussball.de";
const AJAX_SEARCH_URL = `${BASE_URL}/ajax.search.club.loadmore/-/mime-type/JSON/or/true/text`;
const REQUEST_TIMEOUT_MS = 12000;
const REQUEST_DELAY_MS = 600;
const LOGO_CONCURRENCY = 3;
const MAX_PAGES_PER_QUERY = 8;

const SEARCH_TERMS_PER_KREIS = {
  duesseldorf: [
    "Düsseldorf", "Velbert", "Hilden", "Ratingen", "Mettmann",
    "Erkrath", "Haan", "Heiligenhaus", "Wülfrath", "Monheim",
    "Langenfeld", "Benrath", "Gerresheim", "Eller", "Unterrath",
  ],
  duisburg: [
    "Duisburg", "Hamborn", "Homberg", "Walsum", "Rheinhausen",
    "Meiderich", "Rumeln", "Hochemmerich", "Neuenkamp",
    "Marxloh", "Bruckhausen", "Baerl", "Friemersheim", "Mundelheim",
  ],
  essen: [
    "Essen", "Kray", "Werden", "Kupferdreh", "Steele",
    "Katernberg", "Altenessen", "Borbeck", "Frintrop",
    "Stoppenberg", "Burgaltendorf", "Heisingen", "Überruhr", "Schönebeck",
  ],
  krefeld: [
    "Krefeld", "Uerdingen", "Fischeln", "Hüls", "Bockum",
    "Kempen", "Tönisberg", "Anrath", "Vorst",
    "Grefrath", "Hardt", "Tönisvorst", "Linn",
  ],
  moenchen: [
    "Mönchengladbach", "Gladbach", "Rheydt", "Odenkirchen", "Wickrath",
    "Korschenbroich", "Jüchen", "Wegberg", "Erkelenz",
    "Giesenkirchen", "Neuwerk", "Rheindahlen", "Hardt",
  ],
  neuss: [
    "Neuss", "Grevenbroich", "Dormagen", "Kaarst", "Meerbusch",
    "Büttgen", "Holzheim", "Uedesheim", "Hackenbroich", "Rommerskirchen",
    "Glehn", "Grimlinghausen", "Norf",
  ],
  oberhausen: [
    "Oberhausen", "Sterkrade", "Osterfeld", "Bottrop", "Kirchhellen",
    "Grafenwald", "Dinslaken", "Gladbeck", "Vondern",
    "Klosterhardt", "Schmachtendorf", "Alstaden",
  ],
  viersen: [
    "Viersen", "Dülken", "Süchteln", "Nettetal", "Schwalmtal",
    "Breyell", "Kaldenkirchen", "Lobberich", "Boisheim", "Amern",
    "Brüggen", "Niederkrüchten", "Willich",
  ],
  wesel: [
    "Wesel", "Xanten", "Hamminkeln", "Schermbeck", "Sonsbeck",
    "Hünxe", "Voerde", "Friedrichsfeld",
    "Drevenack", "Haldern", "Bislich", "Budberg", "Moers",
  ],
  kleve: [
    "Kleve", "Geldern", "Straelen", "Kevelaer", "Emmerich",
    "Kalkar", "Rees", "Bedburg-Hau", "Kranenburg", "Goch",
    "Weeze", "Wachtendonk", "Kerken", "Issum",
  ],
};

function log(msg) {
  process.stderr.write(`[scrape-clubs] ${msg}\n`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function sanitizeFilename(name) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function stripTags(input) {
  return String(input || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#039;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toAbsoluteUrl(path) {
  const text = String(path || "").trim();
  if (!text) return "";
  if (text.startsWith("//")) return `https:${text}`;
  if (text.startsWith("http")) return text;
  return `${BASE_URL}${text.startsWith("/") ? "" : "/"}${text}`;
}

function extractClubsFromHtml(html) {
  const entries = [...String(html || "").matchAll(/<a[^>]*href="([^"]+)"[^>]*class="[^"]*\bimage-wrapper\b[^"]*"[^>]*>([\s\S]*?)<\/a>/gi)];
  const clubs = [];

  for (const entry of entries) {
    const block = String(entry[2] || "");
    const name = stripTags(block.match(/<p[^>]*class="[^"]*\bname\b[^"]*"[^>]*>([\s\S]*?)<\/p>/i)?.[1] || "");
    if (!name) continue;

    const location = stripTags(block.match(/<p[^>]*class="[^"]*\bsub\b[^"]*"[^>]*>([\s\S]*?)<\/p>/i)?.[1] || "");
    const logoUrl = toAbsoluteUrl(block.match(/<img[^>]*src="([^"]+)"/i)?.[1] || "");
    const link = toAbsoluteUrl(entry[1] || "");

    clubs.push({ name, location, logoUrl, link });
  }

  return clubs;
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "ScoutXAdapter/1.0 (+https://www.fussball.de)",
        accept: "application/json,text/html",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function searchClubsPaginated(query) {
  const allClubs = [];

  for (let page = 0; page < MAX_PAGES_PER_QUERY; page++) {
    const offset = page * 20;
    let url = `${AJAX_SEARCH_URL}/${encodeURIComponent(query)}`;
    if (offset > 0) url += `/offset/${offset}`;

    try {
      const json = await fetchJson(url);
      const clubs = extractClubsFromHtml(json.html || "");
      allClubs.push(...clubs);

      if (json.final || clubs.length === 0) break;
    } catch (err) {
      log(`WARN: search "${query}" page ${page} failed: ${err.message}`);
      break;
    }

    await sleep(REQUEST_DELAY_MS);
  }

  return allClubs;
}

async function downloadLogo(logoUrl, clubName) {
  if (!logoUrl) return "";

  const filename = `${sanitizeFilename(clubName)}.png`;
  const filepath = join(LOGOS_DIR, filename);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const res = await fetch(logoUrl, {
      signal: controller.signal,
      headers: { "user-agent": "ScoutXAdapter/1.0" },
    });
    clearTimeout(timer);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const body = Readable.fromWeb(res.body);
    await pipeline(body, createWriteStream(filepath));
    return `logos/${filename}`;
  } catch (err) {
    log(`WARN: logo download failed for "${clubName}": ${err.message}`);
    return "";
  }
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

function normKey(name) {
  return String(name || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "").trim();
}

async function main() {
  await mkdir(LOGOS_DIR, { recursive: true });

  const allClubs = new Map();

  function addClub(club, kreisId) {
    const key = normKey(club.name);
    if (!key) return;

    const existing = allClubs.get(key);
    if (existing) {
      if (!existing.logoUrl && club.logoUrl) existing.logoUrl = club.logoUrl;
      if (!existing.location && club.location) existing.location = club.location;
      if (!existing.link && club.link) existing.link = club.link;
      if (kreisId && !existing.kreisIds.includes(kreisId)) existing.kreisIds.push(kreisId);
    } else {
      allClubs.set(key, { ...club, kreisIds: kreisId ? [kreisId] : [] });
    }
  }

  // Phase 1: Search per Kreis
  const kreisIds = Object.keys(SEARCH_TERMS_PER_KREIS);
  let totalSearches = 0;

  for (const kreisId of kreisIds) {
    const terms = SEARCH_TERMS_PER_KREIS[kreisId];
    log(`Kreis ${kreisId}: ${terms.length} Suchbegriffe`);

    for (const term of terms) {
      const clubs = await searchClubsPaginated(term);
      totalSearches++;

      for (const club of clubs) {
        addClub(club, kreisId);
      }

      log(`  "${term}": ${clubs.length} Ergebnisse (gesamt: ${allClubs.size})`);
      await sleep(REQUEST_DELAY_MS);
    }
  }

  log(`\nSuche abgeschlossen: ${totalSearches} Abfragen, ${allClubs.size} Vereine`);

  // Phase 2: Download logos
  const clubList = [...allClubs.values()].sort((a, b) => a.name.localeCompare(b.name, "de"));
  const withLogo = clubList.filter((c) => c.logoUrl);
  log(`Lade ${withLogo.length} Logos herunter...`);

  let downloaded = 0;
  await mapLimit(withLogo, LOGO_CONCURRENCY, async (club) => {
    const localPath = await downloadLogo(club.logoUrl, club.name);
    club.logoLocal = localPath;
    downloaded++;
    if (downloaded % 50 === 0) {
      log(`  ${downloaded}/${withLogo.length} Logos`);
    }
    await sleep(150);
  });

  log(`${downloaded} Logos heruntergeladen`);

  // Phase 3: Write JSON
  const output = {
    meta: {
      region: "FVN/Niederrhein",
      updatedAt: new Date().toISOString(),
      totalClubs: clubList.length,
      withLogo: clubList.filter((c) => c.logoLocal).length,
    },
    clubs: clubList.map((club) => ({
      name: club.name,
      location: club.location || "",
      logoUrl: club.logoUrl || "",
      logoLocal: club.logoLocal || "",
      link: club.link || "",
      kreisIds: club.kreisIds || [],
    })),
  };

  await writeFile(OUTPUT_FILE, JSON.stringify(output, null, 2), "utf8");
  log(`\nFertig! ${output.meta.totalClubs} Vereine -> ${OUTPUT_FILE}`);
  log(`Davon ${output.meta.withLogo} mit Logo`);
}

main().catch((err) => {
  log(`FEHLER: ${err.message}`);
  process.exit(1);
});
