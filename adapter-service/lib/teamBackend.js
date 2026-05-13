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

function compactText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
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
    role: normalizeRole(raw?.role || fallback.role),
    teamId: normalizeId(raw?.teamId || fallback.teamId) || DEFAULT_TEAM_ID,
    active: raw?.active === false ? false : fallback.active !== false,
    passwordHash: compactText(raw?.passwordHash || fallback.passwordHash),
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

  const status = raw?.status === "seen" ? "seen" : "planned";
  return {
    id: normalizeId(raw?.id) || `obs-${normalizeId(gameId)}-${scoutId}`,
    gameId,
    scoutId,
    status,
    note: String(raw?.note || ""),
    planHistoryId: compactText(raw?.planHistoryId),
    plannedAt: compactText(raw?.plannedAt || raw?.createdAt) || new Date(0).toISOString(),
    seenAt: status === "seen" ? compactText(raw?.seenAt || raw?.updatedAt) : "",
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
    teamGoals: { favoriteTeams: [], favoriteClubs: [], leaguePriorities: [], ageGroups: [] },
    observations: [],
    feedItems: [],
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
  const manualGames = (Array.isArray(source.manualGames) ? source.manualGames : [])
    .map(normalizeManualGame)
    .filter(Boolean);
  const feedItems = (Array.isArray(source.feedItems) ? source.feedItems : [])
    .map(normalizeFeedItem)
    .filter(Boolean)
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));

  return {
    version: 1,
    team: normalizeTeam(source.team, normalizedAccounts),
    manualGames,
    teamGoals: normalizeTeamGoals(source.teamGoals),
    observations,
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

function normalizeManualGame(raw) {
  const game = normalizeGame(raw);
  if (!game?.home || !game?.away) {
    return null;
  }
  return {
    ...game,
    id: normalizeId(game.id) || `manual-${normalizeId(`${game.date}-${game.time}-${game.home}-${game.away}`)}`,
    source: "manual",
    note: String(raw?.note || ""),
    status: game.status,
    createdBy: normalizeId(raw?.createdBy),
    createdAt: compactText(raw?.createdAt) || new Date(0).toISOString(),
    updatedAt: compactText(raw?.updatedAt || raw?.createdAt) || new Date(0).toISOString(),
  };
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

function normalizeTeamGoals(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    favoriteTeams: uniqueStrings(source.favoriteTeams),
    favoriteClubs: uniqueStrings(source.favoriteClubs),
    leaguePriorities: uniqueStrings(source.leaguePriorities),
    ageGroups: uniqueStrings(source.ageGroups).map(normalizeId).filter(Boolean),
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
  return [item, ...(teamState.feedItems || [])].slice(0, 200);
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
    createdBy: payload?.createdBy || account.id,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
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
  if (observation.status !== "seen") {
    const error = new Error("Notizen koennen erst nach einer gesehenen Sichtung ergänzt werden.");
    error.statusCode = 400;
    throw error;
  }

  const noted = normalizeObservation({
    ...observation,
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

  return {
    state: next,
    observation: noted,
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
