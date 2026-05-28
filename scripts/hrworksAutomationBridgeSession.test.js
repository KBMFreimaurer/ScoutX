// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import { createHrworksBridgeSession } from "./hrworksAutomationBridgeSession.js";

describe("hrworksAutomationBridgeSession", () => {
  it("attaches to the running Chrome instance when CDP is available", async () => {
    const context = { pages() { return []; } };
    const browser = { contexts() { return [context]; } };
    const chromiumImpl = {
      connectOverCDP: vi.fn().mockResolvedValue(browser),
      launchPersistentContext: vi.fn(),
    };

    const session = await createHrworksBridgeSession({
      chromiumImpl,
      env: {},
      profileDir: "/tmp/hrworks-profile",
    });

    expect(session.mode).toBe("attached");
    expect(session.context).toBe(context);
    expect(session.sameBrowser).toBe(true);
    expect(chromiumImpl.connectOverCDP).toHaveBeenCalledWith("http://127.0.0.1:9222");
    expect(chromiumImpl.launchPersistentContext).not.toHaveBeenCalled();
  });

  it("falls back to a dedicated automation profile when CDP attach is unavailable", async () => {
    const context = { pages() { return []; } };
    const chromiumImpl = {
      connectOverCDP: vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
      launchPersistentContext: vi.fn().mockResolvedValue(context),
    };

    const session = await createHrworksBridgeSession({
      chromiumImpl,
      env: {},
      profileDir: "/tmp/hrworks-profile",
      browserConfig: {
        channel: "chrome",
        appName: "Google Chrome",
      },
    });

    expect(session.mode).toBe("launched");
    expect(session.context).toBe(context);
    expect(session.sameBrowser).toBe(false);
    expect(session.attachError).toMatch(/ECONNREFUSED/);
    expect(chromiumImpl.launchPersistentContext).toHaveBeenCalledWith(
      "/tmp/hrworks-profile",
      expect.objectContaining({ channel: "chrome", headless: false }),
    );
  });

  it("fails hard in attach-only mode when the running Chrome instance is not attachable", async () => {
    const chromiumImpl = {
      connectOverCDP: vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
      launchPersistentContext: vi.fn(),
    };

    await expect(createHrworksBridgeSession({
      chromiumImpl,
      env: {
        HRWORKS_BRIDGE_SESSION_STRATEGY: "attach-only",
      },
      profileDir: "/tmp/hrworks-profile",
    })).rejects.toThrow(/chrome:\/\/inspect\/#remote-debugging/i);
    expect(chromiumImpl.launchPersistentContext).not.toHaveBeenCalled();
  });
});
