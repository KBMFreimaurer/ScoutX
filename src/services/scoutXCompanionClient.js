const DEFAULT_SCOUTX_COMPANION_BASE_ENDPOINT = "http://127.0.0.1:8791";
const DEFAULT_SCOUTX_COMPANION_START_ENDPOINT = "/api/companion/start";
const DEFAULT_SCOUTX_COMPANION_PROTOCOL_URL = "scoutx-companion://start";
const DEFAULT_TIMEOUT_MS = 120000;
const DEFAULT_HEALTH_TIMEOUT_MS = 1500;
const DEFAULT_WAKE_TIMEOUT_MS = 10000;
const DEFAULT_WAKE_POLL_INTERVAL_MS = 250;

function stripTrailingSlash(value) {
  return String(value || "").replace(/\/+$/g, "");
}

function stripKnownCompanionPath(value) {
  return String(value || "")
    .replace(/\/api\/companion\/capabilities\/[^/]+\/[^/]+\/?$/i, "")
    .replace(/\/api\/hrworks\/(?:import|open-login)\/?$/i, "")
    .replace(/\/health\/?$/i, "")
    .replace(/\/+$/g, "");
}

function joinCompanionRoute(baseEndpoint, nextPath) {
  if (!baseEndpoint) {
    return "";
  }
  if (baseEndpoint.startsWith("/")) {
    return `${stripTrailingSlash(baseEndpoint)}${nextPath}`;
  }

  try {
    const url = new URL(baseEndpoint);
    url.pathname = `${stripKnownCompanionPath(url.pathname) || ""}${nextPath}`;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

export function resolveScoutXCompanionBaseEndpoint(explicitEndpoint = "") {
  const explicit = String(explicitEndpoint || "").trim();
  const configured = explicit
    || String(import.meta.env?.VITE_SCOUTX_COMPANION_ENDPOINT || import.meta.env?.VITE_HRWORKS_AUTOMATION_ENDPOINT || DEFAULT_SCOUTX_COMPANION_BASE_ENDPOINT).trim();

  if (!configured) {
    return "";
  }
  if (configured.startsWith("/")) {
    return stripKnownCompanionPath(configured) || "/";
  }

  try {
    const url = new URL(configured);
    url.pathname = stripKnownCompanionPath(url.pathname) || "/";
    url.search = "";
    url.hash = "";
    return stripTrailingSlash(url.toString());
  } catch {
    return "";
  }
}

export function resolveScoutXCompanionHealthEndpoint(explicitEndpoint = "") {
  return joinCompanionRoute(resolveScoutXCompanionBaseEndpoint(explicitEndpoint), "/health");
}

export function resolveScoutXCompanionCapabilityEndpoint(capability, action = "run", explicitEndpoint = "") {
  const normalizedCapability = String(capability || "").trim();
  const normalizedAction = String(action || "run").trim();
  if (!normalizedCapability || !normalizedAction) {
    return "";
  }
  return joinCompanionRoute(
    resolveScoutXCompanionBaseEndpoint(explicitEndpoint),
    `/api/companion/capabilities/${normalizedCapability}/${normalizedAction}`,
  );
}

export function resolveScoutXCompanionStartEndpoint(explicitEndpoint = "") {
  const explicit = String(explicitEndpoint || "").trim();
  if (explicit) {
    return explicit;
  }
  return String(
    import.meta.env?.VITE_SCOUTX_COMPANION_START_ENDPOINT
    || import.meta.env?.VITE_HRWORKS_AUTOMATION_START_ENDPOINT
    || DEFAULT_SCOUTX_COMPANION_START_ENDPOINT,
  ).trim();
}

export function resolveScoutXCompanionProtocolUrl(capability = "", explicitProtocolUrl = "") {
  const baseProtocolUrl = String(
    explicitProtocolUrl
    || import.meta.env?.VITE_SCOUTX_COMPANION_PROTOCOL_URL
    || DEFAULT_SCOUTX_COMPANION_PROTOCOL_URL,
  ).trim();
  if (!baseProtocolUrl) {
    return "";
  }
  const normalizedCapability = String(capability || "").trim();
  if (!normalizedCapability) {
    return baseProtocolUrl;
  }
  const hasQuery = baseProtocolUrl.includes("?");
  const separator = hasQuery ? "&" : "?";
  return `${baseProtocolUrl}${separator}capability=${encodeURIComponent(normalizedCapability)}`;
}

function isPrivateNetworkHostname(hostname) {
  const host = String(hostname || "").trim().toLowerCase();
  if (!host) {
    return false;
  }
  if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]") {
    return true;
  }
  if (host.endsWith(".local")) {
    return true;
  }
  if (host.startsWith("10.") || host.startsWith("192.168.") || host.startsWith("169.254.")) {
    return true;
  }
  const parts = host.split(".").map((part) => Number(part));
  return parts.length === 4
    && parts[0] === 172
    && parts[1] >= 16
    && parts[1] <= 31;
}

