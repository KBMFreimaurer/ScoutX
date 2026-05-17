export function createJobRegistry() {
  const jobs = new Map();
  let sequence = 0;

  function nextJobId() {
    sequence += 1;
    return `job-${Date.now()}-${sequence}`;
  }

  function ensureJob(name, category = "general") {
    const key = String(name || "").trim() || "unknown";
    if (!jobs.has(key)) {
      jobs.set(key, {
        name: key,
        category: String(category || "general"),
        jobId: "",
        correlationId: "",
        status: "idle",
        attempts: 0,
        retries: 0,
        runCount: 0,
        lastStartedAt: "",
        lastFinishedAt: "",
        lastDurationMs: 0,
        lastError: "",
      });
    }
    const job = jobs.get(key);
    job.category = String(category || job.category || "general");
    return jobs.get(key);
  }

  async function runJob(name, runner, options = {}, logger = null) {
    const category = String(options?.category || "general");
    const correlationId = String(options?.correlationId || "").trim() || `corr-${Date.now()}`;
    const job = ensureJob(name, category);
    const retries = Math.max(0, Number(options?.retries) || 0);
    const backoffMs = Math.max(0, Number(options?.backoffMs) || 0);
    job.jobId = nextJobId();
    job.correlationId = correlationId;
    job.status = "running";
    job.attempts = 0;
    job.retries = retries;
    job.runCount = Number(job.runCount || 0) + 1;
    job.lastStartedAt = new Date().toISOString();
    job.lastError = "";
    const startedMs = Date.now();

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      job.attempts = attempt + 1;
      try {
        const result = await runner();
        job.status = "success";
        job.lastFinishedAt = new Date().toISOString();
        job.lastDurationMs = Date.now() - startedMs;
        return result;
      } catch (error) {
        job.lastError = String(error?.message || error || "unknown error");
        if (attempt >= retries) {
          job.status = "failed";
          job.lastFinishedAt = new Date().toISOString();
          job.lastDurationMs = Date.now() - startedMs;
          throw error;
        }
        logger?.warn?.("job attempt failed", {
          name: job.name,
          category: job.category,
          jobId: job.jobId,
          correlationId: job.correlationId,
          attempt: attempt + 1,
          error,
        });
        if (backoffMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, backoffMs * (attempt + 1)));
        }
      }
    }
    return null;
  }

  function listJobs() {
    return [...jobs.values()].map((item) => ({ ...item }));
  }

  return {
    runJob,
    listJobs,
  };
}
