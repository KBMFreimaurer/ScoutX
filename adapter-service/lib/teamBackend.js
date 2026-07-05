import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export const TEAM_ROLES = Object.freeze({
  admin: "Admin",
  coordinator: "Koordinator",
  scout: "Scout",
  readonly: "Gast",
});

const DEFAULT_TEAM_ID = "team-scoutx";
const DEFAULT_TEAM = Object.freeze({
  id: DEFAULT_TEAM_ID,
  name: "ScoutX Team",
});

const DEFAULT_ACCOUNTS = Object.freeze([
  { id: "user-admin", name: "Leitung", role: "admin", teamId: DEFAULT_TEAM_ID, active: true },
  { id: "user-coordinator", name: "Koordination", role: "coordinator", teamId: DEFAULT_TEAM_ID, active: true },
  { id: "user-scout", name: "Scout", role: "scout", teamId: DEFAULT_TEAM_ID, active: true },
  { id: "user-readonly", name: "Gast", role: "readonly", teamId: DEFAULT_TEAM_ID, active: true },
]);

const WRITER_ROLES = new Set(["admin", "coordinator", "scout"]);
const OBSERVATION_STATUSES = new Set(["planned", "seen", "reported", "followup"]);
const OBSERVATION_STATUS_RANK = Object.freeze({
  planned: 0,
  seen: 1,
  reported: 2,
  followup: 3,
});

function compactText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function compactRawText(value) {
  return String(value || "").trim();
}

