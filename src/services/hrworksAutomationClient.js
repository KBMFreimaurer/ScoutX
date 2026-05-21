const DEFAULT_HRWORKS_AUTOMATION_ENDPOINT = "http://127.0.0.1:8791/api/hrworks/import";
const DEFAULT_TIMEOUT_MS = 120000;

export function resolveHrworksAutomationEndpoint(explicitEndpoint = "") {
  const explicit = String(explicitEndpoint || "").trim();
  if (explicit) {
    return explicit;
  }
  return String(import.meta.env?.VITE_HRWORKS_AUTOMATION_ENDPOINT || DEFAULT_HRWORKS_AUTOMATION_ENDPOINT).trim();
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        payload,
        options: {
          confirmBeforeSave: true,
          runRouteFlow: true,
          completeWorkflow: true,
        },
      }),
    });
  } catch (error) {
    const message = String(error?.message || error || "unbekannter Netzwerkfehler");
    if (error?.name === "AbortError") {
      throw new Error(`Lokale HRworks-Automation antwortet nicht innerhalb von ${Math.round(timeoutMs / 1000)} Sekunden. Prüfe das Terminalfenster von npm run hrworks:bridge.`);
    }
    throw new Error(`Lokale HRworks-Automation ist nicht erreichbar. Starte zuerst: npm run hrworks:bridge (${message})`);
  } finally {
    clearTimeout(timeout);
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok === false) {
    throw new Error(body?.error || `HRworks-Automation fehlgeschlagen (HTTP ${response.status}).`);
  }
  return body;
}
