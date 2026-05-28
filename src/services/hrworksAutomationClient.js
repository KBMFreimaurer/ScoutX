const DEFAULT_HRWORKS_AUTOMATION_ENDPOINT = "http://127.0.0.1:8791/api/hrworks/import";
const DEFAULT_HRWORKS_AUTOMATION_START_ENDPOINT = "/api/hrworks/bridge/start";
const DEFAULT_TIMEOUT_MS = 120000;
const DEFAULT_HEALTH_TIMEOUT_MS = 1500;

function replaceHrworksRoute(endpoint, nextPath) {
  if (!endpoint) {
    return "";
  }
  if (endpoint.startsWith("/")) {
    return endpoint
      .replace(/\/api\/hrworks\/import\/?$/i, nextPath)
      .replace(/\/hrworks\/import\/?$/i, nextPath);
  }

  try {
    const url = new URL(endpoint);
    url.pathname = url.pathname
      .replace(/\/api\/hrworks\/import\/?$/i, nextPath)
      .replace(/\/hrworks\/import\/?$/i, nextPath);
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

export function resolveHrworksAutomationEndpoint(explicitEndpoint = "") {
  const explicit = String(explicitEndpoint || "").trim();
  if (explicit) {
    return explicit;
  }
  return String(import.meta.env?.VITE_HRWORKS_AUTOMATION_ENDPOINT || DEFAULT_HRWORKS_AUTOMATION_ENDPOINT).trim();
}

export function resolveHrworksAutomationHealthEndpoint(explicitEndpoint = "") {
  const endpoint = resolveHrworksAutomationEndpoint(explicitEndpoint);
  return replaceHrworksRoute(endpoint, "/health");
}

export function resolveHrworksAutomationLoginEndpoint(explicitEndpoint = "") {
  const endpoint = resolveHrworksAutomationEndpoint(explicitEndpoint);
  return replaceHrworksRoute(endpoint, "/api/hrworks/open-login");
}

export function resolveHrworksAutomationStarterEndpoint(explicitEndpoint = "") {
  const explicit = String(explicitEndpoint || "").trim();
  if (explicit) {
    return explicit;
  }
  return String(import.meta.env?.VITE_HRWORKS_AUTOMATION_START_ENDPOINT || DEFAULT_HRWORKS_AUTOMATION_START_ENDPOINT).trim();
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

export async function ensureHrworksAutomationBridge(options = {}) {
  const healthEndpoint = resolveHrworksAutomationHealthEndpoint(options.endpoint);
  const starterEndpoint = resolveHrworksAutomationStarterEndpoint(options.startEndpoint);
  if (typeof fetch !== "function") {
    throw new Error("HRworks-Automation kann in dieser Umgebung nicht gestartet werden.");
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
      // Intentionally fall through to the local starter endpoint.
    }
  }

  if (!starterEndpoint) {
    throw new Error("Lokaler HRworks-Bridge-Starter fehlt. Starte zuerst: npm run hrworks:bridge");
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
    throw new Error(`Lokale HRworks-Automation konnte nicht automatisch gestartet werden. Starte zuerst: npm run hrworks:bridge (${message})`);
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok === false) {
    throw new Error(body?.error || "Lokale HRworks-Automation konnte nicht automatisch gestartet werden. Starte zuerst: npm run hrworks:bridge");
  }
  return body;
}

export async function openHrworksAutomationLogin(options = {}) {
  const endpoint = resolveHrworksAutomationLoginEndpoint(options.endpoint);
  if (!endpoint) {
    throw new Error("HRworks-Automationsfenster konnte nicht geöffnet werden.");
  }
  if (typeof fetch !== "function") {
    throw new Error("HRworks-Automationsfenster kann in dieser Umgebung nicht geöffnet werden.");
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
    throw new Error(`HRworks-Automationsfenster konnte nicht geöffnet werden (${message}).`);
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok === false) {
    throw new Error(body?.error || `HRworks-Automationsfenster fehlgeschlagen (HTTP ${response.status}).`);
  }
  return body;
}

export async function startHrworksAutomation(payload, options = {}) {
  const endpoint = resolveHrworksAutomationEndpoint(options.endpoint);
  if (!endpoint) {
    throw new Error("HRworks-Automation-Endpunkt fehlt.");
  }
  if (typeof fetch !== "function") {
    throw new Error("HRworks-Automation kann in dieser Umgebung nicht gestartet werden.");
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
          options: {
            confirmBeforeSave: true,
            runRouteFlow: true,
            completeWorkflow: true,
          },
        }),
      },
      timeoutMs,
    );
  } catch (error) {
    const message = String(error?.message || error || "unbekannter Netzwerkfehler");
    if (error?.name === "AbortError") {
      throw new Error(`Lokale HRworks-Automation antwortet nicht innerhalb von ${Math.round(timeoutMs / 1000)} Sekunden. Prüfe das Terminalfenster von npm run hrworks:bridge.`);
    }
    throw new Error(`Lokale HRworks-Automation ist nicht erreichbar. Starte zuerst: npm run hrworks:bridge (${message})`);
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok === false) {
    throw new Error(body?.error || `HRworks-Automation fehlgeschlagen (HTTP ${response.status}).`);
  }
  return body;
}
