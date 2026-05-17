import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer as createNetServer } from "node:net";
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
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Adapter health timeout: ${url}`);
}

function parseJsonSafe(response) {
  return response.json().catch(() => ({}));
}

describe("adapter-service runtime restart integration (file fallback)", () => {
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
    if (!child || child.killed) return;
    child.kill("SIGTERM");
    await new Promise((resolve) => {
      child.once("exit", () => resolve());
      setTimeout(() => resolve(), 4000);
    });
  }

  beforeAll(async () => {
    rootDir = process.cwd();
    const tempDir = await mkdtemp(join(tmpdir(), "scoutx-runtime-restart-file-test-"));
    const importsDir = join(tempDir, "imports");
    await mkdir(importsDir, { recursive: true });

    const sampleFile = join(tempDir, "games.sample.json");
    const storeFile = join(tempDir, "games.store.json");
    const teamStateFile = join(tempDir, "team-state.json");
    const archiveFile = join(tempDir, "team-state.archive.ndjson");
    const aliasesFile = join(tempDir, "aliases.json");
    const clubsFile = join(tempDir, "clubs.catalog.json");
    const runtimeStateFile = join(tempDir, "runtime-state.json");

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
      ADAPTER_EXPOSE_RESET_TOKEN_ON_REQUEST: "true",
      ADAPTER_TEAM_LOGIN_RATE_LIMIT_MAX: "2",
      ADAPTER_RUNTIME_STATE_FILE: runtimeStateFile,
      ADAPTER_SESSION_READS_FROM_DB: "true",
    };

    await startServer();
  }, 40000);

  afterAll(async () => {
    await stopServer();
  });

  it("keeps runtime state valid after restart", async () => {
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
      headers: { "content-type": "application/json", cookie, "x-csrf-token": loginPayload.csrfToken },
      body: JSON.stringify({ userId: "user-new", name: "Neu", role: "scout" }),
    });
    expect(inviteCreateResponse.status).toBe(201);
    const invitationToken = String((await parseJsonSafe(inviteCreateResponse))?.invitation?.token || "");
    expect(invitationToken).toBeTruthy();

    await stopServer();
    await startServer();

    const stateResponse = await fetch(`${baseUrl}/api/team/state`, { headers: { cookie } });
    expect(stateResponse.status).toBe(200);

    const acceptInviteResponse = await fetch(`${baseUrl}/api/team/invitations/accept`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: invitationToken, password: TEAM_TEST_PASSWORD }),
    });
    expect(acceptInviteResponse.status).toBe(201);
  });
});
