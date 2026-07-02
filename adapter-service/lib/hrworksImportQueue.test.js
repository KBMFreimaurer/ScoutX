import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHrworksImportQueue, redactHrworksText } from "./hrworksImportQueue.js";

const PAYLOAD = { planId: "plan-1", date: "2026-07-04", startTime: "09:00", endTime: "13:00", purpose: "Sichtung" };

function tempJobsFile() {
  return join(mkdtempSync(join(tmpdir(), "hrworks-queue-")), "jobs.json");
}

describe("hrworksImportQueue", () => {
  it("durchläuft queued -> running -> completed und verarbeitet seriell", async () => {
    const seen = [];
    let concurrent = 0;
    let maxConcurrent = 0;
    const queue = createHrworksImportQueue({
      jobsFile: tempJobsFile(),
      runJob: async ({ job }) => {
        concurrent += 1;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        seen.push(queue.getJob(job.id).status);
        await new Promise((resolve) => setTimeout(resolve, 10));
        concurrent -= 1;
        return { status: "completed", summary: "ok" };
      },
    });

    const first = queue.enqueue({ planId: "plan-1", payloads: [PAYLOAD], credentials: { username: "u", password: "p" } });
    const second = queue.enqueue({ planId: "plan-2", payloads: [PAYLOAD], credentials: { username: "u", password: "p" } });
    expect(first.status).toBe("queued");
    await queue.idle();

    expect(queue.getJob(first.id).status).toBe("completed");
    expect(queue.getJob(second.id).status).toBe("completed");
    expect(seen).toEqual(["running", "running"]);
    expect(maxConcurrent).toBe(1);
  });

  it("persistiert Jobs ohne Credentials und redigiert Fehler", async () => {
    const jobsFile = tempJobsFile();
    const queue = createHrworksImportQueue({
      jobsFile,
      runJob: async () => {
        throw new Error("Login fehlgeschlagen: password=super-geheim token=abc123def456ghi789jkl012mno345");
      },
    });
    const job = queue.enqueue({
      planId: "plan-1",
      payloads: [PAYLOAD],
      credentials: { username: "scout@example.com", password: "super-geheim" },
    });
    await queue.idle();

    const failed = queue.getJob(job.id);
    expect(failed.status).toBe("failed");
    expect(failed.error).toContain("[redacted]");
    expect(failed.error).not.toContain("super-geheim");

    const persisted = readFileSync(jobsFile, "utf-8");
    expect(persisted).not.toContain("super-geheim");
    expect(persisted).not.toContain("scout@example.com:");
    expect(JSON.parse(persisted).jobs.some((entry) => entry.id === job.id)).toBe(true);
  });

  it("setzt needs_action ohne Retry bei Auth-/MFA-Problemen", async () => {
    let attempts = 0;
    const queue = createHrworksImportQueue({
      jobsFile: tempJobsFile(),
      runJob: async () => {
        attempts += 1;
        return { status: "needs_action", message: "MFA erforderlich." };
      },
    });
    const job = queue.enqueue({ planId: "p", payloads: [PAYLOAD], credentials: { username: "u", password: "p" } });
    await queue.idle();
    expect(queue.getJob(job.id).status).toBe("needs_action");
    expect(attempts).toBe(1);
  });

  it("markiert unterbrochene Jobs nach Neustart als interrupted", async () => {
    const jobsFile = tempJobsFile();
    const queue = createHrworksImportQueue({
      jobsFile,
      runJob: () => new Promise(() => {}),
    });
    queue.enqueue({ planId: "p", payloads: [PAYLOAD], credentials: { username: "u", password: "p" } });
    await new Promise((resolve) => setTimeout(resolve, 20));

    const restarted = createHrworksImportQueue({ jobsFile, runJob: async () => ({ status: "completed" }) });
    const jobs = restarted.listJobs();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].status).toBe("interrupted");
  });

  it("kann wartende Jobs abbrechen", async () => {
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const queue = createHrworksImportQueue({
      jobsFile: tempJobsFile(),
      runJob: async () => {
        await gate;
        return { status: "completed" };
      },
    });
    const running = queue.enqueue({ planId: "a", payloads: [PAYLOAD], credentials: { username: "u", password: "p" } });
    const waiting = queue.enqueue({ planId: "b", payloads: [PAYLOAD], credentials: { username: "u", password: "p" } });
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(queue.cancelJob(waiting.id)?.status).toBe("cancelled");
    expect(queue.cancelJob(running.id)).toBeNull();
    release();
    await queue.idle();
    expect(queue.getJob(running.id).status).toBe("completed");
    expect(queue.getJob(waiting.id).status).toBe("cancelled");
  });
});

describe("redactHrworksText", () => {
  it("entfernt Passwörter und Tokens", () => {
    const redacted = redactHrworksText("Fehler passwort: geheim123 bei bearer abcdefghijklmnopqrstuvwx");
    expect(redacted).not.toContain("geheim123");
    expect(redacted).not.toContain("abcdefghijklmnopqrstuvwx");
  });
});