function normalizeId(value) {
  return compactText(value)
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeRole(value) {
  const role = normalizeId(value);
  return Object.prototype.hasOwnProperty.call(TEAM_ROLES, role) ? role : "scout";
}

function normalizeAccount(raw, fallback = {}) {
  const id = normalizeId(raw?.id) || normalizeId(fallback.id);
  if (!id) {
    return null;
  }

  return {
    id,
    name: compactText(raw?.name) || compactText(fallback.name) || id,
    email: compactRawText(raw?.email || fallback.email).toLowerCase(),
    emailVerified: raw?.email || fallback.email ? raw?.emailVerified !== false : true,
    emailVerificationTokenHash: compactRawText(raw?.emailVerificationTokenHash || fallback.emailVerificationTokenHash),
    emailVerificationExpiresAt: compactRawText(raw?.emailVerificationExpiresAt || fallback.emailVerificationExpiresAt),
    emailVerifiedAt: compactRawText(raw?.emailVerifiedAt || fallback.emailVerifiedAt),
    birthDate: compactRawText(raw?.birthDate || fallback.birthDate),
    profileImage: compactRawText(raw?.profileImage || fallback.profileImage),
    role: normalizeRole(raw?.role || fallback.role),
    teamId: normalizeId(raw?.teamId || fallback.teamId) || DEFAULT_TEAM_ID,
    active: raw?.active === false ? false : fallback.active !== false,
    passwordHash: compactText(raw?.passwordHash || fallback.passwordHash),
    logtoSubject: compactRawText(raw?.logtoSubject || fallback.logtoSubject),
  };
}

function normalizeTeam(raw, accounts) {
  const activeAccounts = Array.isArray(accounts) ? accounts : DEFAULT_ACCOUNTS;
  return {
    id: normalizeId(raw?.id) || DEFAULT_TEAM.id,
    name: compactText(raw?.name) || DEFAULT_TEAM.name,
    accounts: activeAccounts,
  };
}

function normalizeObservation(raw) {
  const gameId = compactText(raw?.gameId || raw?.game?.id);
  const scoutId = normalizeId(raw?.scoutId);
  if (!gameId || !scoutId) {
    return null;
  }

  const rawStatus = normalizeId(raw?.status);
  const status = OBSERVATION_STATUSES.has(rawStatus) ? rawStatus : "planned";
  return {
    id: normalizeId(raw?.id) || `obs-${normalizeId(gameId)}-${scoutId}`,
    gameId,
    scoutId,
    status,
    note: String(raw?.note || ""),
    planHistoryId: compactText(raw?.planHistoryId),
    plannedAt: compactText(raw?.plannedAt || raw?.createdAt) || new Date(0).toISOString(),
    seenAt: ["seen", "reported", "followup"].includes(status) ? compactText(raw?.seenAt || raw?.updatedAt) : "",
    reportId: normalizeId(raw?.reportId),
    reportUrl: compactText(raw?.reportUrl),
    game: raw?.game && typeof raw.game === "object" ? { ...raw.game, id: gameId } : null,
  };
}

function normalizeFeedItem(raw) {
  const type = compactText(raw?.type);
  const createdAt = compactText(raw?.createdAt) || new Date(0).toISOString();
  const actorId = normalizeId(raw?.actorId);
  if (!type || !actorId) {
    return null;
  }

  return {
    id: normalizeId(raw?.id) || `feed-${normalizeId(type)}-${Date.parse(createdAt) || 0}`,
    type,
    createdAt,
    actorId,
    gameId: compactText(raw?.gameId),
    gameIds: (Array.isArray(raw?.gameIds) ? raw.gameIds : [raw?.gameId]).map(compactText).filter(Boolean),
    planHistoryId: compactText(raw?.planHistoryId),
    observationId: normalizeId(raw?.observationId),
    title: compactText(raw?.title),
    body: compactText(raw?.body),
  };
}

export function createInitialTeamState() {
  const accounts = DEFAULT_ACCOUNTS.map((account) => ({ ...account }));
  return {
    version: 1,
    team: normalizeTeam(DEFAULT_TEAM, accounts),
    manualGames: [],
    tournaments: [],
    teamGoals: { favoriteTeams: [], favoriteClubs: [], leaguePriorities: [], ageGroups: [] },
    observations: [],
    notifications: [],
    feedItems: [],
  };
}

function normalizeNotification(raw) {
  const id = normalizeId(raw?.id || raw?.eventId);
  const type = compactText(raw?.type);
  const createdAt = compactText(raw?.createdAt) || new Date(0).toISOString();
  if (!id || !type) {
    return null;
  }
  return {
    id,
    eventId: normalizeId(raw?.eventId) || id,
    type,
    actorId: normalizeId(raw?.actorId),
    title: compactText(raw?.title),
    body: compactText(raw?.body),
    recipientId: normalizeId(raw?.recipientId),
    unread: raw?.unread === false ? false : true,
    createdAt,
  };
}

export function normalizeTeamState(raw) {
  const initial = createInitialTeamState();
  const source = raw && typeof raw === "object" ? raw : {};
  const accountSource = Array.isArray(source.team?.accounts) ? source.team.accounts : initial.team.accounts;
  const accounts = accountSource.map((account, index) => normalizeAccount(account, initial.team.accounts[index])).filter(Boolean);
  const normalizedAccounts = accounts.length ? accounts : initial.team.accounts;
  const observations = (Array.isArray(source.observations) ? source.observations : [])
    .map(normalizeObservation)
    .filter(Boolean);
  const notifications = (Array.isArray(source.notifications) ? source.notifications : [])
    .map(normalizeNotification)
    .filter(Boolean)
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
  const manualGames = (Array.isArray(source.manualGames) ? source.manualGames : [])
    .map(normalizeManualGame)
    .filter(Boolean);
  const tournaments = (Array.isArray(source.tournaments) ? source.tournaments : [])
    .map(normalizeTournament)
    .filter(Boolean);
  const feedItems = (Array.isArray(source.feedItems) ? source.feedItems : [])
    .map(normalizeFeedItem)
    .filter(Boolean)
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));

  return {
    version: 1,
    team: normalizeTeam(source.team, normalizedAccounts),
    manualGames,
    tournaments,
    teamGoals: normalizeTeamGoals(source.teamGoals),
    observations,
    notifications,
    feedItems,
  };
}

export async function readTeamState(filePath) {
  if (!filePath) {
    return createInitialTeamState();
  }

  try {
    const raw = await readFile(filePath, "utf8");
    return normalizeTeamState(JSON.parse(raw));
  } catch (error) {
    if (error?.code === "ENOENT") {
      return createInitialTeamState();
    }
    throw error;
  }
}

export async function writeTeamState(filePath, teamState) {
  const normalized = normalizeTeamState(teamState);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  return normalized;
}

export async function appendTeamStateArchive(filePath, entry) {
  if (!filePath) {
    return;
  }

  const payload = entry && typeof entry === "object" ? entry : {};
  await mkdir(dirname(filePath), { recursive: true });
  await appendFile(filePath, `${JSON.stringify(payload)}\n`, "utf8");
}

