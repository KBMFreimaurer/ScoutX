import { generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { clearLogtoJwksCache, verifyLogtoIdToken } from "./logtoOidc.js";

const ENDPOINT = "https://logto.example.test";
const APP_ID = "scoutx-app";

const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "test-key", alg: "ES256", use: "sig" };

function signIdToken(claims, header = { alg: "ES256", kid: "test-key" }) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const data = `${encode(header)}.${encode(claims)}`;
  const signature = cryptoSign("sha256", Buffer.from(data), { key: privateKey, dsaEncoding: "ieee-p1363" });
  return `${data}.${signature.toString("base64url")}`;
}

function stubFetch() {
  return async () => ({ ok: true, json: async () => ({ keys: [jwk] }) });
}

function baseClaims(now) {
  return {
    iss: `${ENDPOINT}/oidc`,
    aud: APP_ID,
    sub: "logto-user-1",
    email: "scout@example.com",
    email_verified: true,
    name: "Scout Eins",
    exp: Math.floor(now / 1000) + 300,
  };
}

describe("verifyLogtoIdToken", () => {
  beforeEach(() => clearLogtoJwksCache());

  it("akzeptiert ein gültiges Token und liefert Identität", async () => {
    const now = Date.now();
    const token = signIdToken(baseClaims(now));
    const identity = await verifyLogtoIdToken(token, {
      endpoint: ENDPOINT,
      appId: APP_ID,
      fetchImpl: stubFetch(),
      now,
    });
    expect(identity).toEqual({
      subject: "logto-user-1",
      email: "scout@example.com",
      emailVerified: true,
      name: "Scout Eins",
    });
  });

  it("lehnt abgelaufene Tokens ab", async () => {
    const now = Date.now();
    const token = signIdToken({ ...baseClaims(now), exp: Math.floor(now / 1000) - 10 });
    await expect(
      verifyLogtoIdToken(token, { endpoint: ENDPOINT, appId: APP_ID, fetchImpl: stubFetch(), now }),
    ).rejects.toThrow("abgelaufen");
  });

  it("lehnt falsche Audience und falschen Issuer ab", async () => {
    const now = Date.now();
    const wrongAud = signIdToken({ ...baseClaims(now), aud: "other-app" });
    await expect(
      verifyLogtoIdToken(wrongAud, { endpoint: ENDPOINT, appId: APP_ID, fetchImpl: stubFetch(), now }),
    ).rejects.toThrow();
    const wrongIss = signIdToken({ ...baseClaims(now), iss: "https://evil.example/oidc" });
    await expect(
      verifyLogtoIdToken(wrongIss, { endpoint: ENDPOINT, appId: APP_ID, fetchImpl: stubFetch(), now }),
    ).rejects.toThrow();
  });

  it("lehnt manipulierte Signaturen ab", async () => {
    const now = Date.now();
    const token = signIdToken(baseClaims(now));
    const [h, p] = token.split(".");
    const forged = `${h}.${Buffer.from(JSON.stringify({ ...baseClaims(now), sub: "attacker" })).toString("base64url")}.${token.split(".")[2]}`;
    await expect(
      verifyLogtoIdToken(forged, { endpoint: ENDPOINT, appId: APP_ID, fetchImpl: stubFetch(), now }),
    ).rejects.toThrow("Signatur");
    expect(p).toBeTruthy();
  });
});
