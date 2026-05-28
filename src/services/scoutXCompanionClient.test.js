import { afterEach, describe, expect, it, vi } from "vitest";
import {
  canUseScoutXCompanionServerStarter,
  ensureScoutXCompanion,
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
    expect(canUseScoutXCompanionServerStarter("http://127.0.0.1:5173")).toBe(true);
    expect(canUseScoutXCompanionServerStarter("http://localhost:4173")).toBe(true);
    expect(canUseScoutXCompanionServerStarter("https://scoutx.example.com")).toBe(false);
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

  it("wakes the local Companion through a protocol launch for deployed origins", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockResolvedValueOnce({ ok: true });
    const wakeCompanionImpl = vi.fn().mockResolvedValue(true);
    vi.stubGlobal("fetch", fetchMock);

    const result = await ensureScoutXCompanion({
      locationOrigin: "https://scoutx.example.com",
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
