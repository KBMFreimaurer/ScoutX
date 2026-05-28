const DEFAULT_HRWORKS_BRIDGE_BROWSER_CHANNEL = "chrome";
const DEFAULT_HRWORKS_BRIDGE_SESSION_STRATEGY = "attach-preferred";
const DEFAULT_HRWORKS_BRIDGE_CDP_ENDPOINT = "http://127.0.0.1:9222";

const CHANNEL_APP_NAMES = {
  chrome: "Google Chrome",
  "chrome-beta": "Google Chrome Beta",
  "chrome-dev": "Google Chrome Dev",
  "chrome-canary": "Google Chrome Canary",
};

function normalizeText(value) {
  return String(value || "").trim();
}

function escapeAppleScriptString(value) {
  return String(value || "").replaceAll("\\", "\\\\").replaceAll("\"", "\\\"");
}

export function resolveHrworksBridgeBrowserConfig(env = process.env) {
  const channel = normalizeText(env?.HRWORKS_BRIDGE_BROWSER_CHANNEL) || DEFAULT_HRWORKS_BRIDGE_BROWSER_CHANNEL;
  const appName = normalizeText(env?.HRWORKS_BRIDGE_BROWSER_APP) || CHANNEL_APP_NAMES[channel] || "Google Chrome";
  return {
    channel,
    appName,
  };
}

export function resolveHrworksBridgeSessionConfig(env = process.env) {
  const strategy = normalizeText(env?.HRWORKS_BRIDGE_SESSION_STRATEGY) || DEFAULT_HRWORKS_BRIDGE_SESSION_STRATEGY;
  const cdpEndpoint = normalizeText(env?.HRWORKS_BRIDGE_CDP_ENDPOINT) || DEFAULT_HRWORKS_BRIDGE_CDP_ENDPOINT;
  return {
    strategy,
    cdpEndpoint,
  };
}

export function buildHrworksBridgeActivationScript(appName) {
  const safeAppName = escapeAppleScriptString(appName);
  return [
    "-e",
    `tell application "${safeAppName}" to activate`,
    "-e",
    `tell application "System Events" to tell process "${safeAppName}" to set frontmost to true`,
  ];
}
