// HRworks-Importaufträge: Job anlegen, Status abfragen, Historie, Abbrechen.
// Credentials werden nur an die Queue durchgereicht (RAM) und nie geloggt/persistiert.
import { redactHrworksText } from "../lib/hrworksImportQueue.js";

const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_PAYLOADS = 62;

function sanitizePayload(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const date = String(raw.date || "").trim();
  const startTime = String(raw.startTime || "").trim();
  const endTime = String(raw.endTime || "").trim();
  if (!DATE_RE.test(date) || !TIME_RE.test(startTime) || !TIME_RE.test(endTime)) {
    return null;
  }
  return {
    planId: String(raw.planId || "").trim(),
    employeeName: String(raw.employeeName || "").trim(),
    date,
    startTime,
    endTime,
    breakStart: String(raw.breakStart || "").trim(),
    breakEnd: String(raw.breakEnd || "").trim(),
    workHours: Number.isFinite(Number(raw.workHours)) ? Number(raw.workHours) : null,
    purpose: String(raw.purpose || "").trim(),
    note: String(raw.note || "").trim(),
    departureLocation: String(raw.departureLocation || "").trim(),
    destinationLocation: String(raw.destinationLocation || "").trim(),
    intermediateStops: Array.isArray(raw.intermediateStops)
      ? raw.intermediateStops.map((stop) => String(stop || "").trim()).filter(Boolean)
      : [],
    routeLegs: Array.isArray(raw.routeLegs)
      ? raw.routeLegs
          .map((leg) => ({
            from: String(leg?.from || "").trim(),
            to: String(leg?.to || "").trim(),
            distanceKm: Number.isFinite(Number(leg?.distanceKm)) ? Number(leg.distanceKm) : null,
            durationMinutes: Number.isFinite(Number(leg?.durationMinutes)) ? Number(leg.durationMinutes) : null,
          }))
          .filter((leg) => leg.from && leg.to)
      : [],
    costCenter: String(raw.costCenter || "").trim(),
    sourceGames: Array.isArray(raw.sourceGames)
      ? raw.sourceGames.slice(0, 40).map((game) => ({
          id: String(game?.id || "").trim(),
          home: String(game?.home || "").trim(),
          away: String(game?.away || "").trim(),
          venue: String(game?.venue || "").trim(),
          date: String(game?.date || "").trim(),
        }))
      : [],
  };
}

export async function handleHrworksImportRoutes(req, res, routeContext) {
  const { url, origin, requestId, requestLogger, readBody, sendJson, hrworksImportQueue, hrworksJobsDir, writeHrworksTimesheetXlsx } = routeContext;

  if (!url.pathname.startsWith("/api/hrworks/import-jobs")) {
    return false;
  }

  // POST /api/hrworks/import-jobs — Auftrag anlegen (erzeugt XLSX + Queue-Job)
  if (req.method === "POST" && url.pathname === "/api/hrworks/import-jobs") {
    try {
      const body = await readBody(req);
      const payloads = (Array.isArray(body?.payloads) ? body.payloads : []).map(sanitizePayload).filter(Boolean);
      if (payloads.length === 0) {
        sendJson(res, 400, { ok: false, error: "Keine gültigen Import-Tage übergeben (Datum/Beginn/Ende erforderlich)." }, origin, requestId);
        return true;
      }
      if (payloads.length > MAX_PAYLOADS) {
        sendJson(res, 413, { ok: false, error: `Zu viele Import-Tage (${payloads.length}). Maximal ${MAX_PAYLOADS}.` }, origin, requestId);
        return true;
      }
      const credentials = body?.credentials && typeof body.credentials === "object"
        ? {
            baseUrl: String(body.credentials.baseUrl || "").trim(),
            username: String(body.credentials.username || "").trim(),
            password: String(body.credentials.password || ""),
          }
        : null;
      if (!credentials?.username || !credentials?.password) {
        sendJson(res, 400, { ok: false, error: "HRworks-Zugangsdaten (Benutzername und Passwort) sind erforderlich." }, origin, requestId);
        return true;
      }

      const planId = String(body?.planId || payloads[0]?.planId || "plan").trim();
      const employeeName = String(body?.employeeName || payloads[0]?.employeeName || "").trim();

      let xlsxFile = "";
      let xlsxMeta = null;
      try {
        const safePlanId = planId.replace(/[^a-z0-9-_]+/gi, "-").slice(0, 60) || "plan";
        const target = `${hrworksJobsDir}/${Date.now()}-${safePlanId}.xlsx`;
        const written = writeHrworksTimesheetXlsx(target, payloads, { employeeName });
        xlsxFile = written.filePath;
        xlsxMeta = { monthName: written.monthName, totalHours: written.totalHours };
      } catch (error) {
        requestLogger.warn("hrworks xlsx generation failed", { error: String(error?.message || error) });
        sendJson(res, 400, { ok: false, error: redactHrworksText(error?.message || "HRworks-Datei konnte nicht erzeugt werden.") }, origin, requestId);
        return true;
      }

      const job = hrworksImportQueue.enqueue({ planId, employeeName, payloads, credentials, xlsxFile, xlsxMeta });
      requestLogger.info("hrworks import job queued", { jobId: job.id, planId, payloadCount: payloads.length });
      sendJson(res, 200, { ok: true, jobId: job.id, status: job.status, job }, origin, requestId);
      return true;
    } catch (error) {
      requestLogger.warn("hrworks import job creation failed", { error: String(error?.message || error) });
      sendJson(res, 400, { ok: false, error: redactHrworksText(error?.message || "Importauftrag konnte nicht angelegt werden.") }, origin, requestId);
      return true;
    }
  }

  // GET /api/hrworks/import-jobs — Historie (redigiert, ohne Credentials)
  if (req.method === "GET" && url.pathname === "/api/hrworks/import-jobs") {
    sendJson(res, 200, { ok: true, jobs: hrworksImportQueue.listJobs(50) }, origin, requestId);
    return true;
  }

  const jobIdMatch = url.pathname.match(/^\/api\/hrworks\/import-jobs\/([^/]+)(\/cancel)?$/);
  if (!jobIdMatch) {
    sendJson(res, 404, { ok: false, error: "Route nicht gefunden." }, origin, requestId);
    return true;
  }
  const jobId = decodeURIComponent(jobIdMatch[1]);

  // POST /api/hrworks/import-jobs/:id/cancel — nur solange der Job wartet
  if (req.method === "POST" && jobIdMatch[2] === "/cancel") {
    const cancelled = hrworksImportQueue.cancelJob(jobId);
    if (!cancelled) {
      sendJson(res, 409, { ok: false, error: "Auftrag kann nicht mehr abgebrochen werden (läuft bereits oder ist abgeschlossen)." }, origin, requestId);
      return true;
    }
    sendJson(res, 200, { ok: true, job: cancelled }, origin, requestId);
    return true;
  }

  // GET /api/hrworks/import-jobs/:id — Status
  if (req.method === "GET" && !jobIdMatch[2]) {
    const job = hrworksImportQueue.getJob(jobId);
    if (!job) {
      sendJson(res, 404, { ok: false, error: "Importauftrag nicht gefunden." }, origin, requestId);
      return true;
    }
    sendJson(res, 200, { ok: true, job }, origin, requestId);
    return true;
  }

  sendJson(res, 405, { ok: false, error: "Methode nicht erlaubt." }, origin, requestId);
  return true;
}