export function canUseScoutXCompanionServerStarter(locationOrigin = "", options = {}) {
  const origin = String(
    locationOrigin
    || (typeof window !== "undefined" ? window.location?.origin : "")
    || "",
  ).trim();
  const starterEndpoint = String(options.starterEndpoint || resolveScoutXCompanionStartEndpoint()).trim();
  const isDevServer = options.isDevServer ?? import.meta.env?.DEV === true;
  if (isDevServer && starterEndpoint.startsWith("/")) {
    return true;
  }
  if (!origin) {
    return false;
  }
  try {
    const url = new URL(origin);
    return starterEndpoint.startsWith("/") && isPrivateNetworkHostname(url.hostname);
  } catch {
    return false;
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function defaultWakeScoutXCompanion(protocolUrl) {
  if (!protocolUrl || typeof document === "undefined") {
    return false;
  }
  const body = document.body || document.documentElement;
  if (!body || typeof document.createElement !== "function") {
    return false;
  }

  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.display = "none";
  frame.src = protocolUrl;
  body.appendChild(frame);

  await wait(150);
  frame.remove();
  return true;
}

async function requestWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export async function ensureScoutXCompanion(options = {}) {
  const healthEndpoint = resolveScoutXCompanionHealthEndpoint(options.endpoint);
  const starterEndpoint = resolveScoutXCompanionStartEndpoint(options.startEndpoint);
  const locationOrigin = String(
    options.locationOrigin
    || (typeof window !== "undefined" ? window.location?.origin : "")
    || "",
  ).trim();
  const wakeCapability = String(options.wakeCapability || "hrworks-import").trim();
  const wakeProtocolUrl = resolveScoutXCompanionProtocolUrl(wakeCapability, options.protocolUrl);
  const wakeCompanionImpl = options.wakeCompanionImpl || defaultWakeScoutXCompanion;
  if (typeof fetch !== "function") {
    throw new Error("ScoutX Companion kann in dieser Umgebung nicht gestartet werden.");
  }

  if (healthEndpoint) {
    try {
      const healthResponse = await requestWithTimeout(
        healthEndpoint,
        {
          method: "GET",
          headers: { accept: "application/json" },
        },
        Math.max(500, Number(options.healthTimeoutMs || DEFAULT_HEALTH_TIMEOUT_MS)),
      );
      if (healthResponse.ok) {
        return { ok: true, status: "already_running" };
      }
    } catch {
      // Fall through to the local starter endpoint.
    }
  }

  if (!starterEndpoint) {
    throw new Error("Lokaler ScoutX Companion Starter fehlt. Starte zuerst: npm run companion:dev");
  }

  if (!canUseScoutXCompanionServerStarter(locationOrigin, {
    starterEndpoint,
    isDevServer: options.isDevServer,
  })) {
    if (wakeProtocolUrl) {
      try {
        await wakeCompanionImpl(wakeProtocolUrl, {
          capability: wakeCapability,
          locationOrigin,
        });
      } catch {
        // Continue with health polling and final fallback messaging.
      }
    }

    const deadline = Date.now() + Math.max(1000, Number(options.wakeTimeoutMs || DEFAULT_WAKE_TIMEOUT_MS));
    while (Date.now() < deadline) {
      if (await requestWithTimeout(
        healthEndpoint,
        {
          method: "GET",
          headers: { accept: "application/json" },
        },
        Math.max(500, Number(options.healthTimeoutMs || DEFAULT_HEALTH_TIMEOUT_MS)),
      ).then((response) => response.ok).catch(() => false)) {
        return {
          ok: true,
          status: "woken",
          launch: "protocol",
          protocolUrl: wakeProtocolUrl,
        };
      }
      await wait(Math.max(50, Number(options.wakePollIntervalMs || DEFAULT_WAKE_POLL_INTERVAL_MS)));
    }

    throw new Error("ScoutX Companion wurde auf diesem Gerät nicht erreicht. Bei deploytem ScoutX muss der Companion lokal auf deinem Rechner laufen und auf localhost:8791 antworten.");
  }

  let response;
  try {
    response = await requestWithTimeout(
      starterEndpoint,
      {
        method: "POST",
        headers: { accept: "application/json" },
      },
      Math.max(3000, Number(options.startTimeoutMs || 15000)),
    );
  } catch (error) {
    const message = String(error?.message || error || "unbekannter Netzwerkfehler");
    throw new Error(`Lokaler ScoutX Companion konnte nicht automatisch gestartet werden. Starte zuerst: npm run companion:dev (${message})`);
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok === false) {
    throw new Error(body?.error || "Lokaler ScoutX Companion konnte nicht automatisch gestartet werden. Starte zuerst: npm run companion:dev");
  }
  return body;
}

export async function openScoutXCompanionCapability(capability, action, options = {}) {
  const endpoint = resolveScoutXCompanionCapabilityEndpoint(capability, action, options.endpoint);
  if (!endpoint) {
    throw new Error("ScoutX Companion Capability konnte nicht aufgelöst werden.");
  }
  if (typeof fetch !== "function") {
    throw new Error("ScoutX Companion kann in dieser Umgebung nicht kontaktiert werden.");
  }

  let response;
  try {
    response = await requestWithTimeout(
      endpoint,
      {
        method: "POST",
        headers: {
          accept: "application/json",
        },
      },
      Math.max(3000, Number(options.timeoutMs || 15000)),
    );
  } catch (error) {
    const message = String(error?.message || error || "unbekannter Netzwerkfehler");
    throw new Error(`ScoutX Companion Capability konnte nicht gestartet werden (${message}).`);
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok === false) {
    throw new Error(body?.error || `ScoutX Companion Capability fehlgeschlagen (HTTP ${response.status}).`);
  }
  return body;
}

export async function runScoutXCompanionCapability(capability, payload, options = {}) {
  const endpoint = String(options.endpoint || "").trim() || resolveScoutXCompanionCapabilityEndpoint(capability, "run");
  if (!endpoint) {
    throw new Error("ScoutX Companion Capability-Endpunkt fehlt.");
  }
  if (typeof fetch !== "function") {
    throw new Error("ScoutX Companion kann in dieser Umgebung nicht gestartet werden.");
  }

  let response;
  const timeoutMs = Math.max(5000, Number(options.timeoutMs || DEFAULT_TIMEOUT_MS));
  try {
    response = await requestWithTimeout(
      endpoint,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          payload,
          options: options.requestOptions,
        }),
      },
      timeoutMs,
    );
  } catch (error) {
    const message = String(error?.message || error || "unbekannter Netzwerkfehler");
    if (error?.name === "AbortError") {
      throw new Error(`Lokaler ScoutX Companion antwortet nicht innerhalb von ${Math.round(timeoutMs / 1000)} Sekunden. Prüfe das Terminalfenster von npm run companion:dev.`);
    }
    throw new Error(`Lokaler ScoutX Companion ist nicht erreichbar. Starte zuerst: npm run companion:dev (${message})`);
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok === false) {
    throw new Error(body?.error || `ScoutX Companion Capability fehlgeschlagen (HTTP ${response.status}).`);
  }
  return body;
}