export function findAccount(teamState, userId) {
  const id = normalizeId(userId);
  return (teamState?.team?.accounts || []).find((account) => account.id === id && account.active !== false) || null;
}

export function canWriteTeamState(account) {
  return Boolean(account && WRITER_ROLES.has(account.role));
}

export function canManageTeamMembers(account) {
  return Boolean(account && ["admin", "coordinator"].includes(account.role));
}

function gameTitle(game) {
  const home = compactText(game?.home);
  const away = compactText(game?.away);
  return home && away ? `${home} - ${away}` : compactText(game?.id) || "Spiel";
}

function normalizeGame(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const id = compactText(raw.id || raw.matchId || raw.url || `${raw.date || ""}-${raw.time || ""}-${raw.home || ""}-${raw.away || ""}`);
  if (!id) {
    return null;
  }
  return {
    ...raw,
    id,
    date: compactText(raw.date),
    time: compactText(raw.time),
    home: compactText(raw.home),
    away: compactText(raw.away),
    venue: compactText(raw.venue),
    status: normalizeId(raw?.status) === "cancelled" ? "cancelled" : "scheduled",
  };
}

function normalizeGameProvenance(raw, defaultSource) {
  const source = compactText(raw?.source || defaultSource || "manual");
  const provenanceRaw = raw?.provenance && typeof raw.provenance === "object" ? raw.provenance : {};
  const ingestedAt = compactText(provenanceRaw.ingestedAt || raw?.updatedAt || raw?.createdAt) || new Date(0).toISOString();
  return {
    source,
    method: compactText(provenanceRaw.method || (source === "manual" ? "manual-entry" : "import")),
    provider: compactText(provenanceRaw.provider || source),
    importedBy: normalizeId(provenanceRaw.importedBy || raw?.createdBy),
    ingestedAt,
    requestId: compactText(provenanceRaw.requestId),
    jobId: compactText(provenanceRaw.jobId),
  };
}

function normalizeManualGame(raw) {
  const game = normalizeGame(raw);
  if (!game?.home || !game?.away) {
    return null;
  }
  const source = ["manual", "tournament", "national"].includes(String(raw?.source || "").trim())
    ? String(raw?.source || "").trim()
    : "manual";
  const manualTypeRaw = normalizeId(raw?.manualType || raw?.type || "manual");
  const manualType = ["manual", "spontaneous", "inofficial"].includes(manualTypeRaw) ? manualTypeRaw : "manual";
  return {
    ...game,
    id: normalizeId(game.id) || `manual-${normalizeId(`${game.date}-${game.time}-${game.home}-${game.away}`)}`,
    source,
    tournamentId: source === "tournament" ? normalizeId(raw?.tournamentId) : "",
    note: String(raw?.note || ""),
    manualType: source === "manual" ? manualType : "",
    status: game.status,
    createdBy: normalizeId(raw?.createdBy),
    createdAt: compactText(raw?.createdAt) || new Date(0).toISOString(),
    updatedAt: compactText(raw?.updatedAt || raw?.createdAt) || new Date(0).toISOString(),
    provenance: normalizeGameProvenance(raw, source),
  };
}

function normalizeTournament(raw) {
  const id = normalizeId(raw?.id);
  if (!id) {
    return null;
  }
  const name = compactText(raw?.name || raw?.title);
  if (!name) {
    return null;
  }
  const matches = (Array.isArray(raw?.matches) ? raw.matches : [])
    .map((match) => normalizeManualGame({ ...match, source: "tournament", tournamentId: id }))
    .filter(Boolean);
  return {
    id,
    name,
    source: "tournament",
    dateFrom: compactText(raw?.dateFrom),
    dateTo: compactText(raw?.dateTo),
    venue: compactText(raw?.venue),
    note: String(raw?.note || ""),
    createdBy: normalizeId(raw?.createdBy),
    createdAt: compactText(raw?.createdAt) || new Date(0).toISOString(),
    updatedAt: compactText(raw?.updatedAt || raw?.createdAt) || new Date(0).toISOString(),
    matches,
  };
}

