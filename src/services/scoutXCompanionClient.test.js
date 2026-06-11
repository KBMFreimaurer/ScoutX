import { afterEach, describe, expect, it, vi } from "vitest";
import {
  canUseScoutXCompanionServerStarter,
  ensureScoutXCompanion,
  checkScoutXCompanionHealth,
  resolveScoutXCompanionProtocolUrl,
  openScoutXCompanionCapability,
  resolveScoutXCompanionCapabilityEndpoint,
  resolveScoutXCompanionHealthEndpoint,
  resolveScoutXCompanionStartEndpoint,
} from "./scoutXCompanionClient";

describe("scoutXCompanionClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("derives the generic local Companion endpoints", () => {
    expect(resolveScoutXCompanionHealthEndpoint()).toBe("http://127.0.0.1:8791/health");
    expect(resolveScoutXCompanionStartEndpoint()).toBe("/api/companion/start");
    expect(resolveScoutXCompanionCapabilityEndpoint("hrworks-import", "open-login")).toBe(
      "http://127.0.0.1:8791/api/companion/capabilities/hrworks-import/open-login",
    );
    expect(resolveScoutXCompanionProtocolUrl("hrworks-import")).toBe("scoutx-companion://start?capability=hrworks-import");
  });

  it("uses the server starter only for local dev origins", () => {
    expect(canUseScoutXCompanionServerStarter("http://127.0.0.1:5173", { isDevServer: false })).toBe(true);
    expect(canUseScoutXCompanionServerStarter("http://localhost:4173", { isDevServer: false })).toBe(true);
    expect(canUseScoutXCompanionServerStarter("https://scoutx.example.com", { isDevServer: false })).toBe(false);
  });

  it("allows the server starter from a LAN homeserver origin", () => {
    expect(canUseScoutXCompanionServerStarter("http://10.0.0.1:5580", {
      isDevServer: false,
      starterEndpoint: "/api/companion/start",
    })).toBe(true);
    expect(canUseScoutXCompanionServerStarter("http://192.168.178.10:5580", {
      isDevServer: false,
      starterEndpoint: "/api/companion/start",
    })).toBe(true);
    expect(canUseScoutXCompanionServerStarter("http://172.16.0.5:5580", {
      isDevServer: false,
      starterEndpoint: "/api/companion/start",
    })).toBe(true);
    expect(canUseScoutXCompanionServerStarter("http://scoutx.local:5580", {
      isDevServer: false,
      starterEndpoint: "/api/companion/start",
    })).toBe(true);
  });

  it("starts the local Companion through the generic starter route when health is missing", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockResolvedValueOnce({
        ok: true,
        async json() {
          return { ok: true, status: "started" };
        },
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await ensureScoutXCompanion();

    expect(result.status).toBe("started");
    expect(fetchMock).toHaveBeenNthCalledWith(1, "http://127.0.0.1:8791/health", expect.objectContaining({ method: "GET" }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/companion/start", expect.objectContaining({ method: "POST" }));
  });

  it("checks local Companion health without starting or waking it", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const result = await checkScoutXCompanionHealth();

    expect(result.ok).toBe(true);
    expect(result.status).toBe("reachable");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8791/health",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("reports missing health without throwing", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await checkScoutXCompanionHealth();

    expect(result.ok).toBe(false);
    expect(result.status).toBe("missing");
  });

  it("starts the Companion through the homeserver starter before using protocol wakeup", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockResolvedValueOnce({
        ok: true,
        async json() {
          return { ok: true, status: "started" };
        },
      });
    const wakeCompanionImpl = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await ensureScoutXCompanion({
      locationOrigin: "http://10.0.0.1:5580",
      isDevServer: false,
      wakeCompanionImpl,
    });

    expect(result.status).toBe("started");
    expect(wakeCompanionImpl).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenNthCalledWith(1, "http://127.0.0.1:8791/health", expect.objectContaining({ method: "GET" }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/companion/start", expect.objectContaining({ method: "POST" }));
  });

  it("falls back to protocol wakeup when a homeserver proxies the starter route to a 404 adapter response", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockResolvedValueOnce({
        ok: false,
        async json() {
          return { ok: false, error: "Not Found" };
        },
      })
      .mockResolvedValueOnce({ ok: true });
    const wakeCompanionImpl = vi.fn().mockResolvedValue(true);
    vi.stubGlobal("fetch", fetchMock);

    const result = await ensureScoutXCompanion({
      locationOrigin: "http://10.0.0.1:5580",
      isDevServer: false,
      wakeCompanionImpl,
      wakeTimeoutMs: 10,
      wakePollIntervalMs: 1,
    });

    expect(result.status).toBe("woken");
    expect(wakeCompanionImpl).toHaveBeenCalledWith(
      "scoutx-companion://start?capability=hrworks-import",
      expect.objectContaining({ locationOrigin: "http://10.0.0.1:5580" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(1, "http://127.0.0.1:8791/health", expect.objectContaining({ method: "GET" }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/companion/start", expect.objectContaining({ method: "POST" }));
    expect(fetchMock).toHaveBeenNthCalledWith(3, "http://127.0.0.1:8791/health", expect.objectContaining({ method: "GET" }));
  });

  it("keeps a clear local Companion message when homeserver starter and wakeup both fail", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        async json() {
          return { ok: false, error: "Not Found" };
        },
      })
      .mockRejectedValue(new Error("ECONNREFUSED"));
    const wakeCompanionImpl = vi.fn().mockResolvedValue(true);
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      ensureScoutXCompanion({
        locationOrigin: "http://10.0.0.1:5580",
        isDevServer: false,
        wakeCompanionImpl,
        wakeTimeoutMs: 5,
        wakePollIntervalMs: 1,
      }),
    ).rejects.toThrow(/localhost:8791|lokal auf deinem Rechner/i);
  });

  it("wakes the local Companion through a protocol launch for deployed origins", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockResolvedValueOnce({ ok: true });
    const wakeCompanionImpl = vi.fn().mockResolvedValue(true);
    vi.stubGlobal("fetch", fetchMock);

    const result = await ensureScoutXCompanion({
      locationOrigin: "https://scoutx.example.com",
      isDevServer: false,
      wakeCompanionImpl,
      wakeTimeoutMs: 10,
      wakePollIntervalMs: 1,
    });

    expect(result.status).toBe("woken");
    expect(wakeCompanionImpl).toHaveBeenCalledWith(
      "scoutx-companion://start?capability=hrworks-import",
      expect.objectContaining({ locationOrigin: "https://scoutx.example.com" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(1, "http://127.0.0.1:8791/health", expect.objectContaining({ method: "GET" }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "http://127.0.0.1:8791/health", expect.objectContaining({ method: "GET" }));
  });

  it("explains the local companion requirement for deployed origins when wakeup fails", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const wakeCompanionImpl = vi.fn().mockResolvedValue(true);
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      ensureScoutXCompanion({
        locationOrigin: "https://scoutx.example.com",
        isDevServer: false,
        wakeCompanionImpl,
        wakeTimeoutMs: 5,
        wakePollIntervalMs: 1,
      }),
    ).rejects.toThrow(/lokal auf deinem Rechner|ScoutX Companion/i);
  });

  it("opens the HRworks login through the Companion capability route", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      async json() {
        return { ok: true, status: "ready" };
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await openScoutXCompanionCapability("hrworks-import", "open-login");

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8791/api/companion/capabilities/hrworks-import/open-login",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
