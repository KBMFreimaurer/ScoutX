import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer as createNetServer } from "node:net";
import { spawn } from "node:child_process";
import { pbkdf2Sync, randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const DATABASE_URL = String(process.env.ADAPTER_DATABASE_URL || process.env.DATABASE_URL || "").trim();
const SHOULD_RUN = Boolean(DATABASE_URL);
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

async function waitForHealth(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Adapter not ready yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Adapter health timeout: ${url}`);
}

function parseJsonSafe(response) {
  return response.json().catch(() => ({}));
}

describe.skipIf(!SHOULD_RUN)("adapter-service db sot integration", () => {
  let child = null;
  let baseUrl = "";

  beforeAll(async () => {
    const port = await allocatePort();
    const rootDir = process.cwd();
    const tempDir = await mkdtemp(join(tmpdir(), "scoutx-adapter-db-sot-test-"));
    const importsDir = join(tempDir, "imports");
    await mkdir(importsDir, { recursive: true });

    const sampleFile = join(tempDir, "games.sample.json");
    const storeFile = join(tempDir, "games.store.json");
    const teamStateFile = join(tempDir, "team-state.json");
    const archiveFile = join(tempDir, "team-state.archive.ndjson");
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
              { id: "user-admin", name: "Leitung", role: "admin", teamId: "team-scoutx", active: true, passwordHash: hashPassword(TEAM_TEST_PASSWORD) },
              { id: "user-scout", name: "Scout", role: "scout", teamId: "team-scoutx", active: true, passwordHash: hashPassword(TEAM_TEST_PASSWORD) },
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
        ADAPTER_IMPORT_DIR: importsDir,
        ADAPTER_TEAM_ARCHIVE_FILE: archiveFile,
        ADAPTER_ALIASES_FILE: aliasesFile,
        ADAPTER_CLUB_CATALOG_FILE: clubsFile,
        CORS_ORIGIN: "http://localhost:5173,http://127.0.0.1:5173",
        ADAPTER_DB_FIRST_MODE: "true",
        ADAPTER_DATABASE_URL: DATABASE_URL,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    baseUrl = `http://127.0.0.1:${port}`;
    await waitForHealth(`${baseUrl}/health`, 20000);
  }, 30000);

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

  it("reports db-first enabled in health", async () => {
    const response = await fetch(`${baseUrl}/health`);
    expect(response.status).toBe(200);
    const payload = await parseJsonSafe(response);
    expect(payload.dbFirstMode).toBe(true);
    expect(payload.dbUrlConfigured).toBe(true);
    expect(payload.dbReadModes).toMatchObject({
      auth: true,
      sessions: true,
      teamState: true,
      notifications: true,
      observations: true,
      reports: true,
      feed: true,
    });
  });

  it("reaches db-readiness ok after a team-state write", async () => {
    const loginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "user-scout", password: TEAM_TEST_PASSWORD }),
    });
    expect(loginResponse.status).toBe(200);
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
        favoriteTeams: ["MSV Duisburg U15"],
        favoriteClubs: ["MSV Duisburg"],
        leaguePriorities: ["Niederrheinliga"],
        ageGroups: ["U15"],
      }),
    });
    expect(goalsResponse.status).toBe(200);

    const readinessResponse = await fetch(`${baseUrl}/api/admin/db-readiness`, {
      headers: { authorization: "Bearer test-token" },
    });
    expect(readinessResponse.status).toBe(200);
    const readiness = await parseJsonSafe(readinessResponse);
    expect(readiness.dbFirstMode).toBe(true);
    expect(readiness.dbUrlConfigured).toBe(true);
    expect(readiness.ok).toBe(true);
    expect(readiness.probes.teamState?.ok).toBe(true);
    expect(readiness.probes.notifications?.ok).toBe(true);
    expect(readiness.probes.observations?.ok).toBe(true);
    expect(readiness.probes.reports?.ok).toBe(true);
    expect(readiness.probes.feed?.ok).toBe(true);
  });
});