function uniqueStrings(values) {
  const MAX_VALUE_LENGTH = 120;
  const seen = new Set();
  const result = [];
  for (const value of Array.isArray(values) ? values : []) {
    const text = compactText(value).slice(0, MAX_VALUE_LENGTH);
    const key = text.toLowerCase();
    if (!text || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(text);
  }
  return result;
}

function normalizeTeamGoals(raw) {
  const MAX_ITEMS_PER_GROUP = 30;
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    favoriteTeams: uniqueStrings(source.favoriteTeams).slice(0, MAX_ITEMS_PER_GROUP),
    favoriteClubs: uniqueStrings(source.favoriteClubs).slice(0, MAX_ITEMS_PER_GROUP),
    leaguePriorities: uniqueStrings(source.leaguePriorities).slice(0, MAX_ITEMS_PER_GROUP),
    ageGroups: uniqueStrings(source.ageGroups).map(normalizeId).filter(Boolean).slice(0, MAX_ITEMS_PER_GROUP),
  };
}

function addFeedItem(teamState, input, randomId) {
  const item = normalizeFeedItem({
    id: randomId(),
    createdAt: new Date().toISOString(),
    ...input,
  });
  if (!item) {
    return teamState.feedItems;
  }
  const nextNotifications = [
    normalizeNotification({
      id: item.id,
      eventId: item.id,
      type: mapFeedTypeToNotificationType(item.type),
      actorId: item.actorId,
      title: item.title,
      body: item.body,
      unread: true,
      createdAt: item.createdAt,
    }),
    ...(Array.isArray(teamState.notifications) ? teamState.notifications : []),
  ]
    .filter(Boolean)
    .slice(0, 400);
  teamState.notifications = nextNotifications;
  return [item, ...(teamState.feedItems || [])].slice(0, 200);
}

function mapFeedTypeToNotificationType(feedType) {
  const value = normalizeId(feedType);
  if (value.includes("plan")) {
    return "plan";
  }
  if (value.includes("seen")) {
    return "seen";
  }
  if (value.includes("cancel")) {
    return "absage";
  }
  if (value.includes("followup") || value.includes("note")) {
    return "followup";
  }
  if (value.includes("conflict")) {
    return "konflikt";
  }
  if (value.includes("mention")) {
    return "mention";
  }
  // Kein "plan"-Fallback: nur echte Plan-Ereignisse sollen als Typ "plan"
  // (Push-relevant) laufen, nicht z. B. manuelle Spiel-Anlagen.
  return "info";
}

function extractMentionedAccountIds(text, teamAccounts = []) {
  const content = String(text || "");
  if (!content) {
    return [];
  }
  const idMap = new Map((Array.isArray(teamAccounts) ? teamAccounts : []).map((account) => [normalizeId(account?.id), account]));
  const slugMap = new Map(
    (Array.isArray(teamAccounts) ? teamAccounts : [])
      .map((account) => [normalizeId(String(account?.name || "").replace(/\s+/g, "-")), account])
      .filter(([slug]) => slug),
  );
  const hits = new Set();
  for (const raw of content.match(/@([a-zA-Z0-9._-]{2,})/g) || []) {
    const key = normalizeId(raw.slice(1));
    if (!key) continue;
    if (idMap.has(key)) {
      hits.add(key);
      continue;
    }
    if (slugMap.has(key)) {
      hits.add(normalizeId(slugMap.get(key)?.id));
    }
  }
  return [...hits].filter(Boolean);
}

const ACTIVE_OBSERVATION_STATUSES = new Set(["planned", "seen", "reported", "followup"]);

// Einheitliches Dopplungs-Prädikat: welches Spiel ist von welchen Scouts belegt.
// Genutzt von publishTeamPlan (Feed/Push) und buildTeamConflicts (server.mjs).
export function groupScoutsByGame(observations) {
  const scoutsByGame = new Map();
  for (const item of Array.isArray(observations) ? observations : []) {
    if (!ACTIVE_OBSERVATION_STATUSES.has(String(item?.status || ""))) {
      continue;
    }
    const gameId = String(item?.gameId || item?.game?.id || "").trim();
    const scoutId = String(item?.scoutId || "").trim();
    if (!gameId || !scoutId) {
      continue;
    }
    const scouts = scoutsByGame.get(gameId) || new Set();
    scouts.add(scoutId);
    scoutsByGame.set(gameId, scouts);
  }
  return scoutsByGame;
}

