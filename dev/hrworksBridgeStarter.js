import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const DEFAULT_SCRIPT_PATH = path.join(repoRoot, "scripts", "hrworks-automation-bridge.mjs");
const DEFAULT_HEALTH_ENDPOINT = "http://127.0.0.1:8791/health";
const DEFAULT_STARTUP_TIMEOUT_MS = 15000;
const DEFAULT_POLL_INTERVAL_MS = 250;

let bridgeStartPromise = null;
const STARTER_ROUTES = new Set([
  "/api/hrworks/bridge/start",
  "/api/companion/start",
]);

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function checkHrworksBridgeHealth({
  endpoint = DEFAULT_HEALTH_ENDPOINT,
  timeoutMs = 1200,
  fetchImpl = fetch,
} = {}) {
  if (typeof fetchImpl !== "function") {
    return false;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(endpoint, {
      method: "GET",
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export function spawnHrworksBridgeProcess({
  scriptPath = DEFAULT_SCRIPT_PATH,
  cwd = repoRoot,
  spawnImpl = spawn,
  nodeExecPath = process.execPath,
} = {}) {
  const child = spawnImpl(nodeExecPath, [scriptPath], {
    cwd,
    detached: true,
    stdio: "ignore",
  });
  if (typeof child?.unref === "function") {
    child.unref();
  }
  return child;
}

export async function ensureHrworksBridgeRunning(options = {}) {
  const {
    healthEndpoint = DEFAULT_HEALTH_ENDPOINT,
    startupTimeoutMs = DEFAULT_STARTUP_TIMEOUT_MS,
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    fetchImpl = fetch,
  } = options;

  if (await checkHrworksBridgeHealth({ endpoint: healthEndpoint, fetchImpl })) {
    return { ok: true, status: "already_running" };
  }

  if (bridgeStartPromise) {
    return bridgeStartPromise;
  }

  bridgeStartPromise = (async () => {
    spawnHrworksBridgeProcess(options);
    const deadline = Date.now() + Math.max(3000, Number(startupTimeoutMs || DEFAULT_STARTUP_TIMEOUT_MS));
    while (Date.now() < deadline) {
      if (await checkHrworksBridgeHealth({ endpoint: healthEndpoint, fetchImpl })) {
        return { ok: true, status: "started" };
      }
      await wait(Math.max(100, Number(pollIntervalMs || DEFAULT_POLL_INTERVAL_MS)));
    }
    throw new Error("Lokaler ScoutX Companion konnte nicht automatisch gestartet werden. Starte zuerst: npm run companion:dev");
  })().finally(() => {
    bridgeStartPromise = null;
  });

  return bridgeStartPromise;
}

function sendJson(response, statusCode, body) {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}

export function createHrworksBridgeStartMiddleware(options = {}) {
  return async function hrworksBridgeStartMiddleware(request, response, next) {
    if (!STARTER_ROUTES.has(request.url)) {
      next();
      return;
    }

    if (request.method !== "POST") {
      sendJson(response, 405, { ok: false, error: "Nur POST ist erlaubt." });
      return;
    }

    try {
      const ensureBridgeRunning = options.ensureBridgeRunning || ensureHrworksBridgeRunning;
      const result = await ensureBridgeRunning(options);
      sendJson(response, 200, result);
    } catch (error) {
      sendJson(response, 503, {
        ok: false,
        error: String(error?.message || error || "Lokaler ScoutX Companion konnte nicht automatisch gestartet werden."),
      });
    }
  };
}
