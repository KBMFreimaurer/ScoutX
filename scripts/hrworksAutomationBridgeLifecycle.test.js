// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import {
  createHrworksBridgeSessionManager,
  isRecoverableHrworksSessionError,
} from "./hrworksAutomationBridgeLifecycle.js";

describe("hrworksAutomationBridgeLifecycle", () => {
  it("detects closed browser-context errors as recoverable", () => {
    expect(isRecoverableHrworksSessionError(new Error("browserContext.newPage: Target page, context or browser has been closed"))).toBe(true);
    expect(isRecoverableHrworksSessionError(new Error("page.goto: net::ERR_ABORTED"))).toBe(false);
  });

  it("recreates the browser session once when the cached context is closed", async () => {
    const staleSession = { id: "stale" };
    const freshSession = { id: "fresh" };
    const createSession = vi
      .fn()
      .mockResolvedValueOnce(staleSession)
      .mockResolvedValueOnce(freshSession);
    const manager = createHrworksBridgeSessionManager({ createSession });
    const task = vi
      .fn()
      .mockRejectedValueOnce(new Error("browserContext.newPage: Target page, context or browser has been closed"))
      .mockResolvedValueOnce({ ok: true, sessionId: "fresh" });

    const result = await manager.withSession(task);

    expect(result).toEqual({ ok: true, sessionId: "fresh" });
    expect(createSession).toHaveBeenCalledTimes(2);
    expect(task).toHaveBeenNthCalledWith(1, staleSession);
    expect(task).toHaveBeenNthCalledWith(2, freshSession);
  });
});
