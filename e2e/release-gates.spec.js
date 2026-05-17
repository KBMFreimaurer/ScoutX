import { expect, test } from "@playwright/test";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { pbkdf2Sync, randomBytes } from "node:crypto";

const DATABASE_URL = String(process.env.ADAPTER_DATABASE_URL || process.env.DATABASE_URL || "").trim();
const SHOULD_RUN = Boolean(DATABASE_URL);
const TEAM_TEST_PASSWORD = "ScoutX-test-pass-2026";

function hashPassword(password) {
  const salt = randomBytes(16).toString("base64url");
  const iterations = 100000;
  const hash = pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("base64url");
  return `pbkdf2-sha256$${iterations}$${salt}$${hash}`;
}

function resolveTestPort() {
  const explicit = Number(process.env.SCOUTX_RELEASE_E2E_PORT || 18787);
  if (!Number.isFinite(explicit) || explicit < 1024 || explicit > 65535) {
    return 18787;
  }
  return explicit;
}

async function waitForHealth(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch (error) {
      void error;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Adapter health timeout: ${url}`);
}

function parseJsonSafe(response) {
  return response.json().catch(() => ({}));
}

function extractCookie(response) {
  return String(response.headers()["set-cookie"] || "").split(";")[0];
}

const describeRelease = SHOULD_RUN ? test.describe : test.describe.skip;

describeRelease("release gates - db-first backend lifecycle", () => {
  let child = null;
  let baseUrl = "";
  let rootDir = "";
  let env = {};
  let childStdout = "";
  let childStderr = "";

  function appendChunk(target, chunk) {
    const text = String(chunk || "");
    const next = `${target}${text}`;
    if (next.length <= 6000) {
      return next;
    }
    return next.slice(next.length - 6000);
  }

  async function startServer() {
    const port = resolveTestPort();
    child = spawn("node", ["adapter-service/server.mjs"], {
      cwd: rootDir,
      env: {
        ...process.env,
        ...env,
        ADAPTER_PORT: String(port),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    childStdout = "";
    childStderr = "";
    child.stdout?.on("data", (chunk) => {
      childStdout = appendChunk(childStdout, chunk);
    });
    child.stderr?.on("data", (chunk) => {
      childStderr = appendChunk(childStderr, chunk);
    });
    baseUrl = `http://127.0.0.1:${port}`;
    try {
      await waitForHealth(`${baseUrl}/health`, 25000);
    } catch (error) {
      const exitCode = child.exitCode;
      const signalCode = child.signalCode;
      const stdoutLog = childStdout.trim() || "<empty>";
      const stderrLog = childStderr.trim() || "<empty>";
      const reason = [
        `Failed to start adapter on ${baseUrl}`,
        `exitCode=${exitCode ?? "null"} signal=${signalCode ?? "null"}`,
        `stdout_tail:\n${stdoutLog}`,
        `stderr_tail:\n${stderrLog}`,
      ].join("\n\n");
      throw new Error(`${error instanceof Error ? error.message : String(error)}\n\n${reason}`);
    }
  }

  async function stopServer() {
    if (!child || child.killed) {
      return;
    }
    child.kill("SIGTERM");
    await new Promise((resolve) => {
      child.once("exit", () => resolve());
      setTimeout(() => resolve(), 4000);
    });
  }

  test.beforeAll(async () => {
    rootDir = process.cwd();
    const tempDir = await mkdtemp(join(tmpdir(), "scoutx-release-gates-db-first-"));
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

    env = {
      ADAPTER_HOST: "127.0.0.1",
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
      ADAPTER_SESSION_READS_FROM_DB: "true",
      ADAPTER_AUTH_READS_FROM_DB: "true",
      ADAPTER_NOTIFICATIONS_READS_FROM_DB: "true",
      ADAPTER_OBSERVATIONS_READS_FROM_DB: "true",
      ADAPTER_REPORTS_READS_FROM_DB: "true",
      ADAPTER_FEED_READS_FROM_DB: "true",
    };

    await startServer();
  }, 45000);

  test.afterAll(async () => {
    await stopServer();
  });

  test("runs db-first release lifecycle via backend login without localStorage seeding", async ({ request }) => {
    const loginResponse = await request.post(`${baseUrl}/api/team/auth/login`, {
      data: { userId: "user-scout", password: TEAM_TEST_PASSWORD },
    });
    expect(loginResponse.status()).toBe(200);
    const loginPayload = await parseJsonSafe(loginResponse);
    const cookie = extractCookie(loginResponse);
    expect(cookie).toContain("scoutx_session=");
    expect(loginPayload?.csrfToken).toBeTruthy();

    const publishResponse = await request.post(`${baseUrl}/api/team/plans`, {
      headers: {
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
      },
      data: {
        planHistoryId: `release-plan-${Date.now()}`,
        games: [
          {
            id: `release-game-${Date.now()}`,
            home: "Team A",
            away: "Team B",
            date: "2026-05-14",
            time: "18:00",
            venue: "Platz 1",
            status: "scheduled",
          },
        ],
      },
    });
    expect(publishResponse.status()).toBe(200);
    const publishPayload = await parseJsonSafe(publishResponse);
    expect(Array.isArray(publishPayload?.observations)).toBe(true);
    expect(publishPayload.observations.length).toBeGreaterThan(0);
    const observationId = String(publishPayload.observations[0]?.id || "");
    const gameId = String(publishPayload.observations[0]?.gameId || "");
    expect(observationId).toBeTruthy();
    expect(gameId).toBeTruthy();

    const seenResponse = await request.post(`${baseUrl}/api/team/observations/seen`, {
      headers: {
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
      },
      data: { gameId },
    });
    expect(seenResponse.status()).toBe(200);

    const reportResponse = await request.post(`${baseUrl}/api/team/observations/report`, {
      headers: {
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
      },
      data: {
        observationId,
        reportId: `release-report-${Date.now()}`,
        reportUrl: "#release-report",
      },
    });
    expect(reportResponse.status()).toBe(200);

    const noteResponse = await request.post(`${baseUrl}/api/team/observations/note`, {
      headers: {
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
      },
      data: {
        observationId,
        note: "Release E2E follow-up note",
      },
    });
    expect(noteResponse.status()).toBe(200);

    const notificationsResponse = await request.get(`${baseUrl}/api/team/notifications?status=unread`, {
      headers: { cookie },
    });
    expect(notificationsResponse.status()).toBe(200);
    const notificationsPayload = await parseJsonSafe(notificationsResponse);
    expect(Array.isArray(notificationsPayload?.notifications)).toBe(true);
    expect(notificationsPayload.notifications.length).toBeGreaterThan(0);

    const auditResponse = await request.get(`${baseUrl}/api/team/audit-log?actorId=user-scout&limit=20`, {
      headers: { cookie },
    });
    expect(auditResponse.status()).toBe(200);
    const auditPayload = await parseJsonSafe(auditResponse);
    expect(Array.isArray(auditPayload?.entries)).toBe(true);
    expect(auditPayload.entries.some((item) => String(item?.action || "").includes("plan"))).toBe(true);

    const readinessResponse = await request.get(`${baseUrl}/api/admin/db-readiness`, {
      headers: {
        authorization: "Bearer test-token",
      },
    });
    expect(readinessResponse.status()).toBe(200);
    const readinessPayload = await parseJsonSafe(readinessResponse);
    expect(readinessPayload.dbFirstMode).toBe(true);
    expect(readinessPayload.dbUrlConfigured).toBe(true);
    expect(readinessPayload.ok).toBe(true);
  });
});