export function publishTeamPlan(teamState, account, payload, randomId) {
  if (!canWriteTeamState(account)) {
    const error = new Error("Diese Rolle darf keine Team-Planung veroeffentlichen.");
    error.statusCode = 403;
    throw error;
  }

  const games = (Array.isArray(payload?.games) ? payload.games : []).map(normalizeGame).filter(Boolean);
  if (games.length === 0) {
    const error = new Error("Mindestens ein Spiel ist erforderlich.");
    error.statusCode = 400;
    throw error;
  }

  const now = new Date().toISOString();
  const planHistoryId = compactText(payload?.planHistoryId) || randomId();
  const next = normalizeTeamState(teamState);
  const byKey = new Map(next.observations.map((item) => [`${item.gameId}:${item.scoutId}`, item]));
  const changed = [];

  // Dopplung erkennen: Spiele, die bereits ein anderes Teammitglied plant/besucht.
  const scoutsByGame = groupScoutsByGame(next.observations);
  const duplicateLabels = games
    .filter((game) => {
      const scouts = scoutsByGame.get(game.id);
      return scouts && [...scouts].some((scoutId) => scoutId !== account.id);
    })
    .map((game) => `${game.home} vs ${game.away}`);

  for (const game of games) {
    const key = `${game.id}:${account.id}`;
    const existing = byKey.get(key);
    const observation = {
      ...(existing || {}),
      id: existing?.id || `obs-${normalizeId(game.id)}-${account.id}`,
      gameId: game.id,
      scoutId: account.id,
      status: existing?.status === "seen" ? "seen" : "planned",
      planHistoryId,
      plannedAt: existing?.plannedAt || now,
      seenAt: existing?.seenAt || "",
      reportUrl: existing?.reportUrl || "",
      game,
    };
    byKey.set(key, observation);
    changed.push(observation);
  }

  next.observations = [...byKey.values()].map(normalizeObservation).filter(Boolean);
  next.feedItems = addFeedItem(
    next,
    {
      type: "plan_published",
      actorId: account.id,
      planHistoryId,
      gameIds: games.map((game) => game.id),
      title: "Team-Plan veroeffentlicht",
      body: `${account.name} hat ${games.length} Spiel${games.length === 1 ? "" : "e"} in den Team-Plan gestellt.`,
    },
    randomId,
  );

  if (duplicateLabels.length > 0) {
    next.feedItems = addFeedItem(
      next,
      {
        // "conflict" im Typ mappt auf Notification-Typ "konflikt" (Push-relevant).
        type: "duplicate_conflict",
        actorId: account.id,
        planHistoryId,
        gameIds: games.map((game) => game.id),
        title: "Doppelte Spiel-Belegung",
        body: `${account.name} plant Spiele, die bereits ein anderes Teammitglied besucht: ${duplicateLabels.slice(0, 3).join(" · ")}${duplicateLabels.length > 3 ? " …" : ""}`,
      },
      randomId,
    );
  }

  return {
    state: next,
    observations: changed.map(normalizeObservation).filter(Boolean),
    feedItems: next.feedItems,
  };
}

export function upsertManualGame(teamState, account, payload, randomId) {
  if (!canWriteTeamState(account)) {
    const error = new Error("Diese Rolle darf keine manuellen Spiele anlegen.");
    error.statusCode = 403;
    throw error;
  }

  const next = normalizeTeamState(teamState);
  const now = new Date().toISOString();
  const existingId = normalizeId(payload?.id);
  const existing = existingId ? next.manualGames.find((game) => game.id === existingId) : null;
  const manualGame = normalizeManualGame({
    id: existingId || randomId(),
    ...payload,
    source: "manual",
    manualType: payload?.manualType || payload?.type || "manual",
    createdBy: payload?.createdBy || account.id,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    provenance: {
      ...(existing?.provenance && typeof existing.provenance === "object" ? existing.provenance : {}),
      source: "manual",
      method: "manual-entry",
      provider: "manual",
      importedBy: account.id,
      ingestedAt: now,
    },
  });
  if (!manualGame) {
    const error = new Error("Manuelles Spiel braucht Heimteam und Auswaertsteam.");
    error.statusCode = 400;
    throw error;
  }

  next.manualGames = [manualGame, ...(next.manualGames || []).filter((game) => game.id !== manualGame.id)];
  next.feedItems = addFeedItem(
    next,
    {
      type:
        existing?.status !== "cancelled" && manualGame.status === "cancelled"
          ? "manual_game_cancelled"
          : existing
            ? "manual_game_updated"
            : "manual_game_created",
      actorId: account.id,
      gameId: manualGame.id,
      gameIds: [manualGame.id],
      title:
        existing?.status !== "cancelled" && manualGame.status === "cancelled"
          ? "Manuelles Spiel abgesagt"
          : existing
            ? "Manuelles Spiel aktualisiert"
            : "Manuelles Spiel angelegt",
      body: `${manualGame.home} vs ${manualGame.away}`,
    },
    randomId,
  );

  return {
    state: next,
    manualGame,
    feedItems: next.feedItems,
  };
}

