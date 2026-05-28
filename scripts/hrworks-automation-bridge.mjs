import http from "node:http";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { fillHrworksTravelExpenseForm } from "../e2e/helpers/hrworksAutomation.js";
import {
  buildHrworksBridgeActivationScript,
  resolveHrworksBridgeBrowserConfig,
  resolveHrworksBridgeSessionConfig,
} from "./hrworksAutomationBridgeConfig.js";
import {
  isHrworksPageUrl,
  openHrworksLoginTab,
  pickPreferredHrworksPage,
} from "./hrworksAutomationBridgePages.js";
import { createHrworksBridgeSessionManager } from "./hrworksAutomationBridgeLifecycle.js";
import { buildHrworksOpenLoginResponse } from "./hrworksAutomationBridgeResponses.js";
import { createHrworksBridgeSession } from "./hrworksAutomationBridgeSession.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const port = Number(process.env.HRWORKS_BRIDGE_PORT || 8791);
const profileDir = process.env.HRWORKS_BRIDGE_PROFILE || path.join(repoRoot, ".hrworks-automation-profile");
const startUrl = process.env.HRWORKS_START_URL || "https://ssl4.hrworks.de/k/dashboard";
const execFileAsync = promisify(execFile);
const browserConfig = resolveHrworksBridgeBrowserConfig(process.env);
const sessionConfig = resolveHrworksBridgeSessionConfig(process.env);
const sessionManager = createHrworksBridgeSessionManager({
  createSession: () =>
    createHrworksBridgeSession({
      chromiumImpl: chromium,
      env: process.env,
      profileDir,
      browserConfig,
      sessionConfig,
    }),
});

function sendJson(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-allow-private-network": "true",
  });
  response.end(status === 204 ? "" : JSON.stringify(body));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let raw = "";
    request.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 5_000_000) {
        reject(new Error("Request zu groß."));
        request.destroy();
      }
    });
    request.on("end", () => resolve(raw));
    request.on("error", reject);
  });
}

async function getSession() {
  return sessionManager.getSession();
}

async function getContext() {
  const session = await getSession();
  return session.context;
}

async function selectedPage(context) {
  const preferredPage = pickPreferredHrworksPage(context.pages());
  return preferredPage || context.newPage();
}

async function activateBrowserWindow() {
  if (process.platform !== "darwin") {
    return;
  }
  try {
    await execFileAsync("osascript", buildHrworksBridgeActivationScript(browserConfig.appName));
  } catch (error) {
    console.warn(`Could not activate browser window: ${String(error?.message || error)}`);
  }
}

async function ensureHrworksPage(context) {
  const page = await selectedPage(context);
  if (!isHrworksPageUrl(page.url())) {
    await page.goto(startUrl, { waitUntil: "domcontentloaded" });
  }
  await page.bringToFront();
  await activateBrowserWindow();
  return page;
}

async function runImport(payload, options) {
  const startedAtMs = Date.now();
  const { session, page } = await sessionManager.withSession(async (activeSession) => {
    const context = activeSession.context;
    const page = await ensureHrworksPage(context);
    return { session: activeSession, page };
  });

  const result = await fillHrworksTravelExpenseForm(page, payload, {
    confirmBeforeSave: true,
    runRouteFlow: true,
    completeWorkflow: true,
    ...(options || {}),
  });

  return {
    ok: true,
    status: result?.reportsCompleted ? "completed" : "saved",
    browserMode: session.mode,
    sameBrowser: session.sameBrowser,
    result,
    url: page.url(),
    durationMs: Number(result?.metrics?.durationMs || Math.max(0, Date.now() - startedAtMs)),
    metrics: result?.metrics || null,
  };
}

async function openLoginWindow() {
  const { session, page } = await sessionManager.withSession(async (activeSession) => {
    const context = activeSession.context;
    const page = activeSession.sameBrowser
      ? await openHrworksLoginTab(context, startUrl, async (nextPage) => {
          await nextPage.bringToFront();
          await activateBrowserWindow();
        })
      : await ensureHrworksPage(context);
    return { session: activeSession, page };
  });
  return buildHrworksOpenLoginResponse(session, page);
}

