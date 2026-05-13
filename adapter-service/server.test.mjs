import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
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
    const teamStateFile = join(tempDir, "team-state.json");
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
              { id: "user-coordinator", name: "Koordination", role: "coordinator", teamId: "team-scoutx", active: true, passwordHash: hashPassword(TEAM_TEST_PASSWORD) },
              { id: "user-scout", name: "Scout", role: "scout", teamId: "team-scoutx", active: true, passwordHash: hashPassword(TEAM_TEST_PASSWORD) },
              { id: "user-scout-b", name: "Scout B", role: "scout", teamId: "team-scoutx", active: true, passwordHash: hashPassword(TEAM_TEST_PASSWORD) },
              { id: "user-readonly", name: "Gast", role: "readonly", teamId: "team-scoutx", active: true, passwordHash: hashPassword(TEAM_TEST_PASSWORD) },
              { id: "user-outsider", name: "Extern", role: "admin", teamId: "team-other", active: true, passwordHash: hashPassword(TEAM_TEST_PASSWORD) },
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
        ADAPTER_AUTO_REFRESH_WEEK: "false",
        ADAPTER_EXPORT_COMMAND: "",
        ADAPTER_DATA_FILE: sampleFile,
        ADAPTER_STORE_FILE: storeFile,
        ADAPTER_TEAM_STATE_FILE: teamStateFile,
        ADAPTER_TEAM_LOGIN_RATE_LIMIT_MAX: "50",
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
    expect(response.headers.get("x-request-id")).toBeTruthy();
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

  it("protects verband-status endpoint with auth", async () => {
    const response = await fetch(`${baseUrl}/api/admin/verband-status`);
    expect(response.status).toBe(401);
    const payload = await parseJsonSafe(response);
    expect(payload.ok).toBe(false);
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
    expect(loginPayload.team.accounts.every((account) => !Object.prototype.hasOwnProperty.call(account, "passwordHash"))).toBe(true);
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
    expect(statePayload.csrfToken).toBeUndefined();
    expect(statePayload.team.accounts.every((account) => !Object.prototype.hasOwnProperty.call(account, "passwordHash"))).toBe(true);
    expect(statePayload.observations).toEqual([]);
    expect(statePayload.feedItems).toEqual([]);
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
        password: "very-secure-password",
        teamKey: "borussia-moenchengladbach",
      }),
    });

    expect(registerResponse.status).toBe(201);
    const payload = await parseJsonSafe(registerResponse);
    expect(payload.ok).toBe(true);
    expect(payload.user).toMatchObject({ id: "new-scout", role: "scout", teamId: "team-scoutx" });
    expect(payload.team).toMatchObject({ id: "team-scoutx" });
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
        password: "very-secure-password",
        teamKey: "other-team",
      }),
    });

    expect(registerResponse.status).toBe(400);
    const payload = await parseJsonSafe(registerResponse);
    expect(payload.ok).toBe(false);
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
    expect(statePayload.observations).toHaveLength(1);
    expect(statePayload.observations[0].status).toBe("seen");
    expect(statePayload.feedItems.map((item) => item.type)).toEqual(["game_seen", "plan_published"]);
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
});