export function updateTeamGoals(teamState, account, payload, randomId) {
  if (!canWriteTeamState(account)) {
    const error = new Error("Diese Rolle darf Team-Ziele nicht bearbeiten.");
    error.statusCode = 403;
    throw error;
  }

  const next = normalizeTeamState(teamState);
  const teamGoals = normalizeTeamGoals(payload);
  next.teamGoals = teamGoals;
  next.feedItems = addFeedItem(
    next,
    {
      type: "team_goals_updated",
      actorId: account.id,
      title: "Team-Ziele aktualisiert",
      body: [...teamGoals.favoriteTeams, ...teamGoals.favoriteClubs, ...teamGoals.leaguePriorities, ...teamGoals.ageGroups]
        .slice(0, 6)
        .join(" · "),
    },
    randomId,
  );

  return {
    state: next,
    teamGoals,
    feedItems: next.feedItems,
  };
}

export function markObservationSeen(teamState, account, payload, randomId) {
  if (!canWriteTeamState(account)) {
    const error = new Error("Diese Rolle darf keine Sichtung abschliessen.");
    error.statusCode = 403;
    throw error;
  }

  const gameId = compactText(payload?.gameId || payload?.game?.id);
  if (!gameId) {
    const error = new Error("gameId ist erforderlich.");
    error.statusCode = 400;
    throw error;
  }

  const now = new Date().toISOString();
  const next = normalizeTeamState(teamState);
  const scoutId = normalizeId(payload?.scoutId) || account.id;
  if (scoutId !== account.id && !["admin", "coordinator"].includes(account.role)) {
    const error = new Error("Nur Koordination oder Admin koennen fremde Sichtungen abschliessen.");
    error.statusCode = 403;
    throw error;
  }

  const index = next.observations.findIndex((item) => item.gameId === gameId && item.scoutId === scoutId);
  const base = index >= 0 ? next.observations[index] : null;
  const game = normalizeGame(payload?.game) || base?.game || { id: gameId };
  const observation = normalizeObservation({
    ...(base || {}),
    id: base?.id || `obs-${normalizeId(gameId)}-${scoutId}`,
    gameId,
    scoutId,
    status: "seen",
    planHistoryId: base?.planHistoryId || compactText(payload?.planHistoryId),
    plannedAt: base?.plannedAt || now,
    seenAt: now,
    reportUrl: compactText(payload?.reportUrl),
    game,
  });

  if (index >= 0) {
    next.observations[index] = observation;
  } else {
    next.observations.push(observation);
  }

  next.feedItems = addFeedItem(
    next,
    {
      type: "game_seen",
      actorId: account.id,
      gameId,
      gameIds: [gameId],
      planHistoryId: observation.planHistoryId,
      title: "Spiel gesichtet",
      body: `${account.name} hat ${gameTitle(game)} als gesichtet markiert.`,
    },
    randomId,
  );

  return {
    state: next,
    observation,
    feedItems: next.feedItems,
  };
}

