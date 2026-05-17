export const PRODUCT_STATE_VERSION = 2;

export const ROLES = Object.freeze({
  admin: "Admin",
  coordinator: "Koordinator",
  scout: "Scout",
  readonly: "Gast",
});

export const REPORT_TYPES = Object.freeze({
  player: "Spielerbericht",
  match: "Spielbericht",
  tournament: "Turnierbericht",
  note: "Freie Notiz",
});

export const REPORT_STATUSES = Object.freeze({
  draft: "Entwurf",
  in_review: "Review",
  shared: "Geteilt",
  archived: "Archiv",
});

export const WATCHLIST_ENTRY_STATUSES = Object.freeze({
  monitor: "Beobachten",
  priority: "Priorität",
  follow_up: "Follow-up",
  hold: "Parken",
  closed: "Abgeschlossen",
});

export const ASSIGNMENT_STATUSES = Object.freeze({
  open: "Offen",
  planned: "Geplant",
  done: "Erledigt",
  blocked: "Blockiert",
});

export const VISIBILITIES = Object.freeze({
  private: "Privat",
  team: "Team",
  shared: "Geteilt",
});

const DEFAULT_USERS = Object.freeze([
  { id: "user-admin", name: "Leitung", role: "admin", teamId: "team-scoutx" },
  { id: "user-coordinator", name: "Koordination", role: "coordinator", teamId: "team-scoutx" },
  { id: "user-scout", name: "Scout", role: "scout", teamId: "team-scoutx" },
  { id: "user-readonly", name: "Gast", role: "readonly", teamId: "team-scoutx" },
]);

const DEFAULT_TEAM = Object.freeze({
  id: "team-scoutx",
  name: "ScoutX Team",
});

const OBSERVATION_STATUSES = Object.freeze({
  planned: "planned",
  seen: "seen",
});

const REPORT_TEMPLATE_SECTIONS = Object.freeze({
  player: [
    { id: "overview", title: "Kurzprofil", prompt: "Position, Rolle, Spielkontext" },
    { id: "strengths", title: "Stärken", prompt: "Was ist klar überdurchschnittlich?" },
    { id: "risks", title: "Risiken", prompt: "Was braucht weitere Beobachtung?" },
    { id: "next", title: "Nächster Schritt", prompt: "Empfehlung und Follow-up" },
  ],
  match: [
    { id: "context", title: "Spielkontext", prompt: "Wettbewerb, Niveau, Spielverlauf" },
    { id: "standouts", title: "Auffällige Spieler", prompt: "Wer sticht warum heraus?" },
    { id: "team", title: "Team-/Matchmuster", prompt: "Tempo, Struktur, Intensität" },
    { id: "next", title: "Nächster Schritt", prompt: "Empfehlung für weitere Sichtung" },
  ],
  tournament: [
    { id: "context", title: "Turnierkontext", prompt: "Format, Teilnehmer, Niveau" },
    { id: "players", title: "Spieler-Pool", prompt: "Shortlist und Alternativen" },
    { id: "trends", title: "Muster", prompt: "Entwicklung, Wiederholungen, Risiken" },
    { id: "next", title: "Nächster Schritt", prompt: "Folgetermine oder Vergleich" },
  ],
  note: [
    { id: "note", title: "Notiz", prompt: "Freie Beobachtung" },
    { id: "next", title: "Nächster Schritt", prompt: "Was ist zu tun?" },
  ],
});

const RATING_KEYS = ["technical", "tactical", "physical", "mentality"];
const POSITIVE_WORDS = [
  "stark",
  "schnell",
  "präzise",
  "dominant",
  "mutig",
  "robust",
  "sauber",
  "konstant",
  "spielintelligent",
  "druckresistent",
  "abschlussstark",
];
const NEGATIVE_WORDS = [
  "schwach",
  "langsam",
  "unsicher",
  "riskant",
  "fehler",
  "unpräzise",
  "passiv",
  "probleme",
  "inkonstant",
  "zweikampfschwach",
];

