import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer as createNetServer } from "node:net";
import { createServer as createHttpServer } from "node:http";
import { generateKeyPairSync, pbkdf2Sync, randomBytes, sign as cryptoSign } from "node:crypto";
import { spawn } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const TEAM_TEST_PASSWORD = "ScoutX-test-pass-2026";
const LOGTO_APP_ID = "scoutx-app";

const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "logto-test-key", alg: "ES256", use: "sig" };

function hashPassword(password) {
  const salt = randomBytes(16).toString("base64url");
  const iterations = 100000;
  const hash = pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("base64url");
  return `pbkdf2-sha256$${iterations}$${salt}$${hash}`;
}

function signIdToken(logtoEndpoint, claims) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const fullClaims = {
    iss: `${logtoEndpoint}/oidc`,
    aud: LOGTO_APP_ID,
    exp: Math.floor(Date.now() / 1000) + 300,
    ...claims,
  };
  const data = `${encode({ alg: "ES256", kid: "logto-test-key" })}.${encode(fullClaims)}`;
  const signature = cryptoSign("sha256", Buffer.from(data), { key: privateKey, dsaEncoding: "ieee-p1363" });
  return `${data}.${signature.toString("base64url")}`;
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
      // Adapter noch nicht bereit.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Adapter health timeout: ${url}`);
}

function parseJsonSafe(response) {
  return response.json().catch(() => ({}));
}