export function linkObservationReport(teamState, account, payload, randomId) {
  if (!canWriteTeamState(account)) {
    const error = new Error("Diese Rolle darf keine Berichte verknuepfen.");
    error.statusCode = 403;
    throw error;
  }

  const next = normalizeTeamState(teamState);
  const observationId = normalizeId(payload?.observationId);
  const gameId = compactText(payload?.gameId);
  const scoutId = normalizeId(payload?.scoutId) || account.id;
  const index = next.observations.findIndex((item) => {
    if (observationId) {
      return item.id === observationId;
    }
    return item.gameId === gameId && item.scoutId === scoutId;
  });
  if (index < 0) {
    const error = new Error("Sichtung wurde nicht gefunden.");
    error.statusCode = 404;
    throw error;
  }

  const observation = next.observations[index];
  if (observation.scoutId !== account.id && !["admin", "coordinator"].includes(account.role)) {
    const error = new Error("Nur Koordination oder Admin koennen fremde Sichtungen verknuepfen.");
    error.statusCode = 403;
    throw error;
  }
  if (observation.status !== "seen") {
    const error = new Error("Berichte koennen erst nach einer gesehenen Sichtung verknuepft werden.");
    error.statusCode = 400;
    throw error;
  }

  const reportId = normalizeId(payload?.reportId);
  const reportUrl = compactText(payload?.reportUrl);
  if (!reportId && !reportUrl) {
    const error = new Error("reportId oder reportUrl ist erforderlich.");
    error.statusCode = 400;
    throw error;
  }

  const linked = normalizeObservation({
    ...observation,
    status: "reported",
    reportId: reportId || observation.reportId,
    reportUrl: reportUrl || observation.reportUrl,
  });
  next.observations[index] = linked;
  next.feedItems = addFeedItem(
    next,
    {
      type: "report_linked",
      actorId: account.id,
      gameId: linked.gameId,
      gameIds: [linked.gameId],
      observationId: linked.id,
      planHistoryId: linked.planHistoryId,
      title: "Spielbericht verknuepft",
      body: `${account.name} hat einen Bericht mit der Sichtung verknuepft.`,
    },
    randomId,
  );

  return {
    state: next,
    observation: linked,
    feedItems: next.feedItems,
  };
}

export function updateObservationNote(teamState, account, payload, randomId) {
  if (!canWriteTeamState(account)) {
    const error = new Error("Diese Rolle darf keine Sichtungsnotizen bearbeiten.");
    error.statusCode = 403;
    throw error;
  }

  const next = normalizeTeamState(teamState);
  const observationId = normalizeId(payload?.observationId);
  const gameId = compactText(payload?.gameId);
  const scoutId = normalizeId(payload?.scoutId) || account.id;
  const index = next.observations.findIndex((item) => {
    if (observationId) {
      return item.id === observationId;
    }
    return item.gameId === gameId && item.scoutId === scoutId;
  });
  if (index < 0) {
    const error = new Error("Sichtung wurde nicht gefunden.");
    error.statusCode = 404;
    throw error;
  }

  const observation = next.observations[index];
  if (observation.scoutId !== account.id && !["admin", "coordinator"].includes(account.role)) {
    const error = new Error("Nur Koordination oder Admin koennen fremde Sichtungen kommentieren.");
    error.statusCode = 403;
    throw error;
  }
  if (!["seen", "reported", "followup"].includes(observation.status)) {
    const error = new Error("Notizen koennen erst nach einer gesehenen Sichtung ergänzt werden.");
    error.statusCode = 400;
    throw error;
  }

  const noted = normalizeObservation({
    ...observation,
    status: "followup",
    note: String(payload?.note || "").trim(),
  });
  next.observations[index] = noted;
  next.feedItems = addFeedItem(
    next,
    {
      type: "observation_note_added",
      actorId: account.id,
      gameId: noted.gameId,
      gameIds: [noted.gameId],
      observationId: noted.id,
      planHistoryId: noted.planHistoryId,
      title: "Sichtungsnotiz ergänzt",
      body: noted.note || `${account.name} hat eine Sichtungsnotiz ergänzt.`,
    },
    randomId,
  );
  const mentionedAccountIds = extractMentionedAccountIds(noted.note, next.team?.accounts || []).filter((id) => id !== account.id);
  if (mentionedAccountIds.length > 0) {
    const now = new Date().toISOString();
    const mentionNotifications = mentionedAccountIds
      .map((recipientId, index) =>
        normalizeNotification({
          id: `mention-${noted.id}-${recipientId}-${index + 1}`,
          eventId: `mention-${noted.id}-${recipientId}-${index + 1}`,
          type: "mention",
          title: "Du wurdest erwähnt",
          body: `${account.name} hat dich in einer Sichtungsnotiz erwähnt.`,
          recipientId,
          unread: true,
          createdAt: now,
        }),
      )
      .filter(Boolean);
    next.notifications = [...mentionNotifications, ...(Array.isArray(next.notifications) ? next.notifications : [])].slice(0, 400);
  }

  return {
    state: next,
    observation: noted,
    feedItems: next.feedItems,
  };
}