function compactText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function toLookupKey(value) {
  return compactText(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeId(value) {
  return String(value || "").trim();
}

function uniqueStrings(values) {
  const seen = new Set();
  const result = [];
  for (const value of Array.isArray(values) ? values : []) {
    const text = compactText(value);
    const key = text.toLowerCase();
    if (!text || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(text);
  }
  return result;
}

function clampRating(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.max(1, Math.min(5, Math.round(parsed)));
}

function normalizeRatings(ratings) {
  const source = ratings && typeof ratings === "object" ? ratings : {};
  return RATING_KEYS.reduce((acc, key) => {
    const rating = clampRating(source[key]);
    if (rating) {
      acc[key] = rating;
    }
    return acc;
  }, {});
}

function nowIso(clock) {
  const date = typeof clock === "function" ? clock() : new Date();
  const parsed = date instanceof Date ? date : new Date(date);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function makeId(prefix, clock, random) {
  const safePrefix = compactText(prefix).toLowerCase().replace(/[^a-z0-9]+/g, "-") || "item";
  const date = typeof clock === "function" ? clock() : new Date();
  const stamp = date instanceof Date && !Number.isNaN(date.getTime()) ? date.getTime() : Date.now();
  const rand = typeof random === "function" ? random() : Math.random();
  return `${safePrefix}-${stamp}-${String(rand).slice(2, 8) || "000000"}`;
}

function normalizeVisibility(value, fallback = "team") {
  const key = normalizeId(value);
  return Object.prototype.hasOwnProperty.call(VISIBILITIES, key) ? key : fallback;
}

function normalizeRole(value) {
  const key = normalizeId(value);
  return Object.prototype.hasOwnProperty.call(ROLES, key) ? key : "scout";
}

function normalizeUser(raw, fallback) {
  const source = raw && typeof raw === "object" ? raw : {};
  const id = normalizeId(source.id) || fallback?.id || "user-scout";
  return {
    id,
    name: compactText(source.name) || fallback?.name || "Scout",
    role: normalizeRole(source.role || fallback?.role),
    teamId: normalizeId(source.teamId) || fallback?.teamId || "team-scoutx",
    active: source.active === false ? false : fallback?.active === false ? false : true,
  };
}

function normalizeTeamAccount(raw, fallback) {
  const source = raw && typeof raw === "object" ? raw : {};
  const account = normalizeUser(source, fallback);
  return {
    id: account.id,
    name: account.name,
    role: account.role,
    teamId: account.teamId,
    active: account.active !== false,
  };
}

function normalizeTeam(raw, users) {
  const source = raw && typeof raw === "object" ? raw : {};
  const userAccounts = (Array.isArray(users) ? users : DEFAULT_USERS).map((user) => normalizeTeamAccount(user));
  const rawAccounts = Array.isArray(source.accounts)
    ? source.accounts.map((account) => normalizeTeamAccount(account)).filter(Boolean)
    : [];
  const byId = new Map();

  for (const account of [...userAccounts, ...rawAccounts]) {
    if (!account.id) {
      continue;
    }
    byId.set(account.id, {
      ...(byId.get(account.id) || {}),
      ...account,
    });
  }

  return {
    id: normalizeId(source.id) || DEFAULT_TEAM.id,
    name: compactText(source.name) || DEFAULT_TEAM.name,
    accounts: [...byId.values()].sort((left, right) => {
      const roleOrder = { admin: 0, coordinator: 1, scout: 2, readonly: 3 };
      const roleDelta = (roleOrder[left.role] ?? 9) - (roleOrder[right.role] ?? 9);
      if (roleDelta !== 0) {
        return roleDelta;
      }
      return left.name.localeCompare(right.name, "de-DE");
    }),
  };
}

function normalizeSection(section, fallback, index) {
  const source = section && typeof section === "object" ? section : {};
  const fallbackSection = fallback && typeof fallback === "object" ? fallback : {};
  return {
    id: normalizeId(source.id) || fallbackSection.id || `section-${index + 1}`,
    title: compactText(source.title) || fallbackSection.title || `Abschnitt ${index + 1}`,
    prompt: compactText(source.prompt) || fallbackSection.prompt || "",
    text: String(source.text || ""),
  };
}

export function createReportTemplate(type = "player") {
  const reportType = Object.prototype.hasOwnProperty.call(REPORT_TYPES, type) ? type : "player";
  return REPORT_TEMPLATE_SECTIONS[reportType].map((section, index) => normalizeSection(section, null, index));
}

function normalizeReport(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const id = normalizeId(raw.id);
  const title = compactText(raw.title);
  if (!id || !title) {
    return null;
  }
  const type = Object.prototype.hasOwnProperty.call(REPORT_TYPES, raw.type) ? raw.type : "player";
  const template = createReportTemplate(type);
  const sections = Array.isArray(raw.sections) && raw.sections.length > 0
    ? raw.sections.map((section, index) => normalizeSection(section, template[index], index))
    : template;
  return {
    id,
    type,
    title,
    status: Object.prototype.hasOwnProperty.call(REPORT_STATUSES, raw.status) ? raw.status : "draft",
    authorId: normalizeId(raw.authorId) || "user-scout",
    ownerId: normalizeId(raw.ownerId) || normalizeId(raw.authorId) || "user-scout",
    visibility: normalizeVisibility(raw.visibility),
    createdAt: normalizeId(raw.createdAt) || new Date(0).toISOString(),
    updatedAt: normalizeId(raw.updatedAt) || normalizeId(raw.createdAt) || new Date(0).toISOString(),
    context: raw.context && typeof raw.context === "object" ? { ...raw.context } : {},
    tags: uniqueStrings(raw.tags),
    ratings: normalizeRatings(raw.ratings),
    sections,
    ai: raw.ai && typeof raw.ai === "object" ? raw.ai : null,
    comments: (Array.isArray(raw.comments) ? raw.comments : [])
      .map((comment) => {
        const id = normalizeId(comment?.id);
        const body = compactText(comment?.body);
        if (!id || !body) {
          return null;
        }
        return {
          id,
          body,
          authorId: normalizeId(comment?.authorId) || "user-scout",
          createdAt: normalizeId(comment?.createdAt) || new Date(0).toISOString(),
        };
      })
      .filter(Boolean),
    versions: Array.isArray(raw.versions) ? raw.versions.filter(Boolean) : [],
  };
}

function normalizeWatchlistEntry(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const id = normalizeId(raw.id);
  const playerName = compactText(raw.playerName);
  if (!id || !playerName) {
    return null;
  }
  const priority = Number(raw.priority);
  const status = Object.prototype.hasOwnProperty.call(WATCHLIST_ENTRY_STATUSES, raw.status) ? raw.status : "monitor";
  return {
    id,
    playerId: normalizeId(raw.playerId),
    playerName,
    club: compactText(raw.club),
    priority: Number.isFinite(priority) ? Math.max(1, Math.min(5, Math.round(priority))) : 3,
    status,
    labels: uniqueStrings(raw.labels),
    note: String(raw.note || ""),
    assigneeId: normalizeId(raw.assigneeId),
    updatedAt: normalizeId(raw.updatedAt) || new Date(0).toISOString(),
  };
}

function normalizeWatchlist(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const id = normalizeId(raw.id);
  const name = compactText(raw.name);
  if (!id || !name) {
    return null;
  }
  return {
    id,
    name,
    ownerId: normalizeId(raw.ownerId) || "user-scout",
    visibility: normalizeVisibility(raw.visibility),
    tags: uniqueStrings(raw.tags),
    createdAt: normalizeId(raw.createdAt) || new Date(0).toISOString(),
    updatedAt: normalizeId(raw.updatedAt) || normalizeId(raw.createdAt) || new Date(0).toISOString(),
    entries: (Array.isArray(raw.entries) ? raw.entries : []).map(normalizeWatchlistEntry).filter(Boolean),
  };
}

function normalizeAssignment(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const id = normalizeId(raw.id);
  const title = compactText(raw.title);
  if (!id || !title) {
    return null;
  }
  return {
    id,
    type: normalizeId(raw.type) || "general_task",
    title,
    description: String(raw.description || ""),
    ownerId: normalizeId(raw.ownerId) || "user-scout",
    assigneeId: normalizeId(raw.assigneeId) || normalizeId(raw.ownerId) || "user-scout",
    visibility: normalizeVisibility(raw.visibility),
    status: Object.prototype.hasOwnProperty.call(ASSIGNMENT_STATUSES, raw.status) ? raw.status : "open",
    dueAt: normalizeId(raw.dueAt),
    linkedPlayerId: normalizeId(raw.linkedPlayerId),
    linkedGameId: normalizeId(raw.linkedGameId),
    linkedReportId: normalizeId(raw.linkedReportId),
    createdAt: normalizeId(raw.createdAt) || new Date(0).toISOString(),
    updatedAt: normalizeId(raw.updatedAt) || normalizeId(raw.createdAt) || new Date(0).toISOString(),
  };
}

function normalizeNotification(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const id = normalizeId(raw.id);
  const title = compactText(raw.title);
  if (!id || !title) {
    return null;
  }
  return {
    id,
    type: normalizeId(raw.type) || "status_changed",
    title,
    body: String(raw.body || ""),
    entityType: normalizeId(raw.entityType),
    entityId: normalizeId(raw.entityId),
    recipientId: normalizeId(raw.recipientId),
    createdAt: normalizeId(raw.createdAt) || new Date(0).toISOString(),
    readAt: normalizeId(raw.readAt),
  };
}

function normalizeObservation(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const id = normalizeId(raw.id);
  const gameId = normalizeId(raw.gameId);
  const scoutId = normalizeId(raw.scoutId);
  if (!id || !gameId || !scoutId) {
    return null;
  }
  const status = Object.prototype.hasOwnProperty.call(OBSERVATION_STATUSES, raw.status) ? raw.status : "planned";
  const createdAt = normalizeId(raw.createdAt) || new Date(0).toISOString();
  return {
    id,
    gameId,
    scoutId,
    status,
    note: String(raw.note || ""),
    planHistoryId: normalizeId(raw.planHistoryId),
    reportId: normalizeId(raw.reportId),
    reportUrl: String(raw.reportUrl || ""),
    game: raw.game && typeof raw.game === "object" ? { ...raw.game, id: gameId } : null,
    createdAt,
    updatedAt: normalizeId(raw.updatedAt) || createdAt,
    seenAt: normalizeId(raw.seenAt),
  };
}

function normalizeManualGame(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const id = normalizeId(raw.id) || makeId(`manual-game-${raw.date || ""}-${raw.time || ""}-${raw.home || ""}-${raw.away || ""}`);
  const home = compactText(raw.home);
  const away = compactText(raw.away);
  if (!id || !home || !away) {
    return null;
  }
  return {
    ...raw,
    id,
    source: "manual",
    home,
    away,
    date: compactText(raw.date),
    time: compactText(raw.time),
    venue: compactText(raw.venue),
    status: normalizeId(raw.status) === "cancelled" ? "cancelled" : "scheduled",
    note: String(raw.note || ""),
    createdBy: normalizeId(raw.createdBy),
    createdAt: normalizeId(raw.createdAt) || new Date(0).toISOString(),
    updatedAt: normalizeId(raw.updatedAt) || normalizeId(raw.createdAt) || new Date(0).toISOString(),
  };
}

function normalizeTeamGoals(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    favoriteTeams: uniqueStrings(source.favoriteTeams),
    favoriteClubs: uniqueStrings(source.favoriteClubs),
    leaguePriorities: uniqueStrings(source.leaguePriorities),
    ageGroups: uniqueStrings(source.ageGroups).map(normalizeId).filter(Boolean),
  };
}

function normalizeFeedItem(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const id = normalizeId(raw.id);
  const title = compactText(raw.title);
  if (!id || !title) {
    return null;
  }
  return {
    id,
    type: normalizeId(raw.type) || "plan_published",
    actorId: normalizeId(raw.actorId),
    title,
    body: String(raw.body || ""),
    gameIds: (Array.isArray(raw.gameIds) ? raw.gameIds : []).map(normalizeId).filter(Boolean),
    planHistoryId: normalizeId(raw.planHistoryId),
    observationId: normalizeId(raw.observationId),
    createdAt: normalizeId(raw.createdAt) || new Date(0).toISOString(),
  };
}

function normalizeSavedFilter(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const id = normalizeId(raw.id);
  const name = compactText(raw.name);
  if (!id || !name) {
    return null;
  }
  return {
    id,
    name,
    ownerId: normalizeId(raw.ownerId) || "user-scout",
    query: String(raw.query || ""),
    filters: raw.filters && typeof raw.filters === "object" ? { ...raw.filters } : {},
    createdAt: normalizeId(raw.createdAt) || new Date(0).toISOString(),
  };
}

export function createInitialProductState() {
  const scout = DEFAULT_USERS[2];
  const users = DEFAULT_USERS.map((user) => normalizeUser(user));

  return {
    version: PRODUCT_STATE_VERSION,
    activeUserId: scout.id,
    users,
    team: normalizeTeam(null, users),
    reports: [],
    watchlists: [],
    assignments: [],
    notifications: [],
    savedFilters: [],
    manualGames: [],
    teamGoals: normalizeTeamGoals(null),
    observations: [],
    feedItems: [],
  };
}

function isLegacySeedReport(report) {
  return report?.title === "MVP Beispielbericht: schneller erster Eindruck" && report?.context?.playerName === "Beispielspieler";
}

function isLegacySeedWatchlist(watchlist) {
  return watchlist?.name === "Shortlist April" && (watchlist.entries || []).some((entry) => entry.playerName === "Beispielspieler");
}

function isLegacySeedAssignment(assignment) {
  return assignment?.title === "Follow-up für Beispielspieler planen";
}

function isLegacySeedNotification(notification) {
  return notification?.body === "Follow-up für Beispielspieler planen" || notification?.entityType === "assignment" && notification?.title === "Neue Zuweisung";
}

export function normalizeProductState(raw, options = {}) {
  const fallback = createInitialProductState(options);
  if (!raw || typeof raw !== "object") {
    return fallback;
  }

  const normalizedUsers = Array.isArray(raw.users)
    ? raw.users.map((user, index) => normalizeUser(user, DEFAULT_USERS[index])).filter(Boolean)
    : fallback.users;
  const users = normalizedUsers.length > 0 ? normalizedUsers : fallback.users;
  const userIds = new Set(users.map((user) => user.id));
  const activeUserId = userIds.has(raw.activeUserId) ? raw.activeUserId : users[0]?.id || fallback.activeUserId;

  return {
    version: PRODUCT_STATE_VERSION,
    activeUserId,
    users,
    team: normalizeTeam(raw.team, users),
    reports: (Array.isArray(raw.reports) ? raw.reports : []).map(normalizeReport).filter(Boolean).filter((report) => !isLegacySeedReport(report)),
    watchlists: (Array.isArray(raw.watchlists) ? raw.watchlists : []).map(normalizeWatchlist).filter(Boolean).filter((watchlist) => !isLegacySeedWatchlist(watchlist)),
    assignments: (Array.isArray(raw.assignments) ? raw.assignments : []).map(normalizeAssignment).filter(Boolean).filter((assignment) => !isLegacySeedAssignment(assignment)),
    notifications: (Array.isArray(raw.notifications) ? raw.notifications : []).map(normalizeNotification).filter(Boolean).filter((notification) => !isLegacySeedNotification(notification)),
    savedFilters: (Array.isArray(raw.savedFilters) ? raw.savedFilters : []).map(normalizeSavedFilter).filter(Boolean),
    manualGames: (Array.isArray(raw.manualGames) ? raw.manualGames : []).map(normalizeManualGame).filter(Boolean),
    teamGoals: normalizeTeamGoals(raw.teamGoals),
    observations: (Array.isArray(raw.observations) ? raw.observations : []).map(normalizeObservation).filter(Boolean),
    feedItems: (Array.isArray(raw.feedItems) ? raw.feedItems : []).map(normalizeFeedItem).filter(Boolean),
  };
}

export function getActiveUser(state) {
  const users = Array.isArray(state?.users) ? state.users : [];
  return users.find((user) => user.id === state?.activeUserId) || users[0] || DEFAULT_USERS[2];
}

export function canRole(role, action) {
  const normalized = normalizeRole(role);
  if (normalized === "admin") {
    return true;
  }
  if (normalized === "coordinator") {
    return ["create", "update", "assign", "share", "viewPrivate"].includes(action);
  }
  if (normalized === "scout") {
    return ["create", "updateOwn", "assignOwn", "shareOwn"].includes(action);
  }
  return action === "view";
}

export function canViewEntity(user, entity) {
  if (!entity) {
    return false;
  }
  const actor = normalizeUser(user, DEFAULT_USERS[2]);
  if (actor.role === "admin") {
    return true;
  }
  const visibility = normalizeVisibility(entity.visibility, "team");
  if (visibility === "shared") {
    return true;
  }
  const ownerId = normalizeId(entity.ownerId || entity.authorId);
  const assigneeId = normalizeId(entity.assigneeId);
  if (ownerId && ownerId === actor.id) {
    return true;
  }
  if (assigneeId && assigneeId === actor.id) {
    return true;
  }
  if (visibility === "team") {
    return actor.role === "coordinator" || actor.role === "scout";
  }
  return false;
}

export function filterVisibleEntities(items, user) {
  return (Array.isArray(items) ? items : []).filter((item) => canViewEntity(user, item));
}

function assertCanCreate(user) {
  if (!canRole(user?.role, "create")) {
    throw new Error("Diese Rolle darf keine neuen Scouting-Objekte anlegen.");
  }
}

function assertCanEdit(user, entity) {
  if (user?.role === "readonly") {
    throw new Error("Gastzugriff ist schreibgeschützt.");
  }
  if (user?.role === "admin" || user?.role === "coordinator") {
    return;
  }
  const ownerId = normalizeId(entity?.ownerId || entity?.authorId);
  const assigneeId = normalizeId(entity?.assigneeId);
  if (ownerId === user?.id || assigneeId === user?.id) {
    return;
  }
  throw new Error("Nur eigene oder zugewiesene Inhalte können bearbeitet werden.");
}

export function createReportInput(input, user, options = {}) {
  assertCanCreate(user);
  const now = nowIso(options.clock);
  const type = Object.prototype.hasOwnProperty.call(REPORT_TYPES, input?.type) ? input.type : "player";
  const title = compactText(input?.title);
  if (!title) {
    throw new Error("Report-Titel ist erforderlich.");
  }
  const report = normalizeReport({
    id: makeId("report", options.clock, options.random),
    ...(normalizeId(input?.id) ? { id: normalizeId(input.id) } : {}),
    type,
    title,
    status: input?.status || "draft",
    authorId: user.id,
    ownerId: normalizeId(input?.ownerId) || user.id,
    visibility: input?.visibility || "team",
    createdAt: now,
    updatedAt: now,
    context: input?.context,
    tags: input?.tags,
    ratings: input?.ratings,
    sections:
      Array.isArray(input?.sections) && input.sections.length > 0
        ? input.sections
        : createReportTemplate(type).map((section) => ({ ...section, text: "" })),
    versions: [],
  });
  if (!report) {
    throw new Error("Report konnte nicht normalisiert werden.");
  }
  return report;
}

function createTargetReportNotifications(state, report, options = {}) {
  const targetName = compactText(report?.context?.playerName || report?.context?.targetName);
  if (!targetName) {
    return [];
  }
  const normalizedTarget = targetName.toLowerCase();
  const recipients = new Set();
  for (const watchlist of Array.isArray(state?.watchlists) ? state.watchlists : []) {
    for (const entry of Array.isArray(watchlist.entries) ? watchlist.entries : []) {
      if (compactText(entry.playerName).toLowerCase() === normalizedTarget && watchlist.ownerId) {
        recipients.add(watchlist.ownerId);
      }
    }
  }

  return [...recipients]
    .filter((recipientId) => recipientId && recipientId !== report.ownerId)
    .map((recipientId) =>
      createNotification(
        {
          type: "target_report_created",
          title: "Neuer Report zu eigenem Ziel",
          body: report.title,
          entityType: "report",
          entityId: report.id,
          recipientId,
        },
        options,
      ),
    );
}

export function upsertReport(state, input, user, options = {}) {
  const activeUser = user || getActiveUser(state);
  const existing = normalizeId(input?.id)
    ? (state.reports || []).find((report) => report.id === input.id)
    : null;

  if (!existing) {
    const report = createReportInput(input, activeUser, options);
    const reportNotification = createNotification(
      {
        type: "report_shared",
        title: "Neuer Bericht",
        body: report.title,
        entityType: "report",
        entityId: report.id,
        recipientId: report.ownerId,
      },
      options,
    );
    return {
      ...state,
      reports: [report, ...(state.reports || [])],
      notifications: appendUniqueNotifications(
        [reportNotification, ...(state.notifications || [])],
        createTargetReportNotifications(state, report, options),
      ),
    };
  }

  assertCanEdit(activeUser, existing);
  const now = nowIso(options.clock);
  const updated = normalizeReport({
    ...existing,
    ...input,
    id: existing.id,
    authorId: existing.authorId,
    ownerId: normalizeId(input?.ownerId) || existing.ownerId,
    updatedAt: now,
    versions: [
      {
        at: now,
        by: activeUser.id,
        title: existing.title,
        status: existing.status,
        ratings: existing.ratings,
        sections: existing.sections,
      },
      ...(existing.versions || []),
    ].slice(0, 12),
  });
  return {
    ...state,
    reports: state.reports.map((report) => (report.id === existing.id ? updated : report)),
  };
}

export function updateReportStatus(state, reportId, status, user, options = {}) {
  const activeUser = user || getActiveUser(state);
  const target = (state.reports || []).find((report) => report.id === reportId);
  if (!target) {
    throw new Error("Report wurde nicht gefunden.");
  }
  assertCanEdit(activeUser, target);
  const nextStatus = Object.prototype.hasOwnProperty.call(REPORT_STATUSES, status) ? status : target.status;
  const now = nowIso(options.clock);
  return {
    ...state,
    reports: state.reports.map((report) =>
      report.id === target.id
        ? {
            ...report,
            status: nextStatus,
            updatedAt: now,
            versions: [
              {
                at: now,
                by: activeUser.id,
                title: report.title,
                status: report.status,
                ratings: report.ratings,
                sections: report.sections,
              },
              ...(report.versions || []),
            ].slice(0, 12),
          }
        : report,
    ),
    notifications: [
      createNotification(
        {
          type: "status_changed",
          title: "Berichtsstatus geändert",
          body: `${target.title}: ${REPORT_STATUSES[nextStatus]}`,
          entityType: "report",
          entityId: target.id,
          recipientId: target.ownerId,
        },
        options,
      ),
      ...(state.notifications || []),
    ],
  };
}

export function addReportComment(state, reportId, body, user, options = {}) {
  const activeUser = user || getActiveUser(state);
  const target = (state.reports || []).find((report) => report.id === reportId);
  if (!target) {
    throw new Error("Report wurde nicht gefunden.");
  }
  if (!canViewEntity(activeUser, target)) {
    throw new Error("Report ist für diese Rolle nicht sichtbar.");
  }
  if (activeUser.role === "readonly") {
    throw new Error("Gastzugriff ist schreibgeschützt.");
  }
  const text = compactText(body);
  if (!text) {
    throw new Error("Kommentar darf nicht leer sein.");
  }
  const now = nowIso(options.clock);
  const comment = {
    id: makeId("comment", options.clock, options.random),
    body: text,
    authorId: activeUser.id,
    createdAt: now,
  };
  return {
    ...state,
    reports: state.reports.map((report) =>
      report.id === target.id
        ? {
            ...report,
            comments: [comment, ...(report.comments || [])],
            updatedAt: now,
          }
        : report,
    ),
    notifications: [
      createNotification(
        {
          type: "report_shared",
          title: "Neuer Report-Kommentar",
          body: target.title,
          entityType: "report",
          entityId: target.id,
          recipientId: target.ownerId,
        },
        options,
      ),
      ...(state.notifications || []),
    ],
  };
}

export function createWatchlist(state, input, user, options = {}) {
  const activeUser = user || getActiveUser(state);
  assertCanCreate(activeUser);
  const now = nowIso(options.clock);
  const name = compactText(input?.name);
  if (!name) {
    throw new Error("Watchlist-Name ist erforderlich.");
  }
  const watchlist = normalizeWatchlist({
    id: normalizeId(input?.id) || makeId("watchlist", options.clock, options.random),
    name,
    ownerId: activeUser.id,
    visibility: input?.visibility || "team",
    tags: input?.tags,
    createdAt: now,
    updatedAt: now,
    entries: [],
  });
  return {
    ...state,
    watchlists: [watchlist, ...(state.watchlists || [])],
  };
}

export function addWatchlistEntry(state, watchlistId, input, user, options = {}) {
  const activeUser = user || getActiveUser(state);
  const target = (state.watchlists || []).find((watchlist) => watchlist.id === watchlistId);
  if (!target) {
    throw new Error("Watchlist wurde nicht gefunden.");
  }
  assertCanEdit(activeUser, target);
  const now = nowIso(options.clock);
  const playerName = compactText(input?.playerName);
  if (!playerName) {
    throw new Error("Spielername ist erforderlich.");
  }
  const entry = normalizeWatchlistEntry({
    id: makeId("watch-entry", options.clock, options.random),
    ...input,
    playerName,
    updatedAt: now,
  });
  const updatedWatchlist = {
    ...target,
    updatedAt: now,
    entries: [entry, ...(target.entries || [])],
  };
  return {
    ...state,
    watchlists: state.watchlists.map((watchlist) => (watchlist.id === target.id ? updatedWatchlist : watchlist)),
    notifications: [
      createNotification(
        {
          type: "status_changed",
          title: "Watchlist aktualisiert",
          body: `${playerName} wurde zu ${target.name} hinzugefügt.`,
          entityType: "watchlist",
          entityId: target.id,
          recipientId: target.ownerId,
        },
        options,
      ),
      ...(state.notifications || []),
    ],
  };
}

export function updateWatchlistEntry(state, watchlistId, entryId, input, user, options = {}) {
  const activeUser = user || getActiveUser(state);
  const target = (state.watchlists || []).find((watchlist) => watchlist.id === watchlistId);
  if (!target) {
    throw new Error("Watchlist wurde nicht gefunden.");
  }
  assertCanEdit(activeUser, target);
  const existingEntry = (target.entries || []).find((entry) => entry.id === entryId);
  if (!existingEntry) {
    throw new Error("Watchlist-Eintrag wurde nicht gefunden.");
  }
  const now = nowIso(options.clock);
  const updatedEntry = normalizeWatchlistEntry({
    ...existingEntry,
    ...input,
    id: existingEntry.id,
    updatedAt: now,
  });
  return {
    ...state,
    watchlists: state.watchlists.map((watchlist) =>
      watchlist.id === target.id
        ? {
            ...watchlist,
            updatedAt: now,
            entries: watchlist.entries.map((entry) => (entry.id === existingEntry.id ? updatedEntry : entry)),
          }
        : watchlist,
    ),
  };
}

export function removeWatchlistEntry(state, watchlistId, entryId, user, options = {}) {
  const activeUser = user || getActiveUser(state);
  const target = (state.watchlists || []).find((watchlist) => watchlist.id === watchlistId);
  if (!target) {
    throw new Error("Watchlist wurde nicht gefunden.");
  }
  assertCanEdit(activeUser, target);
  const now = nowIso(options.clock);
  return {
    ...state,
    watchlists: state.watchlists.map((watchlist) =>
      watchlist.id === target.id
        ? {
            ...watchlist,
            updatedAt: now,
            entries: watchlist.entries.filter((entry) => entry.id !== entryId),
          }
        : watchlist,
    ),
  };
}

export function createAssignment(state, input, user, options = {}) {
  const activeUser = user || getActiveUser(state);
  assertCanCreate(activeUser);
  const now = nowIso(options.clock);
  const title = compactText(input?.title);
  if (!title) {
    throw new Error("Aufgabentitel ist erforderlich.");
  }
  const assignment = normalizeAssignment({
    id: makeId("assignment", options.clock, options.random),
    ...input,
    title,
    ownerId: activeUser.id,
    assigneeId: normalizeId(input?.assigneeId) || activeUser.id,
    visibility: input?.visibility || "team",
    status: input?.status || "open",
    createdAt: now,
    updatedAt: now,
  });
  return {
    ...state,
    assignments: [assignment, ...(state.assignments || [])],
    notifications: [
      createNotification(
        {
          type: "direct_assignment",
          title: "Direkte Zuweisung",
          body: assignment.title,
          entityType: "assignment",
          entityId: assignment.id,
          recipientId: assignment.assigneeId,
        },
        options,
      ),
      ...(state.notifications || []),
    ],
  };
}

export function updateAssignmentStatus(state, assignmentId, status, user, options = {}) {
  const activeUser = user || getActiveUser(state);
  const target = (state.assignments || []).find((assignment) => assignment.id === assignmentId);
  if (!target) {
    throw new Error("Aufgabe wurde nicht gefunden.");
  }
  assertCanEdit(activeUser, target);
  const nextStatus = Object.prototype.hasOwnProperty.call(ASSIGNMENT_STATUSES, status) ? status : target.status;
  const now = nowIso(options.clock);
  return {
    ...state,
    assignments: state.assignments.map((assignment) =>
      assignment.id === assignmentId ? { ...assignment, status: nextStatus, updatedAt: now } : assignment,
    ),
    notifications: [
      createNotification(
        {
          type: "status_changed",
          title: "Aufgabenstatus geändert",
          body: `${target.title}: ${ASSIGNMENT_STATUSES[nextStatus]}`,
          entityType: "assignment",
          entityId: target.id,
          recipientId: target.ownerId,
        },
        options,
      ),
      ...(state.notifications || []),
    ],
  };
}

export function createNotification(input, options = {}) {
  return normalizeNotification({
    id: makeId("notification", options.clock, options.random),
    ...input,
    createdAt: nowIso(options.clock),
  });
}

function appendUniqueNotifications(existing, candidates) {
  const notifications = Array.isArray(existing) ? existing : [];
  const seen = new Set(
    notifications.map((notification) =>
      [notification.type, notification.entityType, notification.entityId, notification.recipientId].join(":"),
    ),
  );
  const next = [];
  for (const candidate of Array.isArray(candidates) ? candidates : []) {
    if (!candidate) {
      continue;
    }
    const key = [candidate.type, candidate.entityType, candidate.entityId, candidate.recipientId].join(":");
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    next.push(candidate);
  }
  return [...next, ...notifications];
}

export function markNotificationRead(state, notificationId, user, options = {}) {
  const activeUser = user || getActiveUser(state);
  const now = nowIso(options.clock);
  return {
    ...state,
    notifications: (state.notifications || []).map((notification) => {
      if (notification.id !== notificationId) {
        return notification;
      }
      if (notification.recipientId && notification.recipientId !== activeUser.id && activeUser.role !== "admin") {
        return notification;
      }
      return { ...notification, readAt: notification.readAt || now };
    }),
  };
}

function getTeamAccountName(state, userId) {
  const id = normalizeId(userId);
  const account = (state?.team?.accounts || []).find((item) => item.id === id);
  const user = (state?.users || []).find((item) => item.id === id);
  return compactText(account?.name || user?.name) || "Scout";
}

function summarizeGames(games) {
  const labels = (Array.isArray(games) ? games : [])
    .map((game) => compactText(`${game?.home || ""} vs ${game?.away || ""}`))
    .filter((label) => label && label !== "vs")
    .slice(0, 4);
  return labels.join(" · ");
}

function createTeamFeedNotification(feedItem, options = {}) {
  if (!feedItem) {
    return null;
  }
  return createNotification(
    {
      type: "team_feed",
      title: feedItem.type === "plan_published" ? "Team-Plan veröffentlicht" : feedItem.title || "Team-Aktivität",
      body: feedItem.body || feedItem.title || "",
      entityType: "team_feed",
      entityId: feedItem.id,
    },
    options,
  );
}

function createScheduleConflictNotifications(state, overview, options = {}) {
  return (Array.isArray(overview?.conflicts) ? overview.conflicts : []).map((conflict) =>
    createNotification(
      {
        type: "schedule_conflict",
        title: "Konflikt erkannt",
        body: `${conflict.firstGameLabel} → ${conflict.secondGameLabel}`,
        entityType: "schedule_conflict",
        entityId: `${conflict.dateKey}-${conflict.scoutId}-${conflict.firstGameId}-${conflict.secondGameId}`,
        recipientId: conflict.scoutId,
      },
      options,
    ),
  );
}

function getGameObserverIds(state, gameId) {
  const targetGameId = normalizeId(gameId);
  return [
    ...new Set(
      (Array.isArray(state?.observations) ? state.observations : [])
        .filter((observation) => observation.gameId === targetGameId && observation.status !== "closed")
        .map((observation) => observation.scoutId)
        .filter(Boolean),
    ),
  ];
}

function manualGameChanged(previous, next) {
  if (!previous || !next) {
    return false;
  }
  return ["home", "away", "date", "time", "venue"].some((key) => compactText(previous[key]) !== compactText(next[key]));
}

function createManualGameNotifications(state, previous, manualGame, options = {}) {
  if (!previous || !manualGame) {
    return [];
  }
  const cancelled = previous.status !== "cancelled" && manualGame.status === "cancelled";
  const changed = !cancelled && manualGameChanged(previous, manualGame);
  if (!cancelled && !changed) {
    return [];
  }
  return getGameObserverIds(state, manualGame.id).map((recipientId) =>
    createNotification(
      {
        type: cancelled ? "game_cancelled" : "own_game_changed",
        title: cancelled ? "Spielabsage" : "Eigenes Spiel geändert",
        body: `${manualGame.home} vs ${manualGame.away}`,
        entityType: "game",
        entityId: manualGame.id,
        recipientId,
      },
      options,
    ),
  );
}

export function publishTeamPlan(state, input, user, options = {}) {
  const activeUser = user || getActiveUser(state);
  assertCanCreate(activeUser);
  const normalizedState = normalizeProductState(state, options);
  const games = (Array.isArray(input?.games) ? input.games : [])
    .map((game) => ({
      ...game,
      id: normalizeId(game?.id),
    }))
    .filter((game) => game.id);

  if (games.length === 0) {
    return normalizedState;
  }

  const now = nowIso(options.clock);
  const planHistoryId = normalizeId(input?.planHistoryId);
  const note = String(input?.note || "");
  const nextObservations = games.map((game) =>
    normalizeObservation({
      id: makeId(`observation-${game.id}-${activeUser.id}`, options.clock, options.random),
      gameId: game.id,
      scoutId: activeUser.id,
      status: "planned",
      note,
      planHistoryId,
      game,
      createdAt: now,
      updatedAt: now,
    }),
  );
  const existingObservations = (normalizedState.observations || []).filter((observation) => {
    return !nextObservations.some(
      (next) =>
        next &&
        observation.gameId === next.gameId &&
        observation.scoutId === next.scoutId &&
        observation.planHistoryId === next.planHistoryId,
    );
  });
  const actorName = getTeamAccountName(normalizedState, activeUser.id);
  const gameCountLabel = games.length === 1 ? "1 Spiel" : `${games.length} Spiele`;
  const feedItem = normalizeFeedItem({
    id: makeId(`feed-plan-${planHistoryId || activeUser.id}`, options.clock, options.random),
    type: "plan_published",
    actorId: activeUser.id,
    title: `${actorName} hat ${gameCountLabel} in seinen Plan genommen`,
    body: summarizeGames(games),
    gameIds: games.map((game) => game.id),
    planHistoryId,
    createdAt: now,
  });

  const nextState = {
    ...normalizedState,
    observations: [...nextObservations.filter(Boolean), ...existingObservations],
    feedItems: [feedItem, ...(normalizedState.feedItems || [])].filter(Boolean).slice(0, 120),
    notifications: [createTeamFeedNotification(feedItem, options), ...(normalizedState.notifications || [])].filter(Boolean),
  };
  const overview = buildTeamOverview(nextState, { ...options, games });
  return {
    ...nextState,
    notifications: appendUniqueNotifications(
      nextState.notifications,
      createScheduleConflictNotifications(nextState, overview, options),
    ),
  };
}

export function upsertManualGame(state, input, user, options = {}) {
  const activeUser = user || getActiveUser(state);
  assertCanCreate(activeUser);
  const normalizedState = normalizeProductState(state, options);
  const now = nowIso(options.clock);
  const existingId = normalizeId(input?.id);
  const previousManualGame = existingId
    ? (normalizedState.manualGames || []).find((game) => game.id === existingId) || null
    : null;
  const manualGame = normalizeManualGame({
    id: existingId || makeId("manual-game", options.clock, options.random),
    ...input,
    source: "manual",
    createdBy: normalizeId(input?.createdBy) || activeUser.id,
    createdAt:
      existingId && (normalizedState.manualGames || []).find((game) => game.id === existingId)?.createdAt
        ? (normalizedState.manualGames || []).find((game) => game.id === existingId).createdAt
        : now,
    updatedAt: now,
  });
  if (!manualGame) {
    throw new Error("Manuelles Spiel braucht Heimteam, Auswärtsteam und Datum.");
  }

  const existing = (normalizedState.manualGames || []).filter((game) => game.id !== manualGame.id);
  const feedItem = normalizeFeedItem({
    id: makeId(`feed-manual-game-${manualGame.id}`, options.clock, options.random),
    type:
      previousManualGame?.status !== "cancelled" && manualGame.status === "cancelled"
        ? "manual_game_cancelled"
        : previousManualGame
          ? "manual_game_updated"
          : "manual_game_created",
    actorId: activeUser.id,
    title:
      previousManualGame?.status !== "cancelled" && manualGame.status === "cancelled"
        ? "Manuelles Spiel abgesagt"
        : previousManualGame
          ? "Manuelles Spiel aktualisiert"
          : "Manuelles Spiel angelegt",
    body: `${manualGame.home} vs ${manualGame.away}`,
    gameIds: [manualGame.id],
    createdAt: now,
  });

  const nextState = {
    ...normalizedState,
    manualGames: [manualGame, ...existing],
    feedItems: [feedItem, ...(normalizedState.feedItems || [])].filter(Boolean).slice(0, 120),
    notifications: [createTeamFeedNotification(feedItem, options), ...(normalizedState.notifications || [])].filter(Boolean),
  };
  return {
    ...nextState,
    notifications: appendUniqueNotifications(
      nextState.notifications,
      createManualGameNotifications(normalizedState, previousManualGame, manualGame, options),
    ),
  };
}

export function updateTeamGoals(state, input, user, options = {}) {
  const activeUser = user || getActiveUser(state);
  if (!(activeUser.role === "admin" || activeUser.role === "coordinator" || activeUser.role === "scout")) {
    throw new Error("Gastzugriff ist schreibgeschützt.");
  }
  const normalizedState = normalizeProductState(state, options);
  const teamGoals = normalizeTeamGoals(input);
  const now = nowIso(options.clock);
  const feedItem = normalizeFeedItem({
    id: makeId("feed-team-goals", options.clock, options.random),
    type: "team_goals_updated",
    actorId: activeUser.id,
    title: "Team-Ziele aktualisiert",
    body: [...teamGoals.favoriteTeams, ...teamGoals.favoriteClubs, ...teamGoals.leaguePriorities, ...teamGoals.ageGroups]
      .slice(0, 6)
      .join(" · "),
    createdAt: now,
  });

  return {
    ...normalizedState,
    teamGoals,
    feedItems: [feedItem, ...(normalizedState.feedItems || [])].filter(Boolean).slice(0, 120),
    notifications: [createTeamFeedNotification(feedItem, options), ...(normalizedState.notifications || [])].filter(Boolean),
  };
}

export function markGameObservationSeen(state, gameId, scoutId, user, options = {}) {
  const activeUser = user || getActiveUser(state);
  if (activeUser.role === "readonly") {
    throw new Error("Gastzugriff ist schreibgeschützt.");
  }
  const normalizedState = normalizeProductState(state, options);
  const targetGameId = normalizeId(gameId);
  const targetScoutId = normalizeId(scoutId) || activeUser.id;
  const canCorrectOthers = activeUser.role === "admin" || activeUser.role === "coordinator";
  if (targetScoutId !== activeUser.id && !canCorrectOthers) {
    throw new Error("Nur eigene Sichtungen können als gesehen markiert werden.");
  }

  const now = nowIso(options.clock);
  let touchedObservation = null;
  const observations = (normalizedState.observations || []).map((observation) => {
    if (observation.gameId !== targetGameId || observation.scoutId !== targetScoutId || touchedObservation) {
      return observation;
    }
    touchedObservation = {
      ...observation,
      status: "seen",
      seenAt: now,
      updatedAt: now,
    };
    return touchedObservation;
  });

  if (!touchedObservation) {
    touchedObservation = normalizeObservation({
      id: makeId(`observation-${targetGameId}-${targetScoutId}`, options.clock, options.random),
      gameId: targetGameId,
      scoutId: targetScoutId,
      status: "seen",
      createdAt: now,
      updatedAt: now,
      seenAt: now,
    });
    observations.unshift(touchedObservation);
  }

  const actorName = getTeamAccountName(normalizedState, targetScoutId);
  const feedItem = normalizeFeedItem({
    id: makeId(`feed-seen-${targetGameId}-${targetScoutId}`, options.clock, options.random),
    type: "game_seen",
    actorId: targetScoutId,
    title: `${actorName} hat ein geplantes Spiel gesehen`,
    body: targetGameId,
    gameIds: [targetGameId],
    observationId: touchedObservation?.id,
    planHistoryId: touchedObservation?.planHistoryId,
    createdAt: now,
  });

  return {
    ...normalizedState,
    observations,
    feedItems: [feedItem, ...(normalizedState.feedItems || [])].filter(Boolean).slice(0, 120),
    notifications: [createTeamFeedNotification(feedItem, options), ...(normalizedState.notifications || [])].filter(Boolean),
  };
}

function getObservationGameLabel(observation) {
  const game = observation?.game && typeof observation.game === "object" ? observation.game : {};
  const home = compactText(game.home);
  const away = compactText(game.away);
  if (home && away) {
    return `${home} vs ${away}`;
  }
  return normalizeId(observation?.gameId) || "Spiel";
}

export function createObservationMatchReport(state, observationId, user, options = {}) {
  const activeUser = user || getActiveUser(state);
  assertCanCreate(activeUser);
  const normalizedState = normalizeProductState(state, options);
  const targetId = normalizeId(observationId);
  const observation = (normalizedState.observations || []).find((item) => item.id === targetId);
  if (!observation) {
    throw new Error("Sichtung wurde nicht gefunden.");
  }
  const canUseObservation =
    observation.scoutId === activeUser.id || activeUser.role === "admin" || activeUser.role === "coordinator";
  if (!canUseObservation) {
    throw new Error("Nur eigene oder koordinierte Sichtungen koennen verknuepft werden.");
  }
  if (observation.status !== "seen") {
    throw new Error("Ein Spielbericht kann erst nach einer gesehenen Sichtung angelegt werden.");
  }

  const now = nowIso(options.clock);
  const reportId = normalizeId(observation.reportId) || `report-${observation.id}`;
  const reportUrl = String(observation.reportUrl || `#report-${reportId}`);
  const gameLabel = getObservationGameLabel(observation);
  const existingReport = (normalizedState.reports || []).find((report) => report.id === reportId);
  const reportInput = {
    id: reportId,
    type: "match",
    title: existingReport?.title || `Spielbericht: ${gameLabel}`,
    status: existingReport?.status || "draft",
    visibility: "team",
    ownerId: observation.scoutId || activeUser.id,
    context: {
      ...(existingReport?.context || {}),
      observationId: observation.id,
      gameId: observation.gameId,
      scoutId: observation.scoutId,
      gameLabel,
      source: "seen_observation",
    },
    tags: existingReport?.tags || ["live-sichtung"],
    sections: existingReport?.sections,
  };

  const withReport = existingReport
    ? upsertReport(normalizedState, reportInput, activeUser, options)
    : {
        ...normalizedState,
        reports: [createReportInput(reportInput, activeUser, options), ...(normalizedState.reports || [])],
        notifications: [
          createNotification(
            {
              type: "report_shared",
              title: "Neuer Spielbericht",
              body: `Spielbericht: ${gameLabel}`,
              entityType: "report",
              entityId: reportId,
              recipientId: observation.scoutId || activeUser.id,
            },
            options,
          ),
          ...(normalizedState.notifications || []),
        ],
      };

  const observations = (withReport.observations || []).map((item) =>
    item.id === observation.id
      ? {
          ...item,
          reportId,
          reportUrl,
          updatedAt: now,
        }
      : item,
  );
  const feedItem = normalizeFeedItem({
    id: makeId(`feed-report-${observation.id}`, options.clock, options.random),
    type: "report_linked",
    actorId: activeUser.id,
    title: "Spielbericht verknuepft",
    body: gameLabel,
    gameIds: [observation.gameId],
    observationId: observation.id,
    planHistoryId: observation.planHistoryId,
    createdAt: now,
  });

  return {
    ...withReport,
    observations,
    feedItems: [feedItem, ...(withReport.feedItems || [])].filter(Boolean).slice(0, 120),
    notifications: [createTeamFeedNotification(feedItem, options), ...(withReport.notifications || [])].filter(Boolean),
  };
}

export function updateObservationNote(state, observationId, note, user, options = {}) {
  const activeUser = user || getActiveUser(state);
  if (activeUser.role === "readonly") {
    throw new Error("Gastzugriff ist schreibgeschützt.");
  }
  const normalizedState = normalizeProductState(state, options);
  const targetId = normalizeId(observationId);
  const index = (normalizedState.observations || []).findIndex((item) => item.id === targetId);
  if (index < 0) {
    throw new Error("Sichtung wurde nicht gefunden.");
  }

  const observation = normalizedState.observations[index];
  const canUseObservation =
    observation.scoutId === activeUser.id || activeUser.role === "admin" || activeUser.role === "coordinator";
  if (!canUseObservation) {
    throw new Error("Nur eigene oder koordinierte Sichtungen koennen kommentiert werden.");
  }
  if (observation.status !== "seen") {
    throw new Error("Notizen koennen erst nach einer gesehenen Sichtung ergänzt werden.");
  }

  const now = nowIso(options.clock);
  const text = String(note || "").trim();
  const observations = [...normalizedState.observations];
  observations[index] = {
    ...observation,
    note: text,
    updatedAt: now,
  };
  const feedItem = normalizeFeedItem({
    id: makeId(`feed-note-${observation.id}`, options.clock, options.random),
    type: "observation_note_added",
    actorId: activeUser.id,
    title: "Sichtungsnotiz ergänzt",
    body: text || getObservationGameLabel(observation),
    gameIds: [observation.gameId],
    observationId: observation.id,
    planHistoryId: observation.planHistoryId,
    createdAt: now,
  });
  const mentionedIds = [...new Set((text.match(/@([a-zA-Z0-9._-]{2,})/g) || []).map((raw) => normalizeId(raw.slice(1))).filter(Boolean))];
  const mentionNotifications = mentionedIds
    .map((id) => (normalizedState.team?.accounts || []).find((account) => account.id === id && account.active !== false))
    .filter(Boolean)
    .filter((account) => account.id !== activeUser.id)
    .map((account) =>
      createNotification(
        {
          type: "mention",
          title: "Du wurdest erwähnt",
          body: `${activeUser.name} hat dich in einer Sichtungsnotiz erwähnt.`,
          entityType: "observation",
          entityId: observation.id,
          recipientId: account.id,
        },
        options,
      ),
    );

  return {
    ...normalizedState,
    observations,
    feedItems: [feedItem, ...(normalizedState.feedItems || [])].filter(Boolean).slice(0, 120),
    notifications: [createTeamFeedNotification(feedItem, options), ...mentionNotifications, ...(normalizedState.notifications || [])].filter(Boolean),
  };
}

export function reassignObservation(state, observationId, targetScoutId, user, options = {}) {
  const activeUser = user || getActiveUser(state);
  if (!(activeUser.role === "admin" || activeUser.role === "coordinator")) {
    throw new Error("Nur Admin oder Koordination können Sichtungen umverteilen.");
  }
  const normalizedState = normalizeProductState(state, options);
  const targetObservationId = normalizeId(observationId);
  const targetScout = normalizeId(targetScoutId);
  if (!targetObservationId || !targetScout) {
    throw new Error("observationId und targetScoutId sind erforderlich.");
  }
  const targetAccount = (normalizedState.team?.accounts || []).find((account) => account.id === targetScout && account.active !== false);
  if (!targetAccount) {
    throw new Error("Ziel-Scout wurde nicht gefunden.");
  }
  if (targetAccount.role === "readonly") {
    throw new Error("Gastkonten können keine Sichtungen übernehmen.");
  }
  const observation = (normalizedState.observations || []).find((item) => item.id === targetObservationId);
  if (!observation) {
    throw new Error("Sichtung wurde nicht gefunden.");
  }
  const now = nowIso(options.clock);
  const reassigned = normalizeObservation({
    ...observation,
    id: makeId(`observation-${observation.gameId}-${targetScout}`, options.clock, options.random),
    scoutId: targetScout,
    updatedAt: now,
  });
  const feedItem = normalizeFeedItem({
    id: makeId(`feed-reassign-${observation.gameId}-${targetScout}`, options.clock, options.random),
    type: "observation_reassigned",
    actorId: activeUser.id,
    title: "Sichtung umverteilt",
    body: `${targetAccount.name} übernimmt ${getObservationGameLabel(observation)}.`,
    gameIds: [observation.gameId],
    observationId: reassigned.id,
    planHistoryId: reassigned.planHistoryId,
    createdAt: now,
  });
  return {
    ...normalizedState,
    observations: (normalizedState.observations || []).map((item) => (item.id === targetObservationId ? reassigned : item)),
    feedItems: [feedItem, ...(normalizedState.feedItems || [])].filter(Boolean).slice(0, 120),
    notifications: [createTeamFeedNotification(feedItem, options), ...(normalizedState.notifications || [])].filter(Boolean),
  };
}

export function upsertTeamAccount(state, input, user) {
  const activeUser = user || getActiveUser(state);
  if (!(activeUser?.role === "admin" || activeUser?.role === "coordinator")) {
    throw new Error("Nur Admin oder Koordinator können Team-Accounts verwalten.");
  }
  const normalizedState = normalizeProductState(state);
  const id = normalizeId(input?.id);
  const name = compactText(input?.name);
  if (!id || !name) {
    throw new Error("Team-Account benötigt ID und Namen.");
  }
  const account = normalizeTeamAccount({
    id,
    name,
    role: input?.role,
    teamId: input?.teamId || normalizedState.team.id,
    active: input?.active,
  });
  const accounts = [
    account,
    ...(normalizedState.team.accounts || []).filter((item) => item.id !== account.id),
  ];
  const existingUser = (normalizedState.users || []).find((item) => item.id === account.id);
  const nextUser = normalizeUser(
    {
      ...existingUser,
      id: account.id,
      name: account.name,
      role: account.role,
      teamId: account.teamId,
      active: account.active,
    },
    existingUser,
  );
  const users = existingUser
    ? normalizedState.users.map((item) => (item.id === account.id ? nextUser : item))
    : [...normalizedState.users, nextUser];

  return normalizeProductState({
    ...normalizedState,
    users,
    team: {
      ...normalizedState.team,
      accounts,
    },
  });
}

export function switchActiveUser(state, userId) {
  const id = normalizeId(userId);
  if (!state.users.some((user) => user.id === id)) {
    return state;
  }
  return {
    ...state,
    activeUserId: id,
  };
}

export function saveSearchFilter(state, input, user, options = {}) {
  const activeUser = user || getActiveUser(state);
  assertCanCreate(activeUser);
  const name = compactText(input?.name);
  if (!name) {
    throw new Error("Filter-Name ist erforderlich.");
  }
  const filter = normalizeSavedFilter({
    id: makeId("filter", options.clock, options.random),
    name,
    ownerId: activeUser.id,
    query: input?.query,
    filters: input?.filters,
    createdAt: nowIso(options.clock),
  });
  return {
    ...state,
    savedFilters: [filter, ...(state.savedFilters || []).filter((item) => item.name.toLowerCase() !== name.toLowerCase())].slice(0, 20),
  };
}

export function deleteSearchFilter(state, filterId, user) {
  const activeUser = user || getActiveUser(state);
  return {
    ...state,
    savedFilters: (state.savedFilters || []).filter((filter) => {
      if (filter.id !== filterId) {
        return true;
      }
      return !(activeUser.role === "admin" || filter.ownerId === activeUser.id);
    }),
  };
}

function reportText(report) {
  return (Array.isArray(report?.sections) ? report.sections : []).map((section) => section.text).join(" ");
}

function scoreKeywordHits(text, words) {
  const lookup = toLookupKey(text);
  return words.filter((word) => lookup.includes(toLookupKey(word)));
}

function averageRating(ratings) {
  const values = Object.values(ratings || {}).filter((value) => Number.isFinite(Number(value)));
  if (!values.length) {
    return null;
  }
  return values.reduce((sum, value) => sum + Number(value), 0) / values.length;
}

export function analyzeReport(report, options = {}) {
  const text = reportText(report);
  const positiveHits = scoreKeywordHits(text, POSITIVE_WORDS);
  const negativeHits = scoreKeywordHits(text, NEGATIVE_WORDS);
  const avg = averageRating(report?.ratings);
  const strengths = positiveHits.length
    ? positiveHits.slice(0, 4).map((word) => `Textsignal: ${word}`)
    : ["Noch keine klaren Stärken aus dem Text extrahiert."];
  const weaknesses = negativeHits.length
    ? negativeHits.slice(0, 4).map((word) => `Prüfsignal: ${word}`)
    : ["Keine expliziten Schwachstellen im Text markiert."];
  const contradictions = [];

  if (Number.isFinite(avg) && avg >= 4 && negativeHits.length >= 2) {
    contradictions.push("Hohe Bewertung trifft auf mehrere kritische Textsignale. Bewertung und Freitext prüfen.");
  }
  if (Number.isFinite(avg) && avg <= 2 && positiveHits.length >= 2) {
    contradictions.push("Niedrige Bewertung trifft auf mehrere positive Textsignale. Bewertungslogik prüfen.");
  }
  if (!compactText(text)) {
    contradictions.push("Report enthält noch keinen auswertbaren Freitext.");
  }

  const summary = compactText(text)
    ? compactText(text).split(/[.!?]/).map(compactText).filter(Boolean).slice(0, 2).join(". ")
    : "Noch keine belastbare Zusammenfassung möglich.";

  return {
    status: "complete",
    generatedAt: nowIso(options.clock),
    summary: summary.endsWith(".") ? summary : `${summary}.`,
    strengths,
    weaknesses,
    trends: Number.isFinite(avg)
      ? [`Durchschnittsbewertung ${avg.toFixed(1)} / 5 als erster Trendanker.`]
      : ["Noch nicht genug Ratings für einen Trend."],
    developmentHints:
      contradictions.length > 0
        ? ["Erst Widersprüche klären, dann Follow-up terminieren."]
        : ["Nächste Sichtung mit gleichem Raster dokumentieren."],
    contradictions,
  };
}

export function attachReportAnalysis(state, reportId, user, options = {}) {
  const activeUser = user || getActiveUser(state);
  const target = (state.reports || []).find((report) => report.id === reportId);
  if (!target) {
    throw new Error("Report wurde nicht gefunden.");
  }
  assertCanEdit(activeUser, target);
  const ai = analyzeReport(target, options);
  const now = nowIso(options.clock);
  return {
    ...state,
    reports: state.reports.map((report) => (report.id === reportId ? { ...report, ai, updatedAt: now } : report)),
  };
}

function addSearchResult(results, type, title, subtitle, entity, score) {
  results.push({
    id: `${type}:${entity?.id || title}`,
    type,
    title: compactText(title),
    subtitle: compactText(subtitle),
    entity,
    score,
  });
}

function matchesQuery(queryKey, values) {
  if (!queryKey) {
    return true;
  }
  return values.some((value) => toLookupKey(value).includes(queryKey));
}

export function buildGlobalSearchResults({ state, user, games, playerSheets, planHistory, query, filters } = {}) {
  const actor = user || getActiveUser(state);
  const queryKey = toLookupKey(query);
  const typeFilter = normalizeId(filters?.type);
  const statusFilter = normalizeId(filters?.status);
  const results = [];

  for (const report of filterVisibleEntities(state?.reports, actor)) {
    if (typeFilter && typeFilter !== "report") {
      continue;
    }
    if (statusFilter && report.status !== statusFilter) {
      continue;
    }
    const haystack = [report.title, report.type, report.status, report.tags.join(" "), reportText(report), report.context?.playerName];
    if (matchesQuery(queryKey, haystack)) {
      addSearchResult(results, "report", report.title, `${REPORT_TYPES[report.type]} · ${REPORT_STATUSES[report.status]}`, report, 80);
    }
  }

  for (const watchlist of filterVisibleEntities(state?.watchlists, actor)) {
    if (typeFilter && typeFilter !== "watchlist") {
      continue;
    }
    const entryText = (watchlist.entries || []).map((entry) => `${entry.playerName} ${entry.club} ${entry.labels.join(" ")}`).join(" ");
    if (matchesQuery(queryKey, [watchlist.name, watchlist.tags.join(" "), entryText])) {
      addSearchResult(results, "watchlist", watchlist.name, `${watchlist.entries.length} Spieler · ${VISIBILITIES[watchlist.visibility]}`, watchlist, 70);
    }
  }

  for (const assignment of filterVisibleEntities(state?.assignments, actor)) {
    if (typeFilter && typeFilter !== "assignment") {
      continue;
    }
    if (statusFilter && assignment.status !== statusFilter) {
      continue;
    }
    if (matchesQuery(queryKey, [assignment.title, assignment.description, assignment.status, assignment.type])) {
      addSearchResult(results, "assignment", assignment.title, ASSIGNMENT_STATUSES[assignment.status], assignment, 65);
    }
  }

  for (const player of Array.isArray(playerSheets) ? playerSheets : []) {
    if (typeFilter && typeFilter !== "player") {
      continue;
    }
    if (matchesQuery(queryKey, [player.name, player.club, player.position, player.strengths])) {
      addSearchResult(results, "player", player.name, `${player.club || "Verein offen"} · ${player.position || "Position offen"}`, player, 60);
    }
  }

  for (const game of Array.isArray(games) ? games : []) {
    if (typeFilter && typeFilter !== "game") {
      continue;
    }
    if (matchesQuery(queryKey, [game.home, game.away, game.venue, game.dateLabel, game.note])) {
      addSearchResult(results, "game", `${game.home} vs ${game.away}`, `${game.dateLabel || ""} ${game.time || ""} · ${game.venue || ""}`, game, 45);
    }
  }

  for (const entry of Array.isArray(planHistory) ? planHistory : []) {
    if (typeFilter && typeFilter !== "history") {
      continue;
    }
    const meta = entry?.meta || {};
    if (matchesQuery(queryKey, [meta.kreisLabel, meta.jugendLabel, entry.planText])) {
      addSearchResult(results, "history", `${meta.jugendLabel || "Plan"} · ${meta.kreisLabel || "Historie"}`, entry.createdAt || "", entry, 35);
    }
  }

  return results
    .filter((result) => result.title)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.title.localeCompare(right.title, "de-DE");
    })
    .slice(0, 40);
}

export function buildScoutingDashboard({ state, user } = {}) {
  const actor = user || getActiveUser(state);
  const reports = filterVisibleEntities(state?.reports, actor);
  const watchlists = filterVisibleEntities(state?.watchlists, actor);
  const assignments = filterVisibleEntities(state?.assignments, actor);
  const notifications = (state?.notifications || []).filter(
    (notification) => !notification.recipientId || notification.recipientId === actor.id || actor.role === "admin",
  );
  const openAssignments = assignments.filter((assignment) => assignment.status === "open" || assignment.status === "planned");
  const todayKey = new Date().toISOString().slice(0, 10);
  const dueToday = openAssignments.filter((assignment) => assignment.dueAt && assignment.dueAt.slice(0, 10) <= todayKey);
  const unreadNotifications = notifications.filter((notification) => !notification.readAt);
  const priorityPlayers = watchlists
    .flatMap((watchlist) =>
      (watchlist.entries || []).map((entry) => ({
        ...entry,
        watchlistId: watchlist.id,
        watchlistName: watchlist.name,
      })),
    )
    .sort((left, right) => Number(right.priority || 0) - Number(left.priority || 0))
    .slice(0, 8);

  return {
    summary: {
      visibleReports: reports.length,
      openAssignments: openAssignments.length,
      dueToday: dueToday.length,
      watchlists: watchlists.length,
      unreadNotifications: unreadNotifications.length,
      priorityPlayers: priorityPlayers.length,
    },
    recentReports: [...reports].sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt))).slice(0, 6),
    openAssignments: [...openAssignments].sort((left, right) => String(left.dueAt || "9999").localeCompare(String(right.dueAt || "9999"))).slice(0, 8),
    priorityPlayers,
    notifications: [...notifications].sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt))).slice(0, 8),
  };
}

