import { describe, expect, it, vi } from "vitest";

vi.stubEnv("VITE_LOGTO_ENDPOINT", "https://logto.example.test");
vi.stubEnv("VITE_LOGTO_APP_ID", "scoutx-app");

const { buildLogtoSignInUrl, completeLogtoCallback, isLogtoConfigured } = await import("./logtoClient");

function memoryStorage() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };
}

describe("logtoClient", () => {
  it("ist mit Env-Konfiguration aktiv", () => {
    expect(isLogtoConfigured()).toBe(true);
  });

  it("baut eine PKCE-Sign-in-URL und schließt den Callback mit Code-Austausch ab", async () => {
    const storage = memoryStorage();
    const origin = "https://scoutx.example.test";
    const signInUrl = new URL(await buildLogtoSignInUrl({ origin, storage }));

    expect(signInUrl.origin).toBe("https://logto.example.test");
    expect(signInUrl.pathname).toBe("/oidc/auth");
    expect(signInUrl.searchParams.get("client_id")).toBe("scoutx-app");
    expect(signInUrl.searchParams.get("code_challenge_method")).toBe("S256");
    expect(signInUrl.searchParams.get("redirect_uri")).toBe(`${origin}/auth/callback`);
    const state = signInUrl.searchParams.get("state");
    expect(state?.length).toBeGreaterThan(20);

    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ id_token: "id-token-123" }) }));
    const result = await completeLogtoCallback({
      currentUrl: `${origin}/auth/callback?code=abc&state=${state}`,
      origin,
      storage,
      fetchImpl,
    });
    expect(result.idToken).toBe("id-token-123");
    const body = String(fetchImpl.mock.calls[0][1].body);
    expect(body).toContain("grant_type=authorization_code");
    expect(body).toContain("code_verifier=");
  });

  it("lehnt Callback mit falschem State ab", async () => {
    const storage = memoryStorage();
    const origin = "https://scoutx.example.test";
    await buildLogtoSignInUrl({ origin, storage });
    await expect(
      completeLogtoCallback({
        currentUrl: `${origin}/auth/callback?code=abc&state=wrong`,
        origin,
        storage,
        fetchImpl: vi.fn(),
      }),
    ).rejects.toThrow();
  });
});
