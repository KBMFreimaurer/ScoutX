import { spawn } from "node:child_process";
import { describe, expect, it } from "vitest";

function waitForExit(child, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Timed out waiting for process exit."));
    }, timeoutMs);

    let stderr = "";
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk || "");
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on("exit", (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, stderr });
    });
  });
}

describe("adapter-service production startup guards", () => {
  it("fails startup in production when ADAPTER_TOKEN is missing", async () => {
    const child = spawn("node", ["adapter-service/server.mjs"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: "production",
        ADAPTER_TOKEN: "",
      },
      stdio: ["ignore", "ignore", "pipe"],
    });

    const result = await waitForExit(child);
    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain("ADAPTER_TOKEN ist in Produktion verpflichtend.");
  });

  it("fails startup in production when reset-token exposure is enabled", async () => {
    const child = spawn("node", ["adapter-service/server.mjs"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: "production",
        ADAPTER_TOKEN: "prod-test-token",
        ADAPTER_EXPOSE_RESET_TOKEN_ON_REQUEST: "true",
      },
      stdio: ["ignore", "ignore", "pipe"],
    });

    const result = await waitForExit(child);
    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain("ADAPTER_EXPOSE_RESET_TOKEN_ON_REQUEST=true ist in Produktion nicht erlaubt.");
  });

  it("fails startup in production when invitation-token exposure is enabled", async () => {
    const child = spawn("node", ["adapter-service/server.mjs"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: "production",
        ADAPTER_TOKEN: "prod-test-token",
        ADAPTER_EXPOSE_INVITATION_TOKEN_ON_CREATE: "true",
      },
      stdio: ["ignore", "ignore", "pipe"],
    });

    const result = await waitForExit(child);
    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain("ADAPTER_EXPOSE_INVITATION_TOKEN_ON_CREATE=true ist in Produktion nicht erlaubt.");
  });

  it("fails startup when team join allowlist is not valid JSON", async () => {
    const child = spawn("node", ["adapter-service/server.mjs"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ADAPTER_TEAM_JOIN_ALLOWLIST: "{not-json",
      },
      stdio: ["ignore", "ignore", "pipe"],
    });

    const result = await waitForExit(child);
    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain("ADAPTER_TEAM_JOIN_ALLOWLIST muss valides JSON sein.");
  });

  it("fails startup when team join allowlist uses non-array team entries", async () => {
    const child = spawn("node", ["adapter-service/server.mjs"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ADAPTER_TEAM_JOIN_ALLOWLIST: JSON.stringify({ "borussia-moenchengladbach": "user-a" }),
      },
      stdio: ["ignore", "ignore", "pipe"],
    });

    const result = await waitForExit(child);
    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain("muss ein Array sein");
  });
});
