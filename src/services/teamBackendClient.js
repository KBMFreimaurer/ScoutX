import { ADAPTER_ENDPOINT } from "../config/adapter";

const ENV_TEAM_API_BASE = String(import.meta.env?.VITE_TEAM_API_BASE || "").trim();

let csrfToken = "";

export function resolveTeamApiBase(explicitBase = ENV_TEAM_API_BASE, adapterEndpoint = ADAPTER_ENDPOINT) {
  const explicit = String(explicitBase || "").trim().replace(/\/+$/, "");
  if (explicit) {
    return explicit;
  }

  const endpoint = String(adapterEndpoint || "").trim();
  if (!endpoint || endpoint === "/api/games") {
    return "/api/team";
  }
  if (endpoint.startsWith("/")) {
    return endpoint.replace(/\/api\/games\/?$/, "/api/team").replace(/\/games\/?$/, "/team");
  }

  try {
    const url = new URL(endpoint);
    url.pathname = url.pathname.replace(/\/api\/games\/?$/, "/api/team").replace(/\/games\/?$/, "/api/team");
    if (!/\/api\/team\/?$/.test(url.pathname)) {
      url.pathname = "/api/team";
    }
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "/api/team";
  }
}

function isBackendDisabled() {
  return import.meta.env?.MODE === "test" || import.meta.env?.VITE_TEAM_BACKEND_DISABLED === "true";
}

async function readJson(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) {
    const error = new Error(payload?.error || `Team-Backend antwortet mit HTTP ${response.status}.`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

async function requestTeamBackend(path, options = {}) {
  if (isBackendDisabled() || typeof fetch !== "function") {
    const error = new Error("Team-Backend ist deaktiviert.");
    error.status = 0;
    throw error;
  }

  const method = String(options.method || "GET").toUpperCase();
  const headers = {
    ...(options.body ? { "content-type": "application/json" } : {}),
    ...(method !== "GET" && csrfToken ? { "x-csrf-token": csrfToken } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${resolveTeamApiBase()}${path}`, {
    ...options,
    method,
    headers,
    credentials: "include",
    body: options.body && typeof options.body !== "string" ? JSON.stringify(options.body) : options.body,
  });
  const payload = await readJson(response);
  if (payload?.csrfToken) {
    csrfToken = payload.csrfToken;
  }
  return payload;
}

export function getTeamBackendStatus() {
  return {
    enabled: !isBackendDisabled(),
    hasCsrfToken: Boolean(csrfToken),
  };
}

export async function loginTeamBackend(userId, password) {
  const payload = await requestTeamBackend("/auth/login", {
    method: "POST",
    body: { userId, password },
  });
  return payload;
}

export async function registerTeamBackend(userId, name, password, teamKey) {
  const payload = await requestTeamBackend("/auth/register", {
    method: "POST",
    body: { userId, name, password, teamKey },
  });
  return payload;
}

export async function logoutTeamBackend() {
  const payload = await requestTeamBackend("/auth/logout", {
    method: "POST",
    body: {},
  });
  csrfToken = "";
  return payload;
}

export async function fetchTeamBackendState() {
  return requestTeamBackend("/state");
}

export async function publishTeamBackendPlan(input) {
  return requestTeamBackend("/plans", {
    method: "POST",
    body: input,
  });
}

export async function markTeamBackendObservationSeen(input) {
  return requestTeamBackend("/observations/seen", {
    method: "POST",
    body: input,
  });
}

export async function linkTeamBackendObservationReport(input) {
  return requestTeamBackend("/observations/report", {
    method: "POST",
    body: input,
  });
}

export async function updateTeamBackendObservationNote(input) {
  return requestTeamBackend("/observations/note", {
    method: "POST",
    body: input,
  });
}

export async function upsertTeamBackendMember(input) {
  return requestTeamBackend("/members", {
    method: "POST",
    body: input,
  });
}

export async function upsertTeamBackendManualGame(input) {
  return requestTeamBackend("/manual-games", {
    method: "POST",
    body: input,
  });
}

export async function updateTeamBackendGoals(input) {
  return requestTeamBackend("/goals", {
    method: "POST",
    body: input,
  });
}
