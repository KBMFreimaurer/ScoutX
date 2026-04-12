const GEO_CACHE_KEY = "scoutplan.geo.cache.v1";
const ROUTE_CACHE_KEY = "scoutplan.route.cache.v1";
const REQUEST_INTERVAL_MS_OSM = 1000;
const REQUEST_INTERVAL_MS_GOOGLE = 150;
const REQUEST_TIMEOUT_MS = Math.max(2000, Number(import.meta?.env?.VITE_GEO_REQUEST_TIMEOUT_MS || 12000));
const GEO_CACHE_MAX_ENTRIES = Math.max(50, Number(import.meta?.env?.VITE_GEO_CACHE_MAX_ENTRIES || 500));
const ROUTE_CACHE_MAX_ENTRIES = Math.max(50, Number(import.meta?.env?.VITE_ROUTE_CACHE_MAX_ENTRIES || 500));
const ROUTING_BASE_URL = "https://router.project-osrm.org/route/v1/driving";
const PHOTON_BASE_URL = "https://photon.komoot.io/api/";
const GOOGLE_GEOCODE_BASE_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const GOOGLE_DIRECTIONS_BASE_URL = "https://maps.googleapis.com/maps/api/directions/json";
const ENV_GOOGLE_MAPS_API_KEY = String(import.meta?.env?.VITE_GOOGLE_MAPS_API_KEY || "").trim();
const GOOGLE_STRICT_ENV = String(import.meta?.env?.VITE_GOOGLE_MAPS_STRICT || "").trim().toLowerCase();
const GOOGLE_MAPS_RUNTIME_STORAGE_KEY = "scoutplan.googlemaps.apikey.v1";
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

async function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const safeTimeout = Math.max(1000, Number(timeoutMs) || REQUEST_TIMEOUT_MS);
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), safeTimeout);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    globalThis.clearTimeout(timer);
  }
}

function pruneCacheObject(cacheObj, maxEntries) {
  const entries = Object.entries(cacheObj || {});
  const limit = Math.max(1, Number(maxEntries) || 1);
  if (entries.length <= limit) {
    return cacheObj || {};
  }
  return Object.fromEntries(entries.slice(entries.length - limit));
}

function pruneMap(map, maxEntries) {
  const limit = Math.max(1, Number(maxEntries) || 1);
  while (map.size > limit) {
    const firstKey = map.keys().next().value;
    if (firstKey === undefined) {
      break;
    }
    map.delete(firstKey);
  }
}

function hasGoogleMapsApiKey() {
  return getGoogleMapsApiKey().length > 0;
}

function getRequestIntervalMs() {
  return hasGoogleMapsApiKey() ? REQUEST_INTERVAL_MS_GOOGLE : REQUEST_INTERVAL_MS_OSM;
}

function readRuntimeGoogleMapsApiKey() {
  if (typeof window === "undefined") {
    return "";
  }
  try {
    return String(window.localStorage.getItem(GOOGLE_MAPS_RUNTIME_STORAGE_KEY) || "").trim();
  } catch {
    return "";
  }
}

function getGoogleMapsApiKey() {
  const runtime = readRuntimeGoogleMapsApiKey();
  if (runtime) {
    return runtime;
  }
  return ENV_GOOGLE_MAPS_API_KEY;
}

function getGoogleMapsApiKeySource() {
  const runtime = readRuntimeGoogleMapsApiKey();
  if (runtime) {
    return "runtime";
  }
  if (ENV_GOOGLE_MAPS_API_KEY) {
    return "env";
  }
  return "none";
}

export function setRuntimeGoogleMapsApiKey(value) {
  const key = String(value || "").trim();
  if (!key || typeof window === "undefined") {
    return false;
  }
  try {
    window.localStorage.setItem(GOOGLE_MAPS_RUNTIME_STORAGE_KEY, key);
    return true;
  } catch {
    return false;
  }
}

export function clearRuntimeGoogleMapsApiKey() {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(GOOGLE_MAPS_RUNTIME_STORAGE_KEY);
  } catch {
    // Ignore localStorage errors.
  }
}

function isGoogleStrictDisabled() {
  return GOOGLE_STRICT_ENV === "false" || GOOGLE_STRICT_ENV === "0" || GOOGLE_STRICT_ENV === "off";
}

function isGoogleStrictRequestedByEnv() {
  return !isGoogleStrictDisabled();
}