export function reassignObservation(teamState, account, payload, randomId) {
  if (!["admin", "coordinator"].includes(String(account?.role || ""))) {
    const error = new Error("Nur Admin oder Koordination koennen Sichtungen umverteilen.");
    error.statusCode = 403;
    throw error;
  }

  const next = normalizeTeamState(teamState);
  const observationId = normalizeId(payload?.observationId);
  const targetScoutId = normalizeId(payload?.targetScoutId);
  if (!observationId || !targetScoutId) {
    const error = new Error("observationId und targetScoutId sind erforderlich.");
    error.statusCode = 400;
    throw error;
  }
  const targetScout = (next.team?.accounts || []).find((item) => item.id === targetScoutId && item.active !== false);
  if (!targetScout) {
    const error = new Error("Ziel-Scout wurde nicht gefunden.");
    error.statusCode = 404;
    throw error;
  }
  if (targetScout.role === "readonly") {
    const error = new Error("Gastkonten koennen keine Sichtungen uebernehmen.");
    error.statusCode = 400;
    throw error;
  }

  const index = next.observations.findIndex((item) => item.id === observationId);
  if (index < 0) {
    const error = new Error("Sichtung wurde nicht gefunden.");
    error.statusCode = 404;
    throw error;
  }
  const current = next.observations[index];
  const duplicateIndex = next.observations.findIndex(
    (item, itemIndex) => itemIndex !== index && item.gameId === current.gameId && item.scoutId === targetScoutId,
  );
  const duplicate = duplicateIndex >= 0 ? next.observations[duplicateIndex] : null;
  const mergedStatus =
    Number(OBSERVATION_STATUS_RANK[String(duplicate?.status || "planned")] || 0) >=
    Number(OBSERVATION_STATUS_RANK[String(current?.status || "planned")] || 0)
      ? String(duplicate?.status || "planned")
      : String(current?.status || "planned");
  const reassigned = normalizeObservation({
    ...current,
    ...(duplicate || {}),
    note: duplicate?.note || current?.note || "",
    reportId: duplicate?.reportId || current?.reportId || "",
    reportUrl: duplicate?.reportUrl || current?.reportUrl || "",
    plannedAt: duplicate?.plannedAt || current?.plannedAt,
    seenAt: duplicate?.seenAt || current?.seenAt || "",
    status: mergedStatus,
    scoutId: targetScoutId,
    id: `obs-${normalizeId(current.gameId)}-${targetScoutId}`,
  });
  if (!reassigned) {
    const error = new Error("Sichtung konnte nicht umverteilt werden.");
    error.statusCode = 400;
    throw error;
  }
  next.observations[index] = reassigned;
  if (duplicateIndex >= 0) {
    next.observations = next.observations.filter((_, itemIndex) => itemIndex !== duplicateIndex);
  }
  next.feedItems = addFeedItem(
    next,
    {
      type: "observation_reassigned",
      actorId: account.id,
      gameId: reassigned.gameId,
      gameIds: [reassigned.gameId],
      observationId: reassigned.id,
      planHistoryId: reassigned.planHistoryId,
      title: "Sichtung umverteilt",
      body: `${account.name} hat die Sichtung an ${targetScout.name} übergeben.`,
    },
    randomId,
  );
  return {
    state: next,
    observation: reassigned,
    feedItems: next.feedItems,
  };
}

export function upsertTeamMember(teamState, account, payload) {
  if (!canManageTeamMembers(account)) {
    const error = new Error("Nur Admin oder Koordination koennen Team-Mitglieder verwalten.");
    error.statusCode = 403;
    throw error;
  }

  const next = normalizeTeamState(teamState);
  const existing = (next.team.accounts || []).find((item) => item.id === normalizeId(payload?.id));
  const fallback = {
    teamId: next.team.id,
    role: existing?.role || "scout",
    active: existing?.active !== false,
    passwordHash: existing?.passwordHash || "",
  };
  const member = normalizeAccount(
    {
      ...payload,
      teamId: payload?.teamId || next.team.id,
    },
    fallback,
  );
  if (!member) {
    const error = new Error("Team-Mitglied braucht eine id.");
    error.statusCode = 400;
    throw error;
  }

  const accounts = (next.team.accounts || []).filter((item) => item.id !== member.id);
  next.team = normalizeTeam(next.team, [...accounts, member]);

  return {
    state: next,
    member,
  };
}
