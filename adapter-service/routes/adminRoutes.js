export async function handleAdminRoutes(req, res, routeContext) {
  const {
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
    dedupeClubEntries,
    writeClubCatalogFile,
    ingestionJobs,
    buildPrometheusMetricsText,
    fetchMandantProbe,
    collectKnownMandantStatus,
    clampLimit,
    fetchRecentTeamArchiveEvents,
    readRecentTeamArchiveFromFile,
    teamArchiveFile,
    buildDbReadinessReport,
  } = routeContext;

  if (req.method === "POST" && url.pathname === "/api/admin/refresh") {
    if (!isAuthorized(req)) {
      requestLogger.warn("unauthorized /api/admin/refresh");
      sendJson(res, 401, { ok: false, error: "Unauthorized" }, origin, requestId);
      return true;
    }

    try {
      await runRefreshIngestionJob("admin-refresh", requestLogger);
      sendJson(res, 200, { ok: true, ...buildAdminMeta() }, origin, requestId);
    } catch (error) {
      requestLogger.error("admin refresh failed", { error });
      sendJson(res, 500, { ok: false, error: "Refresh fehlgeschlagen." }, origin, requestId);
    }
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/import") {
    if (!isAuthorized(req)) {
      requestLogger.warn("unauthorized /api/admin/import");
      sendJson(res, 401, { ok: false, error: "Unauthorized" }, origin, requestId);
      return true;
    }

    try {
      const payload = await readBody(req);
      if (!Array.isArray(payload.games)) {
        throw new Error("`games` muss ein Array sein.");
      }

      const replace = Boolean(payload.replace);
      const importedGames = normalizeGames(payload.games, {
        aliasMap: state.aliasMap,
        source: "manual-import",
      });

      const merged = replace ? dedupeGames(importedGames) : dedupeGames([...(state.games || []), ...importedGames]);

      const meta = {
        ...(state.meta || {}),
        updatedAt: new Date().toISOString(),
        counts: {
          ...(state.meta?.counts || {}),
          total: merged.length,
          manualImport: importedGames.length,
        },
        warnings: state.meta?.warnings || [],
      };

      const persisted = await writeStoreSafely("admin-import", { games: merged, meta }, requestLogger);
      if (!persisted) {
        sendJson(res, 500, { ok: false, error: "Store konnte nicht geschrieben werden." }, origin, requestId);
        return true;
      }
      state.games = merged;
      state.meta = meta;
      state.lastRefreshReason = replace ? "admin-import-replace" : "admin-import-merge";
      state.lastError = null;
      state.lastSuccessfulRefreshAt = nowIso();

      sendJson(res, 200, { ok: true, imported: importedGames.length, total: merged.length }, origin, requestId);
    } catch (error) {
      requestLogger.error("admin import failed", { error });
      sendJson(res, 400, { ok: false, error: "Import fehlgeschlagen." }, origin, requestId);
    }

    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/clubs/import") {
    if (!isAuthorized(req)) {
      requestLogger.warn("unauthorized /api/admin/clubs/import");
      sendJson(res, 401, { ok: false, error: "Unauthorized" }, origin, requestId);
      return true;
    }

    try {
      const payload = await readBody(req);
      if (!Array.isArray(payload.clubs)) {
        throw new Error("`clubs` muss ein Array sein.");
      }

      const replace = Boolean(payload.replace);
      const importedClubs = dedupeClubEntries(payload.clubs);
      const merged = replace ? importedClubs : dedupeClubEntries([...(state.clubs || []), ...importedClubs]);
      const persisted = await writeClubCatalogFile(merged);

      state.clubs = persisted;

      sendJson(
        res,
        200,
        {
          ok: true,
          imported: importedClubs.length,
          total: persisted.length,
          replace,
        },
        origin,
        requestId,
      );
    } catch (error) {
      requestLogger.error("admin clubs import failed", { error });
      sendJson(res, 400, { ok: false, error: "Vereinskatalog-Import fehlgeschlagen." }, origin, requestId);
    }

    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/status") {
    if (!isAuthorized(req)) {
      requestLogger.warn("unauthorized /api/admin/status");
      sendJson(res, 401, { ok: false, error: "Unauthorized" }, origin, requestId);
      return true;
    }

    sendJson(res, 200, { ok: true, ...buildAdminMeta() }, origin, requestId);
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/jobs") {
    if (!isAuthorized(req)) {
      requestLogger.warn("unauthorized /api/admin/jobs");
      sendJson(res, 401, { ok: false, error: "Unauthorized" }, origin, requestId);
      return true;
    }
    sendJson(
      res,
      200,
      {
        ok: true,
        jobs: ingestionJobs.listJobs(),
      },
      origin,
      requestId,
    );
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/metrics") {
    if (!isAuthorized(req)) {
      requestLogger.warn("unauthorized /api/admin/metrics");
      sendJson(res, 401, { ok: false, error: "Unauthorized" }, origin, requestId);
      return true;
    }
    setCorsHeaders(res, origin);
    const headers = { "Content-Type": "text/plain; version=0.0.4; charset=utf-8" };
    if (requestId) {
      headers["X-Request-Id"] = requestId;
    }
    const payload = buildPrometheusMetricsText();
    res.writeHead(200, headers);
    res.end(payload);
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/db-readiness") {
    if (!isAuthorized(req)) {
      requestLogger.warn("unauthorized /api/admin/db-readiness");
      sendJson(res, 401, { ok: false, error: "Unauthorized" }, origin, requestId);
      return true;
    }
    try {
      const payload = await buildDbReadinessReport(requestLogger);
      sendJson(res, 200, payload, origin, requestId);
    } catch (error) {
      requestLogger.error("admin db-readiness failed", { error });
      sendJson(res, 500, { ok: false, error: "DB-Readiness fehlgeschlagen." }, origin, requestId);
    }
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/mandant-probe") {
    if (!isAuthorized(req)) {
      requestLogger.warn("unauthorized /api/admin/mandant-probe");
      sendJson(res, 401, { ok: false, error: "Unauthorized" }, origin, requestId);
      return true;
    }

    try {
      const mandant = String(url.searchParams.get("mandant") || "").trim();
      const season = String(url.searchParams.get("season") || "").trim();
      const competitionType = String(url.searchParams.get("competitionType") || "").trim();
      const probe = await fetchMandantProbe({ mandant, season, competitionType, logger: requestLogger });
      sendJson(res, 200, probe, origin, requestId);
    } catch (error) {
      requestLogger.error("admin mandant-probe failed", { error });
      sendJson(res, 400, { ok: false, error: String(error?.message || "Mandant-Probe fehlgeschlagen.") }, origin, requestId);
    }
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/verband-status") {
    if (!isAuthorized(req)) {
      requestLogger.warn("unauthorized /api/admin/verband-status");
      sendJson(res, 401, { ok: false, error: "Unauthorized" }, origin, requestId);
      return true;
    }

    try {
      const payload = await collectKnownMandantStatus(requestLogger);
      sendJson(res, 200, payload, origin, requestId);
    } catch (error) {
      requestLogger.error("admin verband-status failed", { error });
      sendJson(res, 500, { ok: false, error: "Verbands-Status fehlgeschlagen." }, origin, requestId);
    }
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/team-archive") {
    if (!isAuthorized(req)) {
      requestLogger.warn("unauthorized /api/admin/team-archive");
      sendJson(res, 401, { ok: false, error: "Unauthorized" }, origin, requestId);
      return true;
    }

    try {
      const limit = clampLimit(url.searchParams.get("limit"), 1, 200, 50);
      const dbEvents = await fetchRecentTeamArchiveEvents(limit, requestLogger);
      const events = dbEvents.length > 0 ? dbEvents : await readRecentTeamArchiveFromFile(teamArchiveFile, limit);
      sendJson(
        res,
        200,
        {
          ok: true,
          count: events.length,
          source: dbEvents.length > 0 ? "postgres" : "ndjson",
          events,
        },
        origin,
        requestId,
      );
    } catch (error) {
      requestLogger.error("admin team-archive failed", { error });
      sendJson(res, 500, { ok: false, error: "Team-Archiv konnte nicht geladen werden." }, origin, requestId);
    }
    return true;
  }

  return false;
}
