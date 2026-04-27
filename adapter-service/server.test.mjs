import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

async function allocatePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

async function waitForHealth(url, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Adapter noch nicht bereit.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Adapter health timeout: ${url}`);
}

function parseJsonSafe(response) {
  return response.json().catch(() => ({}));
}

describe("adapter-service server integration", () => {
  let child = null;
  let baseUrl = "";

  beforeAll(async () => {
    const port = await allocatePort();
    const rootDir = process.cwd();
    const tempDir = await mkdtemp(join(tmpdir(), "scoutx-adapter-test-"));
    const importsDir = join(tempDir, "imports");
    await mkdir(importsDir, { recursive: true });

    const sampleFile = join(tempDir, "games.sample.json");
    const storeFile = join(tempDir, "games.store.json");
    const aliasesFile = join(tempDir, "aliases.json");
    const clubsFile = join(tempDir, "clubs.catalog.json");

    await writeFile(
      sampleFile,
      JSON.stringify(
        [
          {
            date: "2026-05-02",
            time: "11:00",
            home: "MSV Duisburg U13",
            away: "VfB Uerdingen U13",
            venue: "Sportanlage Test",
            kreisId: "duisburg",
            jugendId: "d-jugend",
          },
        ],
        null,
        2,
      ),
      "utf8",
    );
    await writeFile(aliasesFile, JSON.stringify({ aliases: {} }, null, 2), "utf8");
    await writeFile(clubsFile, JSON.stringify({ clubs: [] }, null, 2), "utf8");

    child = spawn("node", ["adapter-service/server.mjs"], {
      cwd: rootDir,
      env: {
        ...process.env,
        ADAPTER_HOST: "127.0.0.1",
        ADAPTER_PORT: String(port),
        ADAPTER_TOKEN: "test-token",
        ADAPTER_AUTO_REFRESH_WEEK: "false",
        ADAPTER_EXPORT_COMMAND: "",
        ADAPTER_DATA_FILE: sampleFile,
        ADAPTER_STORE_FILE: storeFile,
        ADAPTER_IMPORT_DIR: importsDir,
        ADAPTER_ALIASES_FILE: aliasesFile,
        ADAPTER_CLUB_CATALOG_FILE: clubsFile,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    baseUrl = `http://127.0.0.1:${port}`;
    await waitForHealth(`${baseUrl}/health`, 15000);
  }, 25000);

  afterAll(async () => {
    if (!child || child.killed) {
      return;
    }
    child.kill("SIGTERM");
    await new Promise((resolve) => {
      child.once("exit", () => resolve());
      setTimeout(() => resolve(), 3000);
    });
  });

  it("returns health payload", async () => {
    const response = await fetch(`${baseUrl}/health`);
    expect(response.status).toBe(200);
    const payload = await parseJsonSafe(response);
    expect(payload.ok).toBe(true);
    expect(payload.authEnabled).toBe(true);
  });

  it("serves games roundtrip for POST /api/games", async () => {
    const response = await fetch(`${baseUrl}/api/games`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer test-token",
      },
      body: JSON.stringify({
        kreisId: "duisburg",
        jugendId: "d-jugend",
        fromDate: "2026-04-27",
        toDate: "2026-05-03",
        teams: [],
        ensureWeekData: false,
      }),
    });

    expect(response.status).toBe(200);
    const payload = await parseJsonSafe(response);
    expect(payload.ok).toBe(true);
    expect(Array.isArray(payload.games)).toBe(true);
    expect(payload.games.length).toBeGreaterThan(0);
    expect(payload.games[0].kreisId).toBe("duisburg");
  });

  it("refreshes adapter store via POST /api/admin/refresh", async () => {
    const response = await fetch(`${baseUrl}/api/admin/refresh`, {
      method: "POST",
      headers: {
        authorization: "Bearer test-token",
      },
    });

    expect(response.status).toBe(200);
    const payload = await parseJsonSafe(response);
    expect(payload.ok).toBe(true);
    expect(typeof payload.count).toBe("number");
  });

  it("validates mandant-probe input", async () => {
    const response = await fetch(`${baseUrl}/api/admin/mandant-probe?mandant=invalid`, {
      headers: {
        authorization: "Bearer test-token",
      },
    });

    expect(response.status).toBe(400);
    const payload = await parseJsonSafe(response);
    expect(payload.ok).toBe(false);
    expect(String(payload.error || "")).toContain("Mandant");
  });
});
