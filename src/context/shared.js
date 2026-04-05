export function readStorage(key, fallback) {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const item = window.localStorage.getItem(key);
    return item ? { ...fallback, ...JSON.parse(item) } : fallback;
  } catch {
    return fallback;
  }
}

function isLocalHost(hostname) {
  const host = String(hostname || "").toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "0.0.0.0";
}

function tryParseAbsoluteUrl(urlText) {
  try {
    return new URL(urlText);
  } catch {
    return null;
  }
}

export function normalizeAdapterEndpoint(savedEndpoint, fallbackEndpoint) {
  const endpoint = String(savedEndpoint || "").trim();
  if (!endpoint) {
    return fallbackEndpoint;
  }

  if (typeof window === "undefined") {
    return endpoint;
  }

  const appIsLocal = isLocalHost(window.location.hostname);
  const parsed = tryParseAbsoluteUrl(endpoint);
  const endpointIsAbsolute = Boolean(parsed);
  const endpointIsLocal = endpointIsAbsolute ? isLocalHost(parsed.hostname) : false;
  const mixedContentRisk =
    window.location.protocol === "https:" && endpointIsAbsolute && parsed.protocol.toLowerCase() === "http:";

  if ((!appIsLocal && endpointIsLocal) || mixedContentRisk) {
    return fallbackEndpoint;
  }

  return endpoint;
}

export function normalizeLlmEndpoint(savedEndpoint, fallbackEndpoint) {
  const endpoint = String(savedEndpoint || "").trim();
  if (!endpoint) {
    return fallbackEndpoint;
  }

  if (typeof window === "undefined") {
    return endpoint;
  }

  const appIsLocal = isLocalHost(window.location.hostname);
  const parsed = tryParseAbsoluteUrl(endpoint);
  const endpointIsAbsolute = Boolean(parsed);
  const endpointIsLocal = endpointIsAbsolute ? isLocalHost(parsed.hostname) : false;
  const mixedContentRisk =
    window.location.protocol === "https:" && endpointIsAbsolute && parsed.protocol.toLowerCase() === "http:";

  if ((!appIsLocal && endpointIsLocal) || mixedContentRisk) {
    return fallbackEndpoint;
  }

  return endpoint;
}

export function getWeekRange(isoDate) {
  const [year, month, day] = String(isoDate || "").split("-").map(Number);
  const date = new Date(year, (month || 1) - 1, day || 1);
  date.setHours(0, 0, 0, 0);

  const weekday = (date.getDay() + 6) % 7;
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - weekday);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const toIso = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  return { fromDate: toIso(weekStart), toDate: toIso(weekEnd) };
}

export function normalizeTeamParameters(values) {
  const seen = new Set();
  const teams = [];

  for (const value of Array.isArray(values) ? values : []) {
    const team = String(value || "").trim();
    if (!team) {
      continue;
    }

    const key = team.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    teams.push(team);
  }

  return teams;
}

export function cleanScoutPlanText(rawText) {
  const lines = String(rawText || "")
    .replace(/[#*]/g, "")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => !/^(?:VALIDIERUNG)$/i.test(line.trim()))
    .filter((line) => !/^(?:Wettbewerbsniveau|Scout-?Niveau)\s*:/i.test(line.trim()));

  return lines.join("\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
