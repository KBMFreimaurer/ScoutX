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

export async function loginTeamBackendWithLogto(idToken) {
  return requestTeamBackend("/auth/logto", {
    method: "POST",
    body: { idToken },
  });
}

export async function acceptTeamInvitationWithLogto(token, idToken) {
  return requestTeamBackend("/invitations/accept", {
    method: "POST",
    body: { token, idToken },
  });
}

export async function registerTeamBackend(userId, name, password, teamKey) {
  const payload = await requestTeamBackend("/auth/register", {
    method: "POST",
    body: { userId, email: userId, name, password, teamKey },
  });
  return payload;
}

export async function confirmTeamEmailVerification(token) {
  return requestTeamBackend("/auth/verification/confirm", {
    method: "POST",
    body: { token },
  });
}

export async function resendTeamEmailVerification() {
  return requestTeamBackend("/auth/verification/resend", {
    method: "POST",
    body: {},
  });
}

export async function updateTeamAuthProfile(input) {
  return requestTeamBackend("/auth/profile", {
    method: "POST",
    body: input,
  });
}

export async function createTeamInvitation(input) {
  return requestTeamBackend("/invitations/create", {
    method: "POST",
    body: input,
  });
}

export async function acceptTeamInvitation(token, password) {
  return requestTeamBackend("/invitations/accept", {
    method: "POST",
    body: { token, password },
  });
}

export async function requestTeamPasswordReset(userId) {
  return requestTeamBackend("/auth/password-reset/request", {
    method: "POST",
    body: { userId },
  });
}

export async function confirmTeamPasswordReset(token, password) {
  return requestTeamBackend("/auth/password-reset/confirm", {
    method: "POST",
    body: { token, password },
  });
}

export async function subscribeTeamPushNotifications(subscription) {
  return requestTeamBackend("/notifications/push/subscribe", {
    method: "POST",
    body: { subscription },
  });
}

export async function fetchTeamPushPendingEvents() {
  return requestTeamBackend("/notifications/push/pending");
}

export async function ackTeamPushEvents(eventIds) {
  return requestTeamBackend("/notifications/push/ack", {
    method: "POST",
    body: { eventIds },
  });
}

export async function fetchTeamNotifications({ status = "", type = "" } = {}) {
  const params = new URLSearchParams();
  if (status) {
    params.set("status", status);
  }
  if (type) {
    params.set("type", type);
  }
  const query = params.toString();
  return requestTeamBackend(`/notifications${query ? `?${query}` : ""}`);
}

export async function markTeamNotificationsRead(eventIds) {
  return requestTeamBackend("/notifications/read", {
    method: "POST",
    body: { eventIds },
  });
}

export async function fetchTeamConflicts() {
  return requestTeamBackend("/conflicts");
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

export async function reassignTeamBackendObservation(input) {
  return requestTeamBackend("/observations/reassign", {
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

export async function createTeamTournament(input) {
  return requestTeamBackend("/tournaments", {
    method: "POST",
    body: input,
  });
}

export async function addTeamTournamentMatches(tournamentId, matches) {
  return requestTeamBackend(`/tournaments/${encodeURIComponent(String(tournamentId || ""))}/matches`, {
    method: "POST",
    body: { matches },
  });
}

export async function importTeamTournamentsFromMeinturnierplan(input) {
  return requestTeamBackend("/tournaments/import/meinturnierplan", {
    method: "POST",
    body: input,
  });
}

export async function importTeamNationalGames(input) {
  return requestTeamBackend("/import/dfb-national-games", {
    method: "POST",
    body: input,
  });
}

export async function previewTeamKreisPdfImport(input) {
  return requestTeamBackend("/import/kreis-pdf", {
    method: "POST",
    body: {
      mode: "preview",
      ...input,
    },
  });
}

export async function confirmTeamKreisPdfImport(previewToken) {
  return requestTeamBackend("/import/kreis-pdf", {
    method: "POST",
    body: {
      mode: "confirm",
      previewToken,
    },
  });
}
