const ABSOLUTE_HTTP_RE = /^https?:\/\//i;

function normalizeEndpoint(value) {
  return String(value || "").trim();
}

function toAdminPath(suffix) {
  const safeSuffix = String(suffix || "status")
    .trim()
    .replace(/^\/+/, "");

  return `/api/admin/${safeSuffix}`;
}

function withClearedSearchAndHash(url) {
  url.search = "";
  url.hash = "";
  return url;
}

function replaceGamesPath(pathname, suffix) {
  if (!/\/api\/games\/?$/i.test(pathname)) {
    return null;
  }

  return pathname.replace(/\/games\/?$/i, `/admin/${suffix}`);
}

export function resolveAdapterAdminUrl(adapterEndpoint, suffix = "status") {
  const endpoint = normalizeEndpoint(adapterEndpoint);
  const fallbackPath = toAdminPath(suffix);

  if (!endpoint) {
    return fallbackPath;
  }

  if (endpoint.startsWith("/")) {
    return replaceGamesPath(endpoint, suffix) || fallbackPath;
  }

  if (!ABSOLUTE_HTTP_RE.test(endpoint)) {
    return fallbackPath;
  }

  try {
    const parsed = new URL(endpoint);
    const replacedPath = replaceGamesPath(parsed.pathname, suffix);

    if (replacedPath) {
      parsed.pathname = replacedPath;
      return withClearedSearchAndHash(parsed).toString();
    }

    parsed.pathname = fallbackPath;
    return withClearedSearchAndHash(parsed).toString();
  } catch {
    return fallbackPath;
  }
}

export function resolveAdapterHealthUrl(adapterEndpoint) {
  const endpoint = normalizeEndpoint(adapterEndpoint);

  if (!endpoint) {
    return "/health";
  }

  if (endpoint.startsWith("/")) {
    return /\/api\/games\/?$/i.test(endpoint) ? endpoint.replace(/\/api\/games\/?$/i, "/health") : "/health";
  }

  if (!ABSOLUTE_HTTP_RE.test(endpoint)) {
    return "/health";
  }

  try {
    const parsed = new URL(endpoint);
    parsed.pathname = /\/api\/games\/?$/i.test(parsed.pathname)
      ? parsed.pathname.replace(/\/api\/games\/?$/i, "/health")
      : "/health";
    return withClearedSearchAndHash(parsed).toString();
  } catch {
    return "/health";
  }
}

async function parseJsonSafe(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function callAdapterApi({ url, method = "GET", token = "" }) {
  const headers = {
    Accept: "application/json",
  };

  const authToken = String(token || "").trim();
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
    });
  } catch {
    throw new Error(`Adapter nicht erreichbar (${url}).`);
  }

  const payload = await parseJsonSafe(response);

  if (!response.ok) {
    const details = String(payload?.error || `HTTP ${response.status}`).trim();
    throw new Error(details || "Unbekannter Adapter-Fehler");
  }

  return payload || {};
}

export async function fetchAdapterAdminStatus(adapterEndpoint, adapterToken) {
  const url = resolveAdapterAdminUrl(adapterEndpoint, "status");
  return callAdapterApi({
    url,
    method: "GET",
    token: adapterToken,
  });
}

export async function triggerAdapterAdminRefresh(adapterEndpoint, adapterToken) {
  const url = resolveAdapterAdminUrl(adapterEndpoint, "refresh");
  return callAdapterApi({
    url,
    method: "POST",
    token: adapterToken,
  });
}

export async function fetchAdapterHealth(adapterEndpoint) {
  const url = resolveAdapterHealthUrl(adapterEndpoint);
  return callAdapterApi({
    url,
    method: "GET",
    token: "",
  });
}
