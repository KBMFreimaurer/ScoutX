import { createServer } from "node:http";
import { createHash, pbkdf2Sync, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { dedupeGames, filterGames, isLikelyTeamMatch, normalizeGames } from "./lib/games.js";
import { extractClubSearchResults, resolveFussballDeCompetitionTypes } from "./lib/fussballde.js";
import { createJobRegistry } from "./lib/jobRunner.js";
import { readStore, refreshStore, writeStore } from "./lib/loader.js";
import { createLogger } from "./lib/logger.js";
import { fetchWeekTemplateGames, runExportCommand } from "./lib/dynamicSources.js";
import { handleTeamNotificationsRoutes } from "./routes/teamNotificationsRoutes.js";
import { handleTeamInvitationRoutes } from "./routes/teamInvitationRoutes.js";
import { handleTeamPasswordResetRoutes } from "./routes/teamPasswordResetRoutes.js";
import { handleTeamAuthRoutes } from "./routes/teamAuthRoutes.js";
import { handleAdminRoutes } from "./routes/adminRoutes.js";
import { handleTeamPlanningRoutes } from "./routes/teamPlanningRoutes.js";
import { handleTeamImportTournamentRoutes } from "./routes/teamImportTournamentRoutes.js";
import { handlePublicDataRoutes } from "./routes/publicDataRoutes.js";
import { handleHrworksImportRoutes } from "./routes/hrworksImportRoutes.js";
import { createHrworksImportQueue } from "./lib/hrworksImportQueue.js";
import { createHrworksJobRunner } from "./lib/hrworksServerAutomation.js";
import { writeHrworksTimesheetXlsx } from "./lib/hrworksPlanExport.js";
import { handleTeamAuditRoutes } from "./routes/teamAuditRoutes.js";
import { createTeamRouteBaseContext } from "./routes/routeContextFactory.js";
import { isAccountEmailVerified, isAccountProfileComplete, normalizeEmail } from "./services/teamAuthService.js";
import { createEmailDelivery } from "./lib/emailDelivery.js";
import { fetchRecentTeamArchiveEvents, persistTeamArchiveEventToDb } from "./lib/teamArchiveDb.js";
import { fetchTeamAccountByIdFromDb, syncTeamAccountsToDb } from "./lib/teamAccountsDb.js";
import { fetchTeamFeedItemsFromDb, syncTeamFeedItemsToDb } from "./lib/teamFeedDb.js";
import { fetchTeamNotificationsFromDb, syncTeamNotificationsToDb } from "./lib/teamNotificationsDb.js";
import { fetchTeamObservationsFromDb, syncTeamObservationsToDb } from "./lib/teamObservationsDb.js";
import { fetchTeamReportMapFromDb, syncTeamReportsToDb } from "./lib/teamReportsDb.js";
import { fetchTeamStateFromDb, persistTeamStateToDb } from "./lib/teamStateDb.js";
import { ensureTeamDbMirrorsSynced } from "./lib/teamDbPersistence.js";
import {
  fetchPushRuntimeSnapshot,
  persistPushOutboxEvent,
  persistPushSubscription,
  removePushOutboxEventsAndMarkAcked,
} from "./lib/teamPushDb.js";
import {
  checkAndBumpRuntimeRateLimit,
  deleteRuntimeInvitation,
  deleteRuntimeKreisPdfPreview,
  deleteRuntimePasswordResetToken,
  fetchRuntimeInvitationByToken,
  fetchRuntimeKreisPdfPreviewByToken,
  fetchRuntimePasswordResetToken,
  fetchRuntimeTeamSessionById,
  persistRuntimeInvitation,
  persistRuntimeKreisPdfPreview,
  persistRuntimePasswordResetToken,
  persistRuntimeTeamSession,
  pruneExpiredRuntimeTeamSessions,
  pruneExpiredRuntimeTokens,
  pruneRuntimeRateLimits,
  revokeRuntimeTeamSessionsForAccount,
  revokeRuntimeTeamSession,
} from "./lib/teamRuntimeDb.js";
import { buildWeekCacheKey, getWeekRange, isDateInRange, shouldRefreshWeek } from "./lib/week.js";
import {
  appendTeamStateArchive,
  canWriteTeamState,
  canManageTeamMembers,
  createInitialTeamState,
  findAccount,
  linkObservationReport,
  markObservationSeen,
  reassignObservation,
  normalizeTeamState,
  publishTeamPlan,
  readTeamState,
  updateObservationNote,
  updateTeamGoals,
  upsertManualGame,
  upsertTeamMember,
  writeTeamState,
} from "./lib/teamBackend.js";
import { GERMANY_VERBANDS } from "../src/data/germany_regions.js";

function envNumber(name, fallback, { min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY } = {}) {
  const raw = process.env[name];
  const value = Number(raw ?? fallback);
  if (!Number.isFinite(value)) {
    throw new Error(`Ungültige ENV ${name}: '${raw}'`);
  }
  if (value < min || value > max) {
    throw new Error(`ENV ${name} außerhalb erlaubter Grenze (${min}..${max}): ${value}`);
  }
  return value;
}

const HOST = process.env.ADAPTER_HOST || "0.0.0.0";
const PORT = envNumber("ADAPTER_PORT", 8787, { min: 1, max: 65535 });
const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173";
const NODE_ENV = String(process.env.NODE_ENV || "").trim().toLowerCase();
const IS_PRODUCTION = NODE_ENV === "production";
const EXPOSE_RESET_TOKEN_ON_REQUEST = process.env.ADAPTER_EXPOSE_RESET_TOKEN_ON_REQUEST === "true";
const EXPOSE_VERIFICATION_TOKEN_ON_REGISTER = process.env.ADAPTER_EXPOSE_VERIFICATION_TOKEN_ON_REGISTER
  ? process.env.ADAPTER_EXPOSE_VERIFICATION_TOKEN_ON_REGISTER === "true"
  : !IS_PRODUCTION;
const EXPOSE_INVITATION_TOKEN_ON_CREATE = process.env.ADAPTER_EXPOSE_INVITATION_TOKEN_ON_CREATE
  ? process.env.ADAPTER_EXPOSE_INVITATION_TOKEN_ON_CREATE === "true"
  : !IS_PRODUCTION;
const AUTH_READS_FROM_DB = process.env.ADAPTER_AUTH_READS_FROM_DB === "true";
const SESSION_READS_FROM_DB = process.env.ADAPTER_SESSION_READS_FROM_DB === "true";
const TEAM_STATE_READS_FROM_DB = process.env.ADAPTER_TEAM_STATE_READS_FROM_DB === "true";
const NOTIFICATIONS_READS_FROM_DB = process.env.ADAPTER_NOTIFICATIONS_READS_FROM_DB === "true";
const OBSERVATIONS_READS_FROM_DB = process.env.ADAPTER_OBSERVATIONS_READS_FROM_DB === "true";
const REPORTS_READS_FROM_DB = process.env.ADAPTER_REPORTS_READS_FROM_DB === "true";
const FEED_READS_FROM_DB = process.env.ADAPTER_FEED_READS_FROM_DB === "true";
const DB_FIRST_MODE = process.env.ADAPTER_DB_FIRST_MODE === "true";
const DATABASE_URL_CONFIGURED = Boolean(String(process.env.ADAPTER_DATABASE_URL || process.env.DATABASE_URL || "").trim());
const RUNTIME_FILE_CONFIGURED = Boolean(String(process.env.ADAPTER_RUNTIME_STATE_FILE || "").trim());
const EFFECTIVE_AUTH_READS_FROM_DB = DB_FIRST_MODE || AUTH_READS_FROM_DB;
const EFFECTIVE_SESSION_READS_FROM_DB = DB_FIRST_MODE || SESSION_READS_FROM_DB;
const EFFECTIVE_TEAM_STATE_READS_FROM_DB = DB_FIRST_MODE || TEAM_STATE_READS_FROM_DB;
const EFFECTIVE_NOTIFICATIONS_READS_FROM_DB = DB_FIRST_MODE || NOTIFICATIONS_READS_FROM_DB;
const EFFECTIVE_OBSERVATIONS_READS_FROM_DB = DB_FIRST_MODE || OBSERVATIONS_READS_FROM_DB;
const EFFECTIVE_REPORTS_READS_FROM_DB = DB_FIRST_MODE || REPORTS_READS_FROM_DB;
const EFFECTIVE_FEED_READS_FROM_DB = DB_FIRST_MODE || FEED_READS_FROM_DB;
const RUNTIME_DB_ENABLED = DATABASE_URL_CONFIGURED || RUNTIME_FILE_CONFIGURED;
if (DB_FIRST_MODE && !DATABASE_URL_CONFIGURED) {
  throw new Error("ADAPTER_DB_FIRST_MODE=true benötigt ADAPTER_DATABASE_URL oder DATABASE_URL.");
}
const COOKIE_SECURE = process.env.ADAPTER_TEAM_COOKIE_SECURE
  ? process.env.ADAPTER_TEAM_COOKIE_SECURE === "true"
  : process.env.NODE_ENV !== "development";
const COOKIE_SAME_SITE = String(process.env.ADAPTER_TEAM_COOKIE_SAMESITE || "Lax").trim();
const AUTH_TOKEN = String(process.env.ADAPTER_TOKEN || "").trim();
const emailDelivery = createEmailDelivery(process.env);
if (IS_PRODUCTION && EXPOSE_RESET_TOKEN_ON_REQUEST) {
  throw new Error("ADAPTER_EXPOSE_RESET_TOKEN_ON_REQUEST=true ist in Produktion nicht erlaubt.");
}
if (IS_PRODUCTION && EXPOSE_VERIFICATION_TOKEN_ON_REGISTER) {
  throw new Error("ADAPTER_EXPOSE_VERIFICATION_TOKEN_ON_REGISTER=true ist in Produktion nicht erlaubt.");
}
if (IS_PRODUCTION && EXPOSE_INVITATION_TOKEN_ON_CREATE) {
  throw new Error("ADAPTER_EXPOSE_INVITATION_TOKEN_ON_CREATE=true ist in Produktion nicht erlaubt.");
}
if (IS_PRODUCTION && !AUTH_TOKEN) {
  throw new Error("ADAPTER_TOKEN ist in Produktion verpflichtend.");
}
const MAX_BODY_BYTES = (() => {
  const configured = Number(process.env.ADAPTER_MAX_BODY_BYTES || 1024 * 1024);
  if (!Number.isFinite(configured) || configured <= 0) {
    return 1024 * 1024;
  }
  return Math.min(configured, 1024 * 1024);
})();
const MAX_TOKEN_BYTES = (() => {
  const configured = Number(process.env.ADAPTER_MAX_TOKEN_BYTES || 4096);
  if (!Number.isFinite(configured) || configured <= 0) {
    return 4096;
  }
  return Math.min(configured, 64 * 1024);
})();

const SAMPLE_FILE =
  process.env.ADAPTER_DATA_FILE || fileURLToPath(new URL("./data/games.sample.json", import.meta.url));
const STORE_FILE =
  process.env.ADAPTER_STORE_FILE || fileURLToPath(new URL("./data/games.store.db", import.meta.url));
const TEAM_STATE_FILE =
  process.env.ADAPTER_TEAM_STATE_FILE || fileURLToPath(new URL("./data/team-state.json", import.meta.url));
const TEAM_ARCHIVE_FILE =
  process.env.ADAPTER_TEAM_ARCHIVE_FILE || fileURLToPath(new URL("./data/team-state.archive.ndjson", import.meta.url));
const REGISTRATION_TEAM = Object.freeze({
  key: "borussia-moenchengladbach",
});
const TEAM_JOIN_ALLOWLIST_ENABLED = process.env.ADAPTER_TEAM_JOIN_ALLOWLIST_ENABLED === "true";
const TEAM_JOIN_ALLOWLIST_MAP = Object.freeze(parseTeamJoinAllowlist(process.env.ADAPTER_TEAM_JOIN_ALLOWLIST || ""));
const CLUB_CATALOG_FILE =
  process.env.ADAPTER_CLUB_CATALOG_FILE || fileURLToPath(new URL("./data/clubs.catalog.json", import.meta.url));
const CLUB_LOGOS_DIR =
  process.env.ADAPTER_CLUB_LOGOS_DIR || fileURLToPath(new URL("./data/logos", import.meta.url));
const IMPORT_DIR =
  process.env.ADAPTER_IMPORT_DIR || fileURLToPath(new URL("./imports", import.meta.url));
const ALIASES_FILE =
  process.env.ADAPTER_ALIASES_FILE || fileURLToPath(new URL("./data/team-aliases.json", import.meta.url));
const REMOTE_URL = process.env.ADAPTER_REMOTE_URL || "";
const REMOTE_TOKEN = process.env.ADAPTER_REMOTE_TOKEN || "";
const REMOTE_TIMEOUT_MS = envNumber("ADAPTER_REMOTE_TIMEOUT_MS", 10000, { min: 1000, max: 120000 });
const REFRESH_INTERVAL_SEC = envNumber("ADAPTER_REFRESH_INTERVAL_SEC", 0, { min: 0, max: 86400 });

// Fully automatic week refresh for every scouting request
const AUTO_REFRESH_WEEK = process.env.ADAPTER_AUTO_REFRESH_WEEK !== "false";
const WEEK_REFRESH_TTL_SEC = envNumber("ADAPTER_WEEK_REFRESH_TTL_SEC", 300, { min: 0, max: 86400 });
const WEEK_SOURCE_TEMPLATE = process.env.ADAPTER_WEEK_SOURCE_URL_TEMPLATE || "";
const WEEK_SOURCE_TOKEN = process.env.ADAPTER_WEEK_SOURCE_TOKEN || "";
const DEFAULT_EXPORT_SCRIPT = fileURLToPath(new URL("./scripts/fetch-week.fussballde.mjs", import.meta.url));
const EXPORT_COMMAND =
  process.env.ADAPTER_EXPORT_COMMAND !== undefined ? process.env.ADAPTER_EXPORT_COMMAND : `node "${DEFAULT_EXPORT_SCRIPT}"`;
const WEEK_COMMAND_TIMEOUT_MS = envNumber("ADAPTER_WEEK_COMMAND_TIMEOUT_MS", 60000, { min: 1000, max: 300000 });
const WEEK_EXTERNAL_TIMEOUT_MS = 60000;

const RATE_LIMIT_WINDOW_MS = envNumber("ADAPTER_RATE_LIMIT_WINDOW_MS", 60000, { min: 1000, max: 300000 });
const RATE_LIMIT_MAX = envNumber("ADAPTER_RATE_LIMIT_MAX", 60, { min: 1, max: 10000 });
const TEAM_LOGIN_RATE_LIMIT_MAX = envNumber("ADAPTER_TEAM_LOGIN_RATE_LIMIT_MAX", 12, { min: 1, max: 10000 });
const TEAM_LOGIN_LOCK_THRESHOLD = envNumber("ADAPTER_TEAM_LOGIN_LOCK_THRESHOLD", 8, { min: 2, max: 1000 });
const TEAM_LOGIN_LOCK_DURATION_SEC = envNumber("ADAPTER_TEAM_LOGIN_LOCK_DURATION_SEC", 300, { min: 5, max: 86400 });
const TEAM_WRITE_RATE_LIMIT_MAX = envNumber("ADAPTER_TEAM_WRITE_RATE_LIMIT_MAX", 60, { min: 1, max: 10000 });
const TEAM_SESSION_TTL_SEC = envNumber("ADAPTER_TEAM_SESSION_TTL_SEC", 28800, { min: 1, max: 86400 * 30 });
const TEAM_INVITATION_TTL_SEC = envNumber("ADAPTER_TEAM_INVITATION_TTL_SEC", 604800, { min: 300, max: 86400 * 365 });
const TEAM_PASSWORD_RESET_TTL_SEC = envNumber("ADAPTER_TEAM_PASSWORD_RESET_TTL_SEC", 3600, { min: 300, max: 86400 * 30 });
const MEINTURNIERPLAN_BASE_URL = String(process.env.ADAPTER_MEINTURNIERPLAN_BASE_URL || "https://www.meinturnierplan.de").trim();
const DFB_NATIONAL_BASE_URL = String(process.env.ADAPTER_DFB_NATIONAL_BASE_URL || "https://www.dfb.de").trim();
const DFB_NATIONAL_SOURCE_URL_TEMPLATE = String(process.env.ADAPTER_DFB_NATIONAL_SOURCE_URL_TEMPLATE || "").trim();
const DFB_NATIONAL_SOURCE_TOKEN = String(process.env.ADAPTER_DFB_NATIONAL_SOURCE_TOKEN || "").trim();
const DFB_NATIONAL_SOURCE_TIMEOUT_MS = envNumber("ADAPTER_DFB_NATIONAL_SOURCE_TIMEOUT_MS", 20000, { min: 1000, max: 120000 });
const CLUB_SEARCH_URL = process.env.ADAPTER_CLUB_SEARCH_URL || "https://www.fussball.de/suche";
const CLUB_SEARCH_TIMEOUT_MS = Number(process.env.ADAPTER_CLUB_SEARCH_TIMEOUT_MS || 12000);
const CLUB_SEARCH_MAX_LIMIT = Number(process.env.ADAPTER_CLUB_SEARCH_MAX_LIMIT || 20);
const MANDANT_PROBE_BASE_URL = process.env.FUSSBALLDE_BASE_URL || "https://www.fussball.de";
const MANDANT_PROBE_TIMEOUT_MS = Number(process.env.ADAPTER_MANDANT_PROBE_TIMEOUT_MS || 15000);
const VERBAND_STATUS_MAX = Math.max(1, Number(process.env.ADAPTER_VERBAND_STATUS_MAX || 8));
const INGESTION_RETRY_MAX = envNumber("ADAPTER_INGESTION_RETRY_MAX", 2, { min: 0, max: 10 });
const INGESTION_BACKOFF_MS = envNumber("ADAPTER_INGESTION_BACKOFF_MS", 750, { min: 0, max: 30000 });
const METRICS_PROVENANCE_MISSING_WARN_THRESHOLD = envNumber("ADAPTER_METRICS_PROVENANCE_MISSING_WARN_THRESHOLD", 1, { min: 0, max: 1000000 });
const METRICS_JOB_FAILED_WARN_THRESHOLD = envNumber("ADAPTER_METRICS_JOB_FAILED_WARN_THRESHOLD", 1, { min: 0, max: 1000000 });
const PUSH_OUTBOX_MAX_AGE_MS = envNumber("ADAPTER_PUSH_OUTBOX_MAX_AGE_MS", 14 * 24 * 60 * 60 * 1000, {
  min: 60 * 1000,
  max: 90 * 24 * 60 * 60 * 1000,
});
const LOGO_CONTENT_TYPES = Object.freeze({
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
});

const rateLimitStore = new Map();
const rootLogger = createLogger({ service: "scoutx-adapter" });
const ingestionJobs = createJobRegistry();

// HRworks: serverseitige Import-Queue (seriell), Jobstatus als JSON, Credentials nur im RAM.
const HRWORKS_JOBS_FILE =
  process.env.ADAPTER_HRWORKS_JOBS_FILE || fileURLToPath(new URL("./data/hrworks-import-jobs.json", import.meta.url));
const HRWORKS_JOBS_DIR =
  process.env.ADAPTER_HRWORKS_JOBS_DIR || fileURLToPath(new URL("./data/hrworks-exports", import.meta.url));
const hrworksImportQueue = createHrworksImportQueue({
  jobsFile: HRWORKS_JOBS_FILE,
  runJob: createHrworksJobRunner({ env: process.env, logger: rootLogger }),
  logger: rootLogger,
});

const KNOWN_VERBANDS = Object.values(GERMANY_VERBANDS || {})
  .filter((entry) => entry && typeof entry === "object")
  .map((entry) => ({
    code: String(entry.code || "").trim(),
    label: String(entry.label || "").trim(),
    mandant: String(entry.mandant || "").trim(),
    areaKeyword: String(entry.areaKeyword || "").trim(),
  }))
  .filter((entry) => entry.mandant)
  .sort((left, right) => left.code.localeCompare(right.code, "de-DE"));

async function checkRateLimit(ip) {
  if (RUNTIME_DB_ENABLED) {
    const dbAllowed = await checkAndBumpRuntimeRateLimit(`global:${ip}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS, rootLogger);
    if (typeof dbAllowed === "boolean") {
      return dbAllowed;
    }
  }
  const now = Date.now();
  let entry = rateLimitStore.get(ip);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    entry = { windowStart: now, count: 1 };
    rateLimitStore.set(ip, entry);
    return true;
  }

  entry.count += 1;
  return entry.count <= RATE_LIMIT_MAX;
}

async function checkScopedRateLimit(store, key, maxRequests, windowMs = RATE_LIMIT_WINDOW_MS) {
  if (RUNTIME_DB_ENABLED) {
    const dbAllowed = await checkAndBumpRuntimeRateLimit(key, maxRequests, windowMs, rootLogger);
    if (typeof dbAllowed === "boolean") {
      return dbAllowed;
    }
  }
  const now = Date.now();
  let entry = store.get(key);
  if (!entry || now - entry.windowStart > windowMs) {
    entry = { windowStart: now, count: 1 };
    store.set(key, entry);
    return true;
  }
  entry.count += 1;
  return entry.count <= maxRequests;
}

// Cleanup stale rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  const nowTimestamp = new Date(now).toISOString();
  for (const [ip, entry] of rateLimitStore) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
      rateLimitStore.delete(ip);
    }
  }
  for (const [token, invitation] of teamInvitations) {
    const expiresAtMs = Date.parse(String(invitation?.expiresAt || ""));
    if (!Number.isFinite(expiresAtMs) || now > expiresAtMs) {
      teamInvitations.delete(token);
    }
  }
  for (const [token, reset] of teamPasswordResetTokens) {
    const expiresAtMs = Date.parse(String(reset?.expiresAt || ""));
    if (!Number.isFinite(expiresAtMs) || now > expiresAtMs) {
      teamPasswordResetTokens.delete(token);
    }
  }
  for (const [token, preview] of teamKreisPdfPreviews) {
    const expiresAtMs = Date.parse(String(preview?.expiresAt || ""));
    if (!Number.isFinite(expiresAtMs) || now > expiresAtMs) {
      teamKreisPdfPreviews.delete(token);
    }
  }
  for (const [userId, lock] of teamLoginLockStore) {
    const lockedUntilMs = Date.parse(String(lock?.lockedUntil || ""));
    if (!Number.isFinite(lockedUntilMs) || lockedUntilMs <= now) {
      teamLoginLockStore.delete(userId);
    }
  }
  prunePushOutbox(now, PUSH_OUTBOX_MAX_AGE_MS);
  void pruneExpiredRuntimeTeamSessions(nowTimestamp, rootLogger);
  void pruneExpiredRuntimeTokens(nowTimestamp, rootLogger);
  void pruneRuntimeRateLimits(RATE_LIMIT_WINDOW_MS * 2, rootLogger);
}, 300000);

const state = {
  games: [],
  clubs: [],
  team: createInitialTeamState(),
  meta: null,
  aliasMap: {},
  lastRefreshReason: "startup",
  lastError: null,
  startedAt: nowIso(),
  lastSuccessfulRefreshAt: "",
  weekRefreshCache: {},
  weekRefreshPromises: {},
  runtimeMetrics: {
    totalResponses: 0,
    errorResponses: 0,
    statusCounts: {},
  },
};
const teamSessions = new Map();
const teamInvitations = new Map();
const teamPasswordResetTokens = new Map();
const teamPushSubscriptions = new Map();
const teamPushOutbox = new Map();
const pushedCriticalEventIds = new Set();
const teamPushStreams = new Map();
const teamKreisPdfPreviews = new Map();
const teamLoginRateStore = new Map();
const teamLoginLockStore = new Map();
const teamWriteRateStore = new Map();

async function createTeamSessionForAccount(account, clientIp = "", userAgent = "") {
  const sessionId = randomUUID();
  const csrfToken = randomUUID();
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + TEAM_SESSION_TTL_SEC * 1000).toISOString();
  if (!RUNTIME_DB_ENABLED) {
    teamSessions.set(sessionId, {
      userId: account.id,
      teamId: account.teamId,
      csrfToken,
      createdAt,
      expiresAt,
    });
  }
  const persisted = await persistRuntimeTeamSession(
    {
      sessionId,
      accountId: account.id,
      teamId: account.teamId,
      csrfToken,
      createdAt,
      expiresAt,
      userAgent,
      ipAddress: clientIp,
    },
    rootLogger,
  );
  if (RUNTIME_DB_ENABLED && !persisted) {
    throw new Error("Team-Session konnte nicht persistent gespeichert werden.");
  }
  return { sessionId, csrfToken };
}

function uniqueNormalizedTeams(values) {
  const seen = new Set();
  const teams = [];

  for (const value of Array.isArray(values) ? values : []) {
    const team = String(value || "").trim();
    if (!team) {
      continue;
    }

    const key = team.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    teams.push(team);
  }

  return teams;
}

function splitTeamValidation(teams, games) {
  const matchedTeams = [];
  const missingTeams = [];

  for (const team of teams) {
    const found = games.some((game) => isLikelyTeamMatch(team, game.home) || isLikelyTeamMatch(team, game.away));
    if (found) {
      matchedTeams.push(team);
    } else {
      missingTeams.push(team);
    }
  }

  return {
    matchedTeams,
    missingTeams,
  };
}

function clampLimit(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function normalizeSearchQuery(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function formatWizardDateForMeinturnierplan(date, endOfDay = false) {
  const text = String(date || "").trim();
  if (!text) {
    return "";
  }
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return "";
  }
  const [, year, month, day] = match;
  return `${day}.${month}.${year} ${endOfDay ? "23:59" : "00:00"}`;
}

function parseGermanDateToIso(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) {
    return "";
  }
  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

function extractMeinturnierplanJson(html) {
  const match = String(html || "").match(/window\.mapSearchTournaments\s*=\s*(\{[\s\S]*?\});/);
  if (!match || !match[1]) {
    return null;
  }
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function toFilterKeywords(payload) {
  const keywords = [];
  const teams = Array.isArray(payload?.teams) ? payload.teams : [];
  for (const team of teams) {
    const normalized = normalizeSearchQuery(team).toLowerCase();
    if (normalized.length >= 3) {
      keywords.push(normalized);
    }
  }
  const ageKeywords = Array.isArray(payload?.ageKeywords) ? payload.ageKeywords : [];
  for (const keyword of ageKeywords) {
    const normalized = normalizeSearchQuery(keyword).toLowerCase();
    if (normalized.length >= 2) {
      keywords.push(normalized);
    }
  }
  const extras = [payload?.jugendLabel, payload?.jugendId, payload?.kreisLabel, payload?.kreisId];
  for (const value of extras) {
    const normalized = normalizeSearchQuery(value).toLowerCase();
    if (normalized.length >= 2) {
      keywords.push(normalized);
    }
  }
  return [...new Set(keywords)];
}

function toKickoffMs(date, time) {
  const dateText = String(date || "").trim();
  const timeText = String(time || "").trim();
  const match = timeText.match(/^(\d{2}):(\d{2})$/);
  if (!dateText || !match) {
    return NaN;
  }
  const [, hh, mm] = match;
  return Date.parse(`${dateText}T${hh}:${mm}:00Z`);
}

function buildTeamConflicts(observations) {
  const byScoutDate = new Map();
  for (const item of Array.isArray(observations) ? observations : []) {
    if (item?.status !== "planned" && item?.status !== "seen" && item?.status !== "reported" && item?.status !== "followup") {
      continue;
    }
    const game = item?.game || {};
    const date = String(game?.date || "").trim();
    const time = String(game?.time || "").trim();
    const kickoffMs = toKickoffMs(date, time);
    if (!date || Number.isNaN(kickoffMs)) {
      continue;
    }
    const key = `${String(item?.scoutId || "")}:${date}`;
    const bucket = byScoutDate.get(key) || [];
    bucket.push({
      observationId: String(item?.id || ""),
      scoutId: String(item?.scoutId || ""),
      gameId: String(item?.gameId || game?.id || ""),
      date,
      time,
      venue: String(game?.venue || "").trim(),
      kickoffMs,
    });
    byScoutDate.set(key, bucket);
  }

  const conflicts = [];

  // Dopplung: mehrere Scouts planen dasselbe Spiel.
  const scoutsByGame = new Map();
  for (const entries of byScoutDate.values()) {
    for (const entry of entries) {
      if (!entry.gameId) {
        continue;
      }
      const scouts = scoutsByGame.get(entry.gameId) || new Set();
      scouts.add(entry.scoutId);
      scoutsByGame.set(entry.gameId, scouts);
    }
  }
  for (const [gameId, scouts] of scoutsByGame) {
    if (scouts.size < 2) {
      continue;
    }
    conflicts.push({
      id: `conflict-duplicate-${gameId}`,
      type: "duplicate_visit",
      scoutId: "",
      scoutIds: [...scouts],
      gameIds: [gameId],
      severity: "medium",
      message: `${scouts.size} Scouts planen dasselbe Spiel.`,
    });
  }

  for (const entries of byScoutDate.values()) {
    const sorted = [...entries].sort((a, b) => a.kickoffMs - b.kickoffMs);
    for (let index = 0; index < sorted.length - 1; index += 1) {
      const left = sorted[index];
      const right = sorted[index + 1];
      const deltaMinutes = Math.round((right.kickoffMs - left.kickoffMs) / 60000);
      const sameVenue = left.venue && right.venue && left.venue.toLowerCase() === right.venue.toLowerCase();
      if (deltaMinutes < 120) {
        conflicts.push({
          id: `conflict-overlap-${left.gameId}-${right.gameId}`,
          type: "time_overlap",
          scoutId: left.scoutId,
          gameIds: [left.gameId, right.gameId],
          severity: "high",
          message: `Zeitueberlappung zwischen ${left.time} und ${right.time}.`,
        });
      } else if (!sameVenue && deltaMinutes < 90) {
        conflicts.push({
          id: `conflict-travel-${left.gameId}-${right.gameId}`,
          type: "travel_risk",
          scoutId: left.scoutId,
          gameIds: [left.gameId, right.gameId],
          severity: "medium",
          message: `Knappes Reisefenster (${deltaMinutes} Minuten) zwischen unterschiedlichen Spielorten.`,
        });
      }
    }
  }
  return conflicts;
}

function parseKreisPdfDate(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) {
    return "";
  }
  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

function parseKreisPdfGamesFromText(extractedText) {
  const games = [];
  const text = String(extractedText || "").replace(/\r/g, "\n");
  const gamePattern = /(\d{2}\.\d{2}\.\d{4})\s+(\d{2}:\d{2})\s+([^\n]+)/g;

  for (const match of text.matchAll(gamePattern)) {
    const rawDate = String(match[1] || "").trim();
    const time = String(match[2] || "").trim();
    const body = String(match[3] || "").trim();
    const teamParts = String(body || "").split(/\s+-\s+/);
    if (teamParts.length < 2) {
      continue;
    }
    const home = String(teamParts[0] || "").trim();
    const rightSide = String(teamParts.slice(1).join(" - ") || "").trim();
    let away = "";
    let venue = "";
    if (rightSide.includes(" | ")) {
      const [awayPart, venuePart] = rightSide.split(/\s+\|\s+/, 2);
      away = String(awayPart || "").trim();
      venue = String(venuePart || "").trim();
    } else {
      const tokens = rightSide.split(/\s+/).filter(Boolean);
      if (tokens.length >= 4) {
        venue = tokens.slice(-2).join(" ");
        away = tokens.slice(0, -2).join(" ");
      } else {
        away = rightSide;
        venue = "";
      }
    }
    const date = parseKreisPdfDate(rawDate);
    if (!date || !home || !away) {
      continue;
    }
    games.push({
      id: `kreis-pdf-${randomUUID()}`,
      source: "manual",
      tournamentId: "",
      date,
      time: String(time || "").trim(),
      home: String(home || "").trim(),
      away: String(away || "").trim(),
      venue: String(venue || "").trim(),
      status: "scheduled",
      note: "",
    });
  }
  return games;
}

function createGameProvenance({
  source,
  method,
  provider = "",
  importedBy = "",
  requestId = "",
  jobId = "",
  ingestedAt = nowIso(),
}) {
  const normalizedSource = String(source || "manual").trim() || "manual";
  const normalizedProvider = String(provider || normalizedSource).trim() || normalizedSource;
  return {
    source: normalizedSource,
    method: String(method || "import").trim() || "import",
    provider: normalizedProvider,
    importedBy: String(importedBy || "").trim(),
    ingestedAt: String(ingestedAt || nowIso()).trim() || nowIso(),
    requestId: String(requestId || "").trim(),
    jobId: String(jobId || "").trim(),
  };
}

function buildGameProvenanceSummary() {
  const catalogGames = Array.isArray(state.games) ? state.games : [];
  const manualGames = Array.isArray(state.team?.manualGames) ? state.team.manualGames : [];
  const combined = [...catalogGames, ...manualGames];
  const bySource = {};
  const byMethod = {};
  let withProvenance = 0;
  let missingProvenance = 0;

  for (const game of combined) {
    const source = String(game?.source || "unknown").trim() || "unknown";
    bySource[source] = (bySource[source] || 0) + 1;
    const provenance = game?.provenance && typeof game.provenance === "object" ? game.provenance : null;
    if (provenance) {
      withProvenance += 1;
      const method = String(provenance.method || "unknown").trim() || "unknown";
      byMethod[method] = (byMethod[method] || 0) + 1;
    } else {
      missingProvenance += 1;
    }
  }

  return {
    totalGames: combined.length,
    catalogGames: catalogGames.length,
    manualGames: manualGames.length,
    withProvenance,
    missingProvenance,
    bySource,
    byMethod,
  };
}

function buildMonitoringAlerts() {
  const alerts = [];
  const jobs = ingestionJobs.listJobs();
  const failedJobs = jobs.filter((job) => job?.status === "failed");
  const provenance = buildGameProvenanceSummary();

  if (METRICS_JOB_FAILED_WARN_THRESHOLD > 0 && failedJobs.length >= METRICS_JOB_FAILED_WARN_THRESHOLD) {
    alerts.push({
      code: "INGESTION_JOB_FAILED",
      severity: "warning",
      message: `${failedJobs.length} Ingestion-Job(s) im Status failed.`,
      value: failedJobs.length,
      threshold: METRICS_JOB_FAILED_WARN_THRESHOLD,
    });
  }

  if (
    METRICS_PROVENANCE_MISSING_WARN_THRESHOLD > 0 &&
    provenance.missingProvenance >= METRICS_PROVENANCE_MISSING_WARN_THRESHOLD
  ) {
    alerts.push({
      code: "MISSING_GAME_PROVENANCE",
      severity: "warning",
      message: `${provenance.missingProvenance} Spiel(e) ohne Provenance.`,
      value: provenance.missingProvenance,
      threshold: METRICS_PROVENANCE_MISSING_WARN_THRESHOLD,
    });
  }

  if (state.lastError) {
    alerts.push({
      code: "ADAPTER_LAST_ERROR",
      severity: "warning",
      message: String(state.lastError),
      value: 1,
      threshold: 0,
    });
  }

  return alerts;
}

function buildPrometheusMetricsText() {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const startedAtMs = Date.parse(String(state.startedAt || ""));
  const uptimeSeconds = Number.isFinite(startedAtMs) ? Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000)) : 0;
  const jobs = ingestionJobs.listJobs();
  const failedJobs = jobs.filter((job) => job?.status === "failed").length;
  const runningJobs = jobs.filter((job) => job?.status === "running").length;
  const alerts = buildMonitoringAlerts();
  const provenance = buildGameProvenanceSummary();

  const lines = [
    "# HELP scoutx_adapter_uptime_seconds Adapter uptime in seconds.",
    "# TYPE scoutx_adapter_uptime_seconds gauge",
    `scoutx_adapter_uptime_seconds ${uptimeSeconds}`,
    "# HELP scoutx_adapter_games_total Number of games in adapter state.",
    "# TYPE scoutx_adapter_games_total gauge",
    `scoutx_adapter_games_total ${Number(state.games.length || 0)}`,
    "# HELP scoutx_adapter_runtime_responses_total Total number of HTTP responses.",
    "# TYPE scoutx_adapter_runtime_responses_total counter",
    `scoutx_adapter_runtime_responses_total ${Number(state.runtimeMetrics.totalResponses || 0)}`,
    "# HELP scoutx_adapter_runtime_error_responses_total Total number of HTTP 4xx/5xx responses.",
    "# TYPE scoutx_adapter_runtime_error_responses_total counter",
    `scoutx_adapter_runtime_error_responses_total ${Number(state.runtimeMetrics.errorResponses || 0)}`,
    "# HELP scoutx_ingestion_jobs_failed Number of ingestion jobs currently failed.",
    "# TYPE scoutx_ingestion_jobs_failed gauge",
    `scoutx_ingestion_jobs_failed ${failedJobs}`,
    "# HELP scoutx_ingestion_jobs_running Number of ingestion jobs currently running.",
    "# TYPE scoutx_ingestion_jobs_running gauge",
    `scoutx_ingestion_jobs_running ${runningJobs}`,
    "# HELP scoutx_game_provenance_missing Number of games without provenance.",
    "# TYPE scoutx_game_provenance_missing gauge",
    `scoutx_game_provenance_missing ${Number(provenance.missingProvenance || 0)}`,
    "# HELP scoutx_monitoring_alerts Number of currently active monitoring alerts.",
    "# TYPE scoutx_monitoring_alerts gauge",
    `scoutx_monitoring_alerts ${alerts.length}`,
    `scoutx_metrics_timestamp_seconds ${nowSeconds}`,
  ];
  return `${lines.join("\n")}\n`;
}

function toLookupKey(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeLogoLocalFileName(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }

  const normalized = text
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/^\.\/+/, "");
  const segments = normalized.split("/").filter(Boolean);
  const fileName = segments[segments.length - 1] || "";
  if (!fileName || fileName === "." || fileName === ".." || fileName.includes("..")) {
    return "";
  }
  return fileName;
}

function normalizeKreisIds(value) {
  const source = Array.isArray(value) ? value : String(value || "").split(/[;,|]/);
  const unique = new Set();

  for (const entry of source) {
    const normalized = String(entry || "").trim().toLowerCase();
    if (normalized) {
      unique.add(normalized);
    }
  }

  return [...unique];
}

function normalizeClubEntry(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const name = String(raw.name || "").trim();
  if (!name) {
    return null;
  }

  const logoUrl = String(raw.logoUrl || raw.logo || "").trim();
  const logoLocal = normalizeLogoLocalFileName(raw.logoLocal || raw.localLogo || raw.logoPath || "");
  const link = String(raw.link || "").trim();
  const location = String(raw.location || "").trim();
  const kreisIds = normalizeKreisIds(raw.kreisIds || raw.kreis || raw.kreise || []);

  return {
    name,
    location,
    logoUrl: logoUrl.startsWith("//") ? `https:${logoUrl}` : logoUrl,
    logoLocal,
    link,
    kreisIds,
  };
}

function dedupeClubEntries(items) {
  const merged = new Map();

  for (const item of Array.isArray(items) ? items : []) {
    const normalized = normalizeClubEntry(item);
    if (!normalized) {
      continue;
    }

    const key = toLookupKey(normalized.name);
    if (!key) {
      continue;
    }

    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, normalized);
      continue;
    }

    merged.set(key, {
      ...existing,
      location: existing.location || normalized.location,
      logoUrl: existing.logoUrl || normalized.logoUrl,
      logoLocal: existing.logoLocal || normalized.logoLocal,
      link: existing.link || normalized.link,
      kreisIds: normalizeKreisIds([...(existing.kreisIds || []), ...(normalized.kreisIds || [])]),
    });
  }

  return [...merged.values()];
}

function scoreClubMatch(name, queryKey) {
  const key = toLookupKey(name);
  if (!key || !queryKey || !key.includes(queryKey)) {
    return -1;
  }

  if (key === queryKey) {
    return 4;
  }
  if (key.startsWith(queryKey)) {
    return 3;
  }
  if (key.split(" ").some((token) => token.startsWith(queryKey))) {
    return 2;
  }
  return 1;
}

function searchLocalClubCatalog(catalog, query, limit) {
  const queryKey = toLookupKey(query);
  if (!queryKey) {
    return [];
  }

  const scored = [];
  for (const item of Array.isArray(catalog) ? catalog : []) {
    const score = scoreClubMatch(item?.name, queryKey);
    if (score < 0) {
      continue;
    }
    scored.push({ score, item });
  }

  scored.sort((left, right) => {
    if (left.score !== right.score) {
      return right.score - left.score;
    }
    return String(left.item?.name || "").localeCompare(String(right.item?.name || ""), "de-DE");
  });

  return scored.slice(0, limit).map((entry) => entry.item);
}

function mergeClubResults(primary, fallback, limit) {
  const merged = dedupeClubEntries([...(Array.isArray(primary) ? primary : []), ...(Array.isArray(fallback) ? fallback : [])]);
  return merged.slice(0, Math.max(1, Number(limit) || 8));
}

function getRequestBaseUrl(req) {
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  const forwardedHost = String(req.headers["x-forwarded-host"] || "")
    .split(",")[0]
    .trim();
  const host = forwardedHost || String(req.headers.host || "localhost");
  const proto = forwardedProto === "https" ? "https" : "http";
  return `${proto}://${host}`;
}

function buildLocalLogoUrl(req, logoLocal) {
  const fileName = normalizeLogoLocalFileName(logoLocal);
  if (!fileName) {
    return "";
  }

  const relativePath = `/api/clubs/logo/${encodeURIComponent(fileName)}`;
  try {
    return new URL(relativePath, getRequestBaseUrl(req)).toString();
  } catch {
    return relativePath;
  }
}

function toPublicClubEntry(req, item) {
  const normalized = normalizeClubEntry(item);
  if (!normalized) {
    return null;
  }

  const localLogoUrl = buildLocalLogoUrl(req, normalized.logoLocal);
  return {
    name: normalized.name,
    location: normalized.location,
    logoUrl: localLogoUrl || normalized.logoUrl,
    link: normalized.link,
  };
}

function toPublicClubEntries(req, items) {
  const response = [];
  for (const item of dedupeClubEntries(items)) {
    const entry = toPublicClubEntry(req, item);
    if (entry) {
      response.push(entry);
    }
  }
  return response;
}

function resolveLogoFilePath(fileName) {
  const safeFileName = normalizeLogoLocalFileName(fileName);
  if (!safeFileName) {
    return "";
  }

  const root = resolve(CLUB_LOGOS_DIR);
  const target = resolve(root, safeFileName);
  if (target !== root && !target.startsWith(`${root}${sep}`)) {
    return "";
  }
  return target;
}

function detectLogoContentType(filePath) {
  const extension = extname(String(filePath || "")).toLowerCase();
  return LOGO_CONTENT_TYPES[extension] || "application/octet-stream";
}

async function readClubCatalogFile(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    const clubs = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.clubs) ? parsed.clubs : [];
    return dedupeClubEntries(clubs);
  } catch {
    return [];
  }
}

async function writeClubCatalogFile(filePath, clubs) {
  const normalized = dedupeClubEntries(clubs);
  const payload = {
    updatedAt: new Date().toISOString(),
    count: normalized.length,
    withLogo: normalized.filter((item) => Boolean(item.logoLocal || item.logoUrl)).length,
    clubs: normalized,
  };

  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
  return normalized;
}

async function fetchTextWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "ScoutXAdapter/1.0 (+https://www.fussball.de)",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.text();
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`Timeout nach ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchRemoteClubSuggestions(query, limit) {
  const text = normalizeSearchQuery(query);
  if (text.length < 2) {
    return [];
  }

  const searchUrl = new URL(CLUB_SEARCH_URL);
  searchUrl.searchParams.set("text", text);
  searchUrl.searchParams.set("cat", "CLUB_AND_TEAM");

  const html = await fetchTextWithTimeout(searchUrl.toString(), CLUB_SEARCH_TIMEOUT_MS);
  return dedupeClubEntries(extractClubSearchResults(html, limit));
}

let refreshPromise = null;

function setCorsHeaders(res, origin) {
  const allowedOrigins = String(ALLOWED_ORIGIN || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const normalizedOrigin = String(origin || "").trim();
  const hasWildcard = allowedOrigins.includes("*");
  const allowed = hasWildcard ? Boolean(normalizedOrigin) : normalizedOrigin && allowedOrigins.includes(normalizedOrigin);
  if (!allowed) {
    return false;
  }
  res.setHeader("Access-Control-Allow-Origin", normalizedOrigin);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-CSRF-Token");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Vary", "Origin");
  return true;
}

function extractBearerToken(authorizationHeader) {
  const header = String(authorizationHeader || "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function timingSafeTokenEquals(left, right) {
  const leftBuf = Buffer.from(String(left || ""), "utf8");
  const rightBuf = Buffer.from(String(right || ""), "utf8");
  const maxLen = Math.max(leftBuf.length, rightBuf.length);

  if (maxLen > MAX_TOKEN_BYTES) {
    return false;
  }

  const paddedLeft = Buffer.alloc(maxLen);
  const paddedRight = Buffer.alloc(maxLen);
  leftBuf.copy(paddedLeft);
  rightBuf.copy(paddedRight);

  const equal = timingSafeEqual(paddedLeft, paddedRight);
  return equal && leftBuf.length === rightBuf.length;
}

function sendJson(res, statusCode, payload, origin, requestId = "") {
  setCorsHeaders(res, origin);
  state.runtimeMetrics.totalResponses += 1;
  if (statusCode >= 400) {
    state.runtimeMetrics.errorResponses += 1;
  }
  const statusKey = String(statusCode);
  state.runtimeMetrics.statusCounts[statusKey] = Number(state.runtimeMetrics.statusCounts[statusKey] || 0) + 1;
  const text = JSON.stringify(payload);
  const headers = { "Content-Type": "application/json; charset=utf-8" };
  if (requestId) {
    headers["X-Request-Id"] = requestId;
  }
  res.writeHead(statusCode, headers);
  res.end(text);
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    const declaredLength = Number(req.headers["content-length"] || 0);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
      const payloadTooLarge = new Error(`Payload zu groß (max ${MAX_BODY_BYTES} Bytes).`);
      payloadTooLarge.statusCode = 413;
      reject(payloadTooLarge);
      return;
    }
    const chunks = [];
    let totalBytes = 0;
    let tooLargeError = null;
    let settled = false;

    req.on("data", (chunk) => {
      if (settled) {
        return;
      }
      const chunkBuffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += chunkBuffer.length;
      if (totalBytes > MAX_BODY_BYTES) {
        tooLargeError = new Error(`Payload zu groß (max ${MAX_BODY_BYTES} Bytes).`);
        tooLargeError.statusCode = 413;
        return;
      }
      chunks.push(chunkBuffer);
    });

    req.on("end", () => {
      if (settled) {
        return;
      }
      if (tooLargeError) {
        settled = true;
        reject(tooLargeError);
        return;
      }
      try {
        const text = Buffer.concat(chunks).toString("utf8");
        settled = true;
        resolve(text ? JSON.parse(text) : {});
      } catch {
        settled = true;
        reject(new Error("Ungültiges JSON im Request-Body."));
      }
    });

    req.on("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      reject(error);
    });
  });
}

async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const declaredLength = Number(req.headers["content-length"] || 0);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
      const payloadTooLarge = new Error(`Payload zu groß (max ${MAX_BODY_BYTES} Bytes).`);
      payloadTooLarge.statusCode = 413;
      reject(payloadTooLarge);
      return;
    }
    const chunks = [];
    let totalBytes = 0;
    let tooLargeError = null;
    let settled = false;

    req.on("data", (chunk) => {
      if (settled) {
        return;
      }
      const chunkBuffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += chunkBuffer.length;
      if (totalBytes > MAX_BODY_BYTES) {
        tooLargeError = new Error(`Payload zu groß (max ${MAX_BODY_BYTES} Bytes).`);
        tooLargeError.statusCode = 413;
        return;
      }
      chunks.push(chunkBuffer);
    });

    req.on("end", () => {
      if (settled) {
        return;
      }
      if (tooLargeError) {
        settled = true;
        reject(tooLargeError);
        return;
      }
      settled = true;
      resolve(Buffer.concat(chunks));
    });

    req.on("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      reject(error);
    });
  });
}

function parseMultipartFormData(bodyBuffer, contentType) {
  const boundaryMatch = String(contentType || "").match(/boundary=([^;]+)/i);
  if (!boundaryMatch) {
    return { fields: {}, files: [] };
  }
  const boundary = boundaryMatch[1].trim().replace(/^"|"$/g, "");
  const marker = `--${boundary}`;
  const text = bodyBuffer.toString("latin1");
  const parts = text.split(marker).slice(1, -1);
  const fields = {};
  const files = [];

  for (const partRaw of parts) {
    const part = partRaw.replace(/^\r?\n/, "");
    const headerEnd = part.indexOf("\r\n\r\n") >= 0 ? part.indexOf("\r\n\r\n") : part.indexOf("\n\n");
    if (headerEnd < 0) {
      continue;
    }
    const separatorLength = part.startsWith("\r\n\r\n", headerEnd) ? 4 : 2;
    const headerText = part.slice(0, headerEnd);
    const bodyText = part.slice(headerEnd + separatorLength).replace(/\r?\n$/, "");
    const headers = headerText.split(/\r?\n/);
    const disposition = headers.find((line) => /^content-disposition:/i.test(line)) || "";
    const nameMatch = disposition.match(/name="([^"]+)"/i);
    if (!nameMatch) {
      continue;
    }
    const fieldName = nameMatch[1];
    const fileNameMatch = disposition.match(/filename="([^"]*)"/i);
    const contentTypeLine = headers.find((line) => /^content-type:/i.test(line)) || "";
    const mimeType = contentTypeLine.replace(/^content-type:\s*/i, "").trim() || "application/octet-stream";
    const contentBuffer = Buffer.from(bodyText, "latin1");

    if (fileNameMatch && fileNameMatch[1]) {
      files.push({
        fieldName,
        fileName: fileNameMatch[1],
        mimeType,
        content: contentBuffer,
      });
    } else {
      fields[fieldName] = Buffer.from(bodyText, "latin1").toString("utf8");
    }
  }

  return { fields, files };
}

function extractTextFromPdfBuffer(pdfBuffer) {
  const text = pdfBuffer.toString("latin1");
  const pieces = [];

  for (const match of text.matchAll(/\(([^()]*)\)\s*Tj/g)) {
    pieces.push(match[1]);
  }
  for (const match of text.matchAll(/\[(.*?)\]\s*TJ/gs)) {
    for (const inner of match[1].matchAll(/\(([^()]*)\)/g)) {
      pieces.push(inner[1]);
    }
  }
  const decoded = pieces
    .map((piece) =>
      String(piece || "")
        .replace(/\\\(/g, "(")
        .replace(/\\\)/g, ")")
        .replace(/\\\\/g, "\\"),
    )
    .join("\n")
    .trim();
  return decoded;
}

function isAuthorized(req) {
  if (!AUTH_TOKEN) {
    return true;
  }

  const providedToken = extractBearerToken(req.headers.authorization || "");
  return timingSafeTokenEquals(providedToken, AUTH_TOKEN);
}

function parseCookies(cookieHeader) {
  const cookies = new Map();
  for (const part of String(cookieHeader || "").split(";")) {
    const [name, ...valueParts] = part.trim().split("=");
    if (!name || valueParts.length === 0) {
      continue;
    }
    cookies.set(name, decodeURIComponent(valueParts.join("=")));
  }
  return cookies;
}

function createSessionCookie(sessionId, maxAgeSeconds = TEAM_SESSION_TTL_SEC) {
  const sameSite = ["Lax", "Strict", "None"].includes(COOKIE_SAME_SITE) ? COOKIE_SAME_SITE : "Lax";
  const secure = COOKIE_SECURE || sameSite === "None" ? "; Secure" : "";
  return `scoutx_session=${encodeURIComponent(sessionId)}; HttpOnly; SameSite=${sameSite}; Path=/; Max-Age=${maxAgeSeconds}${secure}`;
}

function clearSessionCookie() {
  const sameSite = ["Lax", "Strict", "None"].includes(COOKIE_SAME_SITE) ? COOKIE_SAME_SITE : "Lax";
  const secure = COOKIE_SECURE || sameSite === "None" ? "; Secure" : "";
  return `scoutx_session=; HttpOnly; SameSite=${sameSite}; Path=/; Max-Age=0${secure}`;
}

function toPublicAccount(account) {
  if (!account) {
    return null;
  }
  return {
    id: account.id,
    name: account.name,
    email: account.email || "",
    emailVerified: isAccountEmailVerified(account),
    profileImage: account.profileImage || "",
    birthDate: account.birthDate || "",
    profileComplete: isAccountProfileComplete(account),
    role: account.role,
    teamId: account.teamId,
    active: account.active !== false,
  };
}

function getAccountAuthStatus(account) {
  if (!isAccountEmailVerified(account)) {
    return { status: "email_verification_required", error: "Bitte bestätige zuerst deine E-Mail-Adresse." };
  }
  if (!isAccountProfileComplete(account)) {
    return { status: "profile_required", error: "Bitte vervollständige dein Scout-Profil." };
  }
  return { status: "connected", error: "" };
}

function toPublicTeam(team) {
  return {
    ...team,
    accounts: (Array.isArray(team?.accounts) ? team.accounts : []).map(toPublicAccount).filter(Boolean),
  };
}

function verifyPassword(password, passwordHash) {
  const parts = String(passwordHash || "").split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2-sha256") {
    return false;
  }
  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations < 100000 || iterations > 1000000) {
    return false;
  }
  const expected = Buffer.from(parts[3], "base64url");
  const actual = pbkdf2Sync(String(password || ""), parts[2], iterations, expected.length, "sha256");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function createPasswordHash(password) {
  const iterations = 210000;
  const salt = randomBytes(16).toString("base64url");
  const hash = pbkdf2Sync(String(password || ""), salt, iterations, 32, "sha256").toString("base64url");
  return `pbkdf2-sha256$${iterations}$${salt}$${hash}`;
}

function normalizeAccountId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseTeamJoinAllowlist(rawValue) {
  const text = String(rawValue || "").trim();
  if (!text) {
    return {};
  }
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error("ADAPTER_TEAM_JOIN_ALLOWLIST muss valides JSON sein.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("ADAPTER_TEAM_JOIN_ALLOWLIST muss ein JSON-Objekt sein (teamKey -> [userId]).");
  }
  const result = {};
  for (const [teamKeyRaw, usersRaw] of Object.entries(parsed)) {
    const teamKey = normalizeAccountId(teamKeyRaw);
    if (!teamKey) {
      continue;
    }
    if (!Array.isArray(usersRaw)) {
      throw new Error(`ADAPTER_TEAM_JOIN_ALLOWLIST Eintrag für '${teamKeyRaw}' muss ein Array sein.`);
    }
    const users = new Set();
    for (const userIdRaw of usersRaw) {
      const userId = normalizeAccountId(userIdRaw);
      if (userId) {
        users.add(userId);
      }
    }
    result[teamKey] = Object.freeze(Array.from(users));
  }
  return result;
}

function isTeamJoinAllowedByAllowlist({ teamKey, userId }) {
  if (!TEAM_JOIN_ALLOWLIST_ENABLED) {
    return true;
  }
  const normalizedTeamKey = normalizeAccountId(teamKey);
  const normalizedUserId = normalizeAccountId(userId);
  if (!normalizedTeamKey || !normalizedUserId) {
    return false;
  }
  const teamAllowlist = TEAM_JOIN_ALLOWLIST_MAP[normalizedTeamKey];
  if (!Array.isArray(teamAllowlist) || teamAllowlist.length === 0) {
    return false;
  }
  return teamAllowlist.includes(normalizedUserId);
}

function nowIso() {
  return new Date().toISOString();
}

function hasTokenExpired(expiresAt) {
  const expiresAtMs = Date.parse(String(expiresAt || ""));
  return !Number.isFinite(expiresAtMs) || Date.now() > expiresAtMs;
}

function findTeamAccountRecordById(userId) {
  const id = normalizeAccountId(userId);
  return (Array.isArray(state.team?.team?.accounts) ? state.team.team.accounts : []).find((item) => item?.id === id) || null;
}

async function resolveAccountForAuth(userId, logger) {
  const normalizedId = normalizeAccountId(userId);
  const email = normalizeEmail(userId);
  if (!normalizedId && !email) {
    return null;
  }
  if (EFFECTIVE_AUTH_READS_FROM_DB) {
    const dbAccount = await fetchTeamAccountByIdFromDb(normalizedId, logger);
    if (dbAccount) {
      return dbAccount;
    }
  }
  const direct = normalizedId ? findAccount(state.team, normalizedId) : null;
  if (direct) {
    return direct;
  }
  return (
    (Array.isArray(state.team?.team?.accounts) ? state.team.team.accounts : []).find(
      (account) => normalizeEmail(account?.email) === email && account?.active !== false,
    ) || null
  );
}

async function resolveAccountForSession(userId, logger) {
  const normalizedId = normalizeAccountId(userId);
  if (!normalizedId) {
    return null;
  }
  const stateAccount = findTeamAccountRecordById(normalizedId);
  if (stateAccount) {
    return stateAccount;
  }
  if (EFFECTIVE_AUTH_READS_FROM_DB) {
    return fetchTeamAccountByIdFromDb(normalizedId, logger);
  }
  return null;
}

function hasTeamSessionExpired(session) {
  const expiresAtMs = Date.parse(String(session?.expiresAt || ""));
  if (Number.isFinite(expiresAtMs)) {
    return Date.now() > expiresAtMs;
  }
  const createdAtMs = Date.parse(String(session?.createdAt || ""));
  return !Number.isFinite(createdAtMs) || Date.now() - createdAtMs > TEAM_SESSION_TTL_SEC * 1000;
}

async function resolveTeamSessionContext(req, logger) {
  const cookies = parseCookies(req.headers.cookie || "");
  const sessionId = cookies.get("scoutx_session") || "";
  if (!sessionId) {
    return null;
  }

  let session = null;
  let loadedFromDb = false;
  if (EFFECTIVE_SESSION_READS_FROM_DB || RUNTIME_DB_ENABLED) {
    const dbSession = await fetchRuntimeTeamSessionById(sessionId, logger);
    if (dbSession && !dbSession.revokedAt) {
      session = {
        userId: dbSession.accountId,
        teamId: dbSession.teamId,
        csrfToken: dbSession.csrfToken,
        createdAt: dbSession.createdAt,
        expiresAt: dbSession.expiresAt,
      };
      loadedFromDb = true;
    }
  }
  if (!session && !RUNTIME_DB_ENABLED) {
    session = teamSessions.get(sessionId) || null;
  }

  if (!session) {
    return null;
  }
  if (hasTeamSessionExpired(session)) {
    teamSessions.delete(sessionId);
    void revokeRuntimeTeamSession(sessionId, nowIso(), rootLogger);
    return null;
  }

  const account = await resolveAccountForSession(session.userId, logger);
  if (!account || account.teamId !== session.teamId || account.teamId !== state.team.team.id) {
    teamSessions.delete(sessionId);
    void revokeRuntimeTeamSession(sessionId, nowIso(), rootLogger);
    return null;
  }

  if (loadedFromDb && !RUNTIME_DB_ENABLED) {
    teamSessions.set(sessionId, session);
  }

  return {
    sessionId,
    session,
    account,
  };
}

function getTeamSessionContext(req) {
  if (req && Object.prototype.hasOwnProperty.call(req, "__teamSessionContext")) {
    return req.__teamSessionContext || null;
  }
  if (RUNTIME_DB_ENABLED) {
    return null;
  }
  const cookies = parseCookies(req.headers.cookie || "");
  const sessionId = cookies.get("scoutx_session") || "";
  const session = teamSessions.get(sessionId);
  if (!session) {
    return null;
  }
  if (hasTeamSessionExpired(session)) {
    teamSessions.delete(sessionId);
    void revokeRuntimeTeamSession(sessionId, nowIso(), rootLogger);
    return null;
  }

  const account = findAccount(state.team, session.userId);
  if (!account || account.teamId !== session.teamId || account.teamId !== state.team.team.id) {
    teamSessions.delete(sessionId);
    void revokeRuntimeTeamSession(sessionId, nowIso(), rootLogger);
    return null;
  }

  return {
    sessionId,
    session,
    account,
  };
}

function requireTeamSession(req, res, origin, requestId) {
  const context = getTeamSessionContext(req);
  if (!context) {
    sendJson(res, 401, { ok: false, error: "Team-Anmeldung erforderlich." }, origin, requestId);
    return null;
  }
  return context;
}

function requireTeamCsrf(req, context, res, origin, requestId) {
  const provided = String(req.headers["x-csrf-token"] || "");
  if (!provided || !timingSafeTokenEquals(provided, context.session.csrfToken)) {
    sendJson(res, 403, { ok: false, error: "CSRF-Token fehlt oder ist ungültig." }, origin, requestId);
    return false;
  }
  return true;
}

async function requireTeamWriteAllowed(req, context, res, origin, requestId, clientIp) {
  if (!(await checkScopedRateLimit(teamWriteRateStore, `${clientIp}:${context.account.teamId}:${context.account.id}`, TEAM_WRITE_RATE_LIMIT_MAX))) {
    sendJson(res, 429, { ok: false, error: "Zu viele Team-Schreibzugriffe. Bitte später erneut versuchen." }, origin, requestId);
    return false;
  }
  if (!canWriteTeamState(context.account)) {
    sendJson(res, 403, { ok: false, error: "Keine Schreibrechte für diese Team-Aktion." }, origin, requestId);
    return false;
  }
  if (!requireTeamCsrf(req, context, res, origin, requestId)) {
    return false;
  }
  return true;
}

function getTeamLoginLockState(loginUserId, now = Date.now()) {
  const key = String(loginUserId || "").trim().toLowerCase() || "unknown";
  const current = teamLoginLockStore.get(key);
  if (!current) {
    return { locked: false, retryAfterSec: 0 };
  }
  if (!current?.lockedUntil) {
    return { locked: false, retryAfterSec: 0 };
  }
  const lockedUntilMs = Date.parse(String(current?.lockedUntil || ""));
  if (!Number.isFinite(lockedUntilMs) || lockedUntilMs <= now) {
    teamLoginLockStore.delete(key);
    return { locked: false, retryAfterSec: 0 };
  }
  return {
    locked: true,
    retryAfterSec: Math.max(1, Math.ceil((lockedUntilMs - now) / 1000)),
  };
}

function registerTeamLoginFailure(loginUserId, now = Date.now()) {
  const key = String(loginUserId || "").trim().toLowerCase() || "unknown";
  const current = teamLoginLockStore.get(key);
  const nextFailures = Number(current?.failures || 0) + 1;
  if (nextFailures >= TEAM_LOGIN_LOCK_THRESHOLD) {
    const lockedUntil = new Date(now + TEAM_LOGIN_LOCK_DURATION_SEC * 1000).toISOString();
    teamLoginLockStore.set(key, { failures: nextFailures, lockedUntil });
    return {
      locked: true,
      retryAfterSec: TEAM_LOGIN_LOCK_DURATION_SEC,
      failures: nextFailures,
      lockedUntil,
    };
  }
  teamLoginLockStore.set(key, { failures: nextFailures, lockedUntil: "" });
  return {
    locked: false,
    retryAfterSec: 0,
    failures: nextFailures,
    lockedUntil: "",
  };
}

function clearTeamLoginFailure(loginUserId) {
  const key = String(loginUserId || "").trim().toLowerCase() || "unknown";
  teamLoginLockStore.delete(key);
}

function buildTeamStatePayload(context, teamStateInput = null) {
  const normalized = normalizeTeamState(teamStateInput || state.team);
  const recipientId = String(context?.account?.id || "").trim().toLowerCase();
  const visibleNotifications = (Array.isArray(normalized.notifications) ? normalized.notifications : []).filter((item) => {
    const target = String(item?.recipientId || "").trim().toLowerCase();
    return !target || target === recipientId;
  });
  return {
    ok: true,
    ...getAccountAuthStatus(context.account),
    user: toPublicAccount(context.account),
    team: toPublicTeam(normalized.team),
    manualGames: normalized.manualGames,
    teamGoals: normalized.teamGoals,
    observations: normalized.observations,
    notifications: visibleNotifications,
    feedItems: normalized.feedItems,
  };
}

function isCriticalNotificationType(type) {
  return ["absage", "konflikt", "followup", "plan"].includes(String(type || "").trim().toLowerCase());
}

function registerTeamPushStream(teamId, stream) {
  const key = String(teamId || "").trim();
  if (!key || !stream || typeof stream.write !== "function") {
    return () => {};
  }
  const bucket = teamPushStreams.get(key) || new Set();
  bucket.add(stream);
  teamPushStreams.set(key, bucket);
  return () => {
    const current = teamPushStreams.get(key);
    if (!current) {
      return;
    }
    current.delete(stream);
    if (current.size === 0) {
      teamPushStreams.delete(key);
    }
  };
}

function emitTeamPushEvents(teamId, events) {
  const key = String(teamId || "").trim();
  if (!key) {
    return;
  }
  const bucket = teamPushStreams.get(key);
  if (!bucket || bucket.size === 0) {
    return;
  }
  const payloadEvents = (Array.isArray(events) ? events : []).filter(Boolean);
  if (payloadEvents.length === 0) {
    return;
  }
  const payload = JSON.stringify({
    ok: true,
    type: "team_push_events",
    events: payloadEvents,
  });
  for (const stream of [...bucket]) {
    try {
      stream.write(`data: ${payload}\n\n`);
      for (const event of payloadEvents) {
        const eventId = String(event?.eventId || "").trim();
        if (!eventId) {
          continue;
        }
        const current = teamPushOutbox.get(eventId);
        if (!current) {
          continue;
        }
        const deliveredCount = Number(current?.deliveredCount || 0);
        teamPushOutbox.set(eventId, {
          ...current,
          status: "delivered",
          deliveredCount: deliveredCount + 1,
          lastDeliveredAt: nowIso(),
        });
        void persistPushOutboxEvent(teamPushOutbox.get(eventId), rootLogger);
      }
    } catch {
      bucket.delete(stream);
    }
  }
  if (bucket.size === 0) {
    teamPushStreams.delete(key);
  }
}

function enqueueCriticalPushEvents(teamState) {
  const teamId = String(teamState?.team?.id || state.team?.team?.id || "");
  const notifications = Array.isArray(teamState?.notifications) ? teamState.notifications : [];
  const queuedEvents = [];
  for (const item of notifications) {
    const eventId = normalizeAccountId(item?.eventId || item?.id);
    const type = String(item?.type || "").trim().toLowerCase();
    if (!eventId || !isCriticalNotificationType(type)) {
      continue;
    }
    // Nur frische Ereignisse pushen: alte Notifications im Team-State sollen
    // nach Deploy/Neustart keine Popup-Flut auslösen.
    const createdAtMs = Date.parse(String(item?.createdAt || ""));
    if (Number.isFinite(createdAtMs) && Date.now() - createdAtMs > 24 * 60 * 60 * 1000) {
      continue;
    }
    if (pushedCriticalEventIds.has(eventId) || teamPushOutbox.has(eventId)) {
      continue;
    }
    const outboxEvent = {
      eventId,
      teamId,
      type,
      title: String(item?.title || ""),
      body: String(item?.body || ""),
      createdAt: String(item?.createdAt || nowIso()),
      status: "new",
      deliveredCount: 0,
      lastDeliveredAt: "",
    };
    teamPushOutbox.set(eventId, outboxEvent);
    queuedEvents.push(outboxEvent);
    void persistPushOutboxEvent(outboxEvent, rootLogger);
  }
  if (queuedEvents.length > 0) {
    emitTeamPushEvents(teamId, queuedEvents);
  }
}

function prunePushOutbox(nowMs = Date.now(), maxAgeMs = PUSH_OUTBOX_MAX_AGE_MS) {
  const cutoff = Number(nowMs) - Number(maxAgeMs);
  for (const [eventId, event] of teamPushOutbox) {
    const createdAtMs = Date.parse(String(event?.createdAt || ""));
    if (!Number.isFinite(createdAtMs) || createdAtMs < cutoff) {
      teamPushOutbox.delete(eventId);
    }
  }
}

async function persistTeamState(nextTeamState, logger, reason) {
  state.team = normalizeTeamState(nextTeamState);
  const archiveTeamState = {
    ...state.team,
    team: {
      ...(state.team?.team || {}),
      accounts: (Array.isArray(state.team?.team?.accounts) ? state.team.team.accounts : []).map((account) => {
        const nextAccount = { ...account };
        delete nextAccount.passwordHash;
        return nextAccount;
      }),
    },
  };
  try {
    state.team = await writeTeamState(TEAM_STATE_FILE, state.team);
    await ensureTeamDbMirrorsSynced(state.team, logger, {
      persistTeamStateToDb,
      syncTeamAccountsToDb,
      syncTeamNotificationsToDb,
      syncTeamObservationsToDb,
      syncTeamReportsToDb,
      syncTeamFeedItemsToDb,
    }, { strict: DB_FIRST_MODE });
    enqueueCriticalPushEvents(state.team);
    await appendTeamStateArchive(TEAM_ARCHIVE_FILE, {
      archivedAt: new Date().toISOString(),
      reason: String(reason || "team-update"),
      teamStateVersion: state.team.version || 1,
      teamState: archiveTeamState,
    });
    await persistTeamArchiveEventToDb(
      {
        archivedAt: new Date().toISOString(),
        reason: String(reason || "team-update"),
        teamStateVersion: state.team.version || 1,
        teamState: archiveTeamState,
      },
      logger,
    );
    return true;
  } catch (error) {
    logger.error("team state write failed", { reason, error });
    return false;
  }
}

let teamStateMutationChain = Promise.resolve();
let storeMutationChain = Promise.resolve();
const TEAM_WRITE_IDEMPOTENCY_TTL_MS = 5 * 60 * 1000;
const TEAM_WRITE_IDEMPOTENCY_MAX = 2000;
const TEAM_WRITE_IDEMPOTENCY_KEY_MAX_LENGTH = 256;
const TEAM_WRITE_IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]+$/;
const teamWriteIdempotencyCache = new Map();

function pruneTeamWriteIdempotencyCache(nowMs = Date.now()) {
  const cutoff = Number(nowMs) - TEAM_WRITE_IDEMPOTENCY_TTL_MS;
  for (const [key, entry] of teamWriteIdempotencyCache) {
    if (!entry || Number(entry.createdAt || 0) < cutoff) {
      teamWriteIdempotencyCache.delete(key);
    }
  }
  while (teamWriteIdempotencyCache.size > TEAM_WRITE_IDEMPOTENCY_MAX) {
    const oldestKey = teamWriteIdempotencyCache.keys().next().value;
    if (!oldestKey) {
      break;
    }
    teamWriteIdempotencyCache.delete(oldestKey);
  }
}

function serializeIdempotencyPayload(payload) {
  const canonicalize = (value) => {
    if (Array.isArray(value)) {
      return value.map((item) => canonicalize(item));
    }
    if (value && typeof value === "object") {
      const entries = Object.entries(value)
        .sort(([a], [b]) => String(a).localeCompare(String(b)))
        .map(([key, nestedValue]) => [key, canonicalize(nestedValue)]);
      return Object.fromEntries(entries);
    }
    return value;
  };
  try {
    return JSON.stringify(canonicalize(payload ?? null));
  } catch {
    return "";
  }
}

async function runTeamWriteIdempotent(req, context, scope, payload, execute) {
  const primaryHeader = String(req.headers["idempotency-key"] || "").trim();
  const fallbackHeader = String(req.headers["x-idempotency-key"] || "").trim();
  if (primaryHeader && fallbackHeader && primaryHeader !== fallbackHeader) {
    const keyError = new Error("idempotency-key und x-idempotency-key widersprechen sich.");
    keyError.statusCode = 400;
    throw keyError;
  }
  const headerValue = primaryHeader || fallbackHeader;
  if (!headerValue) {
    const directResult = await execute();
    return { ...directResult, replayed: false };
  }
  if (headerValue.length > TEAM_WRITE_IDEMPOTENCY_KEY_MAX_LENGTH) {
    const keyError = new Error(`Idempotency-Key darf maximal ${TEAM_WRITE_IDEMPOTENCY_KEY_MAX_LENGTH} Zeichen enthalten.`);
    keyError.statusCode = 400;
    throw keyError;
  }
  if (!TEAM_WRITE_IDEMPOTENCY_KEY_PATTERN.test(headerValue)) {
    const keyError = new Error("Idempotency-Key enthält ungültige Zeichen.");
    keyError.statusCode = 400;
    throw keyError;
  }
  const teamId = String(context?.account?.teamId || "").trim();
  const userId = String(context?.account?.id || "").trim();
  if (!teamId || !userId) {
    const directResult = await execute();
    return { ...directResult, replayed: false };
  }

  pruneTeamWriteIdempotencyCache();
  const requestHash = createHash("sha256").update(serializeIdempotencyPayload(payload)).digest("base64url");
  const method = String(req?.method || "").trim().toUpperCase();
  const cacheKey = `${method}:${teamId}:${userId}:${String(scope || "")}:${headerValue}`;
  const existing = teamWriteIdempotencyCache.get(cacheKey);
  if (existing) {
    if (String(existing.requestHash || "") !== requestHash) {
      const conflictError = new Error("Idempotency-Key wurde bereits mit anderem Payload verwendet.");
      conflictError.statusCode = 409;
      throw conflictError;
    }
    const cachedResult = await existing.promise;
    return { ...cachedResult, replayed: true };
  }

  const promise = Promise.resolve().then(execute);
  teamWriteIdempotencyCache.set(cacheKey, {
    createdAt: Date.now(),
    requestHash,
    promise,
  });
  try {
    const result = await promise;
    teamWriteIdempotencyCache.set(cacheKey, {
      createdAt: Date.now(),
      requestHash,
      promise: Promise.resolve(result),
    });
    return { ...result, replayed: false };
  } catch (error) {
    teamWriteIdempotencyCache.delete(cacheKey);
    throw error;
  }
}

async function applyTeamStateMutation(logger, reason, mutateFn) {
  const runMutation = async () => {
    const currentState = normalizeTeamState(state.team);
    const mutation = await mutateFn(currentState);
    const nextTeamState = mutation && typeof mutation === "object" && mutation.state ? mutation.state : mutation;
    const persisted = await persistTeamState(nextTeamState, logger, reason);
    if (!persisted) {
      const error = new Error("Team-State konnte nicht gespeichert werden.");
      error.statusCode = 500;
      throw error;
    }
    return mutation;
  };

  const task = teamStateMutationChain.then(runMutation, runMutation);
  teamStateMutationChain = task.then(
    () => undefined,
    () => undefined,
  );
  return task;
}

async function runStoreMutationSerialized(reason, mutateFn) {
  const run = async () => mutateFn();
  const task = storeMutationChain.then(run, run);
  storeMutationChain = task.then(
    () => undefined,
    () => undefined,
  );
  return task;
}

async function readRecentTeamArchiveFromFile(filePath, limit) {
  if (!filePath) {
    return [];
  }
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));
  try {
    const content = await readFile(filePath, "utf8");
    const lines = String(content || "")
      .split(/\r?\n/g)
      .map((line) => line.trim())
      .filter(Boolean);
    const selected = lines.slice(Math.max(0, lines.length - safeLimit)).reverse();
    const events = [];
    for (const line of selected) {
      try {
        const parsed = JSON.parse(line);
        if (!parsed || typeof parsed !== "object") {
          continue;
        }
        events.push({
          archivedAt: String(parsed.archivedAt || ""),
          teamId: String(parsed.teamState?.team?.id || ""),
          reason: String(parsed.reason || ""),
          teamStateVersion: Number(parsed.teamStateVersion || 1),
          teamState: parsed.teamState && typeof parsed.teamState === "object" ? parsed.teamState : {},
          source: "ndjson",
        });
      } catch {
        // Skip malformed archive entries; keep diagnostics endpoint resilient.
      }
    }
    return events;
  } catch (error) {
    if (error?.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function writeStoreSafely(reason, payload, logger = rootLogger) {
  try {
    await writeStore(STORE_FILE, payload);
    return true;
  } catch (error) {
    logger.error("store write failed", { reason, error });
    state.lastError = `Store-Write fehlgeschlagen (${reason}). Vorheriger Stand bleibt aktiv.`;
    return false;
  }
}

async function refreshData(reason = "manual", logger = rootLogger) {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const result = await runStoreMutationSerialized(`refresh-data:${String(reason || "manual")}`, async () => {
        const next = await refreshStore({
          aliasesFile: ALIASES_FILE,
          importDir: IMPORT_DIR,
          sampleFile: SAMPLE_FILE,
          storeFile: STORE_FILE,
          remoteUrl: REMOTE_URL,
          remoteToken: REMOTE_TOKEN,
          remoteTimeoutMs: REMOTE_TIMEOUT_MS,
        });

        state.games = next.games;
        state.meta = next.meta;
        state.aliasMap = next.aliasMap;
        state.lastRefreshReason = reason;
        state.lastError = null;
        state.lastSuccessfulRefreshAt = nowIso();
        return next;
      });
      logger.info("adapter refresh completed", {
        reason,
        count: result.games.length,
        warnings: result.meta?.warnings?.length || 0,
      });

      return result;
    } catch (error) {
      state.lastError = error.message || "Refresh fehlgeschlagen.";
      logger.error("adapter refresh failed", { reason, error });
      await runStoreMutationSerialized(`refresh-fallback:${String(reason || "manual")}`, async () => {
        const fallbackStore = await readStore(STORE_FILE);
        if (fallbackStore.games.length > 0) {
          state.games = fallbackStore.games;
          state.meta = fallbackStore.meta;
        }
      });

      throw error;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function runRefreshIngestionJob(reason = "manual", logger = rootLogger) {
  const jobName = `refresh:${String(reason || "manual")}`;
  const correlationId = `refresh:${String(reason || "manual")}:${Date.now()}`;
  return ingestionJobs.runJob(
    jobName,
    () => refreshData(reason, logger),
    {
      retries: INGESTION_RETRY_MAX,
      backoffMs: INGESTION_BACKOFF_MS,
      category: "refresh",
      correlationId,
    },
    logger,
  );
}

function filterGamesToWeek(games, range) {
  return games.filter((game) => isDateInRange(game.date, range));
}

function shouldKeepExistingGameForWeek(game, params, weekRange) {
  if (!isDateInRange(game.date, weekRange)) {
    return true;
  }

  if (params.kreisId && game.kreisId && game.kreisId !== params.kreisId) {
    return true;
  }

  if (params.jugendId && game.jugendId && game.jugendId !== params.jugendId) {
    return true;
  }

  return false;
}

async function maybeAutoRefreshWeek(payload, logger = rootLogger, options = {}) {
  const strictLiveData = options?.strictLiveData === true;
  const hasDynamicSource = Boolean(EXPORT_COMMAND || WEEK_SOURCE_TEMPLATE);
  if (!AUTO_REFRESH_WEEK || !hasDynamicSource) {
    return { ran: false, reason: "disabled_or_not_configured" };
  }

  const weekRange = getWeekRange(payload.fromDate);
  if (!weekRange) {
    return { ran: false, reason: "invalid_from_date" };
  }

  const now = Date.now();
  const cacheKey = buildWeekCacheKey(payload, weekRange);
  const lastRefreshMs = state.weekRefreshCache[cacheKey] || 0;

  if (!shouldRefreshWeek(lastRefreshMs, now, WEEK_REFRESH_TTL_SEC)) {
    return { ran: false, reason: "cached", cacheKey, weekRange };
  }

  const pending = state.weekRefreshPromises[cacheKey];
  if (pending) {
    return pending;
  }

  const refreshPromise = (async () => {
    const externalTimeoutMs = Math.min(WEEK_EXTERNAL_TIMEOUT_MS, Math.max(1000, WEEK_COMMAND_TIMEOUT_MS));
    const params = {
      fromDate: weekRange.fromDate,
      toDate: weekRange.toDate,
      kreisId: payload.kreisId || "",
      stateCode: payload.stateCode || "",
      regionName: payload.regionName || "",
      regionShortCode: payload.regionShortCode || "",
      fussballDeMapping: payload.fussballDeMapping || null,
      jugendId: payload.jugendId || "",
      teams: Array.isArray(payload.teams) ? payload.teams : [],
    };

    const warnings = [];
    const collected = [];
    const liveSourceErrors = [];
    let plannedSources = 0;
    let successfulSources = 0;

    if (EXPORT_COMMAND) {
      plannedSources += 1;
      try {
        const cmd = await runExportCommand({
          command: EXPORT_COMMAND,
          timeoutMs: externalTimeoutMs,
          params,
          importDir: IMPORT_DIR,
        });

        if (cmd.warnings?.length) {
          warnings.push(...cmd.warnings);
          if (strictLiveData) {
            throw new Error(`Export command warning: ${cmd.warnings.join(" | ")}`);
          }
        }

        const normalized = normalizeGames(cmd.games, {
          aliasMap: state.aliasMap,
          source: cmd.source,
        });
        collected.push(...filterGamesToWeek(normalized, weekRange));
        successfulSources += 1;
      } catch (error) {
        const message = `Export command failed: ${error.message || error}`;
        warnings.push(message);
        liveSourceErrors.push(message);
        logger.warn("week export command failed", {
          cacheKey,
          reason: String(error.message || error),
          stateCode: params.stateCode,
          regionName: params.regionName,
          regionShortCode: params.regionShortCode,
        });
      }
    }

    if (WEEK_SOURCE_TEMPLATE) {
      plannedSources += 1;
      try {
        const remote = await fetchWeekTemplateGames({
          template: WEEK_SOURCE_TEMPLATE,
          token: WEEK_SOURCE_TOKEN,
          params,
          timeoutMs: externalTimeoutMs,
        });

        if (remote.warnings?.length) {
          warnings.push(...remote.warnings);
          if (strictLiveData) {
            throw new Error(`Week source warning: ${remote.warnings.join(" | ")}`);
          }
        }

        const normalized = normalizeGames(remote.games, {
          aliasMap: state.aliasMap,
          source: remote.source,
        });
        collected.push(...filterGamesToWeek(normalized, weekRange));
        successfulSources += 1;
      } catch (error) {
        const message = `Week source failed: ${error.message || error}`;
        warnings.push(message);
        liveSourceErrors.push(message);
        logger.warn("week template source failed", {
          cacheKey,
          reason: String(error.message || error),
          stateCode: params.stateCode,
          regionName: params.regionName,
          regionShortCode: params.regionShortCode,
        });
      }
    }

    if (strictLiveData && plannedSources > 0 && successfulSources === 0) {
      throw new Error(`Live-Datenabruf fehlgeschlagen: ${liveSourceErrors.join(" | ") || "keine Quelle erfolgreich"}`);
    }

    // Wochen-Scrapes anderer Altersklassen/Kreise leben nur im Store; der
    // Import/Remote-Baseline-Refresh würde sie verwerfen. Vorherigen Stand
    // sichern und beim Merge wieder einmischen.
    const previousGames = Array.isArray(state.games) ? state.games : [];
    // Reload import/remote baseline after command execution
    await refreshData("auto-week-base", logger);

    const serializedStoreResult = await runStoreMutationSerialized("auto-week", async () => {
      // Basis erst hier aus state.games bilden: parallele auto-week-Läufe
      // (andere Altersklasse) haben bis hierhin evtl. schon geschrieben.
      const baselineGames = dedupeGames([...state.games, ...previousGames]);
      const replaceBaseline =
        collected.length > 0
          ? baselineGames.filter((game) => shouldKeepExistingGameForWeek(game, params, weekRange))
          : baselineGames;

      const replaced = baselineGames.length - replaceBaseline.length;
      const merged = dedupeGames([...replaceBaseline, ...collected]);
      const added = merged.length - baselineGames.length;

      const weekMeta = {
        week: weekRange,
        cacheKey,
        refreshedAt: new Date().toISOString(),
        added,
        replaced,
        collected: collected.length,
        warnings,
      };

      const nextMeta = {
        ...(state.meta || {}),
        updatedAt: new Date().toISOString(),
        counts: {
          ...(state.meta?.counts || {}),
          total: merged.length,
        },
        weekRefresh: weekMeta,
      };

      const persisted = await writeStoreSafely("auto-week", { games: merged, meta: nextMeta }, logger);
      if (!persisted) {
        return { persisted: false };
      }
      state.games = merged;
      state.meta = nextMeta;
      state.lastRefreshReason = "auto-week";
      state.lastError = warnings.length ? warnings.join(" | ") : null;
      state.lastSuccessfulRefreshAt = nowIso();
      state.weekRefreshCache[cacheKey] = now;
      return { persisted: true, added, replaced };
    });
    if (!serializedStoreResult?.persisted) {
      return {
        ran: false,
        reason: "store_write_failed",
        weekRange,
        cacheKey,
        added: 0,
        replaced: 0,
        collected: collected.length,
        warnings: [...warnings, "Store konnte nicht geschrieben werden."],
      };
    }
    logger.info("week refresh completed", {
      cacheKey,
      added: serializedStoreResult.added,
      replaced: serializedStoreResult.replaced,
      collected: collected.length,
      warningCount: warnings.length,
      stateCode: params.stateCode,
      regionName: params.regionName,
      regionShortCode: params.regionShortCode,
      jugendId: params.jugendId,
    });

    return {
      ran: true,
      reason: "refreshed",
      weekRange,
      cacheKey,
      added: serializedStoreResult.added,
      replaced: serializedStoreResult.replaced,
      collected: collected.length,
      warnings,
    };
  })();

  state.weekRefreshPromises[cacheKey] = refreshPromise;

  try {
    return await refreshPromise;
  } finally {
    delete state.weekRefreshPromises[cacheKey];
  }
}

function getHealthPayload() {
  const storeExtension = extname(String(STORE_FILE || "")).toLowerCase();
  const storeBackend = [".db", ".sqlite", ".sqlite3"].includes(storeExtension) ? "sqlite" : "json";
  return {
    ok: true,
    service: "scoutx-adapter",
    timestamp: new Date().toISOString(),
    count: state.games.length,
    clubsCount: state.clubs.length,
    lastRefreshReason: state.lastRefreshReason,
    lastError: state.lastError,
    remoteConfigured: Boolean(REMOTE_URL),
    authEnabled: Boolean(AUTH_TOKEN),
    dbFirstMode: DB_FIRST_MODE,
    dbUrlConfigured: DATABASE_URL_CONFIGURED,
    dbReadModes: {
      auth: EFFECTIVE_AUTH_READS_FROM_DB,
      sessions: EFFECTIVE_SESSION_READS_FROM_DB,
      teamState: EFFECTIVE_TEAM_STATE_READS_FROM_DB,
      notifications: EFFECTIVE_NOTIFICATIONS_READS_FROM_DB,
      observations: EFFECTIVE_OBSERVATIONS_READS_FROM_DB,
      reports: EFFECTIVE_REPORTS_READS_FROM_DB,
      feed: EFFECTIVE_FEED_READS_FROM_DB,
    },
    refreshIntervalSec: REFRESH_INTERVAL_SEC,
    autoRefreshWeek: AUTO_REFRESH_WEEK,
    weekSourceConfigured: Boolean(WEEK_SOURCE_TEMPLATE || EXPORT_COMMAND),
    storeBackend,
    storeFile: STORE_FILE,
    meta: state.meta,
  };
}

function buildAdminMeta() {
  return {
    count: state.games.length,
    clubsCount: state.clubs.length,
    lastRefreshReason: state.lastRefreshReason,
    lastError: state.lastError,
    meta: state.meta,
    jobs: ingestionJobs.listJobs(),
    provenance: buildGameProvenanceSummary(),
    alerts: buildMonitoringAlerts(),
    runtimeMetrics: {
      ...state.runtimeMetrics,
      statusCounts: { ...(state.runtimeMetrics.statusCounts || {}) },
    },
    startedAt: state.startedAt,
    lastSuccessfulRefreshAt: state.lastSuccessfulRefreshAt,
  };
}

async function buildDbReadinessReport(logger = rootLogger) {
  const readModes = {
    auth: EFFECTIVE_AUTH_READS_FROM_DB,
    sessions: EFFECTIVE_SESSION_READS_FROM_DB,
    teamState: EFFECTIVE_TEAM_STATE_READS_FROM_DB,
    notifications: EFFECTIVE_NOTIFICATIONS_READS_FROM_DB,
    observations: EFFECTIVE_OBSERVATIONS_READS_FROM_DB,
    reports: EFFECTIVE_REPORTS_READS_FROM_DB,
    feed: EFFECTIVE_FEED_READS_FROM_DB,
  };

  const report = {
    ok: false,
    dbFirstMode: DB_FIRST_MODE,
    dbUrlConfigured: DATABASE_URL_CONFIGURED,
    readModes,
    probes: {},
  };

  if (!DATABASE_URL_CONFIGURED) {
    return report;
  }

  const probeTeamId = String(state.team?.team?.id || "");
  const toType = (value) => {
    if (value === null || value === undefined) {
      return "null";
    }
    if (Array.isArray(value)) {
      return "array";
    }
    return typeof value;
  };

  const safeProbe = async (name, runner) => {
    try {
      const value = await runner();
      report.probes[name] = { ok: true, valueType: toType(value) };
      return value;
    } catch (error) {
      report.probes[name] = { ok: false, valueType: "error", error: String(error?.message || error) };
      return null;
    }
  };

  const probed = {
    accounts: await safeProbe("accounts", () => fetchTeamAccountByIdFromDb("user-admin", logger)),
    sessions: await safeProbe("sessions", () => fetchRuntimeTeamSessionById("probe-session", logger)),
    teamState: await safeProbe("teamState", () => fetchTeamStateFromDb(probeTeamId, logger)),
    notifications: await safeProbe("notifications", () => fetchTeamNotificationsFromDb(probeTeamId, logger)),
    observations: await safeProbe("observations", () => fetchTeamObservationsFromDb(probeTeamId, logger)),
    reports: await safeProbe("reports", () => fetchTeamReportMapFromDb(probeTeamId, logger)),
    feed: await safeProbe("feed", () => fetchTeamFeedItemsFromDb(probeTeamId, logger)),
    push: await safeProbe("push", () => fetchPushRuntimeSnapshot(probeTeamId, logger)),
    archive: await safeProbe("archive", () => fetchRecentTeamArchiveEvents(1, logger)),
  };

  if (!DB_FIRST_MODE) {
    report.ok = Object.values(report.probes).every((item) => item?.ok !== false);
    return report;
  }

  // In DB-first mode, core domain probes must return non-null values to be considered ready.
  const requiredKeys = ["teamState", "notifications", "observations", "reports", "feed"];
  report.ok =
    requiredKeys.every((key) => report.probes[key]?.ok === true) &&
    requiredKeys.every((key) => probed[key] !== null && probed[key] !== undefined);
  return report;
}

function normalizeUnderscoreKeyMap(raw) {
  const out = {};
  for (const [key, value] of Object.entries(raw || {})) {
    out[String(key || "").replace(/^_/, "")] = value;
  }
  return out;
}

async function fetchBasePayload({ signal }) {
  const baseUrl = String(MANDANT_PROBE_BASE_URL || "").replace(/\/+$/, "");
  const baseResponse = await fetch(`${baseUrl}/wam_base.json`, { signal });
  if (!baseResponse.ok) {
    throw new Error(`wam_base HTTP ${baseResponse.status}`);
  }
  const basePayload = await baseResponse.json();
  return { baseUrl, basePayload };
}

async function fetchMandantProbe({ mandant, season = "", competitionType = "", logger = rootLogger }) {
  const normalizedMandant = String(mandant || "").trim();
  if (!/^\d{1,3}$/.test(normalizedMandant)) {
    throw new Error("Ungültiger Mandant. Erwartet wird eine numerische Kennzahl.");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MANDANT_PROBE_TIMEOUT_MS);

  try {
    const { baseUrl, basePayload } = await fetchBasePayload({ signal: controller.signal });
    const effectiveSeason = String(season || basePayload?.currentSaison || "").trim();
    const competitionTypes = resolveFussballDeCompetitionTypes({
      base: basePayload,
      mandant: normalizedMandant,
      season: effectiveSeason,
      requestedType: competitionType,
    });

    if (!effectiveSeason) {
      throw new Error("Keine Saison verfügbar (wam_base.currentSaison leer).");
    }

    const teamTypes = {};
    const leagueIds = new Set();
    const kindsUrls = [];

    for (const effectiveCompetitionType of competitionTypes) {
      const kindsUrl = `${baseUrl}/wam_kinds_${normalizedMandant}_${effectiveSeason}_${effectiveCompetitionType}.json`;
      const kindsResponse = await fetch(kindsUrl, { signal: controller.signal });
      if (!kindsResponse.ok) {
        throw new Error(`wam_kinds HTTP ${kindsResponse.status}`);
      }
      const kindsPayload = await kindsResponse.json();
      Object.assign(teamTypes, normalizeUnderscoreKeyMap(kindsPayload?.Mannschaftsart || {}));
      kindsUrls.push(kindsUrl);

      const spielklasseByType = normalizeUnderscoreKeyMap(kindsPayload?.Spielklasse || {});
      for (const byLeague of Object.values(spielklasseByType)) {
        const normalized = normalizeUnderscoreKeyMap(byLeague || {});
        for (const leagueId of Object.keys(normalized)) {
          leagueIds.add(leagueId);
        }
      }
    }

    const probe = {
      ok: true,
      mandant: normalizedMandant,
      season: effectiveSeason,
      competitionType: competitionTypes[0] || "",
      competitionTypes,
      teamTypeCount: Object.keys(teamTypes).length,
      leagueCount: leagueIds.size,
      teamTypes,
      kindsUrl: kindsUrls[0] || "",
      kindsUrls,
    };

    logger.info("mandant probe succeeded", {
      mandant: normalizedMandant,
      season: effectiveSeason,
      competitionTypes,
      leagueCount: probe.leagueCount,
      teamTypeCount: probe.teamTypeCount,
    });
    return probe;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`Mandant-Probe Timeout nach ${MANDANT_PROBE_TIMEOUT_MS}ms`);
    }
    logger.warn("mandant probe failed", {
      mandant: normalizedMandant,
      season,
      competitionType,
      error,
    });
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchVerbandStatusRow(verband, basePayload, logger) {
  const mandant = String(verband?.mandant || "").trim();
  const season = String(basePayload?.currentSaison || "").trim();
  const competitionType = String(basePayload?.defaultCompetitionType || "1").trim() || "1";
  const baseUrl = String(MANDANT_PROBE_BASE_URL || "").replace(/\/+$/, "");
  const kindsUrl = `${baseUrl}/wam_kinds_${mandant}_${season}_${competitionType}.json`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MANDANT_PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(kindsUrl, { signal: controller.signal });
    if (!response.ok) {
      return {
        code: verband.code,
        label: verband.label,
        mandant,
        ok: false,
        status: response.status,
        error: `HTTP ${response.status}`,
      };
    }
    const payload = await response.json();
    const teamTypes = Object.keys(normalizeUnderscoreKeyMap(payload?.Mannschaftsart || {}));
    return {
      code: verband.code,
      label: verband.label,
      mandant,
      ok: true,
      season,
      competitionType,
      teamTypeCount: teamTypes.length,
    };
  } catch (error) {
    const errorMessage = error?.name === "AbortError" ? `Timeout nach ${MANDANT_PROBE_TIMEOUT_MS}ms` : String(error.message || error);
    logger.warn("verband status check failed", {
      verband: verband.code,
      mandant,
      error: errorMessage,
    });
    return {
      code: verband.code,
      label: verband.label,
      mandant,
      ok: false,
      error: errorMessage,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function collectKnownMandantStatus(logger = rootLogger) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MANDANT_PROBE_TIMEOUT_MS);
  try {
    const { basePayload } = await fetchBasePayload({ signal: controller.signal });
    const rows = [];
    for (let index = 0; index < KNOWN_VERBANDS.length; index += VERBAND_STATUS_MAX) {
      const chunk = KNOWN_VERBANDS.slice(index, index + VERBAND_STATUS_MAX);
      const part = await Promise.all(chunk.map((verband) => fetchVerbandStatusRow(verband, basePayload, logger)));
      rows.push(...part);
    }

    return {
      ok: true,
      fetchedAt: new Date().toISOString(),
      season: String(basePayload?.currentSaison || ""),
      competitionType: String(basePayload?.defaultCompetitionType || "1") || "1",
      total: rows.length,
      okCount: rows.filter((row) => row.ok).length,
      rows,
    };
  } finally {
    clearTimeout(timer);
  }
}

function summarizeDiscoveredMandants(basePayload) {
  const source = basePayload?.mandant || basePayload?.Mandant || basePayload?.associations || basePayload?.associationsById || {};
  const pairs = [];
  if (Array.isArray(source)) {
    for (const entry of source) {
      const mandant = String(entry?.id || entry?.mandant || entry?.value || "").trim();
      const label = String(entry?.name || entry?.label || "").trim();
      if (mandant) {
        pairs.push({ mandant, label });
      }
    }
    return pairs;
  }

  if (source && typeof source === "object") {
    for (const [key, value] of Object.entries(source)) {
      const mandant = String(key || "").replace(/^_/, "").trim();
      const label = String(value || "").trim();
      if (mandant) {
        pairs.push({ mandant, label });
      }
    }
  }
  return pairs;
}

async function runStartupVerbandDiscovery(logger = rootLogger) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MANDANT_PROBE_TIMEOUT_MS);
  try {
    const { basePayload } = await fetchBasePayload({ signal: controller.signal });
    const discovered = summarizeDiscoveredMandants(basePayload);
    if (discovered.length === 0) {
      logger.info("verband discovery: no association list found in wam_base");
      return;
    }

    const knownMandants = new Set(KNOWN_VERBANDS.map((entry) => entry.mandant));
    const discoveredMandants = new Set(discovered.map((entry) => entry.mandant));
    const unknown = discovered.filter((entry) => !knownMandants.has(entry.mandant));
    const missing = KNOWN_VERBANDS.filter((entry) => !discoveredMandants.has(entry.mandant));

    logger.info("verband discovery completed", {
      discoveredCount: discovered.length,
      configuredCount: KNOWN_VERBANDS.length,
      unknownMandants: unknown.map((entry) => `${entry.mandant}:${entry.label || "-"}`),
      missingConfiguredMandants: missing.map((entry) => `${entry.mandant}:${entry.code}`),
    });
  } catch (error) {
    const message = error?.name === "AbortError" ? `Timeout nach ${MANDANT_PROBE_TIMEOUT_MS}ms` : String(error.message || error);
    logger.warn("verband discovery failed", { error: message });
  } finally {
    clearTimeout(timer);
  }
}

const server = createServer(async (req, res) => {
  const requestId = randomUUID();
  const origin = req.headers.origin || "";
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const clientIp = req.headers["x-real-ip"] || req.socket.remoteAddress || "unknown";
  const requestLogger = rootLogger.withRequest(requestId).child({
    method: req.method,
    path: url.pathname,
    clientIp,
  });

  requestLogger.info("incoming request");

  if (req.method === "OPTIONS") {
    const corsOk = setCorsHeaders(res, origin);
    if (!corsOk) {
      res.writeHead(403, { "X-Request-Id": requestId });
      res.end();
      return;
    }
    res.writeHead(204, { "X-Request-Id": requestId });
    res.end();
    return;
  }

  if (url.pathname !== "/health" && !(await checkRateLimit(clientIp))) {
    requestLogger.warn("rate limit exceeded");
    sendJson(res, 429, { ok: false, error: "Zu viele Anfragen. Bitte später erneut versuchen." }, origin, requestId);
    return;
  }

  if (req.method === "GET" && url.pathname === "/health") {
    sendJson(res, 200, getHealthPayload(), origin, requestId);
    return;
  }

  req.__teamSessionContext = await resolveTeamSessionContext(req, requestLogger);
  const teamRouteBaseContext = createTeamRouteBaseContext({
    url,
    origin,
    requestId,
    clientIp,
    requestLogger,
    state,
    readBody,
    sendJson,
    persistTeamState,
    applyTeamStateMutation,
    runTeamWriteIdempotent,
    findAccount,
    createTeamSessionForAccount,
    createSessionCookie,
    buildTeamStatePayload,
  });

  if (req.method === "GET" && url.pathname.startsWith("/api/clubs/logo/")) {
    const encodedName = url.pathname.slice("/api/clubs/logo/".length);
    let decodedName = "";
    try {
      decodedName = decodeURIComponent(encodedName);
    } catch {
      decodedName = "";
    }

    const logoPath = resolveLogoFilePath(decodedName);
    if (!logoPath) {
      setCorsHeaders(res, origin);
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", "X-Request-Id": requestId });
      res.end("Logo not found");
      return;
    }

    try {
      const logoBuffer = await readFile(logoPath);
      setCorsHeaders(res, origin);
      res.writeHead(200, {
        "Content-Type": detectLogoContentType(logoPath),
        "Cache-Control": "public, max-age=86400",
        "X-Request-Id": requestId,
      });
      res.end(logoBuffer);
    } catch {
      setCorsHeaders(res, origin);
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", "X-Request-Id": requestId });
      res.end("Logo not found");
    }
    return;
  }

  if (
    await handleTeamAuthRoutes(req, res, {
      ...teamRouteBaseContext,
      normalizeAccountId,
      checkScopedRateLimit,
      teamLoginRateStore,
      teamLoginRateLimitMax: TEAM_LOGIN_RATE_LIMIT_MAX,
      getTeamLoginLockState,
      registerTeamLoginFailure,
      clearTeamLoginFailure,
      resolveAccountForAuth,
      verifyPassword,
      createPasswordHash,
      persistTeamState,
      findAccount,
      createTeamSessionForAccount,
      createSessionCookie,
      buildTeamStatePayload,
      registrationTeamKey: REGISTRATION_TEAM.key,
      isTeamJoinAllowedByAllowlist,
      requireTeamSession,
      requireTeamWriteAllowed,
      clearSessionCookie,
      teamSessions,
      revokeRuntimeTeamSession,
      nowIso,
      randomUUID,
      exposeVerificationToken: EXPOSE_VERIFICATION_TOKEN_ON_REGISTER,
      emailDeliveryConfigured: emailDelivery.configured,
      sendVerificationEmail: emailDelivery.sendVerificationEmail,
    })
  ) {
    return;
  }

  if (
    await handleTeamInvitationRoutes(req, res, {
      ...teamRouteBaseContext,
      randomUUID,
      normalizeAccountId,
      findTeamAccountRecordById,
      hasTokenExpired,
      createPasswordHash,
      canManageTeamMembers,
      requireTeamSession,
      requireTeamWriteAllowed,
      teamInvitations,
      teamInvitationTtlSec: TEAM_INVITATION_TTL_SEC,
      exposeInvitationTokenOnCreate: EXPOSE_INVITATION_TOKEN_ON_CREATE,
      registrationTeamKey: REGISTRATION_TEAM.key,
      isTeamJoinAllowedByAllowlist,
      runtimeDbEnabled: RUNTIME_DB_ENABLED,
      persistRuntimeInvitation,
      fetchRuntimeInvitationByToken,
      deleteRuntimeInvitation,
    })
  ) {
    return;
  }

  if (
    await handleTeamPasswordResetRoutes(req, res, {
      ...teamRouteBaseContext,
      randomUUID,
      normalizeAccountId,
      checkScopedRateLimit,
      teamLoginRateStore,
      teamPasswordResetTokens,
      teamLoginRateLimitMax: TEAM_LOGIN_RATE_LIMIT_MAX,
      teamPasswordResetTtlSec: TEAM_PASSWORD_RESET_TTL_SEC,
      exposeResetTokenOnRequest: EXPOSE_RESET_TOKEN_ON_REQUEST,
      resolveAccountForAuth,
      hasTokenExpired,
      createPasswordHash,
      runtimeDbEnabled: RUNTIME_DB_ENABLED,
      persistRuntimePasswordResetToken,
      fetchRuntimePasswordResetToken,
      deleteRuntimePasswordResetToken,
    })
  ) {
    return;
  }

  if (
    await handleHrworksImportRoutes(req, res, {
      ...teamRouteBaseContext,
      hrworksImportQueue,
      hrworksJobsDir: HRWORKS_JOBS_DIR,
      writeHrworksTimesheetXlsx,
    })
  ) {
    return;
  }

  if (
    await handleTeamImportTournamentRoutes(req, res, {
      ...teamRouteBaseContext,
      nowIso,
      randomUUID,
      readRawBody,
      requireTeamSession,
      requireTeamWriteAllowed,
      getTeamSessionContext,
      normalizeAccountId,
      formatWizardDateForMeinturnierplan,
      toFilterKeywords,
      extractMeinturnierplanJson,
      parseGermanDateToIso,
      meinturnierplanBaseUrl: MEINTURNIERPLAN_BASE_URL,
      dfbNationalBaseUrl: DFB_NATIONAL_BASE_URL,
      parseMultipartFormData,
      extractTextFromPdfBuffer,
      parseKreisPdfGamesFromText,
      teamKreisPdfPreviews,
      hasTokenExpired,
      createGameProvenance,
      dfbNationalSourceUrlTemplate: DFB_NATIONAL_SOURCE_URL_TEMPLATE,
      dfbNationalSourceToken: DFB_NATIONAL_SOURCE_TOKEN,
      dfbNationalSourceTimeoutMs: DFB_NATIONAL_SOURCE_TIMEOUT_MS,
      runtimeDbEnabled: RUNTIME_DB_ENABLED,
      persistRuntimeKreisPdfPreview,
      fetchRuntimeKreisPdfPreviewByToken,
      deleteRuntimeKreisPdfPreview,
    })
  ) {
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/team/state") {
    const context = requireTeamSession(req, res, origin, requestId);
    if (!context) {
      return;
    }
    let responseTeamState = normalizeTeamState(state.team);
    if (EFFECTIVE_OBSERVATIONS_READS_FROM_DB) {
      const observationsFromDb = await fetchTeamObservationsFromDb(context.account.teamId, requestLogger);
      if (Array.isArray(observationsFromDb)) {
        responseTeamState = {
          ...responseTeamState,
          observations: observationsFromDb,
        };
      }
    }
    if (EFFECTIVE_REPORTS_READS_FROM_DB) {
      const reportMap = await fetchTeamReportMapFromDb(context.account.teamId, requestLogger);
      if (reportMap && typeof reportMap === "object") {
        responseTeamState = {
          ...responseTeamState,
          observations: (Array.isArray(responseTeamState?.observations) ? responseTeamState.observations : []).map((item) => {
            const patch = reportMap[String(item?.id || "").trim()];
            if (!patch) {
              return item;
            }
            return {
              ...item,
              reportId: String(patch.reportId || item?.reportId || ""),
              reportUrl: String(patch.reportUrl || item?.reportUrl || ""),
            };
          }),
        };
      }
    }
    if (EFFECTIVE_FEED_READS_FROM_DB) {
      const feedItemsFromDb = await fetchTeamFeedItemsFromDb(context.account.teamId, requestLogger);
      if (Array.isArray(feedItemsFromDb)) {
        responseTeamState = {
          ...responseTeamState,
          feedItems: feedItemsFromDb,
        };
      }
    }
    sendJson(res, 200, buildTeamStatePayload(context, responseTeamState), origin, requestId);
    return;
  }

  if (
    await handleTeamNotificationsRoutes(req, res, {
      ...teamRouteBaseContext,
      nowIso,
      requireTeamSession,
      requireTeamWriteAllowed,
      normalizeEventId: normalizeAccountId,
      teamPushSubscriptions,
      teamPushOutbox,
      pushedCriticalEventIds,
      setCorsHeaders,
      registerTeamPushStream,
      persistPushSubscription,
      removePushOutboxEventsAndMarkAcked,
      notificationsReadsFromDb: EFFECTIVE_NOTIFICATIONS_READS_FROM_DB,
      fetchTeamNotificationsFromDb,
    })
  ) {
    return;
  }

  if (
    await handleTeamAuditRoutes(req, res, {
      ...teamRouteBaseContext,
      requireTeamSession,
      clampLimit,
      feedReadsFromDb: EFFECTIVE_FEED_READS_FROM_DB,
      fetchTeamFeedItemsFromDb,
    })
  ) {
    return;
  }

  if (
    await handleTeamPlanningRoutes(req, res, {
      ...teamRouteBaseContext,
      randomUUID,
      requireTeamSession,
      requireTeamWriteAllowed,
      toPublicAccount,
      toPublicTeam,
      buildTeamConflicts,
      publishTeamPlan,
      upsertTeamMember,
      upsertManualGame,
      updateTeamGoals,
      markObservationSeen,
      reassignObservation,
      linkObservationReport,
      updateObservationNote,
      teamSessions,
      revokeRuntimeTeamSessionsForAccount,
      nowIso,
    })
  ) {
    return;
  }

  if (
    await handlePublicDataRoutes(req, res, {
      url,
      origin,
      requestId,
      requestLogger,
      reqRef: req,
      state,
      readBody,
      sendJson,
      isAuthorized,
      maybeAutoRefreshWeek,
      uniqueNormalizedTeams,
      filterGames,
      splitTeamValidation,
      normalizeSearchQuery,
      clampLimit,
      clubSearchMaxLimit: CLUB_SEARCH_MAX_LIMIT,
      searchLocalClubCatalog,
      toPublicClubEntries,
      fetchRemoteClubSuggestions,
      mergeClubResults,
    })
  ) {
    return;
  }

  if (
    await handleAdminRoutes(req, res, {
      url,
      origin,
      requestId,
      requestLogger,
      state,
      readBody,
      sendJson,
      setCorsHeaders,
      nowIso,
      isAuthorized,
      runRefreshIngestionJob,
      buildAdminMeta,
      normalizeGames,
      dedupeGames,
      writeStoreSafely,
      runStoreMutationSerialized,
      runTeamWriteIdempotent,
      dedupeClubEntries,
      writeClubCatalogFile: (clubs) => writeClubCatalogFile(CLUB_CATALOG_FILE, clubs),
      ingestionJobs,
      buildPrometheusMetricsText,
      fetchMandantProbe,
      collectKnownMandantStatus,
      clampLimit,
      fetchRecentTeamArchiveEvents,
      readRecentTeamArchiveFromFile,
      teamArchiveFile: TEAM_ARCHIVE_FILE,
      buildDbReadinessReport,
    })
  ) {
    return;
  }

  sendJson(res, 404, { ok: false, error: "Not Found" }, origin, requestId);
});

try {
  if (EFFECTIVE_TEAM_STATE_READS_FROM_DB) {
    const teamStateFromDb = await fetchTeamStateFromDb("", rootLogger);
    if (teamStateFromDb) {
      state.team = normalizeTeamState(teamStateFromDb);
      await writeTeamState(TEAM_STATE_FILE, state.team);
      await ensureTeamDbMirrorsSynced(state.team, rootLogger, {
        persistTeamStateToDb: async () => true,
        syncTeamAccountsToDb,
        syncTeamNotificationsToDb,
        syncTeamObservationsToDb,
        syncTeamReportsToDb,
        syncTeamFeedItemsToDb,
      }, { strict: DB_FIRST_MODE });
    } else {
      state.team = await readTeamState(TEAM_STATE_FILE);
      await ensureTeamDbMirrorsSynced(state.team, rootLogger, {
        persistTeamStateToDb,
        syncTeamAccountsToDb,
        syncTeamNotificationsToDb,
        syncTeamObservationsToDb,
        syncTeamReportsToDb,
        syncTeamFeedItemsToDb,
      }, { strict: DB_FIRST_MODE });
    }
  } else {
    state.team = await readTeamState(TEAM_STATE_FILE);
    await ensureTeamDbMirrorsSynced(state.team, rootLogger, {
      persistTeamStateToDb,
      syncTeamAccountsToDb,
      syncTeamNotificationsToDb,
      syncTeamObservationsToDb,
      syncTeamReportsToDb,
      syncTeamFeedItemsToDb,
    }, { strict: DB_FIRST_MODE });
  }
} catch (error) {
  rootLogger.error("team state load failed", { error });
  state.team = createInitialTeamState();
  await ensureTeamDbMirrorsSynced(state.team, rootLogger, {
    persistTeamStateToDb,
    syncTeamAccountsToDb,
    syncTeamNotificationsToDb,
    syncTeamObservationsToDb,
    syncTeamReportsToDb,
    syncTeamFeedItemsToDb,
  }, { strict: DB_FIRST_MODE });
}

try {
  const teamId = String(state.team?.team?.id || "");
  if (teamId) {
    const pushSnapshot = await fetchPushRuntimeSnapshot(teamId, rootLogger);
    if (pushSnapshot) {
      teamPushSubscriptions.clear();
      for (const subscription of pushSnapshot.subscriptions || []) {
        if (subscription?.endpoint) {
          teamPushSubscriptions.set(subscription.endpoint, subscription);
        }
      }
      teamPushOutbox.clear();
      for (const event of pushSnapshot.outboxEvents || []) {
        if (event?.eventId) {
          teamPushOutbox.set(event.eventId, event);
        }
      }
      pushedCriticalEventIds.clear();
      for (const eventId of pushSnapshot.ackedEventIds || []) {
        pushedCriticalEventIds.add(eventId);
      }
    }
  }
} catch (error) {
  rootLogger.warn("push runtime rehydrate failed", { error });
}

try {
  state.clubs = await readClubCatalogFile(CLUB_CATALOG_FILE);
} catch {
  state.clubs = [];
}

await runStartupVerbandDiscovery(rootLogger);

try {
  await runRefreshIngestionJob("startup", rootLogger);
} catch (error) {
  rootLogger.error("initial refresh failed", { error });
}

if (REFRESH_INTERVAL_SEC > 0) {
  setInterval(() => {
    runRefreshIngestionJob("interval", rootLogger).catch((error) => {
      rootLogger.error("interval refresh failed", { error });
    });
  }, REFRESH_INTERVAL_SEC * 1000);
}

server.listen(PORT, HOST, () => {
  rootLogger.info("adapter server started", {
    host: HOST,
    port: PORT,
    authEnabled: Boolean(AUTH_TOKEN),
    store: STORE_FILE,
    teamStateFile: TEAM_STATE_FILE,
    teamArchiveFile: TEAM_ARCHIVE_FILE,
    clubCatalog: CLUB_CATALOG_FILE,
    clubsCount: state.clubs.length,
    clubLogosDir: CLUB_LOGOS_DIR,
    importDir: IMPORT_DIR,
    remoteUrl: REMOTE_URL || "",
    remoteTimeoutMs: REMOTE_URL ? REMOTE_TIMEOUT_MS : 0,
    autoWeekRefresh: AUTO_REFRESH_WEEK,
    weekSourceConfigured: Boolean(WEEK_SOURCE_TEMPLATE),
    exportCommandConfigured: Boolean(EXPORT_COMMAND),
    refreshIntervalSec: REFRESH_INTERVAL_SEC,
  });
});