function mergeProfile(profileMap, key, patch) {
  if (!key) {
    return;
  }
  const existing = profileMap.get(key) || {
    key,
    name: "",
    club: "",
    position: "",
    reportIds: [],
    watchlistEntries: [],
    assignments: [],
    notes: [],
    ratings: [],
    latestAt: "",
  };
  const next = {
    ...existing,
    ...patch,
    name: existing.name || patch.name || "",
    club: existing.club || patch.club || "",
    position: existing.position || patch.position || "",
    reportIds: [...existing.reportIds, ...(patch.reportIds || [])],
    watchlistEntries: [...existing.watchlistEntries, ...(patch.watchlistEntries || [])],
    assignments: [...existing.assignments, ...(patch.assignments || [])],
    notes: [...existing.notes, ...(patch.notes || [])],
    ratings: [...existing.ratings, ...(patch.ratings || [])],
    latestAt: [existing.latestAt, patch.latestAt].filter(Boolean).sort().pop() || "",
  };
  profileMap.set(key, next);
}

export function buildPlayerProfiles({ state, user, playerSheets } = {}) {
  const actor = user || getActiveUser(state);
  const profiles = new Map();

  for (const player of Array.isArray(playerSheets) ? playerSheets : []) {
    const name = compactText(player?.name);
    const key = toLookupKey(name);
    mergeProfile(profiles, key, {
      name,
      club: compactText(player?.club),
      position: compactText(player?.position),
      notes: [player?.strengths].filter(Boolean),
      latestAt: normalizeId(player?.updatedAt || player?.createdAt),
    });
  }

  for (const report of filterVisibleEntities(state?.reports, actor)) {
    const name = compactText(report?.context?.playerName);
    const key = toLookupKey(name);
    mergeProfile(profiles, key, {
      name,
      reportIds: [report.id],
      ratings: [report.ratings],
      notes: [reportText(report)].filter(Boolean),
      latestAt: report.updatedAt,
    });
  }

  for (const watchlist of filterVisibleEntities(state?.watchlists, actor)) {
    for (const entry of watchlist.entries || []) {
      const key = toLookupKey(entry.playerName);
      mergeProfile(profiles, key, {
        name: entry.playerName,
        club: entry.club,
        watchlistEntries: [{ ...entry, watchlistId: watchlist.id, watchlistName: watchlist.name }],
        notes: [entry.note].filter(Boolean),
        latestAt: entry.updatedAt,
      });
    }
  }

  for (const assignment of filterVisibleEntities(state?.assignments, actor)) {
    const linkedReport = (state?.reports || []).find((report) => report.id === assignment.linkedReportId);
    const name = compactText(linkedReport?.context?.playerName);
    mergeProfile(profiles, toLookupKey(name), {
      name,
      assignments: [assignment],
      latestAt: assignment.updatedAt,
    });
  }

  return [...profiles.values()]
    .filter((profile) => profile.name)
    .map((profile) => {
      const ratingValues = profile.ratings.flatMap((rating) => Object.values(rating || {}).filter((value) => Number.isFinite(Number(value))));
      const average = ratingValues.length
        ? Math.round((ratingValues.reduce((sum, value) => sum + Number(value), 0) / ratingValues.length) * 10) / 10
        : null;
      return {
        ...profile,
        averageRating: average,
        reportCount: profile.reportIds.length,
        watchlistCount: profile.watchlistEntries.length,
        assignmentCount: profile.assignments.length,
        priority: Math.max(0, ...profile.watchlistEntries.map((entry) => Number(entry.priority || 0))),
      };
    })
    .sort((left, right) => {
      if (right.priority !== left.priority) {
        return right.priority - left.priority;
      }
      if (right.reportCount !== left.reportCount) {
        return right.reportCount - left.reportCount;
      }
      return String(right.latestAt).localeCompare(String(left.latestAt));
    });
}

