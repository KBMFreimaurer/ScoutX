import { constants, createPublicKey, verify as cryptoVerify } from "node:crypto";
import { HttpError } from "./httpErrors.js";

// Logto-ID-Token-Verifikation ohne zusätzliche Abhängigkeit: JWKS via fetch,
// Signaturprüfung mit node:crypto. Unterstützt RS*/PS*/ES*/EdDSA.
const JWKS_CACHE_TTL_MS = 10 * 60 * 1000;
const jwksCache = new Map();

function base64UrlToBuffer(value) {
  return Buffer.from(String(value || ""), "base64url");
}

function decodeSegment(segment) {
  try {
    return JSON.parse(base64UrlToBuffer(segment).toString("utf8"));
  } catch {
    return null;
  }
}

function verifierParamsForAlg(alg, key) {
  switch (alg) {
    case "RS256":
    case "RS384":
    case "RS512":
      return { hash: `sha${alg.slice(2)}`, key };
    case "PS256":
    case "PS384":
    case "PS512":
      return {
        hash: `sha${alg.slice(2)}`,
        key: { key, padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: Number(alg.slice(2)) / 8 },
      };
    case "ES256":
    case "ES384":
    case "ES512":
      return { hash: `sha${alg.slice(2)}`, key: { key, dsaEncoding: "ieee-p1363" } };
    case "EdDSA":
    case "Ed25519":
      return { hash: null, key };
    default:
      return null;
  }
}

async function fetchJwks(jwksUri, fetchImpl, now) {
  const cached = jwksCache.get(jwksUri);
  if (cached && now - cached.fetchedAt < JWKS_CACHE_TTL_MS) {
    return cached.keys;
  }
  const response = await fetchImpl(jwksUri, { headers: { accept: "application/json" } });
  if (!response?.ok) {
    throw new HttpError(502, "Logto-JWKS konnten nicht geladen werden.");
  }
  const payload = await response.json();
  const keys = Array.isArray(payload?.keys) ? payload.keys : [];
  jwksCache.set(jwksUri, { keys, fetchedAt: now });
  return keys;
}

export function clearLogtoJwksCache() {
  jwksCache.clear();
}

export async function verifyLogtoIdToken(idToken, options) {
  const { endpoint, appId, fetchImpl = fetch, now = Date.now() } = options || {};
  const issuerBase = String(endpoint || "").replace(/\/+$/, "");
  if (!issuerBase || !appId) {
    throw new HttpError(503, "Logto ist nicht konfiguriert.");
  }
  const segments = String(idToken || "").split(".");
  if (segments.length !== 3) {
    throw new HttpError(401, "Logto-Token ist ungültig.");
  }
  const header = decodeSegment(segments[0]);
  const claims = decodeSegment(segments[1]);
  if (!header?.alg || !claims) {
    throw new HttpError(401, "Logto-Token ist ungültig.");
  }

  const keys = await fetchJwks(`${issuerBase}/oidc/jwks`, fetchImpl, now);
  const candidates = keys.filter((key) => !header.kid || !key.kid || key.kid === header.kid);
  const data = Buffer.from(`${segments[0]}.${segments[1]}`, "utf8");
  const signature = base64UrlToBuffer(segments[2]);
  const verified = candidates.some((jwk) => {
    try {
      const params = verifierParamsForAlg(String(header.alg), createPublicKey({ key: jwk, format: "jwk" }));
      return params ? cryptoVerify(params.hash, data, params.key, signature) : false;
    } catch {
      return false;
    }
  });
  if (!verified) {
    throw new HttpError(401, "Logto-Token-Signatur ist ungültig.");
  }

  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (String(claims.iss || "") !== `${issuerBase}/oidc`) {
    throw new HttpError(401, "Logto-Token stammt nicht vom erwarteten Aussteller.");
  }
  if (!audiences.includes(appId)) {
    throw new HttpError(401, "Logto-Token gehört nicht zu dieser Anwendung.");
  }
  if (!Number.isFinite(claims.exp) || claims.exp * 1000 <= now) {
    throw new HttpError(401, "Logto-Token ist abgelaufen.");
  }
  if (!claims.sub) {
    throw new HttpError(401, "Logto-Token enthält keine Nutzer-ID.");
  }

  return {
    subject: String(claims.sub),
    email: String(claims.email || "")
      .trim()
      .toLowerCase(),
    emailVerified: claims.email_verified !== false,
    name: String(claims.name || "").trim(),
  };
}
