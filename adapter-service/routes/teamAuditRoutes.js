export async function handleTeamAuditRoutes(req, res, routeContext) {
  const {
    url,
    origin,
    requestId,
    requestLogger,
    state,
    requireTeamSession,
    sendJson,
    clampLimit,
    feedReadsFromDb,
    fetchTeamFeedItemsFromDb,
  } = routeContext;

  if (req.method !== "GET" || url.pathname !== "/api/team/audit-log") {
    return false;
  }

  const context = requireTeamSession(req, res, origin, requestId);
  if (!context) {
    return true;
  }

  const actorIdFilter = String(url.searchParams.get("actorId") || "")
    .trim()
    .toLowerCase();
  const actionFilter = String(url.searchParams.get("action") || "")
    .trim()
    .toLowerCase();
  const limit = clampLimit(url.searchParams.get("limit"), 1, 200, 50);

  let sourceFeedItems = Array.isArray(state.team?.feedItems) ? state.team.feedItems : [];
  if (feedReadsFromDb) {
    const dbFeedItems = await fetchTeamFeedItemsFromDb(context.account.teamId, requestLogger);
    if (Array.isArray(dbFeedItems)) {
      sourceFeedItems = dbFeedItems;
    }
  }

  const entries = sourceFeedItems
    .filter((item) => {
      const actorId = String(item?.actorId || "").trim().toLowerCase();
      const action = String(item?.type || "").trim().toLowerCase();
      if (actorIdFilter && actorId !== actorIdFilter) {
        return false;
      }
      if (actionFilter && action !== actionFilter) {
        return false;
      }
      return true;
    })
    .slice(0, limit)
    .map((item) => ({
      id: String(item?.id || ""),
      actorId: String(item?.actorId || ""),
      action: String(item?.type || ""),
      title: String(item?.title || ""),
      message: String(item?.body || ""),
      createdAt: String(item?.createdAt || ""),
      gameIds: Array.isArray(item?.gameIds) ? item.gameIds.map((id) => String(id || "")) : [],
      observationId: String(item?.observationId || ""),
      planHistoryId: String(item?.planHistoryId || ""),
    }));

  sendJson(
    res,
    200,
    {
      ok: true,
      count: entries.length,
      filters: {
        actorId: actorIdFilter,
        action: actionFilter,
        limit,
      },
      entries,
    },
    origin,
    requestId,
  );

  return true;
}