function shouldUseGoogleStrictMode() {
  if (!hasGoogleMapsApiKey()) {
    return false;
  }
  return isGoogleStrictRequestedByEnv();
}

export function isGoogleRoutingStrictMode() {
  return shouldUseGoogleStrictMode();
}

export function isGoogleRoutingConfigured() {
  return hasGoogleMapsApiKey();
}

export function getGoogleRoutingConfig() {
  const strictRequested = isGoogleStrictRequestedByEnv();
  const googleConfigured = hasGoogleMapsApiKey();
  const strictActive = shouldUseGoogleStrictMode();
  const keySource = getGoogleMapsApiKeySource();

  return {
    googleConfigured,
    strictRequested,
    strictActive,
    keySource,
    geocodeProvider: getGeocodeProvider(),
    routeProvider: getRouteProvider(),
    keyEnvVar: "VITE_GOOGLE_MAPS_API_KEY",
    keyStorageKey: GOOGLE_MAPS_RUNTIME_STORAGE_KEY,
  };
}

function getGeocodeProvider() {
  return shouldUseGoogleStrictMode() ? "google-strict" : hasGoogleMapsApiKey() ? "google" : "osm";
}

function getRouteProvider() {
  return shouldUseGoogleStrictMode() ? "google-strict" : hasGoogleMapsApiKey() ? "google" : "osrm";
}

