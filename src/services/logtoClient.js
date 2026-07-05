// Minimaler Logto-OIDC-Client (Authorization Code + PKCE) ohne SDK.
const LOGTO_ENDPOINT = String(import.meta.env?.VITE_LOGTO_ENDPOINT || "")
  .trim()
  .replace(/\/+$/, "");
const LOGTO_APP_ID = String(import.meta.env?.VITE_LOGTO_APP_ID || "").trim();
const PKCE_STORAGE_KEY = "scoutx.logto.pkce.v1";
export const INVITE_TOKEN_STORAGE_KEY = "scoutx.logto.invite.v1";

export function isLogtoConfigured() {
  return Boolean(LOGTO_ENDPOINT && LOGTO_APP_ID);
}

function toBase64Url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function randomToken() {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

async function sha256Base64Url(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return toBase64Url(new Uint8Array(digest));
}

export function logtoCallbackUri(origin = window.location.origin) {
  return `${origin}/auth/callback`;
}

export async function buildLogtoSignInUrl({ origin = window.location.origin, storage = window.sessionStorage } = {}) {
  if (!isLogtoConfigured()) {
    throw new Error("Logto ist nicht konfiguriert (VITE_LOGTO_ENDPOINT / VITE_LOGTO_APP_ID).");
  }
  const verifier = randomToken();
  const state = randomToken();
  storage.setItem(PKCE_STORAGE_KEY, JSON.stringify({ verifier, state }));
  const params = new URLSearchParams({
    client_id: LOGTO_APP_ID,
    redirect_uri: logtoCallbackUri(origin),
    response_type: "code",
    scope: "openid profile email",
    state,
    code_challenge: await sha256Base64Url(verifier),
    code_challenge_method: "S256",
  });
  return `${LOGTO_ENDPOINT}/oidc/auth?${params.toString()}`;
}

export async function startLogtoSignIn() {
  window.location.assign(await buildLogtoSignInUrl());
}

export async function completeLogtoCallback({
  currentUrl = window.location.href,
  origin = window.location.origin,
  storage = window.sessionStorage,
  fetchImpl = fetch,
} = {}) {
  const url = new URL(currentUrl);
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  let stored = null;
  try {
    stored = JSON.parse(storage.getItem(PKCE_STORAGE_KEY) || "null");
  } catch {
    stored = null;
  }
  storage.removeItem(PKCE_STORAGE_KEY);
  if (!code || !stored?.verifier || stored.state !== state) {
    throw new Error("Logto-Anmeldung konnte nicht abgeschlossen werden. Bitte erneut anmelden.");
  }
  const response = await fetchImpl(`${LOGTO_ENDPOINT}/oidc/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: logtoCallbackUri(origin),
      client_id: LOGTO_APP_ID,
      code_verifier: stored.verifier,
    }).toString(),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.id_token) {
    throw new Error(payload?.error_description || "Logto-Token-Austausch ist fehlgeschlagen.");
  }
  return { idToken: String(payload.id_token) };
}

export function buildLogtoSignOutUrl(postLogoutRedirectUri = window.location.origin) {
  if (!isLogtoConfigured()) {
    return "";
  }
  const params = new URLSearchParams({
    client_id: LOGTO_APP_ID,
    post_logout_redirect_uri: postLogoutRedirectUri,
  });
  return `${LOGTO_ENDPOINT}/oidc/session/end?${params.toString()}`;
}
