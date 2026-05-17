import { createInitialProductState, normalizeProductState } from "../services/scoutxDomain";

export function mergeTeamBackendPayload(prevState, payload, options = {}) {
  if (!payload || payload.ok === false) {
    return prevState;
  }

  const team = payload.team && typeof payload.team === "object" ? payload.team : prevState.team;
  const accounts = Array.isArray(team?.accounts) ? team.accounts : [];
  const users = accounts.length
    ? accounts.map((account) => ({
        id: account.id,
        name: account.name,
        role: account.role,
        teamId: account.teamId,
        active: account.active !== false,
      }))
    : prevState.users;
  const feedItems = Array.isArray(payload.feedItems) ? payload.feedItems : prevState.feedItems;
  const activeUserId = options.switchUser === false ? prevState.activeUserId : payload.user?.id || prevState.activeUserId;
  const activeUserRole = users.find((user) => user.id === activeUserId)?.role || "";
  const backendNotifications = (Array.isArray(payload.notifications) ? payload.notifications : [])
    .map((item) => ({
      id: `notif-${item.eventId || item.id}`,
      type: item.type || "team_feed",
      title: item.title || "Team-Aktivität",
      body: item.body || item.title || "",
      entityType: "team_feed",
      entityId: item.eventId || item.id || "",
      recipientId: item.recipientId || "",
      createdAt: item.createdAt || new Date(0).toISOString(),
      readAt: item.unread === false ? item.createdAt || new Date().toISOString() : "",
    }))
    .filter((notification) => notification.id);
  const existingNotificationIds = new Set(backendNotifications.map((notification) => notification.id));
  const feedNotifications = (Array.isArray(payload.feedItems) ? payload.feedItems : [])
    .map((item) => ({
      id: `notif-${item.id}`,
      type: "team_feed",
      title: item.type === "plan_published" ? "Team-Plan veröffentlicht" : item.title || "Team-Aktivität",
      body: item.body || item.title || "",
      entityType: "team_feed",
      entityId: item.id,
      recipientId: "",
      createdAt: item.createdAt || new Date(0).toISOString(),
      readAt: "",
    }))
    .filter((notification) => notification.id && !existingNotificationIds.has(notification.id));

  const mergedNotifications = [...backendNotifications, ...feedNotifications, ...(prevState.notifications || [])].filter((notification) => {
    const recipientId = String(notification?.recipientId || "").trim();
    if (!recipientId) {
      return true;
    }
    if (activeUserRole === "admin") {
      return true;
    }
    return recipientId === activeUserId;
  });

  return normalizeProductState({
    ...prevState,
    users,
    activeUserId,
    team,
    manualGames: Array.isArray(payload.manualGames) ? payload.manualGames : prevState.manualGames,
    teamGoals: payload.teamGoals && typeof payload.teamGoals === "object" ? payload.teamGoals : prevState.teamGoals,
    observations: Array.isArray(payload.observations) ? payload.observations : prevState.observations,
    feedItems,
    notifications: mergedNotifications,
  });
}

export function createPersistableProductState(state, backendStatus) {
  const normalized = normalizeProductState(state);
  if (backendStatus !== "connected") {
    return normalized;
  }

  const fallback = createInitialProductState();
  return normalizeProductState({
    ...normalized,
    team: fallback.team,
    manualGames: [],
    teamGoals: fallback.teamGoals,
    observations: [],
    feedItems: [],
  });
}
