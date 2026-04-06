const GEO_CACHE_KEY = "scoutplan.geo.cache.v1";
const REQUEST_INTERVAL_MS = 1000;

let queue = Promise.resolve();
let lastRequestTs = 0;
const memoryCache = new Map();

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
    });

    if (!response.ok) {
      throw new Error(`Geocoding HTTP ${response.status}`);
    }

    const payload = await response.json();
    const result = Array.isArray(payload) ? toGeoResult(payload[0], query) : null;
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

  const start = {
    label: String(startPoint?.label || "Startort"),
    lat: Number(startPoint?.lat),
    lon: Number(startPoint?.lon),
  };

  let previous = start;

  for (const game of stops) {
    const current = {
      label: `${game.home} vs ${game.away}`,
      lat: Number(game?.venueLat),
      lon: Number(game?.venueLon),
    };

    let distanceKm = null;
    if (Number.isFinite(previous.lat) && Number.isFinite(previous.lon) && Number.isFinite(current.lat) && Number.isFinite(current.lon)) {
      distanceKm = haversineDistance(previous.lat, previous.lon, current.lat, current.lon);
      totalKm += distanceKm;
    }

    legs.push({
      from: previous.label,
      to: current.label,
      distanceKm,
    });

    previous = current;
  }

  let returnDistanceKm = null;
  if (stops.length > 0 && Number.isFinite(previous.lat) && Number.isFinite(previous.lon) && Number.isFinite(start.lat) && Number.isFinite(start.lon)) {
    returnDistanceKm = haversineDistance(previous.lat, previous.lon, start.lat, start.lon);
    totalKm += returnDistanceKm;
  }

  legs.push({
    from: previous.label,
    to: start.label,
    distanceKm: returnDistanceKm,
  });

  const estimatedMinutes = Number.isFinite(totalKm) ? Math.round((totalKm / 50) * 60) : null;

  return {
    legs,
    totalKm,
    estimatedMinutes,
  };
}