function isCompanionCapabilityRoute(request, capability, action) {
  return request.method === "POST" && request.url === `/api/companion/capabilities/${capability}/${action}`;
}

const server = http.createServer(async (request, response) => {
  console.log(`[${new Date().toISOString()}] ${request.method} ${request.url}`);
  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }
  if (request.method === "GET" && request.url === "/health") {
    sendJson(response, 200, {
      ok: true,
      service: "scoutx-companion",
      transport: "local-http",
      browserChannel: browserConfig.channel,
      sessionStrategy: sessionConfig.strategy,
      capabilities: {
        "hrworks-import": {
          supported: true,
          login: "user-session",
          routes: {
            openLogin: "/api/companion/capabilities/hrworks-import/open-login",
            run: "/api/companion/capabilities/hrworks-import/run",
          },
        },
      },
      legacyService: "hrworks-automation-bridge",
    });
    return;
  }
  if (request.method === "GET" && request.url === "/api/companion/capabilities/hrworks-import") {
    sendJson(response, 200, {
      ok: true,
      capability: "hrworks-import",
      supported: true,
      login: "user-session",
      routes: {
        openLogin: "/api/companion/capabilities/hrworks-import/open-login",
        run: "/api/companion/capabilities/hrworks-import/run",
      },
    });
    return;
  }
  if (
    (request.method === "POST" && request.url === "/api/hrworks/open-login")
    || isCompanionCapabilityRoute(request, "hrworks-import", "open-login")
  ) {
    try {
      const result = await openLoginWindow();
      console.log(`HRworks login window ready at ${result.url}`);
      sendJson(response, 200, result);
    } catch (error) {
      console.error(`HRworks login window could not be opened: ${String(error?.message || error)}`);
      sendJson(response, 500, {
        ok: false,
        error: String(error?.message || error || "HRworks-Automationsfenster konnte nicht geöffnet werden."),
      });
    }
    return;
  }
  if (
    request.method !== "POST"
    || (
      request.url !== "/api/hrworks/import"
      && request.url !== "/api/companion/capabilities/hrworks-import/run"
    )
  ) {
    sendJson(response, 404, { ok: false, error: "Route nicht gefunden." });
    return;
  }

  try {
    const raw = await readBody(request);
    const body = raw ? JSON.parse(raw) : {};
    const payload = body?.payload && typeof body.payload === "object" ? body.payload : null;
    if (!payload) {
      sendJson(response, 400, { ok: false, error: "Payload fehlt." });
      return;
    }
    console.log(`Starting HRworks import for ${payload.date || "unknown date"}: ${payload.purpose || "no purpose"}`);
    const result = await runImport(payload, body?.options);
    console.log(`HRworks import finished with status ${result.status} in ${result.durationMs}ms`);
    sendJson(response, 200, result);
  } catch (error) {
    console.error(`HRworks import failed: ${String(error?.message || error)}`);
    sendJson(response, 500, {
      ok: false,
      error: String(error?.message || error || "HRworks-Automation fehlgeschlagen."),
    });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`HRworks automation bridge listening on http://127.0.0.1:${port}`);
  console.log(`Browser profile: ${profileDir}`);
  console.log(`Browser channel: ${browserConfig.channel} (${browserConfig.appName})`);
  console.log(`Session strategy: ${sessionConfig.strategy} (${sessionConfig.cdpEndpoint})`);
  sessionManager.resetSession();
  getSession()
    .then(async (session) => {
      const context = session.context;
      const page = await ensureHrworksPage(context);
      console.log(`HRworks browser opened: ${page.url()} (${context.pages().length} tab(s)) · mode=${session.mode} sameBrowser=${session.sameBrowser}`);
      if (session.attachError) {
        console.warn(session.attachError);
      }
    })
    .catch((error) => {
      console.error(`HRworks browser could not be opened: ${String(error?.message || error)}`);
    });
});
