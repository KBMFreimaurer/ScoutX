const WEATHER_CACHE_KEY = "scoutplan.weather.cache.v1";

function readWeatherCache() {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.sessionStorage.getItem(WEATHER_CACHE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeWeatherCache(cache) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore storage quota errors.
  }
}

function weatherTypeFromCode(code) {
  const value = Number(code);
  if (value === 0) {
    return "clear";
  }
  if ([1, 2, 3, 45, 48].includes(value)) {
    return "cloud";
  }
  if ((value >= 51 && value <= 67) || (value >= 80 && value <= 82)) {
    return "rain";
  }
  if ((value >= 71 && value <= 77) || (value >= 85 && value <= 86)) {
    return "snow";
  }
  if (value >= 95) {
    return "storm";
  }
  return "cloud";
}

function toHourStamp(date, time) {
  const safeDate = String(date || "").slice(0, 10);
  const safeTime = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(time || "").trim()) ? String(time).trim() : "12:00";
  return `${safeDate}T${safeTime}`;
}

export async function fetchWeatherForGame({ lat, lon, date, time }) {
  const latitude = Number(lat);
  const longitude = Number(lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !date) {
    return null;
  }

  const dateOnly = String(date).slice(0, 10);
  const cacheKey = `${latitude.toFixed(4)}|${longitude.toFixed(4)}|${dateOnly}|${String(time || "")}`;
  const cache = readWeatherCache();
  if (cache[cacheKey]) {
    return cache[cacheKey];
  }

  const endpoint = new URL("https://api.open-meteo.com/v1/forecast");
  endpoint.searchParams.set("latitude", String(latitude));
  endpoint.searchParams.set("longitude", String(longitude));
  endpoint.searchParams.set("hourly", "temperature_2m,precipitation_probability,weather_code");
  endpoint.searchParams.set("start_date", dateOnly);
  endpoint.searchParams.set("end_date", dateOnly);
  endpoint.searchParams.set("timezone", "auto");

  const response = await fetch(endpoint.toString());
  if (!response.ok) {
    throw new Error(`Wetter HTTP ${response.status}`);
  }

  const payload = await response.json();
  const timeAxis = payload?.hourly?.time || [];
  const tempAxis = payload?.hourly?.temperature_2m || [];
  const precipAxis = payload?.hourly?.precipitation_probability || [];
  const codeAxis = payload?.hourly?.weather_code || [];

  if (!Array.isArray(timeAxis) || timeAxis.length === 0) {
    return null;
  }

  const targetHour = toHourStamp(dateOnly, time);
  let idx = timeAxis.findIndex((item) => String(item || "") === targetHour);
  if (idx < 0) {
    idx = 0;
  }

  const weather = {
    temperatureC: Number.isFinite(tempAxis[idx]) ? tempAxis[idx] : null,
    precipitationProbability: Number.isFinite(precipAxis[idx]) ? precipAxis[idx] : null,
    weatherCode: Number.isFinite(codeAxis[idx]) ? codeAxis[idx] : null,
    type: weatherTypeFromCode(codeAxis[idx]),
  };

  cache[cacheKey] = weather;
  writeWeatherCache(cache);
  return weather;
}