export function comparePlayers(profiles, leftKey, rightKey) {
  const list = Array.isArray(profiles) ? profiles : [];
  const left = list.find((profile) => profile.key === leftKey) || null;
  const right = list.find((profile) => profile.key === rightKey) || null;
  if (!left || !right) {
    return null;
  }
  const metrics = [
    ["averageRating", "Durchschnitt"],
    ["reportCount", "Reports"],
    ["watchlistCount", "Shortlists"],
    ["assignmentCount", "Aufgaben"],
    ["priority", "Priorität"],
  ];
  return {
    left,
    right,
    metrics: metrics.map(([key, label]) => {
      const leftValue = Number(left[key]);
      const rightValue = Number(right[key]);
      return {
        key,
        label,
        leftValue: Number.isFinite(leftValue) ? leftValue : null,
        rightValue: Number.isFinite(rightValue) ? rightValue : null,
        leader:
          Number.isFinite(leftValue) && Number.isFinite(rightValue) && leftValue !== rightValue
            ? leftValue > rightValue
              ? "left"
              : "right"
            : "even",
      };
    }),
  };
}

export function buildCalendarModel(assignments, options = {}) {
  const limit = Number.isFinite(options.limit) ? Math.max(1, Number(options.limit)) : 30;
  const grouped = new Map();
  for (const assignment of Array.isArray(assignments) ? assignments : []) {
    const day = normalizeId(assignment.dueAt).slice(0, 10) || "ohne-datum";
    const current = grouped.get(day) || [];
    current.push(assignment);
    grouped.set(day, current);
  }
  return [...grouped.entries()]
    .map(([dateKey, items]) => ({
      dateKey,
      items: items.sort((left, right) => String(left.title).localeCompare(String(right.title), "de-DE")),
      openCount: items.filter((item) => item.status === "open" || item.status === "planned").length,
    }))
    .sort((left, right) => left.dateKey.localeCompare(right.dateKey))
    .slice(0, limit);
}

