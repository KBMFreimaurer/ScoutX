// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  buildHrworksBridgeActivationScript,
  resolveHrworksBridgeBrowserConfig,
  resolveHrworksBridgeSessionConfig,
} from "./hrworksAutomationBridgeConfig.js";
import {
  openHrworksLoginTab,
  pickPreferredHrworksPage,
} from "./hrworksAutomationBridgePages.js";

describe("hrworksAutomationBridgeConfig", () => {
  it("uses normal Google Chrome as the default automation browser", () => {
    expect(resolveHrworksBridgeBrowserConfig({})).toEqual({
      channel: "chrome",
      appName: "Google Chrome",
    });
  });

  it("allows explicit browser overrides through environment variables", () => {
    expect(resolveHrworksBridgeBrowserConfig({
      HRWORKS_BRIDGE_BROWSER_CHANNEL: "chrome-beta",
      HRWORKS_BRIDGE_BROWSER_APP: "Google Chrome Beta",
    })).toEqual({
      channel: "chrome-beta",
      appName: "Google Chrome Beta",
    });
  });

  it("prefers attaching to the running Chrome instance by default", () => {
    expect(resolveHrworksBridgeSessionConfig({})).toEqual({
      strategy: "attach-preferred",
      cdpEndpoint: "http://127.0.0.1:9222",
    });
  });

  it("builds an activation script for the selected browser app", () => {
    expect(buildHrworksBridgeActivationScript("Google Chrome")).toEqual([
      "-e",
      'tell application "Google Chrome" to activate',
      "-e",
      'tell application "System Events" to tell process "Google Chrome" to set frontmost to true',
    ]);
  });

  it("prefers the most recently opened HRworks tab for later automation steps", () => {
    const createPage = (url) => ({
      isClosed() {
        return false;
      },
      url() {
        return url;
      },
    });

    const firstHrworksTab = createPage("https://ssl4.hrworks.de/k/dashboard");
    const latestHrworksTab = createPage("https://login.hrworks.de/?redirect=/dashboard");

    expect(pickPreferredHrworksPage([
      createPage("chrome://newtab/"),
      firstHrworksTab,
      latestHrworksTab,
    ])).toBe(latestHrworksTab);
  });

  it("opens a fresh HRworks login tab instead of reusing the current page", async () => {
    const goto = async () => {};
    const bringToFront = async () => {};
    const page = {
      url() {
        return "about:blank";
      },
      goto,
      bringToFront,
    };
    const context = {
      async newPage() {
        return page;
      },
    };
    const onReady = async () => {};

    const result = await openHrworksLoginTab(context, "https://ssl4.hrworks.de/k/dashboard", onReady);

    expect(result).toBe(page);
  });

  it("accepts an aborted goto when Chrome already landed on an HRworks login page", async () => {
    const abortError = new Error("page.goto: net::ERR_ABORTED");
    const page = {
      currentUrl: "about:blank",
      url() {
        return this.currentUrl;
      },
      async goto() {
        this.currentUrl = "https://login.hrworks.de/?redirect=/dashboard";
        throw abortError;
      },
    };
    const context = {
      async newPage() {
        return page;
      },
    };

    const result = await openHrworksLoginTab(context, "https://ssl4.hrworks.de/k/dashboard");

    expect(result).toBe(page);
    expect(page.url()).toContain("login.hrworks.de");
  });
});
