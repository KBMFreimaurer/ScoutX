import {
  checkScoutXCompanionHealth,
  ensureScoutXCompanion,
  openScoutXCompanionCapability,
  resolveScoutXCompanionCapabilityEndpoint,
  resolveScoutXCompanionHealthEndpoint,
  resolveScoutXCompanionStartEndpoint,
  runScoutXCompanionCapability,
} from "./scoutXCompanionClient";

export function resolveHrworksAutomationEndpoint(explicitEndpoint = "") {
  const explicit = String(explicitEndpoint || "").trim();
  if (explicit) {
    return explicit;
  }
  return resolveScoutXCompanionCapabilityEndpoint("hrworks-import", "run");
}

export function resolveHrworksAutomationHealthEndpoint(explicitEndpoint = "") {
  return resolveScoutXCompanionHealthEndpoint(explicitEndpoint || resolveHrworksAutomationEndpoint(explicitEndpoint));
}

export function resolveHrworksAutomationLoginEndpoint(explicitEndpoint = "") {
  return resolveScoutXCompanionCapabilityEndpoint("hrworks-import", "open-login", explicitEndpoint || resolveHrworksAutomationEndpoint(explicitEndpoint));
}

export function resolveHrworksAutomationStarterEndpoint(explicitEndpoint = "") {
  return resolveScoutXCompanionStartEndpoint(explicitEndpoint);
}

export async function ensureHrworksAutomationBridge(options = {}) {
  return ensureScoutXCompanion(options);
}

export async function checkHrworksAutomationBridge(options = {}) {
  return checkScoutXCompanionHealth(options);
}

export async function openHrworksAutomationLogin(options = {}) {
  return openScoutXCompanionCapability("hrworks-import", "open-login", options);
}

export async function startHrworksAutomation(payload, options = {}) {
  return runScoutXCompanionCapability("hrworks-import", payload, {
    endpoint: resolveHrworksAutomationEndpoint(options.endpoint),
    timeoutMs: options.timeoutMs,
    requestOptions: {
      confirmBeforeSave: true,
      runRouteFlow: true,
      completeWorkflow: true,
    },
  });
}