export function buildGameObservationMap(state, options = {}) {
  const actor = options.user || getActiveUser(state);
  const accounts = new Map((state?.team?.accounts || []).map((account) => [account.id, account]));
  const observationsByGame = {};

  for (const observation of Array.isArray(state?.observations) ? state.observations : []) {
    const gameId = normalizeId(observation.gameId);
    if (!gameId) {
      continue;
    }
    const scoutName = compactText(accounts.get(observation.scoutId)?.name) || getTeamAccountName(state, observation.scoutId);
    const entry = {
      ...observation,
      scoutName,
    };
    const bucket = observationsByGame[gameId] || {
      observations: [],
      plannedBy: [],
      seenBy: [],
      plannedByOtherScouts: [],
      label: "",
    };
    bucket.observations.push(entry);
    observationsByGame[gameId] = bucket;
  }

  for (const [gameId, bucket] of Object.entries(observationsByGame)) {
    const latestPlannedByScout = new Map();
    const latestSeenByScout = new Map();
    const sorted = [...bucket.observations].sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));

    for (const observation of sorted) {
      if (observation.status === "planned" && !latestPlannedByScout.has(observation.scoutId)) {
        latestPlannedByScout.set(observation.scoutId, observation);
      }
      if (observation.status === "seen" && !latestSeenByScout.has(observation.scoutId)) {
        latestSeenByScout.set(observation.scoutId, observation);
      }
    }

    const plannedBy = [...latestPlannedByScout.values()].sort((left, right) => left.scoutName.localeCompare(right.scoutName, "de-DE"));
    const seenBy = [...latestSeenByScout.values()].sort((left, right) => left.scoutName.localeCompare(right.scoutName, "de-DE"));

    observationsByGame[gameId] = {
      ...bucket,
      plannedBy,
      seenBy,
      plannedByOtherScouts: plannedBy
        .filter((observation) => observation.scoutId !== actor?.id)
        .map((observation) => observation.scoutName),
      label: plannedBy.length ? `im Plan von ${plannedBy.map((observation) => observation.scoutName).join(", ")}` : "",
    };
  }

  return observationsByGame;
}

