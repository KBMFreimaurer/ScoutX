import { chromium } from "playwright";
import {
  resolveHrworksBridgeBrowserConfig,
  resolveHrworksBridgeSessionConfig,
} from "./hrworksAutomationBridgeConfig.js";

function formatAttachFailureMessage(cdpEndpoint, error) {
  const reason = String(error?.message || error || "unbekannter Fehler");
  return [
    `Laufender Google Chrome konnte nicht für dieselbe Browser-Session genutzt werden (${reason}).`,
    `Aktiviere in Chrome einmal chrome://inspect/#remote-debugging oder starte Chrome mit Remote-Debugging auf ${cdpEndpoint}.`,
  ].join(" ");
}

export async function createHrworksBridgeSession({
  chromiumImpl = chromium,
  env = process.env,
  profileDir,
  browserConfig = resolveHrworksBridgeBrowserConfig(env),
  sessionConfig = resolveHrworksBridgeSessionConfig(env),
} = {}) {
  const strategy = String(sessionConfig?.strategy || "attach-preferred").trim().toLowerCase();
  const cdpEndpoint = String(sessionConfig?.cdpEndpoint || "").trim();
  const attachRequested = strategy === "attach-preferred" || strategy === "attach-only";

  if (attachRequested && cdpEndpoint) {
    try {
      const browser = await chromiumImpl.connectOverCDP(cdpEndpoint);
      const context = browser?.contexts?.()?.[0];
      if (!context) {
        throw new Error("Kein nutzbarer Browser-Kontext über CDP gefunden.");
      }
      return {
        mode: "attached",
        sameBrowser: true,
        browser,
        context,
        browserConfig,
        sessionConfig,
        attachError: "",
      };
    } catch (error) {
      const attachError = formatAttachFailureMessage(cdpEndpoint, error);
      if (strategy === "attach-only") {
        throw new Error(attachError);
      }
      const context = await chromiumImpl.launchPersistentContext(profileDir, {
        channel: browserConfig.channel,
        headless: false,
        viewport: { width: 1280, height: 900 },
      });
      return {
        mode: "launched",
        sameBrowser: false,
        browser: null,
        context,
        browserConfig,
        sessionConfig,
        attachError,
      };
    }
  }

  const context = await chromiumImpl.launchPersistentContext(profileDir, {
    channel: browserConfig.channel,
    headless: false,
    viewport: { width: 1280, height: 900 },
  });
  return {
    mode: "launched",
    sameBrowser: false,
    browser: null,
    context,
    browserConfig,
    sessionConfig,
    attachError: "",
  };
}
