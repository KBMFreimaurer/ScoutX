import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { fillHrworksTravelExpenseForm } from "../e2e/helpers/hrworksAutomation.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const port = Number(process.env.HRWORKS_BRIDGE_PORT || 8791);
const profileDir = process.env.HRWORKS_BRIDGE_PROFILE || path.join(repoRoot, ".hrworks-automation-profile");
const startUrl = process.env.HRWORKS_START_URL || "https://ssl4.hrworks.de/k/dashboard";

let contextPromise = null;

function sendJson(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
  });
  response.end(JSON.stringify(body));
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
  const pages = context.pages();
  return pages[0] || context.newPage();
}

async function runImport(payload, options) {
  const context = await getContext();
  const page = await selectedPage(context);
  if (!String(page.url() || "").startsWith("https://ssl4.hrworks.de/")) {
    await page.goto(startUrl, { waitUntil: "domcontentloaded" });
  }

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
  };
}

const server = http.createServer(async (request, response) => {
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
    const result = await runImport(payload, body?.options);
    sendJson(response, 200, result);
  } catch (error) {
    sendJson(response, 500, {
      ok: false,
      error: String(error?.message || error || "HRworks-Automation fehlgeschlagen."),
    });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`HRworks automation bridge listening on http://127.0.0.1:${port}`);
  console.log(`Browser profile: ${profileDir}`);
});
