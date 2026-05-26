import http from "node:http";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { fillHrworksTravelExpenseForm } from "../e2e/helpers/hrworksAutomation.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const port = Number(process.env.HRWORKS_BRIDGE_PORT || 8791);
const profileDir = process.env.HRWORKS_BRIDGE_PROFILE || path.join(repoRoot, ".hrworks-automation-profile");
const startUrl = process.env.HRWORKS_START_URL || "https://ssl4.hrworks.de/k/dashboard";
const execFileAsync = promisify(execFile);

let contextPromise = null;

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

async function getContext() {
  if (!contextPromise) {
    contextPromise = chromium.launchPersistentContext(profileDir, {
      headless: false,
      viewport: { width: 1280, height: 900 },
    });
  }
  return contextPromise;
}

async function selectedPage(context) {
  const pages = context
    .pages()
    .filter((page) => !page.isClosed() && !String(page.url() || "").startsWith("devtools://"));
  const preferredPage =
    pages.find((page) => String(page.url() || "").startsWith("https://ssl4.hrworks.de/")) ||
    pages.find((page) => {
      const url = String(page.url() || "");
      return url === "about:blank" || url.startsWith("chrome://newtab");
    }) ||
    pages.at(-1);
  return preferredPage || context.newPage();
}

async function activateBrowserWindow() {
  if (process.platform !== "darwin") {
    return;
  }
  try {
    await execFileAsync("osascript", [
      "-e",
      'tell application "Google Chrome for Testing" to activate',
      "-e",
      'tell application "System Events" to tell process "Google Chrome for Testing" to set frontmost to true',
    ]);
  } catch (error) {
    console.warn(`Could not activate browser window: ${String(error?.message || error)}`);
  }
}

async function ensureHrworksPage(context) {
  const page = await selectedPage(context);
  if (!String(page.url() || "").startsWith("https://ssl4.hrworks.de/")) {
    await page.goto(startUrl, { waitUntil: "domcontentloaded" });
  }
  await page.bringToFront();
  await activateBrowserWindow();
  return page;
}

async function runImport(payload, options) {
  const startedAtMs = Date.now();
  const context = await getContext();
  const page = await ensureHrworksPage(context);

  const result = await fillHrworksTravelExpenseForm(page, payload, {
    confirmBeforeSave: true,
    runRouteFlow: true,
    completeWorkflow: true,
    ...(options || {}),
  });

  return {
    ok: true,
    status: result?.reportsCompleted ? "completed" : "saved",
    result,
    url: page.url(),
    durationMs: Number(result?.metrics?.durationMs || Math.max(0, Date.now() - startedAtMs)),
    metrics: result?.metrics || null,
  };
}

const server = http.createServer(async (request, response) => {
  console.log(`[${new Date().toISOString()}] ${request.method} ${request.url}`);
  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }
  if (request.method === "GET" && request.url === "/health") {
    sendJson(response, 200, { ok: true, service: "hrworks-automation-bridge" });
    return;
  }
  if (request.method !== "POST" || request.url !== "/api/hrworks/import") {
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
  getContext()
    .then(async (context) => {
      const page = await ensureHrworksPage(context);
      console.log(`HRworks browser opened: ${page.url()} (${context.pages().length} tab(s))`);
    })
    .catch((error) => {
      console.error(`HRworks browser could not be opened: ${String(error?.message || error)}`);
    });
});
