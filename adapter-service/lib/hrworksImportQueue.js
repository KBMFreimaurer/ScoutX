// Serielle Queue für serverseitige HRworks-Importjobs.
// Jobstatus wird als JSON persistiert; HRworks-Credentials bleiben ausschließlich
// im Arbeitsspeicher und werden nach Jobende sofort verworfen.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

export const HRWORKS_JOB_STATUSES = ["queued", "running", "needs_action", "completed", "failed", "interrupted", "cancelled"];

export function redactHrworksText(value) {
  return String(value || "")
    .replace(/(password\s*[=:]\s*)(\S+)/gi, "$1[redacted]")
    .replace(/(passwort\s*[=:]\s*)(\S+)/gi, "$1[redacted]")
    .replace(/(bearer\s+)([a-z0-9._~+/=-]+)/gi, "$1[redacted]")
    .replace(/(token\s*[=:]\s*)(\S+)/gi, "$1[redacted]")
    .replace(/\b[a-z0-9._~+/=-]{24,}\b/gi, "[redacted]")
    .slice(0, 400)
    .trim();
}

function loadPersistedJobs(jobsFile, logger) {
  if (!existsSync(jobsFile)) {
    return [];
  }
  try {
    const parsed = JSON.parse(readFileSync(jobsFile, "utf-8"));
    return Array.isArray(parsed?.jobs) ? parsed.jobs : [];
  } catch (error) {
    logger?.warn?.("hrworks jobs file unreadable, starting empty", { error: String(error?.message || error) });
    return [];
  }
}

export function createHrworksImportQueue({ jobsFile, runJob, logger = console, now = () => new Date().toISOString(), maxJobs = 200 }) {
  const jobs = new Map();
  // Credentials nur im Arbeitsspeicher, nie im Job-Objekt oder der JSON-Datei.
  const credentialsByJobId = new Map();
  const payloadsByJobId = new Map();
  let chain = Promise.resolve();

  for (const job of loadPersistedJobs(jobsFile, logger)) {
    if (!job?.id) {
      continue;
    }
    // Nach einem Neustart können queued/running Jobs nicht fortgesetzt werden:
    // Credentials lagen nur im RAM des alten Prozesses.
    if (job.status === "queued" || job.status === "running") {
      job.status = "interrupted";
      job.error = "Server wurde neu gestartet. Bitte Importauftrag erneut starten.";
      job.updatedAt = now();
    }
    jobs.set(job.id, job);
  }

  function persist() {
    try {
      mkdirSync(dirname(jobsFile), { recursive: true });
      const snapshot = { jobs: [...jobs.values()].slice(-maxJobs) };
      const tmpFile = `${jobsFile}.tmp`;
      writeFileSync(tmpFile, JSON.stringify(snapshot, null, 2));
      renameSync(tmpFile, jobsFile);
    } catch (error) {
      logger?.warn?.("hrworks jobs file not writable", { error: String(error?.message || error) });
    }
  }
  persist();

  function update(jobId, patch) {
    const job = jobs.get(jobId);
    if (!job) {
      return null;
    }
    Object.assign(job, patch, { updatedAt: now() });
    persist();
    return job;
  }

  function publicJob(job) {
    if (!job) {
      return null;
    }
    // Defensive Kopie ohne interne Felder; Credentials sind hier nie enthalten.
    return { ...job };
  }

  async function process(jobId) {
    const job = jobs.get(jobId);
    if (!job || job.status !== "queued") {
      return;
    }
    const credentials = credentialsByJobId.get(jobId) || null;
    const payloads = payloadsByJobId.get(jobId) || [];
    update(jobId, { status: "running", startedAt: now(), attempts: Number(job.attempts || 0) + 1 });
    try {
      const result = await runJob({ job: publicJob(job), payloads, credentials });
      if (result?.status === "needs_action") {
        update(jobId, { status: "needs_action", error: redactHrworksText(result?.message || "Manuelle Aktion in HRworks erforderlich.") });
      } else {
        update(jobId, {
          status: "completed",
          error: "",
          resultSummary: redactHrworksText(result?.summary || `Import abgeschlossen (${payloads.length} Tag(e)).`),
          finishedAt: now(),
        });
      }
    } catch (error) {
      const kind = String(error?.kind || "");
      update(jobId, {
        status: kind === "needs_action" ? "needs_action" : "failed",
        error: redactHrworksText(error?.message || "HRworks-Import fehlgeschlagen."),
        finishedAt: now(),
      });
    } finally {
      credentialsByJobId.delete(jobId);
      payloadsByJobId.delete(jobId);
    }
  }

  return {
    enqueue({ planId, employeeName, payloads, credentials, xlsxFile, xlsxMeta }) {
      const id = randomUUID();
      const createdAt = now();
      const job = {
        id,
        status: "queued",
        planId: String(planId || "").trim(),
        employeeName: String(employeeName || "").trim(),
        payloadCount: Array.isArray(payloads) ? payloads.length : 0,
        dates: (Array.isArray(payloads) ? payloads : []).map((payload) => String(payload?.date || "")).filter(Boolean),
        xlsxFile: String(xlsxFile || ""),
        xlsxMeta: xlsxMeta || null,
        attempts: 0,
        error: "",
        resultSummary: "",
        createdAt,
        updatedAt: createdAt,
      };
      jobs.set(id, job);
      credentialsByJobId.set(id, credentials || null);
      payloadsByJobId.set(id, Array.isArray(payloads) ? payloads : []);
      persist();
      // Seriell: ein Worker, damit HRworks-Logins nicht parallel kollidieren.
      chain = chain.then(() => process(id)).catch(() => {});
      return publicJob(job);
    },
    getJob(jobId) {
      return publicJob(jobs.get(String(jobId || "")));
    },
    listJobs(limit = 50) {
      return [...jobs.values()]
        .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
        .slice(0, Math.max(1, limit))
        .map(publicJob);
    },
    cancelJob(jobId) {
      const job = jobs.get(String(jobId || ""));
      if (!job || job.status !== "queued") {
        return null;
      }
      credentialsByJobId.delete(job.id);
      payloadsByJobId.delete(job.id);
      return publicJob(update(job.id, { status: "cancelled", error: "" }));
    },
    // Für Tests: wartet bis alle bisher eingereihten Jobs verarbeitet sind.
    async idle() {
      await chain;
    },
  };
}
