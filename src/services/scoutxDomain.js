export const PRODUCT_STATE_VERSION = 1;

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

  return {
    version: PRODUCT_STATE_VERSION,
    activeUserId: scout.id,
    users: DEFAULT_USERS.map((user) => ({ ...user })),
    reports: [],
    watchlists: [],
    assignments: [],
    notifications: [],
    savedFilters: [],
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
    reports: (Array.isArray(raw.reports) ? raw.reports : []).map(normalizeReport).filter(Boolean).filter((report) => !isLegacySeedReport(report)),
    watchlists: (Array.isArray(raw.watchlists) ? raw.watchlists : []).map(normalizeWatchlist).filter(Boolean).filter((watchlist) => !isLegacySeedWatchlist(watchlist)),
    assignments: (Array.isArray(raw.assignments) ? raw.assignments : []).map(normalizeAssignment).filter(Boolean).filter((assignment) => !isLegacySeedAssignment(assignment)),
    notifications: (Array.isArray(raw.notifications) ? raw.notifications : []).map(normalizeNotification).filter(Boolean).filter((notification) => !isLegacySeedNotification(notification)),
    savedFilters: (Array.isArray(raw.savedFilters) ? raw.savedFilters : []).map(normalizeSavedFilter).filter(Boolean),
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

export function upsertReport(state, input, user, options = {}) {
  const activeUser = user || getActiveUser(state);
  const existing = normalizeId(input?.id)
    ? (state.reports || []).find((report) => report.id === input.id)
    : null;

  if (!existing) {
    const report = createReportInput(input, activeUser, options);
    return {
      ...state,
      reports: [report, ...(state.reports || [])],
      notifications: [
        createNotification(
          {
            type: "report_shared",
            title: "Neuer Bericht",
            body: report.title,
            entityType: "report",
            entityId: report.id,
            recipientId: report.ownerId,
          },
          options,
        ),
        ...(state.notifications || []),
      ],
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
    id: makeId("watchlist", options.clock, options.random),
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
          type: "assignment_created",
          title: "Neue Zuweisung",
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

export function exportProductSnapshot({ state, user, playerSheets, games, planHistory } = {}) {
  const actor = user || getActiveUser(state);
  const visibleState = {
    version: PRODUCT_STATE_VERSION,
    exportedAt: new Date().toISOString(),
    exportedBy: actor.id,
    reports: filterVisibleEntities(state?.reports, actor),
    watchlists: filterVisibleEntities(state?.watchlists, actor),
    assignments: filterVisibleEntities(state?.assignments, actor),
    notifications: (state?.notifications || []).filter(
      (notification) => !notification.recipientId || notification.recipientId === actor.id || actor.role === "admin",
    ),
    savedFilters: (state?.savedFilters || []).filter((filter) => filter.ownerId === actor.id || actor.role === "admin"),
    playerProfiles: buildPlayerProfiles({ state, user: actor, playerSheets }),
    currentGames: Array.isArray(games) ? games : [],
    planHistory: Array.isArray(planHistory) ? planHistory : [],
  };
  return JSON.stringify(visibleState, null, 2);
}