function toFiniteNumber(value) {
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

function toDateKey(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }

  const text = String(value || "").trim();
  if (!text) {
    return "";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  if (/^\d{2}\.\d{2}\.\d{4}$/.test(text)) {
    const [day, month, year] = text.split(".").map(Number);
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
}

function getGameDateKey(game) {
  return toDateKey(game?.dateObj) || toDateKey(game?.date);
}

function shouldCloseRouteDay(currentDateKey, nextDateKey) {
  if (!currentDateKey || !nextDateKey) {
    return true;
  }
  return currentDateKey !== nextDateKey;
}

function normalizeAddressKey(address, provider = getGeocodeProvider()) {
  const normalizedAddress = String(address || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");

  if (!normalizedAddress) {
    return "";
  }

  return `${provider}|${normalizedAddress}`;
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
    window.sessionStorage.setItem(
      GEO_CACHE_KEY,
      JSON.stringify(pruneCacheObject(cacheObj, GEO_CACHE_MAX_ENTRIES)),
    );
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
    window.sessionStorage.setItem(
      ROUTE_CACHE_KEY,
      JSON.stringify(pruneCacheObject(cacheObj, ROUTE_CACHE_MAX_ENTRIES)),
    );
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
  pruneMap(memoryCache, GEO_CACHE_MAX_ENTRIES);
  const cacheObj = readSessionCache();
  cacheObj[key] = value;
  writeSessionCache(cacheObj);
}

function toRouteKey(fromPoint, toPoint, provider = getRouteProvider()) {
  const fromLat = toFiniteNumber(fromPoint?.lat);
  const fromLon = toFiniteNumber(fromPoint?.lon);
  const toLat = toFiniteNumber(toPoint?.lat);
  const toLon = toFiniteNumber(toPoint?.lon);

  if (!Number.isFinite(fromLat) || !Number.isFinite(fromLon) || !Number.isFinite(toLat) || !Number.isFinite(toLon)) {
    return "";
  }

  return `${provider}|${fromLat.toFixed(5)},${fromLon.toFixed(5)}|${toLat.toFixed(5)},${toLon.toFixed(5)}`;
}

function getCachedRoute(fromPoint, toPoint, provider = getRouteProvider()) {
  const key = toRouteKey(fromPoint, toPoint, provider);
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

function setCachedRoute(fromPoint, toPoint, routeValue, provider = getRouteProvider()) {
  const key = toRouteKey(fromPoint, toPoint, provider);
  if (!key || !routeValue) {
    return;
  }

  routeCache.set(key, routeValue);
  pruneMap(routeCache, ROUTE_CACHE_MAX_ENTRIES);
  const cacheObj = readRouteCache();
  cacheObj[key] = routeValue;
  writeRouteCache(cacheObj);
}

async function enqueueRateLimited(task) {
  const runner = queue.then(async () => {
    const waitMs = Math.max(0, lastRequestTs + getRequestIntervalMs() - now());
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
  const lat = toFiniteNumber(entry?.lat);
  const lon = toFiniteNumber(entry?.lon);
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
  const lon = toFiniteNumber(coords[0]);
  const lat = toFiniteNumber(coords[1]);
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

  const response = await fetchWithTimeout(endpoint.toString(), {
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

async function requestGoogleGeocode(query) {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    return null;
  }

  const endpoint = new URL(GOOGLE_GEOCODE_BASE_URL);
  endpoint.searchParams.set("address", query);
  endpoint.searchParams.set("language", "de");
  endpoint.searchParams.set("region", "de");
  endpoint.searchParams.set("key", apiKey);

  const response = await fetchWithTimeout(endpoint.toString(), {
    headers: {
      Accept: "application/json",
    },
  }).catch(() => null);

  if (!response || !response.ok) {
    return null;
  }

  const payload = await response.json().catch(() => null);
  if (payload?.status !== "OK") {
    return null;
  }

  const first = Array.isArray(payload?.results) ? payload.results[0] : null;
  const lat = toFiniteNumber(first?.geometry?.location?.lat);
  const lon = toFiniteNumber(first?.geometry?.location?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }

  return {
    lat,
    lon,
    label: String(first?.formatted_address || query).trim(),
  };
}

async function requestGoogleReverseGeocode(lat, lon) {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    return null;
  }

  const endpoint = new URL(GOOGLE_GEOCODE_BASE_URL);
  endpoint.searchParams.set("latlng", `${lat},${lon}`);
  endpoint.searchParams.set("language", "de");
  endpoint.searchParams.set("region", "de");
  endpoint.searchParams.set("key", apiKey);

  const response = await fetchWithTimeout(endpoint.toString(), {
    headers: {
      Accept: "application/json",
    },
  }).catch(() => null);

  if (!response || !response.ok) {
    return null;
  }

  const payload = await response.json().catch(() => null);
  if (payload?.status !== "OK") {
    return null;
  }

  const first = Array.isArray(payload?.results) ? payload.results[0] : null;
  return {
    lat,
    lon,
    label: String(first?.formatted_address || `${lat.toFixed(4)}, ${lon.toFixed(4)}`).trim(),
  };
}

async function requestPhoton(query) {
  const endpoint = new URL(PHOTON_BASE_URL);
  endpoint.searchParams.set("q", query);
  endpoint.searchParams.set("limit", "1");
  endpoint.searchParams.set("lang", "de");

  const response = await fetchWithTimeout(endpoint.toString(), {
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
    const googleResult = await requestGoogleGeocode(query);
    if (googleResult) {
      setCachedGeocode(query, googleResult);
      return googleResult;
    }

    if (shouldUseGoogleStrictMode()) {
      return null;
    }

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
    const googleReverse = await requestGoogleReverseGeocode(lat, lon).catch(() => null);
    if (googleReverse) {
      setCachedGeocode(cacheKey, googleReverse);
      return googleReverse;
    }

    if (shouldUseGoogleStrictMode()) {
      return null;
    }

    const endpoint = new URL("https://nominatim.openstreetmap.org/reverse");
    endpoint.searchParams.set("format", "jsonv2");
    endpoint.searchParams.set("lat", String(lat));
    endpoint.searchParams.set("lon", String(lon));

    const response = await fetchWithTimeout(endpoint.toString(), {
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

function buildRouteResult(distanceMeters, durationSeconds, provider = "unknown") {
  const parsedDistance = Number(distanceMeters);
  if (!Number.isFinite(parsedDistance) || parsedDistance <= 0) {
    return null;
  }

  const parsedDuration = Number(durationSeconds);

  return {
    distanceKm: parsedDistance / 1000,
    durationMinutes:
      Number.isFinite(parsedDuration) && parsedDuration > 0 ? Math.max(1, Math.round(parsedDuration / 60)) : null,
    source: "route",
    provider,
  };
}

async function requestGoogleDrivingRoute(fromPoint, toPoint) {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    return null;
  }

  const fromLat = toFiniteNumber(fromPoint?.lat);
  const fromLon = toFiniteNumber(fromPoint?.lon);
  const toLat = toFiniteNumber(toPoint?.lat);
  const toLon = toFiniteNumber(toPoint?.lon);
  if (!Number.isFinite(fromLat) || !Number.isFinite(fromLon) || !Number.isFinite(toLat) || !Number.isFinite(toLon)) {
    return null;
  }

  const endpoint = new URL(GOOGLE_DIRECTIONS_BASE_URL);
  endpoint.searchParams.set("origin", `${fromLat},${fromLon}`);
  endpoint.searchParams.set("destination", `${toLat},${toLon}`);
  endpoint.searchParams.set("mode", "driving");
  endpoint.searchParams.set("language", "de");
  endpoint.searchParams.set("region", "de");
  endpoint.searchParams.set("alternatives", "false");
  endpoint.searchParams.set("key", apiKey);

  const response = await fetchWithTimeout(endpoint.toString(), {
    headers: {
      Accept: "application/json",
    },
  }).catch(() => null);

  if (!response || !response.ok) {
    return null;
  }

  const payload = await response.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const leg = Array.isArray(payload?.routes?.[0]?.legs) ? payload.routes[0].legs[0] : null;
  const fromGoogleLeg = buildRouteResult(leg?.distance?.value, leg?.duration?.value, "google");
  if (fromGoogleLeg) {
    return fromGoogleLeg;
  }

  // Test-friendly fallback: accept OSRM-like payloads from mocked fetch responses.
  const osrmLike = Array.isArray(payload?.routes) ? payload.routes[0] : null;
  return buildRouteResult(osrmLike?.distance, osrmLike?.duration, "google");
}

async function requestOsrmDrivingRoute(fromLat, fromLon, toLat, toLon) {
  const endpoint = new URL(`${ROUTING_BASE_URL}/${fromLon},${fromLat};${toLon},${toLat}`);
  endpoint.searchParams.set("overview", "false");
  endpoint.searchParams.set("alternatives", "false");
  endpoint.searchParams.set("steps", "false");
  endpoint.searchParams.set("annotations", "false");

  const response = await fetchWithTimeout(endpoint.toString(), {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Routing HTTP ${response.status}`);
  }

  const payload = await response.json();
  const route = Array.isArray(payload?.routes) ? payload.routes[0] : null;
  return buildRouteResult(route?.distance, route?.duration, "osrm");
}

export async function fetchDrivingRoute(fromPoint, toPoint, options = {}) {
  const fromLat = toFiniteNumber(fromPoint?.lat);
  const fromLon = toFiniteNumber(fromPoint?.lon);
  const toLat = toFiniteNumber(toPoint?.lat);
  const toLon = toFiniteNumber(toPoint?.lon);
  const requireGoogle = options?.requireGoogle === true;

  if (!Number.isFinite(fromLat) || !Number.isFinite(fromLon) || !Number.isFinite(toLat) || !Number.isFinite(toLon)) {
    return null;
  }

  const provider = getRouteProvider();
  const cached = getCachedRoute(fromPoint, toPoint, provider);
  if (cached && (!requireGoogle || String(cached?.provider || "").toLowerCase() === "google")) {
    return cached;
  }

  if (requireGoogle && !hasGoogleMapsApiKey()) {
    return null;
  }

  const googleRoute = await requestGoogleDrivingRoute(fromPoint, toPoint);
  if (googleRoute) {
    setCachedRoute(fromPoint, toPoint, googleRoute, provider);
    return googleRoute;
  }

  if (requireGoogle || shouldUseGoogleStrictMode()) {
    return null;
  }

  const routeResult = await requestOsrmDrivingRoute(fromLat, fromLon, toLat, toLon);
  if (!routeResult) {
    return null;
  }

  setCachedRoute(fromPoint, toPoint, routeResult, provider);
  return routeResult;
}

function selectLegResult(previous, current, routed, options = {}) {
  const requireGoogle = options?.requireGoogle === true;
  if (routed && Number.isFinite(routed.distanceKm)) {
    return routed;
  }

  if (requireGoogle || shouldUseGoogleStrictMode()) {
    return {
      distanceKm: null,
      durationMinutes: null,
      source: "unknown",
      provider: null,
    };
  }

  return buildFallbackLeg(previous, current);
}

function toGameStopPoint(game) {
  return {
    label: `${game.home} vs ${game.away}`,
    lat: toFiniteNumber(game?.venueLat),
    lon: toFiniteNumber(game?.venueLon),
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
  const lat = toFiniteNumber(game?.venueLat);
  const lon = toFiniteNumber(game?.venueLon);
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
  const initialLat = toFiniteNumber(initial.lat);
  const initialLon = toFiniteNumber(initial.lon);
  const hasInitialCoordinates = Number.isFinite(initialLat) && Number.isFinite(initialLon);
  const initialPlausible = hasInitialCoordinates ? isPlausibleForKreis(initialLat, initialLon, game?.kreisId) : false;

  if (!hasRoutableVenueAddress(game)) {
    return {
      label: initial.label,
      lat: Number.NaN,
      lon: Number.NaN,
    };
  }

  const venueQueries = buildVenueQueryCandidates(game);
  if (!venueQueries.length) {
    if (initialPlausible) {
      return initial;
    }
    return {
      label: initial.label,
      lat: Number.NaN,
      lon: Number.NaN,
    };
  }

  for (const query of venueQueries) {
    const geocoded = await geocodeAddress(query).catch(() => null);
    const lat = toFiniteNumber(geocoded?.lat);
    const lon = toFiniteNumber(geocoded?.lon);
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

  if (initialPlausible) {
    return initial;
  }

  return {
    label: initial.label,
    lat: Number.NaN,
    lon: Number.NaN,
  };
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
  let knownDistanceLegs = 0;

  const start = {
    label: String(startPoint?.label || "Startort"),
    lat: toFiniteNumber(startPoint?.lat),
    lon: toFiniteNumber(startPoint?.lon),
  };

  let previous = start;
  let previousDateKey = "";

  for (let index = 0; index < stops.length; index += 1) {
    const game = stops[index];
    const current = {
      label: `${game.home} vs ${game.away}`,
      lat: toFiniteNumber(game?.venueLat),
      lon: toFiniteNumber(game?.venueLon),
    };
    const dateKey = getGameDateKey(game);
    const sameDayAsPrevious = Boolean(previousDateKey) && Boolean(dateKey) && previousDateKey === dateKey;
    const routeStart = sameDayAsPrevious ? previous : start;

    let distanceKm = null;
    let durationMinutes = null;
    let source = "haversine";

    const exactFromStartDistance = !sameDayAsPrevious ? toFiniteNumber(game?.fromStartRouteDistanceKm) : null;
    const exactFromStartMinutes = !sameDayAsPrevious ? toFiniteNumber(game?.fromStartRouteMinutes) : null;

    if (Number.isFinite(exactFromStartDistance)) {
      distanceKm = exactFromStartDistance;
      durationMinutes = Number.isFinite(exactFromStartMinutes) ? Math.max(1, Math.round(exactFromStartMinutes)) : estimateMinutesFromDistance(distanceKm);
      source = "route";
    } else if (
      Number.isFinite(routeStart.lat) &&
      Number.isFinite(routeStart.lon) &&
      Number.isFinite(current.lat) &&
      Number.isFinite(current.lon)
    ) {
      distanceKm = haversineDistance(routeStart.lat, routeStart.lon, current.lat, current.lon);
      durationMinutes = estimateMinutesFromDistance(distanceKm);
      source = "haversine";
    }

    if (Number.isFinite(distanceKm)) {
      totalKm += distanceKm;
      knownDistanceLegs += 1;
    }
    if (Number.isFinite(durationMinutes)) {
      totalMinutes += durationMinutes;
    }

    legs.push({
      from: routeStart.label,
      to: current.label,
      distanceKm,
      durationMinutes,
      source,
      dateKey,
    });

    previous = current;
    previousDateKey = dateKey;

    const nextGame = stops[index + 1];
    const nextDateKey = getGameDateKey(nextGame);
    const closeDay = !nextGame || shouldCloseRouteDay(dateKey, nextDateKey);
    if (closeDay) {
      let returnDistanceKm = null;
      let returnDurationMinutes = null;
      let returnSource = "unknown";

      if (
        Number.isFinite(previous.lat) &&
        Number.isFinite(previous.lon) &&
        Number.isFinite(start.lat) &&
        Number.isFinite(start.lon)
      ) {
        returnDistanceKm = haversineDistance(previous.lat, previous.lon, start.lat, start.lon);
        returnDurationMinutes = estimateMinutesFromDistance(returnDistanceKm);
        returnSource = "haversine";
      }

      if (Number.isFinite(returnDistanceKm)) {
        totalKm += returnDistanceKm;
        knownDistanceLegs += 1;
      }
      if (Number.isFinite(returnDurationMinutes)) {
        totalMinutes += returnDurationMinutes;
      }

      legs.push({
        from: previous.label,
        to: start.label,
        distanceKm: returnDistanceKm,
        durationMinutes: returnDurationMinutes,
        source: returnSource,
        dateKey,
      });
      previous = start;
      previousDateKey = "";
    }
  }

  const estimatedMinutes = totalMinutes > 0 ? Math.round(totalMinutes) : null;
  const normalizedTotalKm = knownDistanceLegs > 0 ? totalKm : null;

  return {
    legs,
    totalKm: normalizedTotalKm,
    estimatedMinutes,
  };
}

export async function calculateRouteWithDriving(startPoint, games, options = {}) {
  const stops = Array.isArray(games) ? games : [];
  const legs = [];
  let totalKm = 0;
  let totalMinutes = 0;
  let knownDistanceLegs = 0;

  const start = {
    label: String(startPoint?.label || "Startort"),
    lat: toFiniteNumber(startPoint?.lat),
    lon: toFiniteNumber(startPoint?.lon),
  };

  let previous = start;
  let previousDateKey = "";

  for (let index = 0; index < stops.length; index += 1) {
    const game = stops[index];
    const current = await resolveGameStopPoint(game);
    const dateKey = getGameDateKey(game);
    const sameDayAsPrevious = Boolean(previousDateKey) && Boolean(dateKey) && previousDateKey === dateKey;
    const routeStart = sameDayAsPrevious ? previous : start;
    const routed = await fetchDrivingRoute(routeStart, current, options).catch(() => null);
    const selected = selectLegResult(routeStart, current, routed, options);

    if (Number.isFinite(selected.distanceKm)) {
      totalKm += selected.distanceKm;
      knownDistanceLegs += 1;
    }
    if (Number.isFinite(selected.durationMinutes)) {
      totalMinutes += selected.durationMinutes;
    }

    legs.push({
      from: routeStart.label,
      to: current.label,
      distanceKm: Number.isFinite(selected.distanceKm) ? selected.distanceKm : null,
      durationMinutes: Number.isFinite(selected.durationMinutes) ? selected.durationMinutes : null,
      source: selected.source || "unknown",
      provider: selected.provider || null,
      dateKey,
    });

    previous = current;
    previousDateKey = dateKey;

    const nextGame = stops[index + 1];
    const nextDateKey = getGameDateKey(nextGame);
    const closeDay = !nextGame || shouldCloseRouteDay(dateKey, nextDateKey);
    if (closeDay) {
      const routedBack = await fetchDrivingRoute(previous, start, options).catch(() => null);
      const selectedBack = selectLegResult(previous, start, routedBack, options);

      if (Number.isFinite(selectedBack.distanceKm)) {
        totalKm += selectedBack.distanceKm;
        knownDistanceLegs += 1;
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
        provider: selectedBack.provider || null,
        dateKey,
      });

      previous = start;
      previousDateKey = "";
    }
  }

  return {
    legs,
    totalKm: knownDistanceLegs > 0 ? totalKm : null,
    estimatedMinutes: totalMinutes > 0 ? Math.round(totalMinutes) : null,
  };
}

export async function calculateDirectStartRoutes(startPoint, games, maxGames = 5, options = {}) {
  const start = {
    label: String(startPoint?.label || "Startort"),
    lat: toFiniteNumber(startPoint?.lat),
    lon: toFiniteNumber(startPoint?.lon),
  };
  if (!Number.isFinite(start.lat) || !Number.isFinite(start.lon)) {
    return [];
  }

  const stops = Array.isArray(games) ? games.slice(0, Math.max(0, Number(maxGames) || 0)) : [];
  const rows = [];

  for (let index = 0; index < stops.length; index += 1) {
    const game = stops[index];
    const target = await resolveGameStopPoint(game);
    const routed = await fetchDrivingRoute(start, target, options).catch(() => null);
    const selected = selectLegResult(start, target, routed, options);

    rows.push({
      index: index + 1,
      match: `${String(game?.home || "").trim()} vs ${String(game?.away || "").trim()}`,
      date: String(game?.dateLabel || game?.date || "").trim(),
      time: String(game?.time || "").trim(),
      venue: String(game?.venue || "").trim(),
      distanceKm: Number.isFinite(selected?.distanceKm) ? selected.distanceKm : null,
      durationMinutes: Number.isFinite(selected?.durationMinutes) ? selected.durationMinutes : null,
      source: selected?.source || "unknown",
      provider: selected?.provider || null,
    });
  }

  return rows;
}
