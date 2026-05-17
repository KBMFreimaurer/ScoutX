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
      resolve(typeof address === "object" && address ? address.port : 0);
      server.close();
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
      // booting
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Adapter health timeout: ${url}`);
}

function parseJsonSafe(response) {
  return response.json().catch(() => ({}));
}

describe.skipIf(!SHOULD_RUN)("adapter-service runtime restart integration", () => {
  let child = null;
  let baseUrl = "";
  let rootDir = "";
  let env = {};

  async function startServer() {
    const port = await allocatePort();
    child = spawn("node", ["adapter-service/server.mjs"], {
      cwd: rootDir,
      env: {
        ...process.env,
        ...env,
        ADAPTER_PORT: String(port),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    baseUrl = `http://127.0.0.1:${port}`;
    await waitForHealth(`${baseUrl}/health`, 25000);
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

  beforeAll(async () => {
    rootDir = process.cwd();
    const tempDir = await mkdtemp(join(tmpdir(), "scoutx-runtime-restart-test-"));
    const importsDir = join(tempDir, "imports");
    await mkdir(importsDir, { recursive: true });

    const sampleFile = join(tempDir, "games.sample.json");
    const storeFile = join(tempDir, "games.store.json");
    const teamStateFile = join(tempDir, "team-state.json");
    const archiveFile = join(tempDir, "team-state.archive.ndjson");
    const aliasesFile = join(tempDir, "aliases.json");
    const clubsFile = join(tempDir, "clubs.catalog.json");

    await writeFile(sampleFile, JSON.stringify([], null, 2), "utf8");
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
      ADAPTER_EXPOSE_RESET_TOKEN_ON_REQUEST: "true",
      ADAPTER_TEAM_LOGIN_RATE_LIMIT_MAX: "2",
    };

    await startServer();
  }, 40000);

  afterAll(async () => {
    await stopServer();
  });

  it("keeps runtime session valid after restart", async () => {
    const loginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "user-scout", password: TEAM_TEST_PASSWORD }),
    });
    expect(loginResponse.status).toBe(200);
    const cookie = String(loginResponse.headers.get("set-cookie") || "").split(";")[0];

    await stopServer();
    await startServer();

    const stateResponse = await fetch(`${baseUrl}/api/team/state`, {
      headers: { cookie },
    });
    expect(stateResponse.status).toBe(200);
  });

  it("keeps invitation and password reset tokens valid after restart", async () => {
    const loginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "user-admin", password: TEAM_TEST_PASSWORD }),
    });
    expect(loginResponse.status).toBe(200);
    const cookie = String(loginResponse.headers.get("set-cookie") || "").split(";")[0];
    const loginPayload = await parseJsonSafe(loginResponse);

    const inviteCreateResponse = await fetch(`${baseUrl}/api/team/invitations/create`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-csrf-token": loginPayload.csrfToken,
      },
      body: JSON.stringify({ userId: "user-new", name: "Neu", role: "scout" }),
    });
    expect(inviteCreateResponse.status).toBe(201);
    const inviteCreatePayload = await parseJsonSafe(inviteCreateResponse);
    const invitationToken = String(inviteCreatePayload?.invitation?.token || "");
    expect(invitationToken).toBeTruthy();

    const resetRequestResponse = await fetch(`${baseUrl}/api/team/auth/password-reset/request`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: "user-scout" }),
    });
    expect(resetRequestResponse.status).toBe(200);
    const resetRequestPayload = await parseJsonSafe(resetRequestResponse);
    const resetToken = String(resetRequestPayload?.reset?.token || "");
    expect(resetToken).toBeTruthy();

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
        extractedText: "10.08.2026 11:00 Borussia MG U15 - MSV Duisburg U15 | Sportpark Nord",
      }),
    });
    expect(previewResponse.status).toBe(200);
    const previewPayload = await parseJsonSafe(previewResponse);
    const previewToken = String(previewPayload?.previewToken || "");
    expect(previewToken).toBeTruthy();

    await stopServer();
    await startServer();

    const acceptInviteResponse = await fetch(`${baseUrl}/api/team/invitations/accept`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: invitationToken, password: TEAM_TEST_PASSWORD }),
    });
    expect(acceptInviteResponse.status).toBe(201);

    const resetConfirmResponse = await fetch(`${baseUrl}/api/team/auth/password-reset/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: resetToken, password: "ScoutX-reset-pass-2026" }),
    });
    expect(resetConfirmResponse.status).toBe(200);

    const reloginResponse = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "user-admin", password: TEAM_TEST_PASSWORD }),
    });
    expect(reloginResponse.status).toBe(200);
    const reloginCookie = String(reloginResponse.headers.get("set-cookie") || "").split(";")[0];
    const reloginPayload = await parseJsonSafe(reloginResponse);

    const confirmPreviewResponse = await fetch(`${baseUrl}/api/team/import/kreis-pdf`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: reloginCookie,
        "x-csrf-token": reloginPayload.csrfToken,
      },
      body: JSON.stringify({ mode: "confirm", previewToken }),
    });
    expect(confirmPreviewResponse.status).toBe(200);
    const confirmPreviewPayload = await parseJsonSafe(confirmPreviewResponse);
    expect(confirmPreviewPayload.importedCount).toBe(1);
  });

  it("applies login rate-limit across restart", async () => {
    const badLoginBody = JSON.stringify({ userId: "user-scout", password: "wrong-password" });
    const first = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: badLoginBody,
    });
    expect(first.status).toBe(401);
    const second = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: badLoginBody,
    });
    expect(second.status).toBe(401);

    await stopServer();
    await startServer();

    const third = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: badLoginBody,
    });
    expect(third.status).toBe(429);
  });
});
