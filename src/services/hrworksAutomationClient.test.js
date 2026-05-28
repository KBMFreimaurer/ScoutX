import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ensureHrworksAutomationBridge,
  openHrworksAutomationLogin,
  resolveHrworksAutomationEndpoint,
  resolveHrworksAutomationHealthEndpoint,
  resolveHrworksAutomationLoginEndpoint,
  resolveHrworksAutomationStarterEndpoint,
  startHrworksAutomation,
} from "./hrworksAutomationClient";

describe("hrworksAutomationClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses the local automation bridge by default", () => {
    expect(resolveHrworksAutomationEndpoint()).toBe("http://127.0.0.1:8791/api/companion/capabilities/hrworks-import/run");
  });

  it("derives health and starter endpoints for the local bridge", () => {
    expect(resolveHrworksAutomationHealthEndpoint()).toBe("http://127.0.0.1:8791/health");
    expect(resolveHrworksAutomationLoginEndpoint()).toBe("http://127.0.0.1:8791/api/companion/capabilities/hrworks-import/open-login");
    expect(resolveHrworksAutomationStarterEndpoint()).toBe("/api/companion/start");
  });

  it("opens the HRworks login in the automation browser", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      async json() {
        return { ok: true, url: "https://ssl4.hrworks.de/k/dashboard" };
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await openHrworksAutomationLogin();

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8791/api/companion/capabilities/hrworks-import/open-login",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("skips the starter route when the local bridge is already healthy", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      async json() {
        return { ok: true };
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await ensureHrworksAutomationBridge();

    expect(result.status).toBe("already_running");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:8791/health", expect.objectContaining({ method: "GET" }));
  });

  it("starts the local bridge through the starter route when health is missing", async () => {
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

    const result = await ensureHrworksAutomationBridge();

    expect(result.status).toBe("started");
    expect(fetchMock).toHaveBeenNthCalledWith(1, "http://127.0.0.1:8791/health", expect.objectContaining({ method: "GET" }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/companion/start", expect.objectContaining({ method: "POST" }));
  });

  it("sends the full HRworks workflow request", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      async json() {
        return { ok: true, status: "completed" };
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await startHrworksAutomation({ planId: "p1" }, { endpoint: "http://127.0.0.1:8791/custom" });

    expect(result.status).toBe("completed");
    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:8791/custom", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining("\"completeWorkflow\":true"),
    }));
  });

  it("explains how to start the bridge when localhost is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    await expect(startHrworksAutomation({ planId: "p1" })).rejects.toThrow(/npm run companion:dev/);
  });

  it("times out with a bridge-terminal hint", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      });
    })));

    const promise = startHrworksAutomation({ planId: "p1" }, { timeoutMs: 5000 });
    promise.catch(() => {});
    await vi.advanceTimersByTimeAsync(5000);
    await expect(promise).rejects.toThrow(/Terminalfenster/);
    vi.useRealTimers();
  });
});
