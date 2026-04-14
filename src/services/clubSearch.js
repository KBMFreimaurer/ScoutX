const ABSOLUTE_HTTP_RE = /^https?:\/\//i;

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

async function parseJsonSafe(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function fetchClubSuggestions(adapterEndpoint, adapterToken, query, limit = 8) {
  const normalizedQuery = String(query || "").trim().replace(/\s+/g, " ");
  if (normalizedQuery.length < 2) {
    return [];
  }

  const url = buildRequestUrl(resolveClubSearchUrl(adapterEndpoint), normalizedQuery, limit);
  const headers = { Accept: "application/json" };
  const token = String(adapterToken || "").trim();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers,
    });
  } catch {
    return [];
  }

  const payload = await parseJsonSafe(response);
  if (!response.ok) {
    return [];
  }

  const clubs = Array.isArray(payload?.clubs) ? payload.clubs : [];
  const normalized = clubs.map(normalizeClubSuggestion).filter(Boolean);

  const unique = [];
  const seen = new Set();

  for (const item of normalized) {
    const key = item.name.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(item);
  }

  return unique;
}
