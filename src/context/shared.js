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

function parseIsoDateStrict(isoDate) {
  const match = String(isoDate || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error("Ungültiges Startdatum. Bitte Format YYYY-MM-DD verwenden.");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw new Error("Ungültiges Startdatum. Bitte Format YYYY-MM-DD verwenden.");
  }

  return date;
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

export function getWeekRange(isoDate) {
  const date = parseIsoDateStrict(isoDate);
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
