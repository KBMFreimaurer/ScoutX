// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import { ensureHrworksBridgeRunning } from "./hrworksBridgeStarter.js";

describe("hrworksBridgeStarter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns already_running when the health endpoint is already reachable", async () => {
    const spawnImpl = vi.fn();
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });

    const result = await ensureHrworksBridgeRunning({
      fetchImpl,
      spawnImpl,
      healthEndpoint: "http://127.0.0.1:8791/health",
    });

    expect(result.status).toBe("already_running");
    expect(spawnImpl).not.toHaveBeenCalled();
  });

  it("spawns the bridge and waits until health succeeds", async () => {
    const spawnImpl = vi.fn().mockReturnValue({ unref: vi.fn() });
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true });

    const result = await ensureHrworksBridgeRunning({
      fetchImpl,
      spawnImpl,
      healthEndpoint: "http://127.0.0.1:8791/health",
      pollIntervalMs: 1,
    });

    expect(result.status).toBe("started");
    expect(spawnImpl).toHaveBeenCalledTimes(1);
  });
});
