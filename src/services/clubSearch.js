const ABSOLUTE_HTTP_RE = /^https?:\/\//i;
const CLUB_SEARCH_TIMEOUT_MS = Number(import.meta.env?.VITE_CLUB_SEARCH_TIMEOUT_MS || 4500);
const LOCAL_CATALOG_URL = String(import.meta.env?.VITE_LOCAL_CLUB_CATALOG_URL || "/data/clubs.catalog.json").trim();

let localCatalogPromise = null;

function normalizeEndpoint(value) {
  return String(value || "").trim();
}

function withClearedSearchAndHash(url) {
  url.search = "";
  url.hash = "";
  return url;
}

function replaceGamesPath(pathname) {
  if (!/\/api\/games\/?$/i.test(pathname)) {
    return null;
  }

  return pathname.replace(/\/api\/games\/?$/i, "/api/clubs/search");
}

export function resolveClubSearchUrl(adapterEndpoint) {
  const endpoint = normalizeEndpoint(adapterEndpoint);
  const fallbackPath = "/api/clubs/search";

  if (!endpoint) {
    return fallbackPath;
  }

  if (endpoint.startsWith("/")) {
    return replaceGamesPath(endpoint) || fallbackPath;
  }

  if (!ABSOLUTE_HTTP_RE.test(endpoint)) {
    return fallbackPath;
  }

  try {
    const parsed = new URL(endpoint);
    parsed.pathname = replaceGamesPath(parsed.pathname) || fallbackPath;
    return withClearedSearchAndHash(parsed).toString();
  } catch {
    return fallbackPath;
  }
}

function isAbsoluteUrl(value) {
  return ABSOLUTE_HTTP_RE.test(String(value || "").trim());
}

function buildRequestUrl(baseUrl, query, limit) {
  const normalizedQuery = String(query || "").trim();
  const safeLimit = Math.min(20, Math.max(1, Number(limit) || 8));

  try {
    const parsed = isAbsoluteUrl(baseUrl)
      ? new URL(baseUrl)
      : new URL(baseUrl, typeof window === "undefined" ? "http://localhost" : window.location.origin);

    parsed.searchParams.set("q", normalizedQuery);
    parsed.searchParams.set("limit", String(safeLimit));

    if (isAbsoluteUrl(baseUrl)) {
      return parsed.toString();
    }

    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return `${baseUrl}?q=${encodeURIComponent(normalizedQuery)}&limit=${encodeURIComponent(String(safeLimit))}`;
  }
}

function toLookupKey(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeLogoUrl(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }

  if (text.startsWith("//")) {
    return `https:${text}`;
  }

  if (ABSOLUTE_HTTP_RE.test(text)) {
    return text;
  }

  return "";
}

function normalizeClubSuggestion(item) {
  if (!item || typeof item !== "object") {
    return null;
  }

  const name = String(item.name || "").trim();
  if (!name) {
    return null;
  }

  return {
    name,
    location: String(item.location || "").trim(),
    logoUrl: normalizeLogoUrl(item.logoUrl || item.logo || ""),
    link: String(item.link || "").trim(),
  };
}

function dedupeSuggestions(items) {
  const unique = [];
  const seen = new Set();

  for (const item of Array.isArray(items) ? items : []) {
    const normalized = normalizeClubSuggestion(item);
    if (!normalized) {
      continue;
    }

    const key = toLookupKey(normalized.name);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(normalized);
  }

  return unique;
}

async function parseJsonSafe(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = CLUB_SEARCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function loadLocalCatalog() {
  if (typeof window === "undefined" || !LOCAL_CATALOG_URL) {
    return [];
  }

  if (!localCatalogPromise) {
    localCatalogPromise = (async () => {
      try {
        const response = await fetch(LOCAL_CATALOG_URL, {
          method: "GET",
          headers: { Accept: "application/json" },
        });
        if (!response.ok) {
          return [];
        }

        const payload = await parseJsonSafe(response);
        const clubs = Array.isArray(payload) ? payload : Array.isArray(payload?.clubs) ? payload.clubs : [];
        return dedupeSuggestions(clubs);
      } catch {
        return [];
      }
    })();
  }

  return localCatalogPromise;
}

function scoreLocalCandidate(name, queryKey) {
  const candidateKey = toLookupKey(name);
  if (!candidateKey || !queryKey || !candidateKey.includes(queryKey)) {
    return -1;
  }

  if (candidateKey === queryKey) {
    return 4;
  }
  if (candidateKey.startsWith(queryKey)) {
    return 3;
  }
  if (candidateKey.split(" ").some((token) => token.startsWith(queryKey))) {
    return 2;
  }
  return 1;
}

function findLocalSuggestions(catalog, query, limit) {
  const queryKey = toLookupKey(query);
  if (!queryKey) {
    return [];
  }

  const scored = [];
  for (const item of Array.isArray(catalog) ? catalog : []) {
    const score = scoreLocalCandidate(item?.name, queryKey);
    if (score < 0) {
      continue;
    }
    scored.push({ score, item });
  }

  scored.sort((left, right) => {
    if (left.score !== right.score) {
      return right.score - left.score;
    }
    return String(left.item?.name || "").localeCompare(String(right.item?.name || ""), "de-DE");
  });

  return scored.slice(0, limit).map((entry) => entry.item);
}

function mergeSuggestions(primary, fallback, limit) {
  const merged = dedupeSuggestions([...(Array.isArray(primary) ? primary : []), ...(Array.isArray(fallback) ? fallback : [])]);
  return merged.slice(0, Math.max(1, Number(limit) || 8));
}

export async function fetchClubSuggestions(adapterEndpoint, adapterToken, query, limit = 8) {
  const normalizedQuery = String(query || "").trim().replace(/\s+/g, " ");
  const safeLimit = Math.min(20, Math.max(1, Number(limit) || 8));
  if (normalizedQuery.length < 2) {
    return [];
  }

  const localCatalog = await loadLocalCatalog();
  const localMatches = findLocalSuggestions(localCatalog, normalizedQuery, safeLimit);
  if (localMatches.length >= safeLimit) {
    return localMatches;
  }

  const url = buildRequestUrl(resolveClubSearchUrl(adapterEndpoint), normalizedQuery, safeLimit);
  const headers = { Accept: "application/json" };
  const token = String(adapterToken || "").trim();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetchJsonWithTimeout(
      url,
      {
        method: "GET",
        headers,
      },
      CLUB_SEARCH_TIMEOUT_MS,
    );
  } catch {
    return localMatches;
  }

  const payload = await parseJsonSafe(response);
  if (!response.ok) {
    return localMatches;
  }

  const remoteClubs = Array.isArray(payload?.clubs) ? payload.clubs : [];
  const remoteMatches = dedupeSuggestions(remoteClubs);
  if (remoteMatches.length === 0) {
    return localMatches;
  }

  return mergeSuggestions(remoteMatches, localMatches, safeLimit);
}

export function __resetClubSearchCacheForTests() {
  localCatalogPromise = null;
}
