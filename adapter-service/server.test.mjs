import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer as createNetServer } from "node:net";
import { createServer as createHttpServer } from "node:http";
import { spawn } from "node:child_process";
import { pbkdf2Sync, randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const TEAM_TEST_PASSWORD = "ScoutX-test-pass-2026";

function hashPassword(password) {
  const salt = randomBytes(16).toString("base64url");
  const iterations = 100000;
  const hash = pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("base64url");
  return `pbkdf2-sha256$${iterations}$${salt}$${hash}`;
}

async function allocatePort() {
  return new Promise((resolve, reject) => {
    const server = createNetServer();
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

async function readSseUntil(response, predicate, timeoutMs = 8000) {
  const reader = response.body?.getReader?.();
  if (!reader) {
    throw new Error("SSE response body missing reader.");
  }
  const decoder = new TextDecoder();
  const deadline = Date.now() + timeoutMs;
  let buffer = "";
  try {
    while (Date.now() < deadline) {
      const waitMs = Math.max(1, Math.min(600, deadline - Date.now()));
      const result = await Promise.race([
        reader.read(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("SSE timeout exceeded.")), waitMs)),
      ]);
      if (!result || result.done) {
        break;
      }
      buffer += decoder.decode(result.value, { stream: true });
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() || "";
      for (const chunk of chunks) {
        const dataLine = chunk
          .split("\n")
          .map((line) => line.trim())
          .find((line) => line.startsWith("data:"));
        if (!dataLine) {
          continue;
        }
        const payloadText = dataLine.slice(5).trim();
        if (!payloadText) {
          continue;
        }
        let payload = null;
        try {
          payload = JSON.parse(payloadText);
        } catch {
          continue;
        }
        if (predicate(payload)) {
          return payload;
        }
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  throw new Error("SSE predicate not matched.");
}

describe("adapter-service server integration", () => {
  let child = null;
  let baseUrl = "";
  let archiveFile = "";
  let emailOutboxFile = "";
  let meinturnierplanStub = null;
  let meinturnierplanBaseUrl = "";

  beforeAll(async () => {
    const port = await allocatePort();
    const meinturnierplanPort = await allocatePort();
    const rootDir = process.cwd();
    const tempDir = await mkdtemp(join(tmpdir(), "scoutx-adapter-test-"));
    const importsDir = join(tempDir, "imports");
    await mkdir(importsDir, { recursive: true });

    const sampleFile = join(tempDir, "games.sample.json");
    const storeFile = join(tempDir, "games.store.json");
    const teamStateFile = join(tempDir, "team-state.json");
    archiveFile = join(tempDir, "team-state.archive.ndjson");
    emailOutboxFile = join(tempDir, "email-outbox.ndjson");
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
    await writeFile(
      teamStateFile,
      JSON.stringify(
        {
          version: 1,
          team: {
            id: "team-scoutx",
            name: "ScoutX Team",
            accounts: [
              {
                id: "user-admin",
                name: "Leitung",
                role: "admin",
                teamId: "team-scoutx",
                active: true,
                passwordHash: hashPassword(TEAM_TEST_PASSWORD),
              },
              {
                id: "user-coordinator",
                name: "Koordination",
                role: "coordinator",
                teamId: "team-scoutx",
                active: true,
                passwordHash: hashPassword(TEAM_TEST_PASSWORD),
              },
              {
                id: "user-scout",
                name: "Scout",
                role: "scout",
                teamId: "team-scoutx",
                active: true,
                passwordHash: hashPassword(TEAM_TEST_PASSWORD),
              },
              {
                id: "user-scout-b",
                name: "Scout B",
                role: "scout",
                teamId: "team-scoutx",
                active: true,
                passwordHash: hashPassword(TEAM_TEST_PASSWORD),
              },
              {
                id: "user-readonly",
                name: "Gast",
                role: "readonly",
                teamId: "team-scoutx",
                active: true,
                passwordHash: hashPassword(TEAM_TEST_PASSWORD),
              },
              {
                id: "user-outsider",
                name: "Extern",
                role: "admin",
                teamId: "team-other",
                active: true,
                passwordHash: hashPassword(TEAM_TEST_PASSWORD),
              },
            ],
          },
          manualGames: [],
          teamGoals: { favoriteTeams: [], favoriteClubs: [], leaguePriorities: [], ageGroups: [] },
          observations: [],
          feedItems: [],
        },
        null,
        2,
      ),
      "utf8",
    );

    meinturnierplanStub = createHttpServer((req, res) => {
      const url = String(req.url || "");
      if (url.startsWith("/national-games")) {
        const payload = {
          games: [
            {
              id: "source-u15-ger-ita-1",
              home: "Deutschland U15",
              away: "Italien U15",
              date: "2026-06-12",
              time: "18:00",
              venue: "DFB Campus Frankfurt",
            },
          ],
        };
        res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify(payload));
        return;
      }
      if (!url.startsWith("/suche/")) {
        res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        res.end("not found");
        return;
      }
      const payload = {
        features: [
          {
            properties: {
              name: "MSV Duisburg U12 Cup",
              url: "/showit.php?id=abc123",
              startDate: "03.06.2026",
              endDate: "04.06.2026",
              venue: "Sportschule Wedau",
              address: "Duisburg",
            },
          },
          {
            properties: {
              name: "MSV Duisburg U12 Cup Nord",
              url: "/showit.php?id=xyz999",
              startDate: "03.06.2026",
              endDate: "04.06.2026",
              venue: "Sportplatz Altona",
              address: "Hamburg",
            },
          },
        ],
      };
      const html = `<!doctype html><html><body><script>window.mapSearchTournaments = ${JSON.stringify(payload)};</script></body></html>`;
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(html);
    });
    await new Promise((resolve, reject) => {
      meinturnierplanStub.once("error", reject);
      meinturnierplanStub.listen(meinturnierplanPort, "127.0.0.1", () => resolve());
    });
    meinturnierplanBaseUrl = `http://127.0.0.1:${meinturnierplanPort}`;

    child = spawn("node", ["adapter-service/server.mjs"], {
      cwd: rootDir,
      env: {
        ...process.env,
        ADAPTER_HOST: "127.0.0.1",
        ADAPTER_PORT: String(port),
        ADAPTER_TOKEN: "test-token",
        ADAPTER_RATE_LIMIT_MAX: "500",
        ADAPTER_AUTO_REFRESH_WEEK: "false",
        ADAPTER_EXPORT_COMMAND: "",
        ADAPTER_DATA_FILE: sampleFile,
        ADAPTER_STORE_FILE: storeFile,
        ADAPTER_TEAM_STATE_FILE: teamStateFile,
        ADAPTER_TEAM_LOGIN_RATE_LIMIT_MAX: "50",
        ADAPTER_TEAM_LOGIN_LOCK_THRESHOLD: "6",
        ADAPTER_TEAM_LOGIN_LOCK_DURATION_SEC: "120",
        ADAPTER_TEAM_WRITE_RATE_LIMIT_MAX: "500",
        ADAPTER_TEAM_SESSION_TTL_SEC: "2",
        ADAPTER_IMPORT_DIR: importsDir,
        ADAPTER_TEAM_ARCHIVE_FILE: archiveFile,
        ADAPTER_EMAIL_OUTBOX_FILE: emailOutboxFile,
        ADAPTER_ALIASES_FILE: aliasesFile,
        ADAPTER_CLUB_CATALOG_FILE: clubsFile,
        ADAPTER_MEINTURNIERPLAN_BASE_URL: meinturnierplanBaseUrl,
        ADAPTER_DFB_NATIONAL_SOURCE_URL_TEMPLATE: `${meinturnierplanBaseUrl}/national-games?from={fromDate}&to={toDate}&age={ageGroup}`,
        CORS_ORIGIN: "http://localhost:5173,http://127.0.0.1:5173",
        ADAPTER_EXPOSE_RESET_TOKEN_ON_REQUEST: "true",
        ADAPTER_AUTH_READS_FROM_DB: "true",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    baseUrl = `http://127.0.0.1:${port}`;
    await waitForHealth(`${baseUrl}/health`, 15000);
  }, 25000);

  afterAll(async () => {
    if (meinturnierplanStub) {
      await new Promise((resolve) => {
        meinturnierplanStub.close(() => resolve());
      });
    }
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
    expect(response.headers.get("x-request-id")).toBeTruthy();
    const payload = await parseJsonSafe(response);
    expect(payload.ok).toBe(true);
    expect(payload.authEnabled).toBe(true);
    expect(payload.dbFirstMode).toBe(false);
    expect(payload.dbUrlConfigured).toBe(false);
    expect(payload.dbReadModes).toMatchObject({
      auth: true,
      sessions: false,
      teamState: false,
      notifications: false,
      observations: false,
      reports: false,
      feed: false,
    });
  });

  it("rejects preflight from disallowed origins", async () => {
    const response = await fetch(`${baseUrl}/api/team/state`, {
      method: "OPTIONS",
      headers: {
        origin: "https://evil.example",
      },
    });
    expect(response.status).toBe(403);
  });

  it("allows preflight from configured origins and returns credentialed CORS headers", async () => {
    const response = await fetch(`${baseUrl}/api/team/state`, {
      method: "OPTIONS",
      headers: {
        origin: "http://localhost:5173",
      },
    });
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
    expect(response.headers.get("access-control-allow-credentials")).toBe("true");
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

  it("handles concurrent admin refresh requests without failure", async () => {
    const [firstRefresh, secondRefresh] = await Promise.all([
      fetch(`${baseUrl}/api/admin/refresh`, {
        method: "POST",
        headers: {
          authorization: "Bearer test-token",
        },
      }),
      fetch(`${baseUrl}/api/admin/refresh`, {
        method: "POST",
        headers: {
          authorization: "Bearer test-token",
        },
      }),
    ]);
    expect(firstRefresh.status).toBe(200);
    expect(secondRefresh.status).toBe(200);
    const firstPayload = await parseJsonSafe(firstRefresh);
    const secondPayload = await parseJsonSafe(secondRefresh);
    expect(firstPayload.ok).toBe(true);
    expect(secondPayload.ok).toBe(true);
    expect(typeof firstPayload.count).toBe("number");
    expect(typeof secondPayload.count).toBe("number");
  });

  it("deduplicates admin refresh with same idempotency key", async () => {
    const headers = {
      authorization: "Bearer test-token",
      "idempotency-key": `admin-refresh-idem-${Date.now()}`,
    };
    const [firstRefresh, secondRefresh] = await Promise.all([
      fetch(`${baseUrl}/api/admin/refresh`, {
        method: "POST",
        headers,
      }),
      fetch(`${baseUrl}/api/admin/refresh`, {
        method: "POST",
        headers,
      }),
    ]);
    expect(firstRefresh.status).toBe(200);
    expect(secondRefresh.status).toBe(200);
    const firstPayload = await parseJsonSafe(firstRefresh);
    const secondPayload = await parseJsonSafe(secondRefresh);
    expect(firstPayload.ok).toBe(true);
    expect(secondPayload.ok).toBe(true);
    expect(secondPayload.count).toBe(firstPayload.count);
  });

  it("handles concurrent admin refresh and admin import without server errors", async () => {
    const importBody = JSON.stringify({
      replace: false,
      games: [
        {
          date: "2026-05-07",
          time: "13:00",
          home: `Admin Mixed ${Date.now()}`,
          away: "Admin Mixed Gegner",
          venue: "Admin Mixed Platz",
        },
      ],
    });

    const [refreshResponse, importResponse] = await Promise.all([
      fetch(`${baseUrl}/api/admin/refresh`, {
        method: "POST",
        headers: {
          authorization: "Bearer test-token",
        },
      }),
      fetch(`${baseUrl}/api/admin/import`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer test-token",
        },
        body: importBody,
      }),
    ]);

    expect(refreshResponse.status).toBe(200);
    expect(importResponse.status).toBe(200);
    const refreshPayload = await parseJsonSafe(refreshResponse);
    const importPayload = await parseJsonSafe(importResponse);
    expect(refreshPayload.ok).toBe(true);
    expect(importPayload.ok).toBe(true);
  });

  it("scopes admin idempotency by endpoint so same key across refresh and import does not conflict", async () => {
    const sameKey = `admin-cross-scope-${Date.now()}`;

    const refreshResponse = await fetch(`${baseUrl}/api/admin/refresh`, {
      method: "POST",
      headers: {
        authorization: "Bearer test-token",
        "idempotency-key": sameKey,
      },
    });
    expect(refreshResponse.status).toBe(200);

    const importResponse = await fetch(`${baseUrl}/api/admin/import`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer test-token",
        "idempotency-key": sameKey,
      },
      body: JSON.stringify({
        replace: false,
        games: [
          {
            date: "2026-05-08",
            time: "14:00",
            home: `Admin Scope Home ${Date.now()}`,
            away: "Admin Scope Away",
            venue: "Admin Scope Platz",
          },
        ],
      }),
    });
    expect(importResponse.status).toBe(200);
    const importPayload = await parseJsonSafe(importResponse);
    expect(importPayload.ok).toBe(true);
  });

  it("handles concurrent admin game import and club import without losing either update", async () => {
    const gameHome = `Admin Mixed Store ${Date.now()}`;
    const clubName = `Admin Mixed Club ${Date.now()}`;

    const [gameImportResponse, clubImportResponse] = await Promise.all([
      fetch(`${baseUrl}/api/admin/import`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer test-token",
        },
        body: JSON.stringify({
          replace: false,
          games: [
            {
              date: "2026-05-09",
              time: "10:30",
              home: gameHome,
              away: "Admin Mixed Gegner",
              venue: "Admin Mixed Platz",
            },
          ],
        }),
      }),
      fetch(`${baseUrl}/api/admin/clubs/import`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer test-token",
        },
        body: JSON.stringify({
          replace: false,
          clubs: [{ name: clubName, aliases: ["AMC"] }],
        }),
      }),
    ]);
    expect(gameImportResponse.status).toBe(200);
    expect(clubImportResponse.status).toBe(200);

    const gamesResponse = await fetch(`${baseUrl}/api/games`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer test-token",
      },
      body: JSON.stringify({
        kreisId: "duisburg",
        jugendId: "d-jugend",
        fromDate: "2026-05-01",
        toDate: "2026-05-15",
        teams: [],
        ensureWeekData: false,
      }),
    });
    expect(gamesResponse.status).toBe(200);
    const gamesPayload = await parseJsonSafe(gamesResponse);
    const homes = (Array.isArray(gamesPayload.games) ? gamesPayload.games : []).map((item) => String(item?.home || ""));
    expect(homes).toContain(gameHome);

    const clubsResponse = await fetch(`${baseUrl}/api/clubs/search?q=Admin Mixed Club&limit=50`, {
      headers: {
        authorization: "Bearer test-token",
      },
    });
    expect(clubsResponse.status).toBe(200);
    const clubsPayload = await parseJsonSafe(clubsResponse);
    const names = (Array.isArray(clubsPayload.clubs) ? clubsPayload.clubs : []).map((item) => String(item?.name || ""));
    expect(names).toContain(clubName);
  });

  it("applies concurrent admin imports without losing games", async () => {
    const gameA = {
      date: "2026-05-03",
      time: "10:00",
      home: `Admin Parallel A ${Date.now()}`,
      away: "Admin Gegner A",
      venue: "Admin Platz A",
      kreisId: "duisburg",
      jugendId: "d-jugend",
    };
    const gameB = {
      date: "2026-05-03",
      time: "11:00",
      home: `Admin Parallel B ${Date.now()}`,
      away: "Admin Gegner B",
      venue: "Admin Platz B",
      kreisId: "duisburg",
      jugendId: "d-jugend",
    };

    const [firstImport, secondImport] = await Promise.all([
      fetch(`${baseUrl}/api/admin/import`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer test-token",
        },
        body: JSON.stringify({ replace: false, games: [gameA] }),
      }),
      fetch(`${baseUrl}/api/admin/import`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer test-token",
        },
        body: JSON.stringify({ replace: false, games: [gameB] }),
      }),
    ]);
    expect(firstImport.status).toBe(200);
    expect(secondImport.status).toBe(200);

    const gamesResponse = await fetch(`${baseUrl}/api/games`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer test-token",
      },
      body: JSON.stringify({
        kreisId: "duisburg",
        jugendId: "d-jugend",
        fromDate: "2026-05-01",
        toDate: "2026-05-10",
        teams: [],
        ensureWeekData: false,
      }),
    });
    expect(gamesResponse.status).toBe(200);
    const gamesPayload = await parseJsonSafe(gamesResponse);
    const homes = (Array.isArray(gamesPayload.games) ? gamesPayload.games : []).map((item) => String(item?.home || ""));
    expect(homes).toContain(gameA.home);
    expect(homes).toContain(gameB.home);
  });

  it("rejects admin import idempotency-key reuse with different payload", async () => {
    const idempotencyKey = `admin-import-conflict-${Date.now()}`;
    const firstResponse = await fetch(`${baseUrl}/api/admin/import`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer test-token",
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify({
        replace: false,
        games: [
          {
            date: "2026-05-05",
            time: "10:00",
            home: `Admin Idem A ${Date.now()}`,
            away: "Admin Gegner A",
            venue: "Admin Platz A",
          },
        ],
      }),
    });
    expect(firstResponse.status).toBe(200);

    const secondResponse = await fetch(`${baseUrl}/api/admin/import`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer test-token",
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify({
        replace: false,
        games: [
          {
            date: "2026-05-05",
            time: "11:00",
            home: `Admin Idem B ${Date.now()}`,
            away: "Admin Gegner B",
            venue: "Admin Platz B",
          },
        ],
      }),
    });
    expect(secondResponse.status).toBe(409);
    const secondPayload = await parseJsonSafe(secondResponse);
    expect(secondPayload.ok).toBe(false);
  });

  it("deduplicates admin import with same idempotency key and payload", async () => {
    const idempotencyKey = `admin-import-dedupe-${Date.now()}`;
    const body = JSON.stringify({
      replace: false,
      games: [
        {
          date: "2026-05-06",
          time: "12:00",
          home: `Admin Dedupe ${Date.now()}`,
          away: "Admin Dedupe Gegner",
          venue: "Admin Dedupe Platz",
        },
      ],
    });
    const headers = {
      "content-type": "application/json",
      authorization: "Bearer test-token",
      "idempotency-key": idempotencyKey,
    };

    const [firstResponse, secondResponse] = await Promise.all([
      fetch(`${baseUrl}/api/admin/import`, {
        method: "POST",
        headers,
        body,
      }),
      fetch(`${baseUrl}/api/admin/import`, {
        method: "POST",
        headers,
        body,
      }),
    ]);
    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    const firstPayload = await parseJsonSafe(firstResponse);
    const secondPayload = await parseJsonSafe(secondResponse);
    expect(firstPayload.ok).toBe(true);
    expect(secondPayload.ok).toBe(true);
    expect(secondPayload.total).toBe(firstPayload.total);
    expect(secondPayload.imported).toBe(firstPayload.imported);
  });

  it("applies concurrent admin club imports without losing entries", async () => {
    const clubA = { name: `Parallel Club A ${Date.now()}`, aliases: ["PCA"] };
    const clubB = { name: `Parallel Club B ${Date.now()}`, aliases: ["PCB"] };

    const [firstImport, secondImport] = await Promise.all([
      fetch(`${baseUrl}/api/admin/clubs/import`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer test-token",
        },
        body: JSON.stringify({ replace: false, clubs: [clubA] }),
      }),
      fetch(`${baseUrl}/api/admin/clubs/import`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer test-token",
        },
        body: JSON.stringify({ replace: false, clubs: [clubB] }),
      }),
    ]);
    expect(firstImport.status).toBe(200);
    expect(secondImport.status).toBe(200);

    const clubsSearchResponse = await fetch(`${baseUrl}/api/clubs/search?q=Parallel Club&limit=50`, {
      headers: {
        authorization: "Bearer test-token",
      },
    });
    expect(clubsSearchResponse.status).toBe(200);
    const clubsSearchPayload = await parseJsonSafe(clubsSearchResponse);
    const names = (Array.isArray(clubsSearchPayload.clubs) ? clubsSearchPayload.clubs : []).map((item) =>
      String(item?.name || ""),
    );
    expect(names).toContain(clubA.name);
    expect(names).toContain(clubB.name);
  });

  it("rejects admin clubs import idempotency-key reuse with different payload", async () => {
    const idempotencyKey = `admin-clubs-conflict-${Date.now()}`;
    const firstResponse = await fetch(`${baseUrl}/api/admin/clubs/import`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer test-token",
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify({
        replace: false,
        clubs: [{ name: `Conflict Club A ${Date.now()}`, aliases: ["CCA"] }],
      }),
    });
    expect(firstResponse.status).toBe(200);

    const secondResponse = await fetch(`${baseUrl}/api/admin/clubs/import`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer test-token",
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify({
        replace: false,
        clubs: [{ name: `Conflict Club B ${Date.now()}`, aliases: ["CCB"] }],
      }),
    });
    expect(secondResponse.status).toBe(409);
    const secondPayload = await parseJsonSafe(secondResponse);
    expect(secondPayload.ok).toBe(false);
  });

  it("deduplicates admin clubs import with same idempotency key and payload", async () => {
    const idempotencyKey = `admin-clubs-dedupe-${Date.now()}`;
    const body = JSON.stringify({
      replace: false,
      clubs: [{ name: `Dedupe Club ${Date.now()}`, aliases: ["DCP"] }],
    });
    const headers = {
      "content-type": "application/json",
      authorization: "Bearer test-token",
      "idempotency-key": idempotencyKey,
    };

    const [firstResponse, secondResponse] = await Promise.all([
      fetch(`${baseUrl}/api/admin/clubs/import`, {
        method: "POST",
        headers,
        body,
      }),
      fetch(`${baseUrl}/api/admin/clubs/import`, {
        method: "POST",
        headers,
        body,
      }),
    ]);
    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    const firstPayload = await parseJsonSafe(firstResponse);
    const secondPayload = await parseJsonSafe(secondResponse);
    expect(firstPayload.ok).toBe(true);
    expect(secondPayload.ok).toBe(true);
    expect(secondPayload.total).toBe(firstPayload.total);
    expect(secondPayload.imported).toBe(firstPayload.imported);
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

  it("protects verband-status endpoint with auth", async () => {
    const response = await fetch(`${baseUrl}/api/admin/verband-status`);
    expect(response.status).toBe(401);
    const payload = await parseJsonSafe(response);
    expect(payload.ok).toBe(false);
  });

  it("protects team-archive endpoint with auth", async () => {
    const response = await fetch(`${baseUrl}/api/admin/team-archive`);
    expect(response.status).toBe(401);
    const payload = await parseJsonSafe(response);
    expect(payload.ok).toBe(false);
  });

  it("protects admin jobs endpoint with auth", async () => {
    const response = await fetch(`${baseUrl}/api/admin/jobs`);
    expect(response.status).toBe(401);
    const payload = await parseJsonSafe(response);
    expect(payload.ok).toBe(false);
  });

  it("protects admin metrics endpoint with auth", async () => {
    const response = await fetch(`${baseUrl}/api/admin/metrics`);
    expect(response.status).toBe(401);
    const payload = await parseJsonSafe(response);
    expect(payload.ok).toBe(false);
  });

  it("protects admin db-readiness endpoint with auth", async () => {
    const response = await fetch(`${baseUrl}/api/admin/db-readiness`);
    expect(response.status).toBe(401);
    const payload = await parseJsonSafe(response);
    expect(payload.ok).toBe(false);
  });

  it("returns ingestion job diagnostics", async () => {
    const refreshResponse = await fetch(`${baseUrl}/api/admin/refresh`, {
      method: "POST",
      headers: {
        authorization: "Bearer test-token",
      },
    });
    expect(refreshResponse.status).toBe(200);

    const response = await fetch(`${baseUrl}/api/admin/jobs`, {
      headers: {
        authorization: "Bearer test-token",
      },
    });
    expect(response.status).toBe(200);
    const payload = await parseJsonSafe(response);
    expect(payload.ok).toBe(true);
    expect(Array.isArray(payload.jobs)).toBe(true);
    const refreshJob = payload.jobs.find((job) => job.name === "refresh:admin-refresh");
    expect(Boolean(refreshJob)).toBe(true);
    expect(refreshJob).toMatchObject({
      category: "refresh",
      status: "success",
    });
    expect(String(refreshJob.jobId || "")).toContain("job-");
    expect(String(refreshJob.correlationId || "")).toContain("refresh:admin-refresh:");
    expect(Number(refreshJob.runCount || 0)).toBeGreaterThan(0);
  });

  it("returns prometheus metrics for admin monitoring", async () => {
    const refreshResponse = await fetch(`${baseUrl}/api/admin/refresh`, {
      method: "POST",
      headers: {
        authorization: "Bearer test-token",
      },
    });
    expect(refreshResponse.status).toBe(200);

    const response = await fetch(`${baseUrl}/api/admin/metrics`, {
      headers: {
        authorization: "Bearer test-token",
      },
    });
    expect(response.status).toBe(200);
    expect(String(response.headers.get("content-type") || "")).toContain("text/plain");
    const text = await response.text();
    expect(text).toContain("scoutx_adapter_uptime_seconds");
    expect(text).toContain("scoutx_adapter_games_total");
    expect(text).toContain("scoutx_ingestion_jobs_failed");
    expect(text).toContain("scoutx_game_provenance_missing");
    expect(text).toContain("scoutx_monitoring_alerts");
  });

  it("returns db-readiness diagnostics for admin", async () => {
    const response = await fetch(`${baseUrl}/api/admin/db-readiness`, {
      headers: {
        authorization: "Bearer test-token",
      },
    });
    expect(response.status).toBe(200);
    const payload = await parseJsonSafe(response);
    expect(payload).toMatchObject({
      dbFirstMode: false,
      dbUrlConfigured: false,
      readModes: {
        auth: true,
        sessions: false,
        teamState: false,
      },
    });
    expect(payload.ok).toBe(false);
    expect(payload.probes).toEqual({});
  });

  it("returns provenance summary in admin status", async () => {
    const response = await fetch(`${baseUrl}/api/admin/status`, {
      headers: {
        authorization: "Bearer test-token",
      },
    });
    expect(response.status).toBe(200);
    const payload = await parseJsonSafe(response);
    expect(payload.ok).toBe(true);
    expect(payload.provenance).toMatchObject({
      totalGames: expect.any(Number),
      catalogGames: expect.any(Number),
      manualGames: expect.any(Number),
      withProvenance: expect.any(Number),
      missingProvenance: expect.any(Number),
      bySource: expect.any(Object),
      byMethod: expect.any(Object),
    });
  });

  it("logs in a team user with an httpOnly session and returns team state", async () => {
    const loginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: "user-scout", password: TEAM_TEST_PASSWORD }),
    });

    expect(loginResponse.status).toBe(200);
    expect(String(loginResponse.headers.get("set-cookie") || "")).toContain("HttpOnly");
    const cookie = String(loginResponse.headers.get("set-cookie") || "").split(";")[0];
    const loginPayload = await parseJsonSafe(loginResponse);
    expect(loginPayload.ok).toBe(true);
    expect(loginPayload.user).toMatchObject({ id: "user-scout", role: "scout" });
    expect(loginPayload.team).toMatchObject({ id: "team-scoutx" });
    expect(loginPayload.team.accounts.every((account) => account.active === true)).toBe(true);
    expect(
      loginPayload.team.accounts.every((account) => !Object.prototype.hasOwnProperty.call(account, "passwordHash")),
    ).toBe(true);
    expect(typeof loginPayload.csrfToken).toBe("string");
    expect(loginPayload.csrfToken.length).toBeGreaterThan(10);

    const stateResponse = await fetch(`${baseUrl}/api/team/state`, {
      headers: {
        cookie,
      },
    });

    expect(stateResponse.status).toBe(200);
    const statePayload = await parseJsonSafe(stateResponse);
    expect(statePayload.ok).toBe(true);
    expect(statePayload.user.id).toBe("user-scout");
    expect(Array.isArray(statePayload.team.accounts)).toBe(true);
    expect(statePayload.team.accounts.every((account) => account.active === true)).toBe(true);
    expect(statePayload.csrfToken).toBeUndefined();
    expect(
      statePayload.team.accounts.every((account) => !Object.prototype.hasOwnProperty.call(account, "passwordHash")),
    ).toBe(true);
    expect(statePayload.observations).toEqual([]);
    expect(statePayload.feedItems).toEqual([]);
  });

  it("deduplicates concurrent logins with same idempotency key", async () => {
    const idempotencyKey = `login-idem-${Date.now()}`;
    const headers = {
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
    };
    const body = JSON.stringify({ userId: "user-scout", password: TEAM_TEST_PASSWORD });
    const [firstResponse, secondResponse] = await Promise.all([
      fetch(`${baseUrl}/api/team/auth/login`, {
        method: "POST",
        headers,
        body,
      }),
      fetch(`${baseUrl}/api/team/auth/login`, {
        method: "POST",
        headers,
        body,
      }),
    ]);
    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    const firstCookie = String(firstResponse.headers.get("set-cookie") || "").split(";")[0];
    const secondCookie = String(secondResponse.headers.get("set-cookie") || "").split(";")[0];
    expect(firstCookie).toBeTruthy();
    expect(secondCookie).toBe(firstCookie);
    const firstPayload = await parseJsonSafe(firstResponse);
    const secondPayload = await parseJsonSafe(secondResponse);
    expect(firstPayload.csrfToken).toBeTruthy();
    expect(secondPayload.csrfToken).toBe(firstPayload.csrfToken);
    expect(secondPayload.user?.id).toBe("user-scout");
  });

  it("rejects login idempotency-key reuse with different payload", async () => {
    const idempotencyKey = `login-idem-conflict-${Date.now()}`;
    const firstResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify({ userId: "user-scout", password: TEAM_TEST_PASSWORD }),
    });
    expect(firstResponse.status).toBe(200);

    const secondResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify({ userId: "user-scout", password: "wrong-password" }),
    });
    expect(secondResponse.status).toBe(409);
    const secondPayload = await parseJsonSafe(secondResponse);
    expect(secondPayload.ok).toBe(false);
  });

  it("scopes login idempotency by user so same key across users does not conflict", async () => {
    const idempotencyKey = `login-cross-user-${Date.now()}`;
    const [scoutResponse, coordinatorResponse] = await Promise.all([
      fetch(`${baseUrl}/api/team/auth/login`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": idempotencyKey,
        },
        body: JSON.stringify({ userId: "user-scout", password: TEAM_TEST_PASSWORD }),
      }),
      fetch(`${baseUrl}/api/team/auth/login`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": idempotencyKey,
        },
        body: JSON.stringify({ userId: "user-coordinator", password: TEAM_TEST_PASSWORD }),
      }),
    ]);

    expect(scoutResponse.status).toBe(200);
    expect(coordinatorResponse.status).toBe(200);
    const scoutPayload = await parseJsonSafe(scoutResponse);
    const coordinatorPayload = await parseJsonSafe(coordinatorResponse);
    expect(scoutPayload.user?.id).toBe("user-scout");
    expect(coordinatorPayload.user?.id).toBe("user-coordinator");
  });

  it("rejects excessively long idempotency keys", async () => {
    const longKey = "k".repeat(300);
    const response = await fetch(`${baseUrl}/api/team/auth/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": longKey,
      },
      body: JSON.stringify({
        userId: `long-key-user-${Date.now()}`,
        name: "Long Key User",
        password: "Long-key-pass-2026",
        teamKey: "borussia-moenchengladbach",
      }),
    });
    expect(response.status).toBe(400);
    const payload = await parseJsonSafe(response);
    expect(payload.ok).toBe(false);
    expect(String(payload.error || "")).toMatch(/Idempotency-Key/i);
  });

  it("rejects idempotency keys with invalid characters", async () => {
    const invalidKey = "bad key with spaces";
    const response = await fetch(`${baseUrl}/api/team/auth/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": invalidKey,
      },
      body: JSON.stringify({
        userId: `invalid-key-user-${Date.now()}`,
        name: "Invalid Key User",
        password: "Invalid-key-pass-2026",
        teamKey: "borussia-moenchengladbach",
      }),
    });
    expect(response.status).toBe(400);
    const payload = await parseJsonSafe(response);
    expect(payload.ok).toBe(false);
    expect(String(payload.error || "")).toMatch(/Idempotency-Key/i);
  });

  it("rejects conflicting idempotency headers when both variants are present", async () => {
    const response = await fetch(`${baseUrl}/api/team/auth/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "key-a",
        "x-idempotency-key": "key-b",
      },
      body: JSON.stringify({
        userId: `conflict-header-user-${Date.now()}`,
        name: "Conflict Header User",
        password: "Conflict-header-pass-2026",
        teamKey: "borussia-moenchengladbach",
      }),
    });
    expect(response.status).toBe(400);
    const payload = await parseJsonSafe(response);
    expect(payload.ok).toBe(false);
    expect(String(payload.error || "")).toMatch(/idempotency-key/i);
  });

  it("rejects oversized request bodies with 413", async () => {
    const oversized = "a".repeat(1024 * 1024 + 4096);
    const response = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: "user-scout", password: TEAM_TEST_PASSWORD, oversized }),
    });
    expect(response.status).toBe(413);
    const payload = await parseJsonSafe(response);
    expect(payload.ok).toBe(false);
    expect(String(payload.error || "")).toMatch(/Payload zu gro/);
  });

  it("returns 413 for oversized /api/games requests", async () => {
    const oversized = "a".repeat(1024 * 1024 + 4096);
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
        oversized,
      }),
    });
    expect(response.status).toBe(413);
    const payload = await parseJsonSafe(response);
    expect(payload.ok).toBe(false);
    expect(String(payload.error || "")).toMatch(/Payload zu gro/);
  });

  it("preserves 413 status on notifications/read when routed through sendRouteError", async () => {
    const loginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "user-scout", password: TEAM_TEST_PASSWORD }),
    });
    expect(loginResponse.status).toBe(200);
    const cookie = String(loginResponse.headers.get("set-cookie") || "").split(";")[0];
    const loginPayload = await parseJsonSafe(loginResponse);

    const oversized = "x".repeat(1024 * 1024 + 4096);
    const response = await fetch(`${baseUrl}/api/team/notifications/read`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
      },
      body: JSON.stringify({
        eventIds: ["evt-1"],
        oversized,
      }),
    });
    expect(response.status).toBe(413);
    const payload = await parseJsonSafe(response);
    expect(payload.ok).toBe(false);
    expect(String(payload.error || "")).toMatch(/Payload zu gro/);
  });

  it("returns 413 for oversized multipart uploads on kreis-pdf import", async () => {
    const loginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "user-coordinator", password: TEAM_TEST_PASSWORD }),
    });
    expect(loginResponse.status).toBe(200);
    const cookie = String(loginResponse.headers.get("set-cookie") || "").split(";")[0];
    const loginPayload = await parseJsonSafe(loginResponse);

    const boundary = "----ScoutXBoundaryOversize";
    const oversizedText = "x".repeat(1024 * 1024 + 4096);
    const multipartBody = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="mode"',
      "",
      "preview",
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="oversized.txt"',
      "Content-Type: text/plain",
      "",
      oversizedText,
      `--${boundary}--`,
      "",
    ].join("\r\n");

    const response = await fetch(`${baseUrl}/api/team/import/kreis-pdf`, {
      method: "POST",
      headers: {
        "content-type": `multipart/form-data; boundary=${boundary}`,
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
      },
      body: multipartBody,
    });
    expect(response.status).toBe(413);
    const payload = await parseJsonSafe(response);
    expect(payload.ok).toBe(false);
    expect(String(payload.error || "")).toMatch(/Payload zu gro/);
  });

  it("registers a scout account into Borussia Mönchengladbach team", async () => {
    const registerResponse = await fetch(`${baseUrl}/api/team/auth/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        userId: "new-scout",
        name: "Neuer Scout",
        password: "Very-secure-password-2026",
        teamKey: "borussia-moenchengladbach",
      }),
    });

    expect(registerResponse.status).toBe(201);
    const payload = await parseJsonSafe(registerResponse);
    expect(payload.ok).toBe(true);
    expect(payload.user).toMatchObject({ id: "new-scout", role: "scout", teamId: "team-scoutx" });
    expect(payload.team).toMatchObject({ id: "team-scoutx" });
  });

  it("gates new email accounts behind verification and profile completion", async () => {
    const email = `verify-${Date.now()}@example.com`;
    const registerResponse = await fetch(`${baseUrl}/api/team/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        userId: email,
        email,
        name: "Verify Scout",
        password: "Very-secure-password-2026",
        teamKey: "borussia-moenchengladbach",
      }),
    });

    expect(registerResponse.status).toBe(201);
    const cookie = String(registerResponse.headers.get("set-cookie") || "").split(";")[0];
    const registerPayload = await parseJsonSafe(registerResponse);
    expect(registerPayload.status).toBe("email_verification_required");
    expect(registerPayload.user).toMatchObject({ email, emailVerified: false, role: "scout" });
    expect(typeof registerPayload.verificationToken).toBe("string");
    expect(registerPayload.emailDelivery).toMatchObject({ ok: true, channel: "outbox" });
    const outboxLines = String(await readFile(emailOutboxFile, "utf8"))
      .split(/\r?\n/g)
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const verificationMail = outboxLines.find((item) => item.to === email);
    expect(verificationMail).toMatchObject({ to: email, subject: "ScoutX E-Mail bestätigen" });
    expect(verificationMail.text).toContain(registerPayload.verificationToken);
    expect(verificationMail.text).toContain("gültig");

    const verifyResponse = await fetch(`${baseUrl}/api/team/auth/verification/confirm`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": registerPayload.csrfToken,
      },
      body: JSON.stringify({ token: registerPayload.verificationToken }),
    });
    expect(verifyResponse.status).toBe(200);
    const verifyPayload = await parseJsonSafe(verifyResponse);
    expect(verifyPayload.status).toBe("profile_required");
    expect(verifyPayload.user.emailVerified).toBe(true);

    const profileResponse = await fetch(`${baseUrl}/api/team/auth/profile`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": registerPayload.csrfToken,
      },
      body: JSON.stringify({
        name: "Verify Scout Final",
        birthDate: "2000-01-01",
        profileImage: "data:image/png;base64,AAAA",
        role: "admin",
      }),
    });
    expect(profileResponse.status).toBe(200);
    const profilePayload = await parseJsonSafe(profileResponse);
    expect(profilePayload.status).toBe("connected");
    expect(profilePayload.user).toMatchObject({
      name: "Verify Scout Final",
      birthDate: "2000-01-01",
      profileComplete: true,
      role: "scout",
    });
  });

  it("rejects duplicate normalized registration email addresses", async () => {
    const email = `duplicate-${Date.now()}@example.com`;
    const body = {
      userId: email,
      email,
      name: "Duplicate Scout",
      password: "Very-secure-password-2026",
      teamKey: "borussia-moenchengladbach",
    };
    const firstResponse = await fetch(`${baseUrl}/api/team/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    expect(firstResponse.status).toBe(201);

    const secondResponse = await fetch(`${baseUrl}/api/team/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, userId: `other-${Date.now()}@example.com`, email: email.toUpperCase() }),
    });
    expect(secondResponse.status).toBe(409);
    const payload = await parseJsonSafe(secondResponse);
    expect(String(payload.error || "")).toMatch(/E-Mail-Adresse/);
  });

  it("rejects registration to unknown team", async () => {
    const registerResponse = await fetch(`${baseUrl}/api/team/auth/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        userId: "new-scout-2",
        name: "Neuer Scout Zwei",
        password: "Very-secure-password-2026",
        teamKey: "other-team",
      }),
    });

    expect(registerResponse.status).toBe(400);
    const payload = await parseJsonSafe(registerResponse);
    expect(payload.ok).toBe(false);
  });

  it("rejects weak passwords on registration", async () => {
    const registerResponse = await fetch(`${baseUrl}/api/team/auth/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        userId: "new-scout-weak",
        name: "Neuer Scout Schwach",
        password: "weakpass",
        teamKey: "borussia-moenchengladbach",
      }),
    });

    expect(registerResponse.status).toBe(400);
    const payload = await parseJsonSafe(registerResponse);
    expect(payload.ok).toBe(false);
    expect(String(payload.error || "")).toMatch(/Passwort/);
  });

  it("creates and accepts team invitations", async () => {
    const coordinatorLoginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: "user-coordinator", password: TEAM_TEST_PASSWORD }),
    });
    expect(coordinatorLoginResponse.status).toBe(200);
    const coordinatorCookie = String(coordinatorLoginResponse.headers.get("set-cookie") || "").split(";")[0];
    const coordinatorPayload = await parseJsonSafe(coordinatorLoginResponse);

    const createInviteResponse = await fetch(`${baseUrl}/api/team/invitations/create`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: coordinatorCookie,
        "x-csrf-token": coordinatorPayload.csrfToken,
      },
      body: JSON.stringify({
        userId: "invite-scout",
        name: "Invite Scout",
        role: "scout",
      }),
    });
    expect(createInviteResponse.status).toBe(201);
    const invitePayload = await parseJsonSafe(createInviteResponse);
    expect(invitePayload.ok).toBe(true);
    expect(typeof invitePayload.invitation?.token).toBe("string");
    expect(invitePayload.invitation?.token?.length).toBeGreaterThan(10);

    const acceptInviteResponse = await fetch(`${baseUrl}/api/team/invitations/accept`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        token: invitePayload.invitation.token,
        password: "Invite-password-2026",
      }),
    });
    expect(acceptInviteResponse.status).toBe(201);
    const acceptedPayload = await parseJsonSafe(acceptInviteResponse);
    expect(acceptedPayload.ok).toBe(true);
    expect(acceptedPayload.user).toMatchObject({ id: "invite-scout", role: "scout", active: true });
  });

  it("deduplicates concurrent invitation create requests with same idempotency key", async () => {
    const coordinatorLoginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "user-coordinator", password: TEAM_TEST_PASSWORD }),
    });
    expect(coordinatorLoginResponse.status).toBe(200);
    const coordinatorCookie = String(coordinatorLoginResponse.headers.get("set-cookie") || "").split(";")[0];
    const coordinatorPayload = await parseJsonSafe(coordinatorLoginResponse);

    const idempotencyKey = `invite-create-idem-${Date.now()}`;
    const headers = {
      "content-type": "application/json",
      cookie: coordinatorCookie,
      "x-csrf-token": coordinatorPayload.csrfToken,
      "idempotency-key": idempotencyKey,
    };
    const body = JSON.stringify({
      userId: `invite-create-idem-user-${Date.now()}`,
      name: "Invite Create Idem",
      role: "scout",
    });

    const [firstResponse, secondResponse] = await Promise.all([
      fetch(`${baseUrl}/api/team/invitations/create`, { method: "POST", headers, body }),
      fetch(`${baseUrl}/api/team/invitations/create`, { method: "POST", headers, body }),
    ]);
    expect(firstResponse.status).toBe(201);
    expect(secondResponse.status).toBe(201);
    const firstPayload = await parseJsonSafe(firstResponse);
    const secondPayload = await parseJsonSafe(secondResponse);
    expect(firstPayload.invitation?.token).toBeTruthy();
    expect(secondPayload.invitation?.token).toBe(firstPayload.invitation?.token);
  });

  it("rejects invitation create idempotency-key reuse with different payload", async () => {
    const coordinatorLoginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "user-coordinator", password: TEAM_TEST_PASSWORD }),
    });
    expect(coordinatorLoginResponse.status).toBe(200);
    const coordinatorCookie = String(coordinatorLoginResponse.headers.get("set-cookie") || "").split(";")[0];
    const coordinatorPayload = await parseJsonSafe(coordinatorLoginResponse);

    const userId = `invite-create-conflict-user-${Date.now()}`;
    const idempotencyKey = `invite-create-conflict-${Date.now()}`;
    const firstResponse = await fetch(`${baseUrl}/api/team/invitations/create`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: coordinatorCookie,
        "x-csrf-token": coordinatorPayload.csrfToken,
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify({
        userId,
        name: "Invite Create Conflict",
        role: "scout",
      }),
    });
    expect(firstResponse.status).toBe(201);

    const secondResponse = await fetch(`${baseUrl}/api/team/invitations/create`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: coordinatorCookie,
        "x-csrf-token": coordinatorPayload.csrfToken,
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify({
        userId,
        name: "Invite Create Conflict Changed",
        role: "scout",
      }),
    });
    expect(secondResponse.status).toBe(409);
    const secondPayload = await parseJsonSafe(secondResponse);
    expect(secondPayload.ok).toBe(false);
  });

  it("consumes invitation token on first concurrent accept", async () => {
    const coordinatorLoginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "user-coordinator", password: TEAM_TEST_PASSWORD }),
    });
    expect(coordinatorLoginResponse.status).toBe(200);
    const coordinatorCookie = String(coordinatorLoginResponse.headers.get("set-cookie") || "").split(";")[0];
    const coordinatorPayload = await parseJsonSafe(coordinatorLoginResponse);

    const userId = `invite-parallel-${Date.now()}`;
    const createInviteResponse = await fetch(`${baseUrl}/api/team/invitations/create`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: coordinatorCookie,
        "x-csrf-token": coordinatorPayload.csrfToken,
      },
      body: JSON.stringify({
        userId,
        name: "Invite Parallel",
        role: "scout",
      }),
    });
    expect(createInviteResponse.status).toBe(201);
    const invitePayload = await parseJsonSafe(createInviteResponse);
    const token = String(invitePayload?.invitation?.token || "");
    expect(token.length).toBeGreaterThan(10);

    const [firstAccept, secondAccept] = await Promise.all([
      fetch(`${baseUrl}/api/team/invitations/accept`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password: "Invite-parallel-pass-2026" }),
      }),
      fetch(`${baseUrl}/api/team/invitations/accept`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password: "Invite-parallel-pass-2026" }),
      }),
    ]);

    const statuses = [firstAccept.status, secondAccept.status].sort((a, b) => a - b);
    expect(statuses[0]).toBe(201);
    expect([404, 409]).toContain(statuses[1]);
  });

  it("deduplicates concurrent invitation accept requests with same idempotency key", async () => {
    const coordinatorLoginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "user-coordinator", password: TEAM_TEST_PASSWORD }),
    });
    expect(coordinatorLoginResponse.status).toBe(200);
    const coordinatorCookie = String(coordinatorLoginResponse.headers.get("set-cookie") || "").split(";")[0];
    const coordinatorPayload = await parseJsonSafe(coordinatorLoginResponse);

    const userId = `invite-idem-${Date.now()}`;
    const createInviteResponse = await fetch(`${baseUrl}/api/team/invitations/create`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: coordinatorCookie,
        "x-csrf-token": coordinatorPayload.csrfToken,
      },
      body: JSON.stringify({
        userId,
        name: "Invite Idem",
        role: "scout",
      }),
    });
    expect(createInviteResponse.status).toBe(201);
    const invitePayload = await parseJsonSafe(createInviteResponse);
    const token = String(invitePayload?.invitation?.token || "");
    expect(token.length).toBeGreaterThan(10);

    const idempotencyKey = `invite-accept-idem-${Date.now()}`;
    const headers = {
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
    };
    const body = JSON.stringify({ token, password: "Invite-idem-pass-2026" });
    const [firstAccept, secondAccept] = await Promise.all([
      fetch(`${baseUrl}/api/team/invitations/accept`, {
        method: "POST",
        headers,
        body,
      }),
      fetch(`${baseUrl}/api/team/invitations/accept`, {
        method: "POST",
        headers,
        body,
      }),
    ]);
    expect(firstAccept.status).toBe(201);
    expect(secondAccept.status).toBe(201);
    const firstPayload = await parseJsonSafe(firstAccept);
    const secondPayload = await parseJsonSafe(secondAccept);
    expect(firstPayload.user?.id).toBe(userId);
    expect(secondPayload.user?.id).toBe(userId);
  });

  it("rejects invitation accept idempotency-key reuse with different payload for the same token", async () => {
    const coordinatorLoginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "user-coordinator", password: TEAM_TEST_PASSWORD }),
    });
    expect(coordinatorLoginResponse.status).toBe(200);
    const coordinatorCookie = String(coordinatorLoginResponse.headers.get("set-cookie") || "").split(";")[0];
    const coordinatorPayload = await parseJsonSafe(coordinatorLoginResponse);

    const createInviteResponse = await fetch(`${baseUrl}/api/team/invitations/create`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: coordinatorCookie,
        "x-csrf-token": coordinatorPayload.csrfToken,
      },
      body: JSON.stringify({
        userId: `invite-idem-conflict-${Date.now()}`,
        name: "Invite Idem Conflict",
        role: "scout",
      }),
    });
    expect(createInviteResponse.status).toBe(201);
    const createdInvitePayload = await parseJsonSafe(createInviteResponse);
    const token = String(createdInvitePayload?.invitation?.token || "");
    expect(token.length).toBeGreaterThan(10);

    const idempotencyKey = `invite-accept-conflict-${Date.now()}`;
    const firstResponse = await fetch(`${baseUrl}/api/team/invitations/accept`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify({ token, password: "Invite-conflict-pass-2026" }),
    });
    expect(firstResponse.status).toBe(201);

    const secondResponse = await fetch(`${baseUrl}/api/team/invitations/accept`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify({ token, password: "Invite-conflict-pass-OTHER-2026" }),
    });
    expect(secondResponse.status).toBe(409);
    const secondPayload = await parseJsonSafe(secondResponse);
    expect(secondPayload.ok).toBe(false);
  });

  it("runs password reset request and confirm flow", async () => {
    const requestResponse = await fetch(`${baseUrl}/api/team/auth/password-reset/request`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: "new-scout" }),
    });
    expect(requestResponse.status).toBe(200);
    const requestPayload = await parseJsonSafe(requestResponse);
    expect(requestPayload.ok).toBe(true);
    expect(typeof requestPayload.reset?.token).toBe("string");

    const confirmResponse = await fetch(`${baseUrl}/api/team/auth/password-reset/confirm`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        token: requestPayload.reset.token,
        password: "New-team-password-2026",
      }),
    });
    expect(confirmResponse.status).toBe(200);
    const confirmPayload = await parseJsonSafe(confirmResponse);
    expect(confirmPayload.ok).toBe(true);
    expect(confirmPayload.user).toMatchObject({ id: "new-scout", active: true });

    const oldLoginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: "new-scout", password: "Very-secure-password-2026" }),
    });
    expect(oldLoginResponse.status).toBe(401);

    const newLoginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: "new-scout", password: "New-team-password-2026" }),
    });
    expect(newLoginResponse.status).toBe(200);
  });

  it("deduplicates concurrent password reset requests with same idempotency key", async () => {
    const idempotencyKey = `reset-request-idem-${Date.now()}`;
    const headers = {
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
    };
    const body = JSON.stringify({ userId: "new-scout" });

    const [firstRequest, secondRequest] = await Promise.all([
      fetch(`${baseUrl}/api/team/auth/password-reset/request`, {
        method: "POST",
        headers,
        body,
      }),
      fetch(`${baseUrl}/api/team/auth/password-reset/request`, {
        method: "POST",
        headers,
        body,
      }),
    ]);
    expect(firstRequest.status).toBe(200);
    expect(secondRequest.status).toBe(200);
    const firstPayload = await parseJsonSafe(firstRequest);
    const secondPayload = await parseJsonSafe(secondRequest);
    expect(String(firstPayload?.reset?.token || "")).toBeTruthy();
    expect(secondPayload?.reset?.token).toBe(firstPayload?.reset?.token);
  });

  it("invalidates password reset tokens after first successful use", async () => {
    const requestResponse = await fetch(`${baseUrl}/api/team/auth/password-reset/request`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: "new-scout" }),
    });
    expect(requestResponse.status).toBe(200);
    const requestPayload = await parseJsonSafe(requestResponse);
    const token = String(requestPayload?.reset?.token || "");
    expect(token.length).toBeGreaterThan(10);

    const firstConfirmResponse = await fetch(`${baseUrl}/api/team/auth/password-reset/confirm`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        token,
        password: "First-reset-password-2026",
      }),
    });
    expect(firstConfirmResponse.status).toBe(200);

    const replayConfirmResponse = await fetch(`${baseUrl}/api/team/auth/password-reset/confirm`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        token,
        password: "Second-reset-password-2026",
      }),
    });
    expect(replayConfirmResponse.status).toBe(404);
    const replayPayload = await parseJsonSafe(replayConfirmResponse);
    expect(replayPayload.ok).toBe(false);
  });

  it("consumes password reset token on first concurrent confirm", async () => {
    const requestResponse = await fetch(`${baseUrl}/api/team/auth/password-reset/request`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "new-scout" }),
    });
    expect(requestResponse.status).toBe(200);
    const requestPayload = await parseJsonSafe(requestResponse);
    const token = String(requestPayload?.reset?.token || "");
    expect(token.length).toBeGreaterThan(10);

    const [firstConfirm, secondConfirm] = await Promise.all([
      fetch(`${baseUrl}/api/team/auth/password-reset/confirm`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password: "Parallel-reset-password-2026" }),
      }),
      fetch(`${baseUrl}/api/team/auth/password-reset/confirm`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password: "Parallel-reset-password-2026" }),
      }),
    ]);

    const statuses = [firstConfirm.status, secondConfirm.status].sort((a, b) => a - b);
    expect(statuses).toEqual([200, 404]);
  });

  it("deduplicates concurrent password reset confirms with same idempotency key", async () => {
    const requestResponse = await fetch(`${baseUrl}/api/team/auth/password-reset/request`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "new-scout" }),
    });
    expect(requestResponse.status).toBe(200);
    const requestPayload = await parseJsonSafe(requestResponse);
    const token = String(requestPayload?.reset?.token || "");
    expect(token.length).toBeGreaterThan(10);

    const idempotencyKey = `reset-confirm-idem-${Date.now()}`;
    const headers = {
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
    };
    const body = JSON.stringify({ token, password: "Parallel-reset-idem-password-2026" });
    const [firstConfirm, secondConfirm] = await Promise.all([
      fetch(`${baseUrl}/api/team/auth/password-reset/confirm`, {
        method: "POST",
        headers,
        body,
      }),
      fetch(`${baseUrl}/api/team/auth/password-reset/confirm`, {
        method: "POST",
        headers,
        body,
      }),
    ]);

    expect(firstConfirm.status).toBe(200);
    expect(secondConfirm.status).toBe(200);
    const firstPayload = await parseJsonSafe(firstConfirm);
    const secondPayload = await parseJsonSafe(secondConfirm);
    expect(firstPayload.user?.id).toBe("new-scout");
    expect(secondPayload.user?.id).toBe("new-scout");
  });

  it("rejects password reset confirm idempotency-key reuse with different payload for the same token", async () => {
    const resetRequest = await fetch(`${baseUrl}/api/team/auth/password-reset/request`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "new-scout" }),
    });
    expect(resetRequest.status).toBe(200);
    const resetPayload = await parseJsonSafe(resetRequest);
    const token = String(resetPayload?.reset?.token || "");
    expect(token.length).toBeGreaterThan(10);

    const idempotencyKey = `reset-confirm-conflict-${Date.now()}`;
    const firstConfirmResponse = await fetch(`${baseUrl}/api/team/auth/password-reset/confirm`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify({ token, password: "Reset-conflict-pass-2026" }),
    });
    expect(firstConfirmResponse.status).toBe(200);

    const secondConfirmResponse = await fetch(`${baseUrl}/api/team/auth/password-reset/confirm`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify({ token, password: "Reset-conflict-pass-OTHER-2026" }),
    });
    expect(secondConfirmResponse.status).toBe(409);
    const secondConfirmPayload = await parseJsonSafe(secondConfirmResponse);
    expect(secondConfirmPayload.ok).toBe(false);
  });

  it("stores web-push subscriptions for logged-in team users", async () => {
    const loginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: "user-scout", password: TEAM_TEST_PASSWORD }),
    });
    expect(loginResponse.status).toBe(200);
    const cookie = String(loginResponse.headers.get("set-cookie") || "").split(";")[0];
    const loginPayload = await parseJsonSafe(loginResponse);

    const response = await fetch(`${baseUrl}/api/team/notifications/push/subscribe`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
      },
      body: JSON.stringify({
        subscription: {
          endpoint: "https://push.example.test/sub-1",
          keys: {
            p256dh: "test-p256dh",
            auth: "test-auth",
          },
        },
      }),
    });
    expect(response.status).toBe(200);
    const payload = await parseJsonSafe(response);
    expect(payload.ok).toBe(true);
    expect(payload.subscription).toMatchObject({
      endpoint: "https://push.example.test/sub-1",
      userId: "user-scout",
      teamId: "team-scoutx",
    });
  });

  it("deduplicates concurrent push subscribe requests with same idempotency key", async () => {
    const loginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: "user-scout", password: TEAM_TEST_PASSWORD }),
    });
    expect(loginResponse.status).toBe(200);
    const cookie = String(loginResponse.headers.get("set-cookie") || "").split(";")[0];
    const loginPayload = await parseJsonSafe(loginResponse);
    const idempotencyKey = `push-subscribe-idem-${Date.now()}`;
    const headers = {
      "content-type": "application/json",
      cookie,
      "x-csrf-token": loginPayload.csrfToken,
      "idempotency-key": idempotencyKey,
    };
    const body = JSON.stringify({
      subscription: {
        endpoint: `https://push.example.test/sub-idem-${Date.now()}`,
        keys: {
          p256dh: "idem-p256dh",
          auth: "idem-auth",
        },
      },
    });

    const [firstResponse, secondResponse] = await Promise.all([
      fetch(`${baseUrl}/api/team/notifications/push/subscribe`, {
        method: "POST",
        headers,
        body,
      }),
      fetch(`${baseUrl}/api/team/notifications/push/subscribe`, {
        method: "POST",
        headers,
        body,
      }),
    ]);
    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    const firstPayload = await parseJsonSafe(firstResponse);
    const secondPayload = await parseJsonSafe(secondResponse);
    expect(secondPayload.subscription?.endpoint).toBe(firstPayload.subscription?.endpoint);
    expect(secondPayload.subscription?.userId).toBe("user-scout");
  });

  it("rejects push subscribe idempotency-key reuse with different payload", async () => {
    const loginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "user-scout", password: TEAM_TEST_PASSWORD }),
    });
    expect(loginResponse.status).toBe(200);
    const cookie = String(loginResponse.headers.get("set-cookie") || "").split(";")[0];
    const loginPayload = await parseJsonSafe(loginResponse);
    const idempotencyKey = `push-subscribe-conflict-${Date.now()}`;

    const firstResponse = await fetch(`${baseUrl}/api/team/notifications/push/subscribe`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify({
        subscription: {
          endpoint: `https://push.example.test/sub-conflict-a-${Date.now()}`,
          keys: { p256dh: "conflict-a", auth: "conflict-a" },
        },
      }),
    });
    expect(firstResponse.status).toBe(200);

    const secondResponse = await fetch(`${baseUrl}/api/team/notifications/push/subscribe`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify({
        subscription: {
          endpoint: `https://push.example.test/sub-conflict-b-${Date.now()}`,
          keys: { p256dh: "conflict-b", auth: "conflict-b" },
        },
      }),
    });
    expect(secondResponse.status).toBe(409);
    const secondPayload = await parseJsonSafe(secondResponse);
    expect(secondPayload.ok).toBe(false);
  });

  it("queues critical push events with same event ids as feed/inbox and deduplicates after ack", async () => {
    const loginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: "user-scout", password: TEAM_TEST_PASSWORD }),
    });
    expect(loginResponse.status).toBe(200);
    const cookie = String(loginResponse.headers.get("set-cookie") || "").split(";")[0];
    const loginPayload = await parseJsonSafe(loginResponse);

    const subscribeResponse = await fetch(`${baseUrl}/api/team/notifications/push/subscribe`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
      },
      body: JSON.stringify({
        subscription: {
          endpoint: "https://push.example.test/sub-critical",
          keys: { p256dh: "k1", auth: "a1" },
        },
      }),
    });
    expect(subscribeResponse.status).toBe(200);

    const createManualResponse = await fetch(`${baseUrl}/api/team/manual-games`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
      },
      body: JSON.stringify({
        home: "Kritisch A",
        away: "Kritisch B",
        date: "2026-09-02",
        time: "18:00",
        venue: "Platz C",
      }),
    });
    expect(createManualResponse.status).toBe(200);
    const createManualPayload = await parseJsonSafe(createManualResponse);
    const manualGame = createManualPayload.manualGame;

    const cancelResponse = await fetch(`${baseUrl}/api/team/manual-games`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
      },
      body: JSON.stringify({
        ...manualGame,
        status: "cancelled",
      }),
    });
    expect(cancelResponse.status).toBe(200);
    const cancelPayload = await parseJsonSafe(cancelResponse);
    const feedEvent = cancelPayload.feedItems[0];
    expect(feedEvent.type).toBe("manual_game_cancelled");

    const pendingResponse = await fetch(`${baseUrl}/api/team/notifications/push/pending`, {
      headers: { cookie },
    });
    expect(pendingResponse.status).toBe(200);
    const pendingPayload = await parseJsonSafe(pendingResponse);
    expect(pendingPayload.ok).toBe(true);
    expect(Array.isArray(pendingPayload.events)).toBe(true);
    expect(pendingPayload.statusSummary).toMatchObject({
      new: 1,
    });
    const critical = pendingPayload.events.find((item) => item.eventId === feedEvent.id);
    expect(critical).toBeTruthy();
    expect(critical.type).toBe("absage");
    expect(critical.status).toBe("new");
    expect(Number(critical.deliveredCount || 0)).toBeGreaterThanOrEqual(0);

    const ackResponse = await fetch(`${baseUrl}/api/team/notifications/push/ack`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
      },
      body: JSON.stringify({
        eventIds: [feedEvent.id],
      }),
    });
    expect(ackResponse.status).toBe(200);

    const pendingAfterAckResponse = await fetch(`${baseUrl}/api/team/notifications/push/pending`, {
      headers: { cookie },
    });
    expect(pendingAfterAckResponse.status).toBe(200);
    const pendingAfterAckPayload = await parseJsonSafe(pendingAfterAckResponse);
    expect(pendingAfterAckPayload.events.some((item) => item.eventId === feedEvent.id)).toBe(false);
  });

  it("does not remove pending outbox events when ack ids are unknown to the team", async () => {
    const scoutLoginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "user-scout", password: TEAM_TEST_PASSWORD }),
    });
    expect(scoutLoginResponse.status).toBe(200);
    const scoutCookie = String(scoutLoginResponse.headers.get("set-cookie") || "").split(";")[0];
    const scoutPayload = await parseJsonSafe(scoutLoginResponse);

    const createManualResponse = await fetch(`${baseUrl}/api/team/manual-games`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: scoutCookie,
        "x-csrf-token": scoutPayload.csrfToken,
      },
      body: JSON.stringify({
        home: "Cross Team A",
        away: "Cross Team B",
        date: "2026-09-06",
        time: "17:00",
        venue: "Cross Platz",
      }),
    });
    expect(createManualResponse.status).toBe(200);
    const createManualPayload = await parseJsonSafe(createManualResponse);
    const manualGame = createManualPayload.manualGame;

    const cancelResponse = await fetch(`${baseUrl}/api/team/manual-games`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: scoutCookie,
        "x-csrf-token": scoutPayload.csrfToken,
      },
      body: JSON.stringify({
        ...manualGame,
        status: "cancelled",
      }),
    });
    expect(cancelResponse.status).toBe(200);
    const cancelPayload = await parseJsonSafe(cancelResponse);
    const criticalEventId = String(cancelPayload.feedItems?.[0]?.id || "");
    expect(criticalEventId.length).toBeGreaterThan(0);

    const unknownAckResponse = await fetch(`${baseUrl}/api/team/notifications/push/ack`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: scoutCookie,
        "x-csrf-token": scoutPayload.csrfToken,
      },
      body: JSON.stringify({
        eventIds: ["foreign-team-event-id"],
      }),
    });
    expect(unknownAckResponse.status).toBe(200);
    const unknownAckPayload = await parseJsonSafe(unknownAckResponse);
    expect(unknownAckPayload.removedCount).toBe(0);

    const scoutPendingResponse = await fetch(`${baseUrl}/api/team/notifications/push/pending`, {
      headers: { cookie: scoutCookie },
    });
    expect(scoutPendingResponse.status).toBe(200);
    const scoutPendingPayload = await parseJsonSafe(scoutPendingResponse);
    expect(scoutPendingPayload.events.some((item) => String(item?.eventId || "") === criticalEventId)).toBe(true);
  });

  it("deduplicates concurrent push ack requests with the same idempotency key", async () => {
    const loginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: "user-scout", password: TEAM_TEST_PASSWORD }),
    });
    expect(loginResponse.status).toBe(200);
    const cookie = String(loginResponse.headers.get("set-cookie") || "").split(";")[0];
    const loginPayload = await parseJsonSafe(loginResponse);

    const createManualResponse = await fetch(`${baseUrl}/api/team/manual-games`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
      },
      body: JSON.stringify({
        home: "Idem Ack A",
        away: "Idem Ack B",
        date: "2026-09-12",
        time: "18:30",
        venue: "Ack Platz",
      }),
    });
    expect(createManualResponse.status).toBe(200);
    const createManualPayload = await parseJsonSafe(createManualResponse);
    const manualGame = createManualPayload.manualGame;

    const cancelResponse = await fetch(`${baseUrl}/api/team/manual-games`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
      },
      body: JSON.stringify({
        ...manualGame,
        status: "cancelled",
      }),
    });
    expect(cancelResponse.status).toBe(200);
    const cancelPayload = await parseJsonSafe(cancelResponse);
    const criticalEventId = String(cancelPayload.feedItems?.[0]?.id || "");
    expect(criticalEventId.length).toBeGreaterThan(0);

    const idempotencyKey = `push-ack-idem-${Date.now()}`;
    const ackBody = JSON.stringify({ eventIds: [criticalEventId] });
    const ackHeaders = {
      "content-type": "application/json",
      cookie,
      "x-csrf-token": loginPayload.csrfToken,
      "idempotency-key": idempotencyKey,
    };

    const [firstAckResponse, secondAckResponse] = await Promise.all([
      fetch(`${baseUrl}/api/team/notifications/push/ack`, {
        method: "POST",
        headers: ackHeaders,
        body: ackBody,
      }),
      fetch(`${baseUrl}/api/team/notifications/push/ack`, {
        method: "POST",
        headers: ackHeaders,
        body: ackBody,
      }),
    ]);
    expect(firstAckResponse.status).toBe(200);
    expect(secondAckResponse.status).toBe(200);
    const firstAckPayload = await parseJsonSafe(firstAckResponse);
    const secondAckPayload = await parseJsonSafe(secondAckResponse);
    expect(firstAckPayload.removedCount).toBe(1);
    expect(secondAckPayload.removedCount).toBe(1);

    const pendingResponse = await fetch(`${baseUrl}/api/team/notifications/push/pending`, {
      headers: { cookie },
    });
    expect(pendingResponse.status).toBe(200);
    const pendingPayload = await parseJsonSafe(pendingResponse);
    expect(pendingPayload.events.some((item) => String(item?.eventId || "") === criticalEventId)).toBe(false);
  });

  it("streams critical push events via SSE for logged-in team users", async () => {
    const loginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: "user-scout", password: TEAM_TEST_PASSWORD }),
    });
    expect(loginResponse.status).toBe(200);
    const cookie = String(loginResponse.headers.get("set-cookie") || "").split(";")[0];
    const loginPayload = await parseJsonSafe(loginResponse);

    const streamResponse = await fetch(`${baseUrl}/api/team/notifications/push/stream`, {
      headers: {
        accept: "text/event-stream",
        cookie,
      },
    });
    expect(streamResponse.status).toBe(200);

    const createManualResponse = await fetch(`${baseUrl}/api/team/manual-games`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
      },
      body: JSON.stringify({
        home: "SSE Team A",
        away: "SSE Team B",
        date: "2026-09-04",
        time: "18:00",
        venue: "Platz SSE",
      }),
    });
    expect(createManualResponse.status).toBe(200);
    const createManualPayload = await parseJsonSafe(createManualResponse);

    const cancelResponse = await fetch(`${baseUrl}/api/team/manual-games`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
      },
      body: JSON.stringify({
        ...createManualPayload.manualGame,
        status: "cancelled",
      }),
    });
    expect(cancelResponse.status).toBe(200);

    const payload = await readSseUntil(
      streamResponse,
      (item) =>
        item?.type === "team_push_events" &&
        Array.isArray(item.events) &&
        item.events.some((entry) => entry?.type === "absage"),
      10000,
    );
    const cancelled = payload.events.find((item) => item?.type === "absage");
    expect(cancelled).toBeTruthy();
    expect(cancelled.teamId).toBe("team-scoutx");

    const pendingResponse = await fetch(`${baseUrl}/api/team/notifications/push/pending`, {
      headers: { cookie },
    });
    expect(pendingResponse.status).toBe(200);
    const pendingPayload = await parseJsonSafe(pendingResponse);
    expect(pendingPayload.statusSummary?.delivered).toBeGreaterThanOrEqual(1);
    const deliveredEvent = (pendingPayload.events || []).find((item) => item.eventId === cancelled.eventId);
    expect(deliveredEvent).toBeTruthy();
    expect(deliveredEvent.status).toBe("delivered");
    expect(Number(deliveredEvent.deliveredCount || 0)).toBeGreaterThanOrEqual(1);
  });

  it("supports inbox unread/read and type filtering", async () => {
    const loginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: "user-scout", password: TEAM_TEST_PASSWORD }),
    });
    expect(loginResponse.status).toBe(200);
    const cookie = String(loginResponse.headers.get("set-cookie") || "").split(";")[0];
    const loginPayload = await parseJsonSafe(loginResponse);

    const planResponse = await fetch(`${baseUrl}/api/team/plans`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
      },
      body: JSON.stringify({
        planHistoryId: "plan-notifications",
        games: [{ id: "game-notify-1", home: "Team A", away: "Team B", date: "2026-08-11" }],
      }),
    });
    expect(planResponse.status).toBe(200);

    const inboxResponse = await fetch(`${baseUrl}/api/team/notifications?status=unread&type=plan`, {
      headers: { cookie },
    });
    expect(inboxResponse.status).toBe(200);
    const inboxPayload = await parseJsonSafe(inboxResponse);
    expect(inboxPayload.ok).toBe(true);
    expect(Array.isArray(inboxPayload.notifications)).toBe(true);
    expect(inboxPayload.notifications.length).toBeGreaterThan(0);
    expect(inboxPayload.notifications[0].eventId).toBe(inboxPayload.notifications[0].id);
    expect(inboxPayload.notifications[0].type).toBe("plan");

    const readResponse = await fetch(`${baseUrl}/api/team/notifications/read`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
      },
      body: JSON.stringify({
        eventIds: [inboxPayload.notifications[0].eventId],
      }),
    });
    expect(readResponse.status).toBe(200);
    const readPayload = await parseJsonSafe(readResponse);
    expect(readPayload.ok).toBe(true);
    expect(readPayload.updatedCount).toBeGreaterThan(0);

    const unreadAgainResponse = await fetch(`${baseUrl}/api/team/notifications?status=unread&type=plan`, {
      headers: { cookie },
    });
    expect(unreadAgainResponse.status).toBe(200);
    const unreadAgainPayload = await parseJsonSafe(unreadAgainResponse);
    expect(
      unreadAgainPayload.notifications.some((item) => item.eventId === inboxPayload.notifications[0].eventId),
    ).toBe(false);
  });

  it("detects planning conflicts for overlaps and low travel feasibility", async () => {
    const loginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: "user-scout", password: TEAM_TEST_PASSWORD }),
    });
    expect(loginResponse.status).toBe(200);
    const cookie = String(loginResponse.headers.get("set-cookie") || "").split(";")[0];
    const loginPayload = await parseJsonSafe(loginResponse);

    const planResponse = await fetch(`${baseUrl}/api/team/plans`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
      },
      body: JSON.stringify({
        planHistoryId: "plan-conflicts",
        games: [
          { id: "conflict-1", home: "Team X", away: "Team Y", date: "2026-09-01", time: "10:00", venue: "Platz A" },
          { id: "conflict-2", home: "Team X2", away: "Team Y2", date: "2026-09-01", time: "10:30", venue: "Platz B" },
        ],
      }),
    });
    expect(planResponse.status).toBe(200);

    const conflictsResponse = await fetch(`${baseUrl}/api/team/conflicts`, {
      headers: { cookie },
    });
    expect(conflictsResponse.status).toBe(200);
    const payload = await parseJsonSafe(conflictsResponse);
    expect(payload.ok).toBe(true);
    expect(Array.isArray(payload.conflicts)).toBe(true);
    expect(payload.conflicts.length).toBeGreaterThan(0);
    expect(payload.conflicts.some((item) => item.type === "time_overlap")).toBe(true);
  });

  it("rejects team login without the configured password", async () => {
    const response = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: "user-scout", password: "wrong-password" }),
    });

    expect(response.status).toBe(401);
    const payload = await parseJsonSafe(response);
    expect(payload.ok).toBe(false);
  });

  it("rejects accounts from another team", async () => {
    const response = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: "user-outsider", password: TEAM_TEST_PASSWORD }),
    });

    expect(response.status).toBe(401);
    const payload = await parseJsonSafe(response);
    expect(payload.ok).toBe(false);
  });

  it("requires a team session for team state", async () => {
    const response = await fetch(`${baseUrl}/api/team/state`);
    expect(response.status).toBe(401);
    const payload = await parseJsonSafe(response);
    expect(payload.ok).toBe(false);
  });

  it("requires a team session for team audit-log", async () => {
    const response = await fetch(`${baseUrl}/api/team/audit-log`);
    expect(response.status).toBe(401);
    const payload = await parseJsonSafe(response);
    expect(payload.ok).toBe(false);
  });

  it("expires team sessions server-side after ttl", async () => {
    const loginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: "user-scout", password: TEAM_TEST_PASSWORD }),
    });
    expect(loginResponse.status).toBe(200);
    const cookie = String(loginResponse.headers.get("set-cookie") || "").split(";")[0];

    await new Promise((resolve) => setTimeout(resolve, 2200));

    const stateResponse = await fetch(`${baseUrl}/api/team/state`, {
      headers: { cookie },
    });
    expect(stateResponse.status).toBe(401);
    const payload = await parseJsonSafe(stateResponse);
    expect(payload.ok).toBe(false);
  }, 10000);

  it("publishes a server-side team plan and then marks the observation seen", async () => {
    const loginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: "user-scout", password: TEAM_TEST_PASSWORD }),
    });
    const cookie = String(loginResponse.headers.get("set-cookie") || "").split(";")[0];
    const loginPayload = await parseJsonSafe(loginResponse);

    const planResponse = await fetch(`${baseUrl}/api/team/plans`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
      },
      body: JSON.stringify({
        planHistoryId: "plan-test-1",
        games: [
          {
            id: "game-1",
            date: "2026-05-02",
            time: "11:00",
            home: "MSV Duisburg U13",
            away: "VfB Uerdingen U13",
            venue: "Sportanlage Test",
          },
        ],
      }),
    });

    expect(planResponse.status).toBe(200);
    const planPayload = await parseJsonSafe(planResponse);
    expect(planPayload.ok).toBe(true);
    expect(planPayload.observations).toHaveLength(1);
    expect(planPayload.observations[0]).toMatchObject({
      gameId: "game-1",
      scoutId: "user-scout",
      status: "planned",
      planHistoryId: "plan-test-1",
    });
    expect(planPayload.feedItems[0].type).toBe("plan_published");

    const seenResponse = await fetch(`${baseUrl}/api/team/observations/seen`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
      },
      body: JSON.stringify({ gameId: "game-1", reportUrl: "https://example.test/report/game-1" }),
    });

    expect(seenResponse.status).toBe(200);
    const seenPayload = await parseJsonSafe(seenResponse);
    expect(seenPayload.ok).toBe(true);
    expect(seenPayload.observation).toMatchObject({
      gameId: "game-1",
      scoutId: "user-scout",
      status: "seen",
      reportUrl: "https://example.test/report/game-1",
    });
    expect(seenPayload.feedItems[0].type).toBe("game_seen");

    const stateResponse = await fetch(`${baseUrl}/api/team/state`, {
      headers: { cookie },
    });
    const statePayload = await parseJsonSafe(stateResponse);
    const gameObservation = (statePayload.observations || []).find((item) => item.gameId === "game-1");
    expect(gameObservation).toBeTruthy();
    expect(gameObservation.status).toBe("seen");
    expect(statePayload.feedItems.map((item) => item.type)).toContain("game_seen");
    expect(statePayload.feedItems.map((item) => item.type)).toContain("plan_published");
  });

  it("deduplicates concurrent observation seen updates with same idempotency key", async () => {
    const loginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "user-coordinator", password: TEAM_TEST_PASSWORD }),
    });
    expect(loginResponse.status).toBe(200);
    const cookie = String(loginResponse.headers.get("set-cookie") || "").split(";")[0];
    const loginPayload = await parseJsonSafe(loginResponse);

    const gameId = `idem-seen-game-${Date.now()}`;
    const planResponse = await fetch(`${baseUrl}/api/team/plans`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
      },
      body: JSON.stringify({
        planHistoryId: `idem-seen-plan-${Date.now()}`,
        games: [{ id: gameId, date: "2026-09-02", home: "Seen Team A", away: "Seen Team B", venue: "Seen Platz" }],
      }),
    });
    expect(planResponse.status).toBe(200);

    const idempotencyKey = `observation-seen-idem-${Date.now()}`;
    const seenHeaders = {
      "content-type": "application/json",
      cookie,
      "x-csrf-token": loginPayload.csrfToken,
      "idempotency-key": idempotencyKey,
    };
    const seenBody = JSON.stringify({ gameId, reportUrl: "https://example.test/report/idem-seen" });
    const [firstSeenResponse, secondSeenResponse] = await Promise.all([
      fetch(`${baseUrl}/api/team/observations/seen`, { method: "POST", headers: seenHeaders, body: seenBody }),
      fetch(`${baseUrl}/api/team/observations/seen`, { method: "POST", headers: seenHeaders, body: seenBody }),
    ]);
    expect(firstSeenResponse.status).toBe(200);
    expect(secondSeenResponse.status).toBe(200);
    const firstSeenPayload = await parseJsonSafe(firstSeenResponse);
    const secondSeenPayload = await parseJsonSafe(secondSeenResponse);
    expect(firstSeenPayload.observation?.id).toBeTruthy();
    expect(secondSeenPayload.observation?.id).toBe(firstSeenPayload.observation?.id);
  });

  it("deduplicates concurrent observation reassign/report/note updates with same idempotency keys", async () => {
    const loginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "user-coordinator", password: TEAM_TEST_PASSWORD }),
    });
    expect(loginResponse.status).toBe(200);
    const cookie = String(loginResponse.headers.get("set-cookie") || "").split(";")[0];
    const loginPayload = await parseJsonSafe(loginResponse);

    const gameId = `idem-multi-obs-${Date.now()}`;
    const planResponse = await fetch(`${baseUrl}/api/team/plans`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
      },
      body: JSON.stringify({
        planHistoryId: `idem-multi-obs-plan-${Date.now()}`,
        games: [{ id: gameId, date: "2026-09-03", home: "Obs Team A", away: "Obs Team B", venue: "Obs Platz" }],
      }),
    });
    expect(planResponse.status).toBe(200);

    const seenResponse = await fetch(`${baseUrl}/api/team/observations/seen`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
      },
      body: JSON.stringify({ gameId }),
    });
    expect(seenResponse.status).toBe(200);
    const seenPayload = await parseJsonSafe(seenResponse);
    const observationId = String(seenPayload?.observation?.id || "");
    expect(observationId).toBeTruthy();

    const reassignHeaders = {
      "content-type": "application/json",
      cookie,
      "x-csrf-token": loginPayload.csrfToken,
      "idempotency-key": `obs-reassign-idem-${Date.now()}`,
    };
    const reassignBody = JSON.stringify({ observationId, targetScoutId: "user-scout-b" });
    const [firstReassign, secondReassign] = await Promise.all([
      fetch(`${baseUrl}/api/team/observations/reassign`, {
        method: "POST",
        headers: reassignHeaders,
        body: reassignBody,
      }),
      fetch(`${baseUrl}/api/team/observations/reassign`, {
        method: "POST",
        headers: reassignHeaders,
        body: reassignBody,
      }),
    ]);
    expect(firstReassign.status).toBe(200);
    expect(secondReassign.status).toBe(200);
    const firstReassignPayload = await parseJsonSafe(firstReassign);
    const secondReassignPayload = await parseJsonSafe(secondReassign);
    expect(firstReassignPayload.observation?.id).toBeTruthy();
    expect(secondReassignPayload.observation?.id).toBe(firstReassignPayload.observation?.id);
    expect(firstReassignPayload.observation?.scoutId).toBe("user-scout-b");
    expect(secondReassignPayload.observation?.scoutId).toBe("user-scout-b");
    const reassignedObservationId = String(firstReassignPayload?.observation?.id || "");

    const reportHeaders = {
      "content-type": "application/json",
      cookie,
      "x-csrf-token": loginPayload.csrfToken,
      "idempotency-key": `obs-report-idem-${Date.now()}`,
    };
    const reportBody = JSON.stringify({
      observationId: reassignedObservationId,
      reportId: `idem-report-${Date.now()}`,
      reportUrl: "#idem-report",
    });
    const [firstReport, secondReport] = await Promise.all([
      fetch(`${baseUrl}/api/team/observations/report`, { method: "POST", headers: reportHeaders, body: reportBody }),
      fetch(`${baseUrl}/api/team/observations/report`, { method: "POST", headers: reportHeaders, body: reportBody }),
    ]);
    expect(firstReport.status).toBe(200);
    expect(secondReport.status).toBe(200);
    const firstReportPayload = await parseJsonSafe(firstReport);
    const secondReportPayload = await parseJsonSafe(secondReport);
    expect(firstReportPayload.observation?.id).toBe(reassignedObservationId);
    expect(secondReportPayload.observation?.id).toBe(reassignedObservationId);
    expect(firstReportPayload.observation?.status).toBe("reported");
    expect(secondReportPayload.observation?.status).toBe("reported");

    const noteHeaders = {
      "content-type": "application/json",
      cookie,
      "x-csrf-token": loginPayload.csrfToken,
      "idempotency-key": `obs-note-idem-${Date.now()}`,
    };
    const noteBody = JSON.stringify({ observationId: reassignedObservationId, note: "Idempotent note text." });
    const [firstNote, secondNote] = await Promise.all([
      fetch(`${baseUrl}/api/team/observations/note`, { method: "POST", headers: noteHeaders, body: noteBody }),
      fetch(`${baseUrl}/api/team/observations/note`, { method: "POST", headers: noteHeaders, body: noteBody }),
    ]);
    expect(firstNote.status).toBe(200);
    expect(secondNote.status).toBe(200);
    const firstNotePayload = await parseJsonSafe(firstNote);
    const secondNotePayload = await parseJsonSafe(secondNote);
    expect(firstNotePayload.observation?.id).toBe(reassignedObservationId);
    expect(secondNotePayload.observation?.id).toBe(reassignedObservationId);
    expect(firstNotePayload.observation?.note).toBe("Idempotent note text.");
    expect(secondNotePayload.observation?.note).toBe("Idempotent note text.");
  });

  it("stores manual game type for spontaneous and inofficial entries", async () => {
    const loginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: "user-scout", password: TEAM_TEST_PASSWORD }),
    });
    expect(loginResponse.status).toBe(200);
    const cookie = String(loginResponse.headers.get("set-cookie") || "").split(";")[0];
    const loginPayload = await parseJsonSafe(loginResponse);

    const spontaneousResponse = await fetch(`${baseUrl}/api/team/manual-games`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
      },
      body: JSON.stringify({
        home: "Spontan Team A",
        away: "Spontan Team B",
        date: "2026-09-05",
        time: "15:00",
        venue: "Nebenplatz",
        manualType: "spontaneous",
      }),
    });
    expect(spontaneousResponse.status).toBe(200);
    const spontaneousPayload = await parseJsonSafe(spontaneousResponse);
    expect(spontaneousPayload.manualGame?.manualType).toBe("spontaneous");

    const inofficialResponse = await fetch(`${baseUrl}/api/team/manual-games`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
      },
      body: JSON.stringify({
        home: "Inoffiziell Team A",
        away: "Inoffiziell Team B",
        date: "2026-09-06",
        time: "12:30",
        venue: "Trainingsplatz",
        manualType: "inofficial",
      }),
    });
    expect(inofficialResponse.status).toBe(200);
    const inofficialPayload = await parseJsonSafe(inofficialResponse);
    expect(inofficialPayload.manualGame?.manualType).toBe("inofficial");
  });

  it("merges duplicate observations when reassigning to a scout who already has the same game", async () => {
    const coordinatorLoginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "user-coordinator", password: TEAM_TEST_PASSWORD }),
    });
    expect(coordinatorLoginResponse.status).toBe(200);
    const coordinatorCookie = String(coordinatorLoginResponse.headers.get("set-cookie") || "").split(";")[0];
    const coordinatorLoginPayload = await parseJsonSafe(coordinatorLoginResponse);

    const gameId = `merge-reassign-${Date.now()}`;
    const planResponse = await fetch(`${baseUrl}/api/team/plans`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: coordinatorCookie,
        "x-csrf-token": coordinatorLoginPayload.csrfToken,
      },
      body: JSON.stringify({
        planHistoryId: `merge-reassign-plan-${Date.now()}`,
        games: [{ id: gameId, date: "2026-09-04", home: "Merge Team A", away: "Merge Team B", venue: "Merge Platz" }],
      }),
    });
    expect(planResponse.status).toBe(200);

    const coordinatorSeenResponse = await fetch(`${baseUrl}/api/team/observations/seen`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: coordinatorCookie,
        "x-csrf-token": coordinatorLoginPayload.csrfToken,
      },
      body: JSON.stringify({ gameId }),
    });
    expect(coordinatorSeenResponse.status).toBe(200);
    const coordinatorSeenPayload = await parseJsonSafe(coordinatorSeenResponse);
    const sourceObservationId = String(coordinatorSeenPayload?.observation?.id || "");
    expect(sourceObservationId).toBeTruthy();

    const scoutBLoginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "user-scout-b", password: TEAM_TEST_PASSWORD }),
    });
    expect(scoutBLoginResponse.status).toBe(200);
    const scoutBCookie = String(scoutBLoginResponse.headers.get("set-cookie") || "").split(";")[0];
    const scoutBLoginPayload = await parseJsonSafe(scoutBLoginResponse);

    const scoutBPlanResponse = await fetch(`${baseUrl}/api/team/plans`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: scoutBCookie,
        "x-csrf-token": scoutBLoginPayload.csrfToken,
      },
      body: JSON.stringify({
        planHistoryId: `merge-reassign-plan-b-${Date.now()}`,
        games: [{ id: gameId, date: "2026-09-04", home: "Merge Team A", away: "Merge Team B", venue: "Merge Platz" }],
      }),
    });
    expect(scoutBPlanResponse.status).toBe(200);

    const reassignResponse = await fetch(`${baseUrl}/api/team/observations/reassign`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: coordinatorCookie,
        "x-csrf-token": coordinatorLoginPayload.csrfToken,
      },
      body: JSON.stringify({ observationId: sourceObservationId, targetScoutId: "user-scout-b" }),
    });
    expect(reassignResponse.status).toBe(200);
    const reassignPayload = await parseJsonSafe(reassignResponse);
    expect(reassignPayload.observation?.scoutId).toBe("user-scout-b");

    const stateResponse = await fetch(`${baseUrl}/api/team/state`, {
      headers: {
        cookie: coordinatorCookie,
      },
    });
    expect(stateResponse.status).toBe(200);
    const statePayload = await parseJsonSafe(stateResponse);
    const gameObservations = (statePayload.observations || []).filter((item) => item.gameId === gameId);
    expect(gameObservations).toHaveLength(1);
    expect(gameObservations[0]?.scoutId).toBe("user-scout-b");
  });

  it("returns filtered team audit-log entries", async () => {
    const loginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "user-scout", password: TEAM_TEST_PASSWORD }),
    });
    expect(loginResponse.status).toBe(200);
    const cookie = String(loginResponse.headers.get("set-cookie") || "").split(";")[0];
    const loginPayload = await parseJsonSafe(loginResponse);

    const planResponse = await fetch(`${baseUrl}/api/team/plans`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
      },
      body: JSON.stringify({
        planHistoryId: `audit-plan-${Date.now()}`,
        games: [
          {
            id: `audit-game-${Date.now()}`,
            date: "2026-05-20",
            time: "12:00",
            home: "Audit Team A",
            away: "Audit Team B",
            venue: "Audit Platz",
            source: "official",
          },
        ],
      }),
    });
    expect(planResponse.status).toBe(200);

    const auditResponse = await fetch(
      `${baseUrl}/api/team/audit-log?actorId=user-scout&action=plan_published&limit=10`,
      {
        headers: { cookie },
      },
    );
    expect(auditResponse.status).toBe(200);
    const payload = await parseJsonSafe(auditResponse);
    expect(payload.ok).toBe(true);
    expect(Array.isArray(payload.entries)).toBe(true);
    expect(payload.entries.length).toBeGreaterThan(0);
    expect(payload.entries[0]).toMatchObject({
      actorId: "user-scout",
      action: "plan_published",
    });
  });

  it("links a report to a seen server-side observation", async () => {
    const loginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: "user-scout", password: TEAM_TEST_PASSWORD }),
    });
    const cookie = String(loginResponse.headers.get("set-cookie") || "").split(";")[0];
    const loginPayload = await parseJsonSafe(loginResponse);
    const gameId = `game-report-${Date.now()}`;

    await fetch(`${baseUrl}/api/team/plans`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
      },
      body: JSON.stringify({
        planHistoryId: "plan-report-link",
        games: [{ id: gameId, home: "Team A", away: "Team B" }],
      }),
    });
    const seenResponse = await fetch(`${baseUrl}/api/team/observations/seen`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
      },
      body: JSON.stringify({ gameId }),
    });
    const seenPayload = await parseJsonSafe(seenResponse);

    const linkResponse = await fetch(`${baseUrl}/api/team/observations/report`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
      },
      body: JSON.stringify({
        observationId: seenPayload.observation.id,
        reportId: "report-linked-1",
        reportUrl: "#report-report-linked-1",
      }),
    });

    expect(linkResponse.status).toBe(200);
    const linkPayload = await parseJsonSafe(linkResponse);
    expect(linkPayload.ok).toBe(true);
    expect(linkPayload.observation).toMatchObject({
      id: seenPayload.observation.id,
      status: "reported",
      reportId: "report-linked-1",
      reportUrl: "#report-report-linked-1",
    });
    expect(linkPayload.feedItems[0]).toMatchObject({
      type: "report_linked",
      observationId: seenPayload.observation.id,
    });
  });

  it("adds a note to a seen server-side observation", async () => {
    const loginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: "user-scout", password: TEAM_TEST_PASSWORD }),
    });
    const cookie = String(loginResponse.headers.get("set-cookie") || "").split(";")[0];
    const loginPayload = await parseJsonSafe(loginResponse);
    const gameId = `game-note-${Date.now()}`;

    await fetch(`${baseUrl}/api/team/plans`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
      },
      body: JSON.stringify({
        planHistoryId: "plan-note",
        games: [{ id: gameId, home: "Team A", away: "Team B" }],
      }),
    });
    const seenResponse = await fetch(`${baseUrl}/api/team/observations/seen`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
      },
      body: JSON.stringify({ gameId }),
    });
    const seenPayload = await parseJsonSafe(seenResponse);

    const noteResponse = await fetch(`${baseUrl}/api/team/observations/note`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
      },
      body: JSON.stringify({
        observationId: seenPayload.observation.id,
        note: "Nr. 10 nochmal gegen körperliche Gegner prüfen.",
      }),
    });

    expect(noteResponse.status).toBe(200);
    const notePayload = await parseJsonSafe(noteResponse);
    expect(notePayload.ok).toBe(true);
    expect(notePayload.observation).toMatchObject({
      id: seenPayload.observation.id,
      status: "followup",
      note: "Nr. 10 nochmal gegen körperliche Gegner prüfen.",
    });
    expect(notePayload.feedItems[0]).toMatchObject({
      type: "observation_note_added",
      observationId: seenPayload.observation.id,
    });
  });

  it("rejects team writes without a matching csrf token", async () => {
    const loginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: "user-scout", password: TEAM_TEST_PASSWORD }),
    });
    const cookie = String(loginResponse.headers.get("set-cookie") || "").split(";")[0];

    const response = await fetch(`${baseUrl}/api/team/plans`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({ games: [] }),
    });

    expect(response.status).toBe(403);
    const payload = await parseJsonSafe(response);
    expect(payload.ok).toBe(false);
  });

  it("rejects readonly team members on publish", async () => {
    const loginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: "user-readonly", password: TEAM_TEST_PASSWORD }),
    });
    const cookie = String(loginResponse.headers.get("set-cookie") || "").split(";")[0];
    const loginPayload = await parseJsonSafe(loginResponse);

    const response = await fetch(`${baseUrl}/api/team/plans`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
      },
      body: JSON.stringify({ games: [{ id: "game-2" }] }),
    });

    expect(response.status).toBe(403);
    const payload = await parseJsonSafe(response);
    expect(payload.ok).toBe(false);
  });

  it("rejects readonly team members on all critical write endpoints", async () => {
    const loginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: "user-readonly", password: TEAM_TEST_PASSWORD }),
    });
    expect(loginResponse.status).toBe(200);
    const cookie = String(loginResponse.headers.get("set-cookie") || "").split(";")[0];
    const loginPayload = await parseJsonSafe(loginResponse);

    const jsonCases = [
      { path: "/api/team/invitations/create", body: { email: "readonly-test@example.com", role: "scout" } },
      {
        path: "/api/team/notifications/push/subscribe",
        body: {
          subscription: {
            endpoint: "https://push.example.test/subscription/readonly",
            keys: { p256dh: "a", auth: "b" },
          },
        },
      },
      {
        path: "/api/team/tournaments/import/meinturnierplan",
        body: { fromDate: "2026-06-01", toDate: "2026-06-07", teams: [] },
      },
      { path: "/api/team/tournaments", body: { name: "Readonly Cup", dateFrom: "2026-06-01", dateTo: "2026-06-02" } },
      { path: "/api/team/import/dfb-national-games", body: { games: [] } },
      { path: "/api/team/notifications/read", body: { eventIds: ["event-readonly-test"] } },
      {
        path: "/api/team/manual-games",
        body: { home: "A", away: "B", date: "2026-06-01", time: "12:00", venue: "Platz" },
      },
      { path: "/api/team/goals", body: { favoriteTeams: ["Readonly Team"] } },
      {
        path: "/api/team/members",
        body: { id: "readonly-member-test", name: "Readonly Test", role: "scout", active: true },
      },
      { path: "/api/team/observations/seen", body: { gameId: "readonly-game" } },
      { path: "/api/team/observations/report", body: { observationId: "obs-readonly", reportId: "report-readonly" } },
      { path: "/api/team/observations/note", body: { observationId: "obs-readonly", note: "readonly" } },
    ];

    for (const testCase of jsonCases) {
      const response = await fetch(`${baseUrl}${testCase.path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie,
          "x-csrf-token": loginPayload.csrfToken,
        },
        body: JSON.stringify(testCase.body),
      });
      expect(response.status, testCase.path).toBe(403);
      const payload = await parseJsonSafe(response);
      expect(payload.ok, testCase.path).toBe(false);
    }

    const kreisPdfResponse = await fetch(`${baseUrl}/api/team/import/kreis-pdf`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
      },
      body: JSON.stringify({
        mode: "preview",
        extractedText: "11.08.2026 10:30 Team Upload A - Team Upload B | Platz Upload",
      }),
    });
    expect(kreisPdfResponse.status).toBe(403);
    const kreisPdfPayload = await parseJsonSafe(kreisPdfResponse);
    expect(kreisPdfPayload.ok).toBe(false);

    const tournamentMatchResponse = await fetch(`${baseUrl}/api/team/tournaments/readonly-tournament/matches`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
      },
      body: JSON.stringify({
        matches: [
          {
            home: "Readonly A",
            away: "Readonly B",
            date: "2026-06-01",
            time: "10:00",
          },
        ],
      }),
    });
    expect(tournamentMatchResponse.status).toBe(403);
    const tournamentMatchPayload = await parseJsonSafe(tournamentMatchResponse);
    expect(tournamentMatchPayload.ok).toBe(false);
  });

  it("allows readonly users to logout with csrf token", async () => {
    const loginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: "user-readonly", password: TEAM_TEST_PASSWORD }),
    });
    expect(loginResponse.status).toBe(200);
    const cookie = String(loginResponse.headers.get("set-cookie") || "").split(";")[0];
    const loginPayload = await parseJsonSafe(loginResponse);

    const logoutResponse = await fetch(`${baseUrl}/api/team/auth/logout`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
      },
      body: JSON.stringify({}),
    });
    expect(logoutResponse.status).toBe(200);
    const logoutPayload = await parseJsonSafe(logoutResponse);
    expect(logoutPayload.ok).toBe(true);
  });

  it("rejects CSRF-mismatched writes on additional team endpoints", async () => {
    const loginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: "user-scout", password: TEAM_TEST_PASSWORD }),
    });
    expect(loginResponse.status).toBe(200);
    const cookie = String(loginResponse.headers.get("set-cookie") || "").split(";")[0];

    const targets = [
      {
        path: "/api/team/notifications/read",
        body: { eventIds: ["csrf-mismatch-event"] },
      },
      {
        path: "/api/team/manual-games",
        body: {
          home: "CSRF Team A",
          away: "CSRF Team B",
          date: "2026-09-21",
          time: "17:30",
          venue: "Nebenplatz",
        },
      },
    ];

    for (const target of targets) {
      const response = await fetch(`${baseUrl}${target.path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie,
          "x-csrf-token": "invalid-csrf-token",
        },
        body: JSON.stringify(target.body),
      });
      expect(response.status, target.path).toBe(403);
      const payload = await parseJsonSafe(response);
      expect(payload.ok, target.path).toBe(false);
    }
  });

  it("rejects scouts marking another scout's observation as seen", async () => {
    const scoutLoginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: "user-scout", password: TEAM_TEST_PASSWORD }),
    });
    const scoutCookie = String(scoutLoginResponse.headers.get("set-cookie") || "").split(";")[0];
    const scoutLoginPayload = await parseJsonSafe(scoutLoginResponse);
    const gameId = `game-cross-scout-${Date.now()}`;

    const planResponse = await fetch(`${baseUrl}/api/team/plans`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: scoutCookie,
        "x-csrf-token": scoutLoginPayload.csrfToken,
      },
      body: JSON.stringify({
        planHistoryId: "plan-cross-scout",
        games: [{ id: gameId, home: "Scout A", away: "Scout B", date: "2026-05-04" }],
      }),
    });

    expect(planResponse.status).toBe(200);

    const otherScoutLoginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: "user-scout-b", password: TEAM_TEST_PASSWORD }),
    });
    const otherScoutCookie = String(otherScoutLoginResponse.headers.get("set-cookie") || "").split(";")[0];
    const otherScoutLoginPayload = await parseJsonSafe(otherScoutLoginResponse);

    const seenResponse = await fetch(`${baseUrl}/api/team/observations/seen`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: otherScoutCookie,
        "x-csrf-token": otherScoutLoginPayload.csrfToken,
      },
      body: JSON.stringify({ gameId, scoutId: "user-scout" }),
    });

    expect(seenResponse.status).toBe(403);
    const payload = await parseJsonSafe(seenResponse);
    expect(payload.ok).toBe(false);
  });

  it("rejects scout role on team member and invitation management", async () => {
    const scoutLoginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: "user-scout", password: TEAM_TEST_PASSWORD }),
    });
    expect(scoutLoginResponse.status).toBe(200);
    const scoutCookie = String(scoutLoginResponse.headers.get("set-cookie") || "").split(";")[0];
    const scoutLoginPayload = await parseJsonSafe(scoutLoginResponse);

    const memberResponse = await fetch(`${baseUrl}/api/team/members`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: scoutCookie,
        "x-csrf-token": scoutLoginPayload.csrfToken,
      },
      body: JSON.stringify({
        id: "scout-member-forbidden",
        name: "Forbidden Member",
        role: "scout",
        active: true,
      }),
    });
    expect(memberResponse.status).toBe(403);
    const memberPayload = await parseJsonSafe(memberResponse);
    expect(memberPayload.ok).toBe(false);

    const inviteResponse = await fetch(`${baseUrl}/api/team/invitations/create`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: scoutCookie,
        "x-csrf-token": scoutLoginPayload.csrfToken,
      },
      body: JSON.stringify({
        userId: "scout-invite-forbidden",
        name: "Invite Forbidden",
        role: "scout",
      }),
    });
    expect(inviteResponse.status).toBe(403);
    const invitePayload = await parseJsonSafe(inviteResponse);
    expect(invitePayload.ok).toBe(false);
  });

  it("lets coordinators update server-side team members", async () => {
    const loginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: "user-coordinator", password: TEAM_TEST_PASSWORD }),
    });
    const cookie = String(loginResponse.headers.get("set-cookie") || "").split(";")[0];
    const loginPayload = await parseJsonSafe(loginResponse);

    const response = await fetch(`${baseUrl}/api/team/members`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
      },
      body: JSON.stringify({
        id: "user-scout",
        name: "Scout",
        role: "coordinator",
        active: true,
      }),
    });

    expect(response.status).toBe(200);
    const payload = await parseJsonSafe(response);
    expect(payload.ok).toBe(true);
    expect(payload.member).toMatchObject({ id: "user-scout", role: "coordinator", active: true });
    expect(payload.team.accounts.find((account) => account.id === "user-scout")).toMatchObject({
      role: "coordinator",
    });
  });

  it("revokes active sessions when a member role changes", async () => {
    const scoutLoginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: "user-scout-b", password: TEAM_TEST_PASSWORD }),
    });
    expect(scoutLoginResponse.status).toBe(200);
    const scoutCookie = String(scoutLoginResponse.headers.get("set-cookie") || "").split(";")[0];

    const coordinatorLoginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: "user-coordinator", password: TEAM_TEST_PASSWORD }),
    });
    expect(coordinatorLoginResponse.status).toBe(200);
    const coordinatorCookie = String(coordinatorLoginResponse.headers.get("set-cookie") || "").split(";")[0];
    const coordinatorPayload = await parseJsonSafe(coordinatorLoginResponse);

    const roleChangeResponse = await fetch(`${baseUrl}/api/team/members`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: coordinatorCookie,
        "x-csrf-token": coordinatorPayload.csrfToken,
      },
      body: JSON.stringify({
        id: "user-scout-b",
        name: "Scout B",
        role: "readonly",
        active: true,
      }),
    });
    expect(roleChangeResponse.status).toBe(200);

    const staleSessionResponse = await fetch(`${baseUrl}/api/team/state`, {
      headers: { cookie: scoutCookie },
    });
    expect(staleSessionResponse.status).toBe(401);
  });

  it("stores manual team games server-side and emits a feed entry", async () => {
    const loginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: "user-scout", password: TEAM_TEST_PASSWORD }),
    });
    const cookie = String(loginResponse.headers.get("set-cookie") || "").split(";")[0];
    const loginPayload = await parseJsonSafe(loginResponse);

    const response = await fetch(`${baseUrl}/api/team/manual-games`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
      },
      body: JSON.stringify({
        home: "Inoffizielles Team A",
        away: "Inoffizielles Team B",
        date: "2026-05-03",
        time: "18:00",
        venue: "Nebenplatz",
      }),
    });

    expect(response.status).toBe(200);
    const payload = await parseJsonSafe(response);
    expect(payload.ok).toBe(true);
    expect(payload.manualGame).toMatchObject({
      source: "manual",
      home: "Inoffizielles Team A",
      away: "Inoffizielles Team B",
    });
    expect(payload.manualGames.map((game) => game.id)).toContain(payload.manualGame.id);
    expect(payload.feedItems[0]).toMatchObject({
      type: "manual_game_created",
      gameIds: [payload.manualGame.id],
    });

    const cancelResponse = await fetch(`${baseUrl}/api/team/manual-games`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
      },
      body: JSON.stringify({
        ...payload.manualGame,
        status: "cancelled",
      }),
    });

    expect(cancelResponse.status).toBe(200);
    const cancelPayload = await parseJsonSafe(cancelResponse);
    expect(cancelPayload.manualGame).toMatchObject({
      id: payload.manualGame.id,
      status: "cancelled",
    });
    expect(cancelPayload.feedItems[0]).toMatchObject({
      type: "manual_game_cancelled",
      gameIds: [payload.manualGame.id],
    });
  });

  it("creates tournaments and tournament matches", async () => {
    const loginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: "user-coordinator", password: TEAM_TEST_PASSWORD }),
    });
    expect(loginResponse.status).toBe(200);
    const cookie = String(loginResponse.headers.get("set-cookie") || "").split(";")[0];
    const loginPayload = await parseJsonSafe(loginResponse);

    const createTournamentResponse = await fetch(`${baseUrl}/api/team/tournaments`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
      },
      body: JSON.stringify({
        name: "Niederrhein Cup U15",
        dateFrom: "2026-06-01",
        dateTo: "2026-06-02",
        venue: "Sportpark Test",
      }),
    });
    expect(createTournamentResponse.status).toBe(201);
    const tournamentPayload = await parseJsonSafe(createTournamentResponse);
    expect(tournamentPayload.ok).toBe(true);
    expect(tournamentPayload.tournament).toMatchObject({
      name: "Niederrhein Cup U15",
      venue: "Sportpark Test",
    });

    const addMatchResponse = await fetch(
      `${baseUrl}/api/team/tournaments/${encodeURIComponent(tournamentPayload.tournament.id)}/matches`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie,
          "x-csrf-token": loginPayload.csrfToken,
        },
        body: JSON.stringify({
          matches: [
            {
              home: "Borussia MG U15",
              away: "MSV Duisburg U15",
              date: "2026-06-01",
              time: "10:30",
              venue: "Platz 1",
            },
          ],
        }),
      },
    );
    expect(addMatchResponse.status).toBe(200);
    const matchPayload = await parseJsonSafe(addMatchResponse);
    expect(matchPayload.ok).toBe(true);
    expect(Array.isArray(matchPayload.matches)).toBe(true);
    expect(matchPayload.matches[0]).toMatchObject({
      source: "tournament",
      tournamentId: tournamentPayload.tournament.id,
      home: "Borussia MG U15",
      away: "MSV Duisburg U15",
    });
  });

  it("deduplicates concurrent tournament create requests with the same idempotency key", async () => {
    const loginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "user-coordinator", password: TEAM_TEST_PASSWORD }),
    });
    expect(loginResponse.status).toBe(200);
    const cookie = String(loginResponse.headers.get("set-cookie") || "").split(";")[0];
    const loginPayload = await parseJsonSafe(loginResponse);
    const idempotencyKey = `tournament-create-idem-${Date.now()}`;
    const requestBody = JSON.stringify({
      name: `Idem Tournament ${Date.now()}`,
      dateFrom: "2026-10-20",
      dateTo: "2026-10-21",
      venue: "Idem Arena",
    });
    const requestHeaders = {
      "content-type": "application/json",
      cookie,
      "x-csrf-token": loginPayload.csrfToken,
      "idempotency-key": idempotencyKey,
    };

    const [firstResponse, secondResponse] = await Promise.all([
      fetch(`${baseUrl}/api/team/tournaments`, { method: "POST", headers: requestHeaders, body: requestBody }),
      fetch(`${baseUrl}/api/team/tournaments`, { method: "POST", headers: requestHeaders, body: requestBody }),
    ]);
    expect(firstResponse.status).toBe(201);
    expect(secondResponse.status).toBe(201);
    const firstPayload = await parseJsonSafe(firstResponse);
    const secondPayload = await parseJsonSafe(secondResponse);
    expect(firstPayload.tournament?.id).toBeTruthy();
    expect(secondPayload.tournament?.id).toBe(firstPayload.tournament?.id);
  });

  it("deduplicates concurrent tournament match imports with the same idempotency key", async () => {
    const loginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "user-coordinator", password: TEAM_TEST_PASSWORD }),
    });
    expect(loginResponse.status).toBe(200);
    const cookie = String(loginResponse.headers.get("set-cookie") || "").split(";")[0];
    const loginPayload = await parseJsonSafe(loginResponse);

    const createTournamentResponse = await fetch(`${baseUrl}/api/team/tournaments`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
      },
      body: JSON.stringify({
        name: `Idem Match Tournament ${Date.now()}`,
        dateFrom: "2026-10-22",
        dateTo: "2026-10-23",
      }),
    });
    expect(createTournamentResponse.status).toBe(201);
    const createTournamentPayload = await parseJsonSafe(createTournamentResponse);
    const tournamentId = String(createTournamentPayload?.tournament?.id || "");
    expect(tournamentId).toBeTruthy();

    const idempotencyKey = `tournament-match-idem-${Date.now()}`;
    const requestBody = JSON.stringify({
      matches: [
        {
          home: "Idem Match Home",
          away: "Idem Match Away",
          date: "2026-10-22",
          time: "11:00",
          venue: "Idem Platz",
        },
      ],
    });
    const requestHeaders = {
      "content-type": "application/json",
      cookie,
      "x-csrf-token": loginPayload.csrfToken,
      "idempotency-key": idempotencyKey,
    };

    const [firstResponse, secondResponse] = await Promise.all([
      fetch(`${baseUrl}/api/team/tournaments/${encodeURIComponent(tournamentId)}/matches`, {
        method: "POST",
        headers: requestHeaders,
        body: requestBody,
      }),
      fetch(`${baseUrl}/api/team/tournaments/${encodeURIComponent(tournamentId)}/matches`, {
        method: "POST",
        headers: requestHeaders,
        body: requestBody,
      }),
    ]);
    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    const firstPayload = await parseJsonSafe(firstResponse);
    const secondPayload = await parseJsonSafe(secondResponse);
    expect(firstPayload.matches?.[0]?.id).toBeTruthy();
    expect(secondPayload.matches?.[0]?.id).toBe(firstPayload.matches?.[0]?.id);
  });

  it("imports national games into team flows", async () => {
    const loginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: "user-coordinator", password: TEAM_TEST_PASSWORD }),
    });
    expect(loginResponse.status).toBe(200);
    const cookie = String(loginResponse.headers.get("set-cookie") || "").split(";")[0];
    const loginPayload = await parseJsonSafe(loginResponse);

    const response = await fetch(`${baseUrl}/api/team/import/dfb-national-games`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
      },
      body: JSON.stringify({
        games: [
          {
            id: "national-u15-ger-fra-1",
            home: "Deutschland U15",
            away: "Frankreich U15",
            date: "2026-07-10",
            time: "17:30",
            venue: "DFB Campus",
          },
        ],
      }),
    });
    expect(response.status).toBe(200);
    const payload = await parseJsonSafe(response);
    expect(payload.ok).toBe(true);
    expect(payload.importedCount).toBe(1);
    expect(payload.games[0]).toMatchObject({
      source: "national",
      home: "Deutschland U15",
      away: "Frankreich U15",
      provenance: {
        source: "national",
        method: "api-import",
        provider: "dfb-national-games",
        importedBy: "user-coordinator",
      },
    });
  });

  it("deduplicates concurrent national-game imports with same idempotency key", async () => {
    const loginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "user-coordinator", password: TEAM_TEST_PASSWORD }),
    });
    expect(loginResponse.status).toBe(200);
    const cookie = String(loginResponse.headers.get("set-cookie") || "").split(";")[0];
    const loginPayload = await parseJsonSafe(loginResponse);

    const idempotencyKey = `national-import-idem-${Date.now()}`;
    const body = JSON.stringify({
      games: [
        {
          home: "Deutschland U16",
          away: "Belgien U16",
          date: "2026-07-11",
          time: "15:00",
          venue: "DFB Campus 2",
        },
      ],
    });
    const headers = {
      "content-type": "application/json",
      cookie,
      "x-csrf-token": loginPayload.csrfToken,
      "idempotency-key": idempotencyKey,
    };

    const [firstResponse, secondResponse] = await Promise.all([
      fetch(`${baseUrl}/api/team/import/dfb-national-games`, { method: "POST", headers, body }),
      fetch(`${baseUrl}/api/team/import/dfb-national-games`, { method: "POST", headers, body }),
    ]);
    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    const firstPayload = await parseJsonSafe(firstResponse);
    const secondPayload = await parseJsonSafe(secondResponse);
    expect(firstPayload.games?.[0]?.id).toBeTruthy();
    expect(secondPayload.games?.[0]?.id).toBe(firstPayload.games?.[0]?.id);
  });

  it("imports national games from configured source when payload has no games", async () => {
    const loginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: "user-coordinator", password: TEAM_TEST_PASSWORD }),
    });
    expect(loginResponse.status).toBe(200);
    const cookie = String(loginResponse.headers.get("set-cookie") || "").split(";")[0];
    const loginPayload = await parseJsonSafe(loginResponse);

    const response = await fetch(`${baseUrl}/api/team/import/dfb-national-games`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
      },
      body: JSON.stringify({
        games: [],
        fromDate: "2026-06-10",
        toDate: "2026-06-15",
        ageGroup: "u15",
      }),
    });
    expect(response.status).toBe(200);
    const payload = await parseJsonSafe(response);
    expect(payload.ok).toBe(true);
    expect(payload.importedCount).toBe(1);
    expect(payload.games[0]).toMatchObject({
      id: "source-u15-ger-ita-1",
      source: "national",
      home: "Deutschland U15",
      away: "Italien U15",
    });
  });

  it("returns 413 when national import payload contains too many games", async () => {
    const loginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: "user-coordinator", password: TEAM_TEST_PASSWORD }),
    });
    expect(loginResponse.status).toBe(200);
    const cookie = String(loginResponse.headers.get("set-cookie") || "").split(";")[0];
    const loginPayload = await parseJsonSafe(loginResponse);

    const response = await fetch(`${baseUrl}/api/team/import/dfb-national-games`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
      },
      body: JSON.stringify({
        games: Array.from({ length: 501 }, (_, index) => ({
          id: `overflow-${index}`,
          home: `Team ${index}A`,
          away: `Team ${index}B`,
          date: "2026-06-10",
          time: "12:00",
          venue: "DFB Campus",
        })),
      }),
    });

    expect(response.status).toBe(413);
    const payload = await parseJsonSafe(response);
    expect(payload.ok).toBe(false);
    expect(String(payload.error || "")).toMatch(/Zu viele U-Nationalspiele im Import/i);
  });

  it("imports tournaments from meinturnierplan using wizard filters", async () => {
    const loginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: "user-coordinator", password: TEAM_TEST_PASSWORD }),
    });
    expect(loginResponse.status).toBe(200);
    const cookie = String(loginResponse.headers.get("set-cookie") || "").split(";")[0];
    const loginPayload = await parseJsonSafe(loginResponse);

    const response = await fetch(`${baseUrl}/api/team/tournaments/import/meinturnierplan`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
      },
      body: JSON.stringify({
        fromDate: "2026-06-01",
        toDate: "2026-06-07",
        jugendId: "f-jugend",
        kreisId: "duisburg",
        teams: ["MSV Duisburg U12"],
        regionName: "Duisburg",
        regionKeywords: ["duisburg", "wedau", "mulheim"],
      }),
    });

    expect(response.status).toBe(200);
    const payload = await parseJsonSafe(response);
    expect(payload.ok).toBe(true);
    expect(payload.provider).toBe("meinturnierplan.de");
    expect(payload.count).toBe(1);
    expect(payload.tournaments[0]).toMatchObject({
      source: "tournament",
      provider: "meinturnierplan.de",
      name: "MSV Duisburg U12 Cup",
      externalId: "abc123",
      dateFrom: "2026-06-03",
      dateTo: "2026-06-04",
      url: `${meinturnierplanBaseUrl}/showit.php?id=abc123`,
    });
  });

  it("runs official/manual/tournament/national through one shared plan-seen-report flow", async () => {
    const loginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: "user-coordinator", password: TEAM_TEST_PASSWORD }),
    });
    expect(loginResponse.status).toBe(200);
    const cookie = String(loginResponse.headers.get("set-cookie") || "").split(";")[0];
    const loginPayload = await parseJsonSafe(loginResponse);

    const createTournamentResponse = await fetch(`${baseUrl}/api/team/tournaments`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
      },
      body: JSON.stringify({
        name: "Flow Cup U15",
        dateFrom: "2026-09-10",
        dateTo: "2026-09-11",
      }),
    });
    expect(createTournamentResponse.status).toBe(201);
    const tournamentPayload = await parseJsonSafe(createTournamentResponse);
    const tournamentId = tournamentPayload?.tournament?.id;
    expect(typeof tournamentId).toBe("string");

    const addTournamentMatchResponse = await fetch(
      `${baseUrl}/api/team/tournaments/${encodeURIComponent(tournamentId)}/matches`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie,
          "x-csrf-token": loginPayload.csrfToken,
        },
        body: JSON.stringify({
          matches: [
            {
              home: "Turnier Team A",
              away: "Turnier Team B",
              date: "2026-09-10",
              time: "10:00",
              venue: "Turnierplatz",
            },
          ],
        }),
      },
    );
    expect(addTournamentMatchResponse.status).toBe(200);
    const addTournamentMatchPayload = await parseJsonSafe(addTournamentMatchResponse);
    const tournamentGame = addTournamentMatchPayload?.matches?.[0];
    expect(tournamentGame?.source).toBe("tournament");

    const nationalImportResponse = await fetch(`${baseUrl}/api/team/import/dfb-national-games`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
      },
      body: JSON.stringify({
        games: [
          {
            id: "national-flow-u15-ger-ned",
            home: "Deutschland U15",
            away: "Niederlande U15",
            date: "2026-09-12",
            time: "13:00",
            venue: "DFB Campus",
          },
        ],
      }),
    });
    expect(nationalImportResponse.status).toBe(200);
    const nationalImportPayload = await parseJsonSafe(nationalImportResponse);
    const nationalGame = nationalImportPayload?.games?.[0];
    expect(nationalGame?.source).toBe("national");

    const kreisPreviewResponse = await fetch(`${baseUrl}/api/team/import/kreis-pdf`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
      },
      body: JSON.stringify({
        mode: "preview",
        extractedText: "13.09.2026 11:30 Kreis Team A - Kreis Team B | Kreissportanlage",
      }),
    });
    expect(kreisPreviewResponse.status).toBe(200);
    const kreisPreviewPayload = await parseJsonSafe(kreisPreviewResponse);
    const kreisPreviewToken = kreisPreviewPayload?.previewToken;
    expect(typeof kreisPreviewToken).toBe("string");

    const kreisConfirmResponse = await fetch(`${baseUrl}/api/team/import/kreis-pdf`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
      },
      body: JSON.stringify({
        mode: "confirm",
        previewToken: kreisPreviewToken,
      }),
    });
    expect(kreisConfirmResponse.status).toBe(200);
    const kreisConfirmPayload = await parseJsonSafe(kreisConfirmResponse);
    const kreisGame = kreisConfirmPayload?.games?.[0];
    expect(kreisGame?.source).toBe("manual");

    const officialGame = {
      id: `official-flow-${Date.now()}`,
      source: "official",
      home: "Official Team A",
      away: "Official Team B",
      date: "2026-09-09",
      time: "18:00",
      venue: "Hauptplatz",
    };

    const planGames = [officialGame, tournamentGame, nationalGame, kreisGame].map((game) => ({
      id: game.id,
      source: game.source,
      home: game.home,
      away: game.away,
      date: game.date,
      time: game.time,
      venue: game.venue,
    }));

    const publishPlanResponse = await fetch(`${baseUrl}/api/team/plans`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
      },
      body: JSON.stringify({
        planHistoryId: `plan-four-sources-${Date.now()}`,
        games: planGames,
      }),
    });
    expect(publishPlanResponse.status).toBe(200);
    const publishPlanPayload = await parseJsonSafe(publishPlanResponse);
    expect(publishPlanPayload.ok).toBe(true);

    const sourceSet = new Set(
      publishPlanPayload.observations
        .filter((item) => planGames.some((game) => game.id === item.gameId))
        .map((item) => item.game?.source),
    );
    expect(sourceSet).toEqual(new Set(["official", "manual", "tournament", "national"]));

    const seenObservationIds = [];
    for (const game of planGames) {
      const seenResponse = await fetch(`${baseUrl}/api/team/observations/seen`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie,
          "x-csrf-token": loginPayload.csrfToken,
        },
        body: JSON.stringify({ gameId: game.id }),
      });
      expect(seenResponse.status).toBe(200);
      const seenPayload = await parseJsonSafe(seenResponse);
      expect(seenPayload.observation).toMatchObject({
        gameId: game.id,
        status: "seen",
      });
      seenObservationIds.push(seenPayload.observation.id);
    }

    for (const observationId of seenObservationIds) {
      const reportResponse = await fetch(`${baseUrl}/api/team/observations/report`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie,
          "x-csrf-token": loginPayload.csrfToken,
        },
        body: JSON.stringify({
          observationId,
          reportId: `report-${observationId}`,
          reportUrl: `#report-${observationId}`,
        }),
      });
      expect(reportResponse.status).toBe(200);
      const reportPayload = await parseJsonSafe(reportResponse);
      expect(reportPayload.observation).toMatchObject({
        id: observationId,
        status: "reported",
      });
    }

    const stateResponse = await fetch(`${baseUrl}/api/team/state`, {
      headers: {
        cookie,
      },
    });
    expect(stateResponse.status).toBe(200);
    const statePayload = await parseJsonSafe(stateResponse);
    const finalObservations = (statePayload.observations || []).filter((item) => seenObservationIds.includes(item.id));
    expect(finalObservations).toHaveLength(4);
    expect(finalObservations.every((item) => item.status === "reported")).toBe(true);

    const feedEvents = statePayload.feedItems || [];
    for (const game of planGames) {
      expect(feedEvents.some((item) => Array.isArray(item.gameIds) && item.gameIds.includes(game.id))).toBe(true);
    }
  });

  it("previews and confirms kreis-pdf imports", async () => {
    const loginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: "user-coordinator", password: TEAM_TEST_PASSWORD }),
    });
    expect(loginResponse.status).toBe(200);
    const cookie = String(loginResponse.headers.get("set-cookie") || "").split(";")[0];
    const loginPayload = await parseJsonSafe(loginResponse);

    const previewResponse = await fetch(`${baseUrl}/api/team/import/kreis-pdf`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
      },
      body: JSON.stringify({
        mode: "preview",
        fileName: "kreis-auswahl.pdf",
        extractedText: [
          "10.08.2026 11:00 Borussia MG U15 - MSV Duisburg U15 | Sportpark Nord",
          "10.08.2026 13:30 Bayer 04 U15 - Fortuna Köln U15 | Stadion Mitte",
        ].join("\n"),
      }),
    });
    expect(previewResponse.status).toBe(200);
    const previewPayload = await parseJsonSafe(previewResponse);
    expect(previewPayload.ok).toBe(true);
    expect(previewPayload.preview.games).toHaveLength(2);
    expect(typeof previewPayload.previewToken).toBe("string");

    const confirmResponse = await fetch(`${baseUrl}/api/team/import/kreis-pdf`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
      },
      body: JSON.stringify({
        mode: "confirm",
        previewToken: previewPayload.previewToken,
      }),
    });
    expect(confirmResponse.status).toBe(200);
    const confirmPayload = await parseJsonSafe(confirmResponse);
    expect(confirmPayload.ok).toBe(true);
    expect(confirmPayload.importedCount).toBe(2);
    expect(confirmPayload.games[0]).toMatchObject({
      source: "manual",
      home: "Borussia MG U15",
      away: "MSV Duisburg U15",
      date: "2026-08-10",
      time: "11:00",
      provenance: {
        source: "manual",
        method: "pdf-import",
        provider: "kreis-pdf",
        importedBy: "user-coordinator",
      },
    });
  });

  it("returns 413 when kreis-pdf preview contains too many games", async () => {
    const loginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: "user-coordinator", password: TEAM_TEST_PASSWORD }),
    });
    expect(loginResponse.status).toBe(200);
    const cookie = String(loginResponse.headers.get("set-cookie") || "").split(";")[0];
    const loginPayload = await parseJsonSafe(loginResponse);

    const extractedText = Array.from({ length: 1001 }, (_, index) => {
      const minute = String(index % 60).padStart(2, "0");
      return `10.08.2026 1${index % 10}:${minute} Team ${index}A - Team ${index}B | Platz ${index}`;
    }).join("\n");

    const previewResponse = await fetch(`${baseUrl}/api/team/import/kreis-pdf`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
      },
      body: JSON.stringify({
        mode: "preview",
        fileName: "kreis-auswahl-oversized.pdf",
        extractedText,
      }),
    });
    expect(previewResponse.status).toBe(413);
    const previewPayload = await parseJsonSafe(previewResponse);
    expect(previewPayload.ok).toBe(false);
    expect(String(previewPayload.error || "")).toMatch(/Zu viele Spiele in der Kreis-PDF-Vorschau/i);
  });

  it("deduplicates concurrent kreis-pdf confirms with same idempotency key", async () => {
    const loginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "user-coordinator", password: TEAM_TEST_PASSWORD }),
    });
    expect(loginResponse.status).toBe(200);
    const cookie = String(loginResponse.headers.get("set-cookie") || "").split(";")[0];
    const loginPayload = await parseJsonSafe(loginResponse);

    const previewResponse = await fetch(`${baseUrl}/api/team/import/kreis-pdf`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
      },
      body: JSON.stringify({
        mode: "preview",
        fileName: "kreis-auswahl-idem.txt",
        extractedText: "12.08.2026 12:15 Team One U15 - Team Two U15 | Platz Alpha",
      }),
    });
    expect(previewResponse.status).toBe(200);
    const previewPayload = await parseJsonSafe(previewResponse);
    const previewToken = String(previewPayload.previewToken || "");
    expect(previewToken).toBeTruthy();

    const idempotencyKey = `kreis-confirm-idem-${Date.now()}`;
    const headers = {
      "content-type": "application/json",
      cookie,
      "x-csrf-token": loginPayload.csrfToken,
      "idempotency-key": idempotencyKey,
    };
    const body = JSON.stringify({ mode: "confirm", previewToken });

    const [firstResponse, secondResponse] = await Promise.all([
      fetch(`${baseUrl}/api/team/import/kreis-pdf`, { method: "POST", headers, body }),
      fetch(`${baseUrl}/api/team/import/kreis-pdf`, { method: "POST", headers, body }),
    ]);
    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    const firstPayload = await parseJsonSafe(firstResponse);
    const secondPayload = await parseJsonSafe(secondResponse);
    expect(firstPayload.games?.[0]?.id).toBeTruthy();
    expect(secondPayload.games?.[0]?.id).toBe(firstPayload.games?.[0]?.id);
  });

  it("accepts multipart file upload for kreis-pdf preview", async () => {
    const loginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: "user-coordinator", password: TEAM_TEST_PASSWORD }),
    });
    expect(loginResponse.status).toBe(200);
    const cookie = String(loginResponse.headers.get("set-cookie") || "").split(";")[0];
    const loginPayload = await parseJsonSafe(loginResponse);

    const textPayload = "11.08.2026 10:30 Team Upload A - Team Upload B | Platz Upload";
    const boundary = "----ScoutXBoundary12345";
    const multipartBody = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="mode"',
      "",
      "preview",
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="kreis-upload.txt"',
      "Content-Type: text/plain",
      "",
      textPayload,
      `--${boundary}`,
      'Content-Disposition: form-data; name="extractedText"',
      "",
      textPayload,
      `--${boundary}--`,
      "",
    ].join("\r\n");

    const previewResponse = await fetch(`${baseUrl}/api/team/import/kreis-pdf`, {
      method: "POST",
      headers: {
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
        "content-type": `multipart/form-data; boundary=${boundary}`,
      },
      body: multipartBody,
    });
    const previewPayload = await parseJsonSafe(previewResponse);
    expect(previewResponse.status).toBe(200);
    expect(previewPayload.ok).toBe(true);
    expect(previewPayload.preview.games).toHaveLength(1);
    expect(previewPayload.preview.games[0]).toMatchObject({
      home: "Team Upload A",
      away: "Team Upload B",
      date: "2026-08-11",
      time: "10:30",
    });
  });

  it("stores team goals server-side", async () => {
    const loginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: "user-coordinator", password: TEAM_TEST_PASSWORD }),
    });
    const cookie = String(loginResponse.headers.get("set-cookie") || "").split(";")[0];
    const loginPayload = await parseJsonSafe(loginResponse);

    const response = await fetch(`${baseUrl}/api/team/goals`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
      },
      body: JSON.stringify({
        favoriteTeams: ["MSV Duisburg U13"],
        favoriteClubs: ["MSV Duisburg"],
        leaguePriorities: ["Niederrheinliga"],
        ageGroups: ["d-jugend"],
      }),
    });

    expect(response.status).toBe(200);
    const payload = await parseJsonSafe(response);
    expect(payload.ok).toBe(true);
    expect(payload.teamGoals).toMatchObject({
      favoriteTeams: ["MSV Duisburg U13"],
      favoriteClubs: ["MSV Duisburg"],
      leaguePriorities: ["Niederrheinliga"],
      ageGroups: ["d-jugend"],
    });
  });

  it("normalizes and limits oversized team goals payloads", async () => {
    const loginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: "user-coordinator", password: TEAM_TEST_PASSWORD }),
    });
    expect(loginResponse.status).toBe(200);
    const cookie = String(loginResponse.headers.get("set-cookie") || "").split(";")[0];
    const loginPayload = await parseJsonSafe(loginResponse);

    const oversizedLeagues = Array.from({ length: 50 }, (_, index) => `Liga ${index + 1}`);
    const response = await fetch(`${baseUrl}/api/team/goals`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
      },
      body: JSON.stringify({
        favoriteTeams: ["  MSV Duisburg U13  ", "msv duisburg u13", "VfL Test U12"],
        favoriteClubs: ["  MSV Duisburg  ", "MSV DUISBURG"],
        leaguePriorities: oversizedLeagues,
        ageGroups: ["D-JUGEND", "d-jugend", "c-jugend"],
      }),
    });

    expect(response.status).toBe(200);
    const payload = await parseJsonSafe(response);
    expect(payload.ok).toBe(true);
    expect(payload.teamGoals.favoriteTeams).toEqual(["MSV Duisburg U13", "VfL Test U12"]);
    expect(payload.teamGoals.favoriteClubs).toEqual(["MSV Duisburg"]);
    expect(payload.teamGoals.leaguePriorities).toHaveLength(30);
    expect(payload.teamGoals.ageGroups).toEqual(["d-jugend", "c-jugend"]);
  });

  it("applies concurrent team writes without losing updates", async () => {
    const loginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: "user-coordinator", password: TEAM_TEST_PASSWORD }),
    });
    const cookie = String(loginResponse.headers.get("set-cookie") || "").split(";")[0];
    const loginPayload = await parseJsonSafe(loginResponse);

    const headers = {
      "content-type": "application/json",
      cookie,
      "x-csrf-token": loginPayload.csrfToken,
    };

    const [goalsResponse, manualResponse] = await Promise.all([
      fetch(`${baseUrl}/api/team/goals`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          favoriteTeams: ["Parallel Team A"],
          favoriteClubs: ["Parallel Club A"],
          leaguePriorities: ["Parallel League A"],
          ageGroups: ["d-jugend"],
        }),
      }),
      fetch(`${baseUrl}/api/team/manual-games`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          id: `parallel-manual-${Date.now()}`,
          home: "Parallel Home",
          away: "Parallel Away",
          date: "2026-06-20",
          time: "12:30",
          venue: "Parallel Platz",
        }),
      }),
    ]);

    expect(goalsResponse.status).toBe(200);
    expect(manualResponse.status).toBe(200);

    const stateResponse = await fetch(`${baseUrl}/api/team/state`, {
      headers: { cookie },
    });
    expect(stateResponse.status).toBe(200);
    const statePayload = await parseJsonSafe(stateResponse);
    expect(statePayload.teamGoals.favoriteTeams).toContain("Parallel Team A");
    expect(
      (Array.isArray(statePayload.manualGames) ? statePayload.manualGames : []).some(
        (game) => String(game?.home || "") === "Parallel Home" && String(game?.away || "") === "Parallel Away",
      ),
    ).toBe(true);
  });

  it("scopes idempotency by endpoint scope so same key across different writes does not conflict", async () => {
    const loginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "user-coordinator", password: TEAM_TEST_PASSWORD }),
    });
    expect(loginResponse.status).toBe(200);
    const cookie = String(loginResponse.headers.get("set-cookie") || "").split(";")[0];
    const loginPayload = await parseJsonSafe(loginResponse);
    const sameKey = `cross-scope-idem-${Date.now()}`;

    const goalsResponse = await fetch(`${baseUrl}/api/team/goals`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
        "idempotency-key": sameKey,
      },
      body: JSON.stringify({
        favoriteTeams: ["Scope Team"],
        favoriteClubs: ["Scope Club"],
        leaguePriorities: ["Scope League"],
        ageGroups: ["c-jugend"],
      }),
    });
    expect(goalsResponse.status).toBe(200);

    const manualResponse = await fetch(`${baseUrl}/api/team/manual-games`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
        "idempotency-key": sameKey,
      },
      body: JSON.stringify({
        home: "Scope Home",
        away: "Scope Away",
        date: "2026-10-25",
        time: "12:00",
        venue: "Scope Platz",
      }),
    });
    expect(manualResponse.status).toBe(200);
    const manualPayload = await parseJsonSafe(manualResponse);
    expect(String(manualPayload.manualGame?.id || "")).toBeTruthy();
  });

  it("deduplicates concurrent manual-game writes with the same idempotency key", async () => {
    const loginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "user-coordinator", password: TEAM_TEST_PASSWORD }),
    });
    expect(loginResponse.status).toBe(200);
    const cookie = String(loginResponse.headers.get("set-cookie") || "").split(";")[0];
    const loginPayload = await parseJsonSafe(loginResponse);
    const idempotencyKey = `manual-idem-${Date.now()}`;
    const payload = {
      home: `Idem Home ${Date.now()}`,
      away: "Idem Away",
      date: "2026-10-12",
      time: "13:00",
      venue: "Idem Platz",
    };
    const headers = {
      "content-type": "application/json",
      cookie,
      "x-csrf-token": loginPayload.csrfToken,
      "idempotency-key": idempotencyKey,
    };

    const [firstResponse, secondResponse] = await Promise.all([
      fetch(`${baseUrl}/api/team/manual-games`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      }),
      fetch(`${baseUrl}/api/team/manual-games`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      }),
    ]);

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    const firstPayload = await parseJsonSafe(firstResponse);
    const secondPayload = await parseJsonSafe(secondResponse);
    expect(String(firstPayload.manualGame?.id || "")).toBeTruthy();
    expect(secondPayload.manualGame?.id).toBe(firstPayload.manualGame?.id);

    const stateResponse = await fetch(`${baseUrl}/api/team/state`, {
      headers: { cookie },
    });
    expect(stateResponse.status).toBe(200);
    const statePayload = await parseJsonSafe(stateResponse);
    const matches = (Array.isArray(statePayload.manualGames) ? statePayload.manualGames : []).filter(
      (item) => String(item?.id || "") === String(firstPayload.manualGame?.id || ""),
    );
    expect(matches).toHaveLength(1);
  });

  it("deduplicates requests when x-idempotency-key header is used", async () => {
    const loginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "user-coordinator", password: TEAM_TEST_PASSWORD }),
    });
    expect(loginResponse.status).toBe(200);
    const cookie = String(loginResponse.headers.get("set-cookie") || "").split(";")[0];
    const loginPayload = await parseJsonSafe(loginResponse);
    const idempotencyKey = `manual-x-idem-${Date.now()}`;
    const payload = {
      home: `X-Idem Home ${Date.now()}`,
      away: "X-Idem Away",
      date: "2026-11-02",
      time: "15:30",
      venue: "X-Idem Platz",
    };
    const headers = {
      "content-type": "application/json",
      cookie,
      "x-csrf-token": loginPayload.csrfToken,
      "x-idempotency-key": idempotencyKey,
    };

    const [firstResponse, secondResponse] = await Promise.all([
      fetch(`${baseUrl}/api/team/manual-games`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      }),
      fetch(`${baseUrl}/api/team/manual-games`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      }),
    ]);
    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    const firstPayload = await parseJsonSafe(firstResponse);
    const secondPayload = await parseJsonSafe(secondResponse);
    expect(String(firstPayload.manualGame?.id || "")).toBeTruthy();
    expect(secondPayload.manualGame?.id).toBe(firstPayload.manualGame?.id);
  });

  it("rejects idempotency key reuse with a different payload", async () => {
    const loginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "user-coordinator", password: TEAM_TEST_PASSWORD }),
    });
    expect(loginResponse.status).toBe(200);
    const cookie = String(loginResponse.headers.get("set-cookie") || "").split(";")[0];
    const loginPayload = await parseJsonSafe(loginResponse);
    const idempotencyKey = `manual-idem-conflict-${Date.now()}`;

    const firstResponse = await fetch(`${baseUrl}/api/team/manual-games`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify({
        home: `Idem Conflict A ${Date.now()}`,
        away: "Away A",
        date: "2026-10-14",
        time: "13:00",
        venue: "Idem Platz A",
      }),
    });
    expect(firstResponse.status).toBe(200);

    const secondResponse = await fetch(`${baseUrl}/api/team/manual-games`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify({
        home: `Idem Conflict B ${Date.now()}`,
        away: "Away B",
        date: "2026-10-15",
        time: "14:00",
        venue: "Idem Platz B",
      }),
    });
    expect(secondResponse.status).toBe(409);
    const secondPayload = await parseJsonSafe(secondResponse);
    expect(secondPayload.ok).toBe(false);
  });

  it("prevents duplicate accounts on concurrent registration for same userId", async () => {
    const userId = `parallel-user-${Date.now()}`;
    const registerBody = {
      userId,
      name: "Parallel User",
      password: "Parallel-pass-2026",
      teamKey: "borussia-moenchengladbach",
    };

    const [first, second] = await Promise.all([
      fetch(`${baseUrl}/api/team/auth/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(registerBody),
      }),
      fetch(`${baseUrl}/api/team/auth/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(registerBody),
      }),
    ]);

    const statuses = [first.status, second.status].sort((a, b) => a - b);
    expect(statuses).toEqual([201, 409]);

    const adminLoginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "user-admin", password: TEAM_TEST_PASSWORD }),
    });
    expect(adminLoginResponse.status).toBe(200);
    const adminCookie = String(adminLoginResponse.headers.get("set-cookie") || "").split(";")[0];

    const teamStateResponse = await fetch(`${baseUrl}/api/team/state`, {
      headers: { cookie: adminCookie },
    });
    expect(teamStateResponse.status).toBe(200);
    const teamStatePayload = await parseJsonSafe(teamStateResponse);
    const matches = (Array.isArray(teamStatePayload?.team?.accounts) ? teamStatePayload.team.accounts : []).filter(
      (account) => String(account?.id || "") === userId,
    );
    expect(matches).toHaveLength(1);
  });

  it("deduplicates concurrent registration with same idempotency key", async () => {
    const userId = `register-idem-${Date.now()}`;
    const idempotencyKey = `register-idem-key-${Date.now()}`;
    const body = JSON.stringify({
      userId,
      name: "Register Idem",
      password: "Register-idem-pass-2026",
      teamKey: "borussia-moenchengladbach",
    });
    const headers = {
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
    };

    const [firstResponse, secondResponse] = await Promise.all([
      fetch(`${baseUrl}/api/team/auth/register`, { method: "POST", headers, body }),
      fetch(`${baseUrl}/api/team/auth/register`, { method: "POST", headers, body }),
    ]);
    expect(firstResponse.status).toBe(201);
    expect(secondResponse.status).toBe(201);
    const firstPayload = await parseJsonSafe(firstResponse);
    const secondPayload = await parseJsonSafe(secondResponse);
    expect(firstPayload.user?.id).toBe(userId);
    expect(secondPayload.user?.id).toBe(userId);
  });

  it("treats same registration payload with different JSON key order as same idempotent request", async () => {
    const userId = `register-idem-order-${Date.now()}`;
    const idempotencyKey = `register-idem-order-key-${Date.now()}`;
    const headers = {
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
    };

    const firstResponse = await fetch(`${baseUrl}/api/team/auth/register`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        userId,
        name: "Register Order",
        password: "Register-order-pass-2026",
        teamKey: "borussia-moenchengladbach",
      }),
    });
    expect(firstResponse.status).toBe(201);

    const secondResponse = await fetch(`${baseUrl}/api/team/auth/register`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        teamKey: "borussia-moenchengladbach",
        password: "Register-order-pass-2026",
        name: "Register Order",
        userId,
      }),
    });
    expect(secondResponse.status).toBe(201);
    const secondPayload = await parseJsonSafe(secondResponse);
    expect(secondPayload.user?.id).toBe(userId);
  });

  it("rejects registration idempotency-key reuse with different payload", async () => {
    const userId = `register-idem-conflict-${Date.now()}`;
    const idempotencyKey = `register-idem-conflict-key-${Date.now()}`;

    const firstResponse = await fetch(`${baseUrl}/api/team/auth/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify({
        userId,
        name: "Register Conflict",
        password: "Register-conflict-pass-2026",
        teamKey: "borussia-moenchengladbach",
      }),
    });
    expect(firstResponse.status).toBe(201);

    const secondResponse = await fetch(`${baseUrl}/api/team/auth/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify({
        userId,
        name: "Register Conflict Other",
        password: "Register-conflict-pass-2026",
        teamKey: "borussia-moenchengladbach",
      }),
    });
    expect(secondResponse.status).toBe(409);
    const secondPayload = await parseJsonSafe(secondResponse);
    expect(secondPayload.ok).toBe(false);
  });

  it("rate-limits repeated invalid team login attempts", async () => {
    let lastResponse = null;
    for (let index = 0; index < 55; index += 1) {
      lastResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ userId: "user-missing-rate-limit", password: "wrong-password" }),
      });
    }

    expect(lastResponse.status).toBe(429);
    const payload = await parseJsonSafe(lastResponse);
    expect(payload.ok).toBe(false);
  });

  it("temporarily locks account after repeated invalid password attempts", async () => {
    const lockUserId = `lock-user-${Date.now()}`;
    const registerResponse = await fetch(`${baseUrl}/api/team/auth/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        userId: lockUserId,
        name: "Lock User",
        password: "Lock-user-password-2026",
        teamKey: "borussia-moenchengladbach",
      }),
    });
    expect(registerResponse.status).toBe(201);

    let lockedResponse = null;
    for (let index = 0; index < 40; index += 1) {
      lockedResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ userId: lockUserId, password: "wrong-password-lock" }),
      });
      if (lockedResponse.status === 429) {
        break;
      }
    }
    expect(lockedResponse.status).toBe(429);
    const lockedPayload = await parseJsonSafe(lockedResponse);
    expect(lockedPayload.ok).toBe(false);
    expect(String(lockedPayload.error || "")).toMatch(/gesperrt/i);

    const blockedValidLoginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: lockUserId, password: "Lock-user-password-2026" }),
    });
    expect(blockedValidLoginResponse.status).toBe(429);
  });

  it("never writes password hashes into team archive events", async () => {
    const content = await readFile(archiveFile, "utf8");
    expect(content.includes("passwordHash")).toBe(false);
  });

  it("returns recent team archive events via admin endpoint", async () => {
    const loginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: "user-coordinator", password: TEAM_TEST_PASSWORD }),
    });
    const cookie = String(loginResponse.headers.get("set-cookie") || "").split(";")[0];
    const loginPayload = await parseJsonSafe(loginResponse);

    const goalsResponse = await fetch(`${baseUrl}/api/team/goals`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
      },
      body: JSON.stringify({
        favoriteTeams: ["Archiv Probe Team"],
      }),
    });
    expect(goalsResponse.status).toBe(200);

    const response = await fetch(`${baseUrl}/api/admin/team-archive?limit=5`, {
      headers: {
        authorization: "Bearer test-token",
      },
    });
    expect(response.status).toBe(200);
    const payload = await parseJsonSafe(response);
    expect(payload.ok).toBe(true);
    expect(typeof payload.count).toBe("number");
    expect(Array.isArray(payload.events)).toBe(true);
    expect(payload.events.length).toBeGreaterThan(0);
    expect(["postgres", "ndjson"]).toContain(payload.source);
    expect(
      payload.events[0].teamState.team.accounts.every(
        (account) => !Object.prototype.hasOwnProperty.call(account, "passwordHash"),
      ),
    ).toBe(true);
  });
});
