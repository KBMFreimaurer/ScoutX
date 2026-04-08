const GEO_CACHE_KEY = "scoutplan.geo.cache.v1";
const ROUTE_CACHE_KEY = "scoutplan.route.cache.v1";
const REQUEST_INTERVAL_MS = 1000;
const ROUTING_BASE_URL = "https://router.project-osrm.org/route/v1/driving";
const PHOTON_BASE_URL = "https://photon.komoot.io/api/";
const KREIS_GEO_HINTS = {
  duesseldorf: "Düsseldorf, Deutschland",
  duisburg: "Duisburg, Deutschland",
  essen: "Essen, Deutschland",
  krefeld: "Krefeld, Deutschland",
  moenchen: "Mönchengladbach, Deutschland",
  neuss: "Neuss, Deutschland",
  oberhausen: "Oberhausen, Deutschland",
  viersen: "Viersen, Deutschland",
  wesel: "Wesel, Deutschland",
  kleve: "Kleve, Deutschland",
};
const KREIS_CENTERS = {
  duesseldorf: { lat: 51.2277, lon: 6.7735 },
  duisburg: { lat: 51.4344, lon: 6.7623 },
  essen: { lat: 51.4556, lon: 7.0116 },
  krefeld: { lat: 51.3388, lon: 6.5853 },
  moenchen: { lat: 51.1805, lon: 6.4428 },
  neuss: { lat: 51.2042, lon: 6.6879 },
  oberhausen: { lat: 51.4963, lon: 6.8638 },
  viersen: { lat: 51.2555, lon: 6.3948 },
  wesel: { lat: 51.6585, lon: 6.6176 },
  kleve: { lat: 51.7871, lon: 6.1381 },
};
const GENERIC_VENUE_TOKENS = new Set([
  "sportanlage",
  "sportplatz",
  "kunstrasenplatz",
  "rasenplatz",
  "hartplatz",
  "stadion",
  "platz",
  "hauptplatz",
  "spielfeld",
]);

let queue = Promise.resolve();
let lastRequestTs = 0;
const memoryCache = new Map();
const routeCache = new Map();