describe("adapter-service Logto invite-only auth", () => {
  let child = null;
  let baseUrl = "";
  let logtoStub = null;
  let logtoEndpoint = "";
  let adminCookie = "";
  let adminCsrf = "";

  async function createInvitation(body) {
    return fetch(`${baseUrl}/api/team/invitations/create`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: adminCookie, "x-csrf-token": adminCsrf },
      body: JSON.stringify(body),
    });
  }

  beforeAll(async () => {
    const port = await allocatePort();
    const logtoPort = await allocatePort();
    const tempDir = await mkdtemp(join(tmpdir(), "scoutx-logto-test-"));
    const importsDir = join(tempDir, "imports");
    await mkdir(importsDir, { recursive: true });
    const sampleFile = join(tempDir, "games.sample.json");
    const storeFile = join(tempDir, "games.store.json");
    const teamStateFile = join(tempDir, "team-state.json");
    await writeFile(sampleFile, "[]", "utf8");
    await writeFile(
      teamStateFile,
      JSON.stringify({
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
          ],
        },
        manualGames: [],
        teamGoals: { favoriteTeams: [], favoriteClubs: [], leaguePriorities: [], ageGroups: [] },
        observations: [],
        feedItems: [],
      }),
      "utf8",
    );

    logtoStub = createHttpServer((req, res) => {
      if (String(req.url || "").startsWith("/oidc/jwks")) {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ keys: [jwk] }));
        return;
      }
      res.writeHead(404);
      res.end();
    });
    await new Promise((resolve, reject) => {
      logtoStub.once("error", reject);
      logtoStub.listen(logtoPort, "127.0.0.1", () => resolve());
    });
    logtoEndpoint = `http://127.0.0.1:${logtoPort}`;

    child = spawn("node", ["adapter-service/server.mjs"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ADAPTER_HOST: "127.0.0.1",
        ADAPTER_PORT: String(port),
        ADAPTER_TOKEN: "test-token",
        ADAPTER_RATE_LIMIT_MAX: "500",
        ADAPTER_TEAM_LOGIN_RATE_LIMIT_MAX: "100",
        ADAPTER_AUTO_REFRESH_WEEK: "false",
        ADAPTER_EXPORT_COMMAND: "",
        ADAPTER_DATA_FILE: sampleFile,
        ADAPTER_STORE_FILE: storeFile,
        ADAPTER_TEAM_STATE_FILE: teamStateFile,
        ADAPTER_TEAM_ARCHIVE_FILE: join(tempDir, "team-state.archive.ndjson"),
        ADAPTER_IMPORT_DIR: importsDir,
        ADAPTER_LOGTO_ENDPOINT: logtoEndpoint,
        ADAPTER_LOGTO_APP_ID: LOGTO_APP_ID,
        CORS_ORIGIN: "http://localhost:5173",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    baseUrl = `http://127.0.0.1:${port}`;
    await waitForHealth(`${baseUrl}/health`);

    const adminLogin = await fetch(`${baseUrl}/api/team/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "user-admin", password: TEAM_TEST_PASSWORD }),
    });
    expect(adminLogin.status).toBe(200);
    adminCookie = String(adminLogin.headers.get("set-cookie") || "").split(";")[0];
    adminCsrf = (await parseJsonSafe(adminLogin)).csrfToken;
  }, 30000);

  afterAll(async () => {
    if (logtoStub) {
      await new Promise((resolve) => logtoStub.close(() => resolve()));
    }
    if (child && !child.killed) {
      child.kill("SIGTERM");
      await new Promise((resolve) => {
        child.once("exit", () => resolve());
        setTimeout(() => resolve(), 3000);
      });
    }
  });

  it("blocks free registration", async () => {
    const response = await fetch(`${baseUrl}/api/team/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        userId: "free-rider",
        name: "Free Rider",
        password: "Sneaky-pass-2026",
        teamKey: "borussia-moenchengladbach",
      }),
    });
    expect(response.status).toBe(403);
    const payload = await parseJsonSafe(response);
    expect(payload.code).toBe("registration_disabled");
  });

  it("requires an email when creating invitations", async () => {
    const response = await createInvitation({ userId: "invite-no-mail", name: "Ohne Mail", role: "scout" });
    expect(response.status).toBe(400);
  });

  it("rejects invitation accept without Logto login", async () => {
    const createResponse = await createInvitation({
      userId: "invite-scout-a",
      name: "Scout A",
      role: "scout",
      email: "scout-a@example.com",
    });
    expect(createResponse.status).toBe(201);
    const { invitation } = await parseJsonSafe(createResponse);

    const acceptResponse = await fetch(`${baseUrl}/api/team/invitations/accept`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: invitation.token, password: "Some-password-2026" }),
    });
    expect(acceptResponse.status).toBe(401);
  });

  it("rejects accept with mismatching email and keeps the invitation usable", async () => {
    const createResponse = await createInvitation({
      userId: "invite-scout-b",
      name: "Scout B",
      role: "scout",
      email: "scout-b@example.com",
    });
    expect(createResponse.status).toBe(201);
    const { invitation } = await parseJsonSafe(createResponse);

    const wrongToken = signIdToken(logtoEndpoint, { sub: "logto-wrong", email: "someone-else@example.com" });
    const wrongResponse = await fetch(`${baseUrl}/api/team/invitations/accept`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: invitation.token, idToken: wrongToken }),
    });
    expect(wrongResponse.status).toBe(403);

    const rightToken = signIdToken(logtoEndpoint, { sub: "logto-scout-b", email: "scout-b@example.com" });
    const rightResponse = await fetch(`${baseUrl}/api/team/invitations/accept`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: invitation.token, idToken: rightToken }),
    });
    expect(rightResponse.status).toBe(201);
  });

  it("accepts an invitation exactly once and enables Logto login", async () => {
    const createResponse = await createInvitation({
      userId: "invite-scout-c",
      name: "Scout C",
      role: "scout",
      email: "scout-c@example.com",
    });
    expect(createResponse.status).toBe(201);
    const { invitation } = await parseJsonSafe(createResponse);
    const idToken = signIdToken(logtoEndpoint, { sub: "logto-scout-c", email: "scout-c@example.com", name: "Scout C" });

    const acceptResponse = await fetch(`${baseUrl}/api/team/invitations/accept`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: invitation.token, idToken }),
    });
    expect(acceptResponse.status).toBe(201);
    const accepted = await parseJsonSafe(acceptResponse);
    expect(accepted.user).toMatchObject({ id: "invite-scout-c", role: "scout", active: true });

    const replayResponse = await fetch(`${baseUrl}/api/team/invitations/accept`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: invitation.token, idToken }),
    });
    expect(replayResponse.status).toBe(404);

    const logtoLogin = await fetch(`${baseUrl}/api/team/auth/logto`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    expect(logtoLogin.status).toBe(200);
    const loginPayload = await parseJsonSafe(logtoLogin);
    expect(loginPayload.user).toMatchObject({ id: "invite-scout-c" });
    expect(String(logtoLogin.headers.get("set-cookie") || "")).toContain("scoutx_session=");
  });

  it("rejects Logto identities with unverified email", async () => {
    const unverifiedToken = signIdToken(logtoEndpoint, {
      sub: "logto-scout-c",
      email: "scout-c@example.com",
      email_verified: false,
    });
    const response = await fetch(`${baseUrl}/api/team/auth/logto`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idToken: unverifiedToken }),
    });
    expect(response.status).toBe(403);
  });

  it("rejects Logto logins without team membership and forged tokens", async () => {
    const strangerToken = signIdToken(logtoEndpoint, { sub: "logto-stranger", email: "stranger@example.com" });
    const strangerResponse = await fetch(`${baseUrl}/api/team/auth/logto`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idToken: strangerToken }),
    });
    expect(strangerResponse.status).toBe(403);

    const [header, , signature] = strangerToken.split(".");
    const forgedClaims = Buffer.from(
      JSON.stringify({
        iss: `${logtoEndpoint}/oidc`,
        aud: LOGTO_APP_ID,
        exp: Math.floor(Date.now() / 1000) + 300,
        sub: "logto-scout-c",
        email: "scout-c@example.com",
      }),
    ).toString("base64url");
    const forgedResponse = await fetch(`${baseUrl}/api/team/auth/logto`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idToken: `${header}.${forgedClaims}.${signature}` }),
    });
    expect(forgedResponse.status).toBe(401);
  });
});