function getGameDateKey(game) {
  const date = String(game?.date || game?.dateKey || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }
  const dateTime = String(game?.dateTime || game?.kickoff || "").trim();
  const match = dateTime.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "";
}

function parseDateKey(dateKey) {
  const text = String(dateKey || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return null;
  }
  const date = new Date(`${text}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateKey(date) {
  return date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : "";
}

function addDays(date, days) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function getWeekBounds(dateKey) {
  const date = parseDateKey(dateKey);
  if (!date) {
    return { start: "", end: "" };
  }
  const day = date.getUTCDay() || 7;
  const start = addDays(date, 1 - day);
  const end = addDays(start, 6);
  return { start: formatDateKey(start), end: formatDateKey(end) };
}

function isDateKeyBetween(dateKey, start, end) {
  return Boolean(dateKey && start && end && dateKey >= start && dateKey <= end);
}

function daysBetween(startDateKey, endDateKey) {
  const start = parseDateKey(startDateKey);
  const end = parseDateKey(endDateKey);
  if (!start || !end) {
    return null;
  }
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000));
}

function getGameLabel(game, fallbackId = "") {
  const home = compactText(game?.home);
  const away = compactText(game?.away);
  if (home && away) {
    return `${home} vs ${away}`;
  }
  return compactText(game?.label || game?.title || fallbackId) || "Spiel";
}

function parseKickoffMinutes(value) {
  const match = String(value || "").match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) {
    return null;
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

function toPositiveMinutes(value, fallback = null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return Math.round(parsed);
}

function estimateStartTravelMinutes(game) {
  const explicit = toPositiveMinutes(
    game?.fromStartRouteMinutes ?? game?.startRouteMinutes ?? game?.travelMinutesFromStart ?? game?.driveMinutesFromStart,
  );
  if (explicit !== null) {
    return explicit;
  }
  const distance = Number(game?.fromStartRouteDistanceKm ?? game?.distanceKm);
  if (Number.isFinite(distance) && distance > 0) {
    return Math.max(10, Math.round(distance * 1.5));
  }
  return 0;
}

function estimateTravelMinutes(firstGame, secondGame) {
  const explicit = toPositiveMinutes(
    firstGame?.travelMinutesToNext ??
      firstGame?.driveMinutesToNext ??
      secondGame?.travelMinutesFromPrevious ??
      secondGame?.driveMinutesFromPrevious,
  );
  if (explicit !== null) {
    return explicit;
  }

  const firstDistance = Number(firstGame?.distanceKm ?? firstGame?.fromStartRouteDistanceKm);
  const secondDistance = Number(secondGame?.distanceKm ?? secondGame?.fromStartRouteDistanceKm);
  if (Number.isFinite(firstDistance) && Number.isFinite(secondDistance)) {
    return Math.max(10, Math.round(Math.abs(secondDistance - firstDistance) * 1.5));
  }
  return 0;
}

function buildScheduleConflicts(observations, options = {}) {
  const minBufferMinutes = toPositiveMinutes(options.minBufferMinutes, 15);
  const startMinutes = parseKickoffMinutes(options.startTime || options.startAt || options.availableFrom);
  const byScout = new Map();
  for (const observation of observations) {
    const gameStartMinutes = parseKickoffMinutes(observation.game?.time);
    if (gameStartMinutes === null) {
      continue;
    }
    const entry = {
      ...observation,
      startMinutes: gameStartMinutes,
      durationMinutes: toPositiveMinutes(observation.game?.durationMinutes, 90),
    };
    byScout.set(observation.scoutId, [...(byScout.get(observation.scoutId) || []), entry]);
  }

  const conflicts = [];
  const classifyConflictSeverity = ({ type, gapMinutes, requiredGap }) => {
    if (type === "overlap") {
      return "hard-conflict";
    }
    const gap = Number(gapMinutes);
    const required = Number(requiredGap);
    if (!Number.isFinite(gap) || !Number.isFinite(required)) {
      return "warn";
    }
    if (gap < required - 20) {
      return "hard-conflict";
    }
    if (gap < required) {
      return "warn";
    }
    return "info";
  };
  for (const [scoutId, entries] of byScout) {
    const sorted = [...entries].sort((left, right) => left.startMinutes - right.startMinutes);
    const firstByDate = new Map();
    for (const entry of sorted) {
      if (!firstByDate.has(entry.dateKey)) {
        firstByDate.set(entry.dateKey, entry);
      }
    }
    if (startMinutes !== null) {
      for (const first of firstByDate.values()) {
        const gapMinutes = first.startMinutes - startMinutes;
        const travelMinutes = estimateStartTravelMinutes(first.game);
        const requiredGap = travelMinutes + minBufferMinutes;
        if (gapMinutes < requiredGap) {
          const severity = classifyConflictSeverity({ type: "start_travel", gapMinutes, requiredGap });
          conflicts.push({
            scoutId,
            scoutName: first.scoutName,
            type: "start_travel",
            severity,
            firstGameId: "",
            firstGameLabel: "Startort",
            secondGameId: first.gameId,
            secondGameLabel: first.gameLabel,
            dateKey: first.dateKey,
            gapMinutes,
            requiredGap,
            travelMinutes,
          });
        }
      }
    }
    for (let index = 0; index < sorted.length - 1; index += 1) {
      const first = sorted[index];
      const second = sorted[index + 1];
      if (first.dateKey !== second.dateKey) {
        continue;
      }

      const firstEnd = first.startMinutes + first.durationMinutes;
      const gapMinutes = second.startMinutes - firstEnd;
      const travelMinutes = estimateTravelMinutes(first.game, second.game);
      const requiredGap = travelMinutes + minBufferMinutes;
      if (second.startMinutes < firstEnd || gapMinutes < requiredGap) {
        const type = second.startMinutes < firstEnd ? "overlap" : "travel";
        const severity = classifyConflictSeverity({ type, gapMinutes, requiredGap });
        conflicts.push({
          scoutId,
          scoutName: first.scoutName,
          type,
          severity,
          firstGameId: first.gameId,
          firstGameLabel: first.gameLabel,
          secondGameId: second.gameId,
          secondGameLabel: second.gameLabel,
          dateKey: first.dateKey,
          gapMinutes,
          requiredGap,
          travelMinutes,
        });
      }
    }
  }
  return conflicts;
}

function gameMatchesTeamGoals(game, teamGoals) {
  const goals = normalizeTeamGoals(teamGoals);
  const haystack = [game?.home, game?.away, game?.league, game?.competition, game?.competitionName, game?.jugendId, game?.jugendLabel]
    .map((value) => compactText(value).toLowerCase())
    .filter(Boolean)
    .join(" ");
  const teamMatch = goals.favoriteTeams.some((team) => haystack.includes(team.toLowerCase()));
  const favoriteMatch = goals.favoriteClubs.some((club) => haystack.includes(club.toLowerCase()));
  const leagueMatch = goals.leaguePriorities.some((league) => haystack.includes(league.toLowerCase()));
  const ageMatch = goals.ageGroups.some((ageGroup) => {
    const gameAge = normalizeId(game?.jugendId || game?.jugendLabel || game?.ageGroup);
    return gameAge === ageGroup || haystack.includes(ageGroup);
  });
  if (!goals.favoriteTeams.length && !goals.favoriteClubs.length && !goals.leaguePriorities.length && !goals.ageGroups.length) {
    return false;
  }
  return teamMatch || favoriteMatch || leagueMatch || ageMatch;
}

function gameMatchesNamedTeam(game, teamName) {
  const needle = compactText(teamName).toLowerCase();
  if (!needle) {
    return false;
  }
  return [game?.home, game?.away, game?.label, game?.title]
    .map((value) => compactText(value).toLowerCase())
    .some((value) => value.includes(needle));
}

function buildStalePriorityTeams(observations, teamGoals, options = {}) {
  const goals = normalizeTeamGoals(teamGoals);
  const teamNames = goals.favoriteTeams;
  if (!teamNames.length) {
    return [];
  }

  const asOfDate = String(options.date || nowIso(options.clock).slice(0, 10));
  const maxDays = Number.isFinite(Number(options.maxPriorityTeamUnseenDays))
    ? Math.max(1, Math.round(Number(options.maxPriorityTeamUnseenDays)))
    : 30;
  const seenObservations = (Array.isArray(observations) ? observations : []).filter((observation) => observation.status === "seen");

  return teamNames
    .map((teamName) => {
      let lastSeenAt = "";
      for (const observation of seenObservations) {
        if (!gameMatchesNamedTeam(observation.game, teamName)) {
          continue;
        }
        const seenDate = String(observation.seenAt || observation.updatedAt || observation.dateKey || getGameDateKey(observation.game)).slice(0, 10);
        if (/^\d{4}-\d{2}-\d{2}$/.test(seenDate) && (!lastSeenAt || seenDate > lastSeenAt)) {
          lastSeenAt = seenDate;
        }
      }
      const daysSinceSeen = lastSeenAt ? daysBetween(lastSeenAt, asOfDate) : null;
      return {
        teamName,
        lastSeenAt,
        daysSinceSeen,
        maxDays,
        stale: daysSinceSeen === null || daysSinceSeen > maxDays,
      };
    })
    .filter((entry) => entry.stale);
}

function buildCoverageSummary(games, byGame, teamGoals, observations = [], options = {}) {
  const priorityGames = games
    .filter((game) => gameMatchesTeamGoals(game, teamGoals))
    .map((game) => ({
      gameId: game.id,
      gameLabel: getGameLabel(game, game.id),
      covered: byGame.has(game.id),
    }));
  const coveredPriorityGames = priorityGames.filter((game) => game.covered).length;
  return {
    priorityGames: priorityGames.length,
    coveredPriorityGames,
    openPriorityGames: priorityGames.length - coveredPriorityGames,
    openPriorityGameLabels: priorityGames.filter((game) => !game.covered).map((game) => game.gameLabel),
    stalePriorityTeams: buildStalePriorityTeams(observations, teamGoals, options),
  };
}

function buildScoutLoad(observations) {
  const byScout = new Map();
  for (const observation of observations) {
    if (!observation.scoutId) {
      continue;
    }
    const current = byScout.get(observation.scoutId) || {
      scoutId: observation.scoutId,
      scoutName: observation.scoutName,
      count: 0,
      gameLabels: [],
      dates: new Set(),
    };
    current.count += 1;
    current.gameLabels.push(observation.gameLabel);
    if (observation.dateKey) {
      current.dates.add(observation.dateKey);
    }
    byScout.set(observation.scoutId, current);
  }

  return [...byScout.values()]
    .map((entry) => ({
      ...entry,
      gameLabels: [...new Set(entry.gameLabels)].sort((left, right) => left.localeCompare(right, "de-DE")),
      dates: [...entry.dates].sort(),
    }))
    .sort((left, right) => left.scoutName.localeCompare(right.scoutName, "de-DE"));
}

function buildOverplannedScouts(observations, options = {}) {
  const maxGames = Number.isFinite(Number(options.maxGamesPerScoutPerDay))
    ? Math.max(1, Math.round(Number(options.maxGamesPerScoutPerDay)))
    : 2;
  const byScoutDate = new Map();
  for (const observation of observations) {
    if (!observation.scoutId || !observation.dateKey) {
      continue;
    }
    const key = `${observation.scoutId}:${observation.dateKey}`;
    const current = byScoutDate.get(key) || {
      scoutId: observation.scoutId,
      scoutName: observation.scoutName,
      dateKey: observation.dateKey,
      count: 0,
      maxGames,
      gameLabels: [],
    };
    current.count += 1;
    current.gameLabels.push(observation.gameLabel);
    byScoutDate.set(key, current);
  }

  return [...byScoutDate.values()]
    .filter((entry) => entry.count > maxGames)
    .map((entry) => ({
      ...entry,
      gameLabels: [...new Set(entry.gameLabels)].sort((left, right) => left.localeCompare(right, "de-DE")),
    }))
    .sort((left, right) => `${left.dateKey} ${left.scoutName}`.localeCompare(`${right.dateKey} ${right.scoutName}`, "de-DE"));
}

export function buildTeamOverview(state, options = {}) {
  const actor = options.user || getActiveUser(state);
  if (!actor) {
    return {
      date: "",
      weekStart: "",
      weekEnd: "",
      activeScoutsToday: [],
      activeScoutsWeek: [],
      plannedToday: [],
      duplicateGames: [],
      overplannedScouts: [],
      conflicts: [],
      coverage: buildCoverageSummary([], new Map(), state?.teamGoals, [], options),
      openGames: [],
    };
  }

  const date = String(options.date || nowIso(options.clock).slice(0, 10));
  const { start: weekStart, end: weekEnd } = getWeekBounds(date);
  const accounts = new Map((state?.team?.accounts || []).map((account) => [account.id, account]));
  const gamesById = new Map();
  for (const game of [...(Array.isArray(options.games) ? options.games : []), ...(state?.manualGames || [])]) {
    const id = normalizeId(game?.id);
    if (id) {
      gamesById.set(id, { ...game, id });
    }
  }

  const observations = (Array.isArray(state?.observations) ? state.observations : [])
    .map((observation) => {
      const gameId = normalizeId(observation?.gameId);
      const game = gamesById.get(gameId) || observation?.game || { id: gameId };
      const scoutName = compactText(accounts.get(observation.scoutId)?.name) || getTeamAccountName(state, observation.scoutId);
      return {
        ...observation,
        gameId,
        scoutName,
        game,
        gameLabel: getGameLabel(game, gameId),
        dateKey: getGameDateKey(game),
      };
    })
    .filter((observation) => observation.gameId && observation.status !== "closed");

  const todayObservations = observations.filter((observation) => observation.dateKey === date);
  const weekObservations = observations.filter((observation) => isDateKeyBetween(observation.dateKey, weekStart, weekEnd));

  const byGame = new Map();
  for (const observation of observations) {
    const bucket = byGame.get(observation.gameId) || {
      gameId: observation.gameId,
      gameLabel: observation.gameLabel,
      dateKey: observation.dateKey,
      scoutIds: new Set(),
      scoutNames: new Set(),
      observations: [],
    };
    bucket.scoutIds.add(observation.scoutId);
    bucket.scoutNames.add(observation.scoutName);
    bucket.observations.push(observation);
    byGame.set(observation.gameId, bucket);
  }

  const games = [...gamesById.values()];
  const openGames = games
    .filter((game) => getGameDateKey(game) === date && !byGame.has(game.id))
    .map((game) => ({
      gameId: game.id,
      gameLabel: getGameLabel(game, game.id),
      dateKey: getGameDateKey(game),
      time: compactText(game.time),
    }))
    .sort((left, right) => `${left.time} ${left.gameLabel}`.localeCompare(`${right.time} ${right.gameLabel}`, "de-DE"));

  return {
    date,
    weekStart,
    weekEnd,
    activeScoutsToday: buildScoutLoad(todayObservations),
    activeScoutsWeek: buildScoutLoad(weekObservations),
    plannedToday: todayObservations.sort((left, right) =>
      `${left.game?.time || ""} ${left.gameLabel}`.localeCompare(`${right.game?.time || ""} ${right.gameLabel}`, "de-DE"),
    ),
    duplicateGames: [...byGame.values()]
      .filter((bucket) => bucket.scoutIds.size > 1)
      .map((bucket) => ({
        gameId: bucket.gameId,
        gameLabel: bucket.gameLabel,
        dateKey: bucket.dateKey,
        scoutNames: [...bucket.scoutNames].sort((left, right) => left.localeCompare(right, "de-DE")),
      }))
      .sort((left, right) => left.gameLabel.localeCompare(right.gameLabel, "de-DE")),
    overplannedScouts: buildOverplannedScouts(weekObservations, options),
    conflicts: buildScheduleConflicts(observations, options),
    coverage: buildCoverageSummary(games, byGame, state?.teamGoals, observations, { ...options, date }),
    openGames,
  };
}

export function buildTeamFeed(state, options = {}) {
  const actor = options.user || getActiveUser(state);
  if (!actor) {
    return [];
  }
  return (Array.isArray(state?.feedItems) ? state.feedItems : [])
    .map((item) => ({
      ...item,
      actorName: getTeamAccountName(state, item.actorId),
    }))
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
    .slice(0, Number.isFinite(options.limit) ? Math.max(1, Number(options.limit)) : 40);
}

export function exportProductSnapshot({ state, user, playerSheets, games, planHistory } = {}) {
  const actor = user || getActiveUser(state);
  const visibleState = {
    version: PRODUCT_STATE_VERSION,
    exportedAt: new Date().toISOString(),
    exportedBy: actor.id,
    team: state?.team || normalizeTeam(null, state?.users),
    reports: filterVisibleEntities(state?.reports, actor),
    watchlists: filterVisibleEntities(state?.watchlists, actor),
    assignments: filterVisibleEntities(state?.assignments, actor),
    notifications: (state?.notifications || []).filter(
      (notification) => !notification.recipientId || notification.recipientId === actor.id || actor.role === "admin",
    ),
    savedFilters: (state?.savedFilters || []).filter((filter) => filter.ownerId === actor.id || actor.role === "admin"),
    manualGames: Array.isArray(state?.manualGames) ? state.manualGames : [],
    teamGoals: normalizeTeamGoals(state?.teamGoals),
    observations: Array.isArray(state?.observations) ? state.observations : [],
    feedItems: buildTeamFeed(state, { user: actor }),
    playerProfiles: buildPlayerProfiles({ state, user: actor, playerSheets }),
    currentGames: Array.isArray(games) ? games : [],
    planHistory: Array.isArray(planHistory) ? planHistory : [],
  };
  return JSON.stringify(visibleState, null, 2);
}