function now() {
  return Date.now();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeAddressKey(address) {
  return String(address || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function readSessionCache() {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.sessionStorage.getItem(GEO_CACHE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeSessionCache(cacheObj) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(GEO_CACHE_KEY, JSON.stringify(cacheObj));
  } catch {
    // Ignore storage quota errors.
  }
}

function readRouteCache() {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.sessionStorage.getItem(ROUTE_CACHE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeRouteCache(cacheObj) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(ROUTE_CACHE_KEY, JSON.stringify(cacheObj));
  } catch {
    // Ignore storage quota errors.
  }
}

function getCachedGeocode(address) {
  const key = normalizeAddressKey(address);
  if (!key) {
    return null;
  }

  if (memoryCache.has(key)) {
    return memoryCache.get(key);
  }

  const cacheObj = readSessionCache();
  const hit = cacheObj[key];
  if (!hit || !Number.isFinite(hit.lat) || !Number.isFinite(hit.lon)) {
    return null;
  }

  memoryCache.set(key, hit);
  return hit;
}

function setCachedGeocode(address, value) {
  const key = normalizeAddressKey(address);
  if (!key || !value) {
    return;
  }

  memoryCache.set(key, value);
  const cacheObj = readSessionCache();
  cacheObj[key] = value;
  writeSessionCache(cacheObj);
}

function toRouteKey(fromPoint, toPoint) {
  const fromLat = Number(fromPoint?.lat);
  const fromLon = Number(fromPoint?.lon);
  const toLat = Number(toPoint?.lat);
  const toLon = Number(toPoint?.lon);

  if (!Number.isFinite(fromLat) || !Number.isFinite(fromLon) || !Number.isFinite(toLat) || !Number.isFinite(toLon)) {
    return "";
  }

  return `${fromLat.toFixed(5)},${fromLon.toFixed(5)}|${toLat.toFixed(5)},${toLon.toFixed(5)}`;
}

function getCachedRoute(fromPoint, toPoint) {
  const key = toRouteKey(fromPoint, toPoint);
  if (!key) {
    return null;
  }

  if (routeCache.has(key)) {
    return routeCache.get(key);
  }

  const cacheObj = readRouteCache();
  const hit = cacheObj[key];
  if (!hit || !Number.isFinite(hit.distanceKm)) {
    return null;
  }

  routeCache.set(key, hit);
  return hit;
}

function setCachedRoute(fromPoint, toPoint, routeValue) {
  const key = toRouteKey(fromPoint, toPoint);
  if (!key || !routeValue) {
    return;
  }

  routeCache.set(key, routeValue);
  const cacheObj = readRouteCache();
  cacheObj[key] = routeValue;
  writeRouteCache(cacheObj);
}

async function enqueueRateLimited(task) {
  const runner = queue.then(async () => {
    const waitMs = Math.max(0, lastRequestTs + REQUEST_INTERVAL_MS - now());
    if (waitMs > 0) {
      await sleep(waitMs);
    }

    lastRequestTs = now();
    return task();
  });

  queue = runner.catch(() => {});
  return runner;
}

function toGeoResult(entry, fallbackLabel = "") {
  const lat = Number(entry?.lat);
  const lon = Number(entry?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }

  return {
    lat,
    lon,
    label: String(entry?.display_name || fallbackLabel || "").trim() || fallbackLabel,
  };
}

function toPhotonGeoResult(entry, fallbackLabel = "") {
  const coords = Array.isArray(entry?.geometry?.coordinates) ? entry.geometry.coordinates : [];
  const lon = Number(coords[0]);
  const lat = Number(coords[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }

  const properties = entry?.properties && typeof entry.properties === "object" ? entry.properties : {};
  const label = [
    properties.name,
    properties.street && properties.housenumber ? `${properties.street} ${properties.housenumber}` : properties.street,
    properties.postcode,
    properties.city,
    properties.country,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(", ");

  return {
    lat,
    lon,
    label: label || fallbackLabel,
  };
}

async function requestNominatim(query) {
  const endpoint = new URL("https://nominatim.openstreetmap.org/search");
  endpoint.searchParams.set("format", "jsonv2");
  endpoint.searchParams.set("limit", "1");
  endpoint.searchParams.set("addressdetails", "1");
  endpoint.searchParams.set("q", query);

  const response = await fetch(endpoint.toString(), {
    headers: {
      Accept: "application/json",
      "Accept-Language": "de",
    },
  }).catch(() => null);

  if (!response || !response.ok) {
    return null;
  }

  const payload = await response.json().catch(() => null);
  return Array.isArray(payload) ? toGeoResult(payload[0], query) : null;
}

async function requestPhoton(query) {
  const endpoint = new URL(PHOTON_BASE_URL);
  endpoint.searchParams.set("q", query);
  endpoint.searchParams.set("limit", "1");
  endpoint.searchParams.set("lang", "de");

  const response = await fetch(endpoint.toString(), {
    headers: {
      Accept: "application/json",
    },
  }).catch(() => null);

  if (!response || !response.ok) {
    return null;
  }

  const payload = await response.json().catch(() => null);
  const features = Array.isArray(payload?.features) ? payload.features : [];
  return toPhotonGeoResult(features[0], query);
}

export async function geocodeAddress(address) {
  const query = String(address || "").trim();
  if (!query) {
    return null;
  }

  const cached = getCachedGeocode(query);
  if (cached) {
    return cached;
  }

  return enqueueRateLimited(async () => {
    const result = (await requestNominatim(query)) || (await requestPhoton(query)) || null;
    if (result) {
      setCachedGeocode(query, result);
    }
    return result;
  });
}

export async function reverseGeocode(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }

  const cacheKey = `lat:${lat.toFixed(5)},lon:${lon.toFixed(5)}`;
  const cached = getCachedGeocode(cacheKey);
  if (cached) {
    return cached;
  }

  return enqueueRateLimited(async () => {
    const endpoint = new URL("https://nominatim.openstreetmap.org/reverse");
    endpoint.searchParams.set("format", "jsonv2");
    endpoint.searchParams.set("lat", String(lat));
    endpoint.searchParams.set("lon", String(lon));

    const response = await fetch(endpoint.toString(), {
      headers: {
        Accept: "application/json",
        "Accept-Language": "de",
      },
    });

    if (!response.ok) {
      throw new Error(`Reverse-Geocoding HTTP ${response.status}`);
    }

    const payload = await response.json();
    const result = toGeoResult({ lat, lon, display_name: payload?.display_name }, `${lat.toFixed(4)}, ${lon.toFixed(4)}`);
    if (result) {
      setCachedGeocode(cacheKey, result);
    }
    return result;
  });
}

export function haversineDistance(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function estimateMinutesFromDistance(distanceKm) {
  if (!Number.isFinite(distanceKm)) {
    return null;
  }
  return Math.max(1, Math.round((distanceKm / 50) * 60));
}

export async function fetchDrivingRoute(fromPoint, toPoint) {
  const fromLat = Number(fromPoint?.lat);
  const fromLon = Number(fromPoint?.lon);
  const toLat = Number(toPoint?.lat);
  const toLon = Number(toPoint?.lon);

  if (!Number.isFinite(fromLat) || !Number.isFinite(fromLon) || !Number.isFinite(toLat) || !Number.isFinite(toLon)) {
    return null;
  }

  const cached = getCachedRoute(fromPoint, toPoint);
  if (cached) {
    return cached;
  }

  const endpoint = new URL(`${ROUTING_BASE_URL}/${fromLon},${fromLat};${toLon},${toLat}`);
  endpoint.searchParams.set("overview", "false");
  endpoint.searchParams.set("alternatives", "false");
  endpoint.searchParams.set("steps", "false");
  endpoint.searchParams.set("annotations", "false");

  const response = await fetch(endpoint.toString(), {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Routing HTTP ${response.status}`);
  }

  const payload = await response.json();
  const route = Array.isArray(payload?.routes) ? payload.routes[0] : null;
  const distanceMeters = Number(route?.distance);
  const durationSeconds = Number(route?.duration);

  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) {
    return null;
  }

  const routeResult = {
    distanceKm: distanceMeters / 1000,
    durationMinutes: Number.isFinite(durationSeconds) && durationSeconds > 0 ? Math.max(1, Math.round(durationSeconds / 60)) : null,
    source: "route",
  };

  setCachedRoute(fromPoint, toPoint, routeResult);
  return routeResult;
}

function toGameStopPoint(game) {
  return {
    label: `${game.home} vs ${game.away}`,
    lat: Number(game?.venueLat),
    lon: Number(game?.venueLon),
  };
}

function addQueryCandidate(candidates, value) {
  const text = String(value || "").trim();
  if (!text) {
    return;
  }
  if (!candidates.includes(text)) {
    candidates.push(text);
  }
}

function buildVenueQueryCandidates(game) {
  const candidates = [];
  const venue = String(game?.venue || "").trim();
  const venueAddress = String(game?.venueAddress || "").trim();
  const venueCity = String(game?.venueCity || "").trim();
  const venuePostalCode = String(game?.venuePostalCode || "").trim();
  const kreisHint = String(KREIS_GEO_HINTS[String(game?.kreisId || "").trim()] || "").trim();
  const hasPreciseVenue = isPreciseRouteAddress(venue);
  const hasPreciseVenueAddress = isPreciseRouteAddress(venueAddress);

  if (hasPreciseVenueAddress) {
    addQueryCandidate(candidates, venueAddress);
  }
  if (hasPreciseVenue) {
    addQueryCandidate(candidates, venue);
  }

  if (!hasPreciseVenue && !hasPreciseVenueAddress) {
    return candidates;
  }

  const venueSegments = venue
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (hasPreciseVenue && venueSegments.length >= 2) {
    addQueryCandidate(candidates, `${venueSegments[venueSegments.length - 2]}, ${venueSegments[venueSegments.length - 1]}`);
  }
  if (hasPreciseVenue && venueSegments.length >= 3) {
    addQueryCandidate(
      candidates,
      `${venueSegments[venueSegments.length - 3]}, ${venueSegments[venueSegments.length - 2]}, ${venueSegments[venueSegments.length - 1]}`,
    );
  }

  if (hasPreciseVenue && venueCity) {
    addQueryCandidate(candidates, `${venue}, ${venueCity}, Deutschland`);
  }

  if (hasPreciseVenue && venuePostalCode) {
    addQueryCandidate(candidates, `${venue}, ${venuePostalCode}, Deutschland`);
  }

  if (hasPreciseVenue && kreisHint) {
    addQueryCandidate(candidates, `${venue}, ${kreisHint}`);
  }

  if (hasPreciseVenue) {
    addQueryCandidate(candidates, `${venue}, Nordrhein-Westfalen, Deutschland`);
  }

  return candidates;
}

function normalizeVenueText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function isGenericVenueText(value) {
  const venue = normalizeVenueText(value);
  if (!venue) {
    return true;
  }

  const parts = venue.split(" ").filter(Boolean);
  if (parts.length === 0) {
    return true;
  }

  const hasDigits = /\d/.test(venue);
  const nonGenericWords = parts.filter((part) => !GENERIC_VENUE_TOKENS.has(part));
  return !hasDigits && nonGenericWords.length <= 1;
}

function hasStreetNumberPattern(value) {
  const text = String(value || "");
  return /(?:str(?:a(?:ss|ß)e)?\.?|weg|allee|gasse|ring|damm|ufer|kamp|pfad|chaussee|wall|promenade)[^,\n]*\d{1,4}[a-z]?/i.test(
    text,
  );
}

function hasPostalCode(value) {
  return /\b\d{5}\b/.test(String(value || ""));
}

export function isPreciseRouteAddress(value) {
  const text = String(value || "").trim();
  if (!text) {
    return false;
  }

  if (isGenericVenueText(text)) {
    return false;
  }

  return hasPostalCode(text) || hasStreetNumberPattern(text);
}

export function hasRoutableVenueAddress(game) {
  const lat = Number(game?.venueLat);
  const lon = Number(game?.venueLon);
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    return true;
  }

  return isPreciseRouteAddress(game?.venueAddress) || isPreciseRouteAddress(game?.venue);
}

function isPlausibleForKreis(lat, lon, kreisId) {
  const center = KREIS_CENTERS[String(kreisId || "").trim()];
  if (!center) {
    return true;
  }

  const distanceToCenter = haversineDistance(lat, lon, center.lat, center.lon);
  return Number.isFinite(distanceToCenter) ? distanceToCenter <= 120 : true;
}

async function resolveGameStopPoint(game) {
  const initial = toGameStopPoint(game);
  if (!hasRoutableVenueAddress(game)) {
    return {
      label: initial.label,
      lat: Number.NaN,
      lon: Number.NaN,
    };
  }

  if (Number.isFinite(initial.lat) && Number.isFinite(initial.lon)) {
    return initial;
  }

  const venueQueries = buildVenueQueryCandidates(game);
  if (!venueQueries.length) {
    return initial;
  }

  for (const query of venueQueries) {
    const geocoded = await geocodeAddress(query).catch(() => null);
    const lat = Number(geocoded?.lat);
    const lon = Number(geocoded?.lon);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      if (!isPlausibleForKreis(lat, lon, game?.kreisId)) {
        continue;
      }
      return {
        label: initial.label,
        lat,
        lon,
      };
    }
  }

  return initial;
}

function buildFallbackLeg(previous, current) {
  if (!Number.isFinite(previous?.lat) || !Number.isFinite(previous?.lon) || !Number.isFinite(current?.lat) || !Number.isFinite(current?.lon)) {
    return {
      distanceKm: null,
      durationMinutes: null,
      source: "unknown",
    };
  }

  const distanceKm = haversineDistance(previous.lat, previous.lon, current.lat, current.lon);
  return {
    distanceKm,
    durationMinutes: estimateMinutesFromDistance(distanceKm),
    source: "haversine",
  };
}

export function formatDistanceKm(distanceKm) {
  if (!Number.isFinite(distanceKm)) {
    return "unbekannt";
  }
  return `${Math.round(distanceKm)} km`;
}

export function calculateRoute(startPoint, games) {
  const stops = Array.isArray(games) ? games : [];
  const legs = [];
  let totalKm = 0;
  let totalMinutes = 0;

  const start = {
    label: String(startPoint?.label || "Startort"),
    lat: Number(startPoint?.lat),
    lon: Number(startPoint?.lon),
  };

  let previous = start;

  for (let index = 0; index < stops.length; index += 1) {
    const game = stops[index];
    const current = {
      label: `${game.home} vs ${game.away}`,
      lat: Number(game?.venueLat),
      lon: Number(game?.venueLon),
    };

    let distanceKm = null;
    let durationMinutes = null;
    let source = "haversine";

    const exactFromStartDistance = index === 0 ? Number(game?.fromStartRouteDistanceKm) : null;
    const exactFromStartMinutes = index === 0 ? Number(game?.fromStartRouteMinutes) : null;

    if (Number.isFinite(exactFromStartDistance)) {
      distanceKm = exactFromStartDistance;
      durationMinutes = Number.isFinite(exactFromStartMinutes) ? Math.max(1, Math.round(exactFromStartMinutes)) : estimateMinutesFromDistance(distanceKm);
      source = "route";
    } else if (Number.isFinite(previous.lat) && Number.isFinite(previous.lon) && Number.isFinite(current.lat) && Number.isFinite(current.lon)) {
      distanceKm = haversineDistance(previous.lat, previous.lon, current.lat, current.lon);
      durationMinutes = estimateMinutesFromDistance(distanceKm);
      source = "haversine";
    }

    if (Number.isFinite(distanceKm)) {
      totalKm += distanceKm;
    }
    if (Number.isFinite(durationMinutes)) {
      totalMinutes += durationMinutes;
    }

    legs.push({
      from: previous.label,
      to: current.label,
      distanceKm,
      durationMinutes,
      source,
    });

    previous = current;
  }

  let returnDistanceKm = null;
  let returnDurationMinutes = null;
  if (stops.length > 0 && Number.isFinite(previous.lat) && Number.isFinite(previous.lon) && Number.isFinite(start.lat) && Number.isFinite(start.lon)) {
    returnDistanceKm = haversineDistance(previous.lat, previous.lon, start.lat, start.lon);
    returnDurationMinutes = estimateMinutesFromDistance(returnDistanceKm);
    totalKm += returnDistanceKm;
    if (Number.isFinite(returnDurationMinutes)) {
      totalMinutes += returnDurationMinutes;
    }
  }

  legs.push({
    from: previous.label,
    to: start.label,
    distanceKm: returnDistanceKm,
    durationMinutes: returnDurationMinutes,
    source: "haversine",
  });

  const estimatedMinutes = totalMinutes > 0 ? Math.round(totalMinutes) : null;

  return {
    legs,
    totalKm,
    estimatedMinutes,
  };
}

export async function calculateRouteWithDriving(startPoint, games) {
  const stops = Array.isArray(games) ? games : [];
  const legs = [];
  let totalKm = 0;
  let totalMinutes = 0;

  const start = {
    label: String(startPoint?.label || "Startort"),
    lat: Number(startPoint?.lat),
    lon: Number(startPoint?.lon),
  };

  let previous = start;

  for (const game of stops) {
    const current = await resolveGameStopPoint(game);
    const routed = await fetchDrivingRoute(previous, current).catch(() => null);
    const fallback = buildFallbackLeg(previous, current);
    const selected = routed && Number.isFinite(routed.distanceKm) ? routed : fallback;

    if (Number.isFinite(selected.distanceKm)) {
      totalKm += selected.distanceKm;
    }
    if (Number.isFinite(selected.durationMinutes)) {
      totalMinutes += selected.durationMinutes;
    }

    legs.push({
      from: previous.label,
      to: current.label,
      distanceKm: Number.isFinite(selected.distanceKm) ? selected.distanceKm : null,
      durationMinutes: Number.isFinite(selected.durationMinutes) ? selected.durationMinutes : null,
      source: selected.source || "unknown",
    });

    previous = current;
  }

  const routedBack = await fetchDrivingRoute(previous, start).catch(() => null);
  const fallbackBack = buildFallbackLeg(previous, start);
  const selectedBack = routedBack && Number.isFinite(routedBack.distanceKm) ? routedBack : fallbackBack;

  if (Number.isFinite(selectedBack.distanceKm)) {
    totalKm += selectedBack.distanceKm;
  }
  if (Number.isFinite(selectedBack.durationMinutes)) {
    totalMinutes += selectedBack.durationMinutes;
  }

  legs.push({
    from: previous.label,
    to: start.label,
    distanceKm: Number.isFinite(selectedBack.distanceKm) ? selectedBack.distanceKm : null,
    durationMinutes: Number.isFinite(selectedBack.durationMinutes) ? selectedBack.durationMinutes : null,
    source: selectedBack.source || "unknown",
  });

  return {
    legs,
    totalKm,
    estimatedMinutes: totalMinutes > 0 ? Math.round(totalMinutes) : null,
  };
}

export async function calculateDirectStartRoutes(startPoint, games, maxGames = 5) {
  const start = {
    label: String(startPoint?.label || "Startort"),
    lat: Number(startPoint?.lat),
    lon: Number(startPoint?.lon),
  };
  if (!Number.isFinite(start.lat) || !Number.isFinite(start.lon)) {
    return [];
  }

  const stops = Array.isArray(games) ? games.slice(0, Math.max(0, Number(maxGames) || 0)) : [];
  const rows = [];

  for (let index = 0; index < stops.length; index += 1) {
    const game = stops[index];
    const target = await resolveGameStopPoint(game);
    const routed = await fetchDrivingRoute(start, target).catch(() => null);
    const fallback = buildFallbackLeg(start, target);
    const selected = routed && Number.isFinite(routed.distanceKm) ? routed : fallback;

    rows.push({
      index: index + 1,
      match: `${String(game?.home || "").trim()} vs ${String(game?.away || "").trim()}`,
      date: String(game?.dateLabel || game?.date || "").trim(),
      time: String(game?.time || "").trim(),
      venue: String(game?.venue || "").trim(),
      distanceKm: Number.isFinite(selected?.distanceKm) ? selected.distanceKm : null,
      durationMinutes: Number.isFinite(selected?.durationMinutes) ? selected.durationMinutes : null,
      source: selected?.source || "unknown",
    });
  }

  return rows;
}
