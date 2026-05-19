export async function handlePublicDataRoutes(req, res, routeContext) {
  const {
    url,
    origin,
    requestId,
    requestLogger,
    reqRef,
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
    clubSearchMaxLimit,
    searchLocalClubCatalog,
    toPublicClubEntries,
    fetchRemoteClubSuggestions,
    mergeClubResults,
  } = routeContext;

  if (req.method === "POST" && url.pathname === "/api/games") {
    if (!isAuthorized(req)) {
      requestLogger.warn("unauthorized /api/games");
      sendJson(res, 401, { ok: false, error: "Unauthorized" }, origin, requestId);
      return true;
    }

    try {
      const payload = await readBody(req);
      const logCtx = {
        stateCode: String(payload.stateCode || ""),
        regionName: String(payload.regionName || payload.kreisId || ""),
        regionShortCode: String(payload.regionShortCode || ""),
        jugendId: String(payload.jugendId || ""),
      };
      const requireFreshWeek = payload?.ensureWeekData !== false;
      let autoRefresh = { ran: false, reason: "skipped" };
      if (requireFreshWeek) {
        autoRefresh = await maybeAutoRefreshWeek(payload, requestLogger.child(logCtx), { strictLiveData: true });
      } else {
        void maybeAutoRefreshWeek(payload, requestLogger.child(logCtx)).catch((error) => {
          requestLogger.warn("background week refresh failed", { ...logCtx, error });
        });
        autoRefresh = { ran: false, reason: "background" };
      }

      const requestedTeams = uniqueNormalizedTeams(payload.teams);
      const requestedTeamCount = requestedTeams.length;
      const gamesWithTeamFilter =
        requestedTeamCount > 0 ? filterGames(state.games, payload, { aliasMap: state.aliasMap }) : [];
      const games = filterGames(
        state.games,
        {
          ...payload,
          teams: [],
        },
        { aliasMap: state.aliasMap },
      );
      const teamFilterFallback = requestedTeamCount > 0 && games.length > gamesWithTeamFilter.length;
      const { matchedTeams, missingTeams } = splitTeamValidation(requestedTeams, games);

      sendJson(
        res,
        200,
        {
          ok: true,
          source: "adapter-store",
          count: games.length,
          autoRefresh,
          teamFilter: {
            requested: requestedTeamCount > 0,
            requestedCount: requestedTeamCount,
            matchedCount: gamesWithTeamFilter.length,
            matchedTeamCount: matchedTeams.length,
            matchedTeams,
            missingTeams,
            binding: false,
            fallbackToUnfiltered: teamFilterFallback,
          },
          games,
        },
        origin,
        requestId,
      );
      requestLogger.info("games request served", {
        ...logCtx,
        count: games.length,
        autoRefreshRan: Boolean(autoRefresh?.ran),
      });
    } catch (error) {
      requestLogger.error("games request failed", { error });
      const message = String(error?.message || "Ungültige Anfrage.");
      const explicitStatus = Number(error?.statusCode || error?.status || 0);
      if (explicitStatus >= 400) {
        sendJson(res, explicitStatus, { ok: false, error: message }, origin, requestId);
        return true;
      }
      const isClientError =
        message.includes("muss") ||
        message.includes("Ungültig") ||
        message.includes("Ungültige") ||
        message.includes("Invalid");
      const statusCode = isClientError ? 400 : 502;
      sendJson(res, statusCode, { ok: false, error: message }, origin, requestId);
    }

    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/clubs/search") {
    if (!isAuthorized(req)) {
      requestLogger.warn("unauthorized /api/clubs/search");
      sendJson(res, 401, { ok: false, error: "Unauthorized" }, origin, requestId);
      return true;
    }

    const query = normalizeSearchQuery(url.searchParams.get("q"));
    const limit = clampLimit(url.searchParams.get("limit"), 1, Math.max(1, clubSearchMaxLimit), 8);

    if (query.length < 2) {
      sendJson(res, 200, { ok: true, query, clubs: [] }, origin, requestId);
      return true;
    }

    const localMatchesRaw = searchLocalClubCatalog(state.clubs, query, limit);
    const localMatches = toPublicClubEntries(reqRef, localMatchesRaw);

    if (localMatches.length >= limit) {
      sendJson(res, 200, { ok: true, query, clubs: localMatches, source: "local-catalog" }, origin, requestId);
      return true;
    }

    try {
      const remoteMatches = await fetchRemoteClubSuggestions(query, limit);
      const clubs = toPublicClubEntries(reqRef, mergeClubResults(remoteMatches, localMatchesRaw, limit));
      sendJson(res, 200, { ok: true, query, clubs, source: "remote+local" }, origin, requestId);
    } catch (error) {
      requestLogger.warn("club search remote fallback", { query, error });
      sendJson(res, 200, { ok: true, query, clubs: localMatches, source: "local-catalog-fallback" }, origin, requestId);
    }

    return true;
  }

  return false;
}
