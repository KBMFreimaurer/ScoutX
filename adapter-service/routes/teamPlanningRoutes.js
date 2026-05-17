export async function handleTeamPlanningRoutes(req, res, routeContext) {
  const {
    url,
    origin,
    requestId,
    clientIp,
    requestLogger,
    state,
    readBody,
    sendJson,
    randomUUID,
    requireTeamSession,
    requireTeamWriteAllowed,
    persistTeamState,
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
  } = routeContext;

  if (req.method === "GET" && url.pathname === "/api/team/conflicts") {
    const context = requireTeamSession(req, res, origin, requestId);
    if (!context) {
      return true;
    }
    const conflicts = buildTeamConflicts(state.team?.observations);
    sendJson(res, 200, { ok: true, conflicts }, origin, requestId);
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/team/plans") {
    const context = requireTeamSession(req, res, origin, requestId);
    if (!context) {
      return true;
    }
    if (!await requireTeamWriteAllowed(req, context, res, origin, requestId, clientIp)) {
      return true;
    }

    try {
      const payload = await readBody(req);
      const result = publishTeamPlan(state.team, context.account, payload, randomUUID);
      const persisted = await persistTeamState(result.state, requestLogger, "team-plan");
      if (!persisted) {
        sendJson(res, 500, { ok: false, error: "Team-State konnte nicht gespeichert werden." }, origin, requestId);
        return true;
      }
      sendJson(
        res,
        200,
        {
          ok: true,
          user: toPublicAccount(context.account),
          team: toPublicTeam(state.team.team),
          observations: result.observations,
          feedItems: state.team.feedItems,
        },
        origin,
        requestId,
      );
      return true;
    } catch (error) {
      const statusCode = Number(error?.statusCode || 400);
      requestLogger.warn("team plan publish failed", { error });
      sendJson(res, statusCode, { ok: false, error: String(error?.message || "Team-Plan konnte nicht gespeichert werden.") }, origin, requestId);
      return true;
    }
  }

  if (req.method === "POST" && url.pathname === "/api/team/members") {
    const context = requireTeamSession(req, res, origin, requestId);
    if (!context) {
      return true;
    }
    if (!await requireTeamWriteAllowed(req, context, res, origin, requestId, clientIp)) {
      return true;
    }

    try {
      const payload = await readBody(req);
      const targetMemberId = String(payload?.id || payload?.userId || "").trim().toLowerCase();
      const previousMember = (Array.isArray(state.team?.team?.accounts) ? state.team.team.accounts : []).find(
        (item) => String(item?.id || "").trim().toLowerCase() === targetMemberId,
      ) || null;
      const result = upsertTeamMember(state.team, context.account, payload);
      const persisted = await persistTeamState(result.state, requestLogger, "team-member");
      if (!persisted) {
        sendJson(res, 500, { ok: false, error: "Team-State konnte nicht gespeichert werden." }, origin, requestId);
        return true;
      }
      const roleChanged = previousMember && String(previousMember.role || "") !== String(result.member?.role || "");
      const deactivated = previousMember && previousMember.active !== false && result.member?.active === false;
      if (roleChanged || deactivated) {
        requestLogger.info("team member security-sensitive update", {
          memberId: String(result.member?.id || ""),
          roleBefore: String(previousMember?.role || ""),
          roleAfter: String(result.member?.role || ""),
          deactivated,
        });
        for (const [sessionId, session] of teamSessions || []) {
          if (!session) {
            continue;
          }
          if (String(session.teamId || "") !== String(context.account.teamId || "")) {
            continue;
          }
          if (String(session.userId || "") !== String(result.member?.id || "")) {
            continue;
          }
          teamSessions.delete(sessionId);
        }
        void revokeRuntimeTeamSessionsForAccount(
          String(context.account.teamId || ""),
          String(result.member?.id || ""),
          nowIso(),
          requestLogger,
        );
      }
      sendJson(
        res,
        200,
        {
          ok: true,
          user: toPublicAccount(context.account),
          team: toPublicTeam(state.team.team),
          member: result.member,
          observations: state.team.observations,
          feedItems: state.team.feedItems,
        },
        origin,
        requestId,
      );
      return true;
    } catch (error) {
      const statusCode = Number(error?.statusCode || 400);
      requestLogger.warn("team member update failed", { error });
      sendJson(res, statusCode, { ok: false, error: String(error?.message || "Team-Mitglied konnte nicht gespeichert werden.") }, origin, requestId);
      return true;
    }
  }

  if (req.method === "POST" && url.pathname === "/api/team/manual-games") {
    const context = requireTeamSession(req, res, origin, requestId);
    if (!context) {
      return true;
    }
    if (!await requireTeamWriteAllowed(req, context, res, origin, requestId, clientIp)) {
      return true;
    }

    try {
      const payload = await readBody(req);
      const result = upsertManualGame(state.team, context.account, payload, randomUUID);
      const persisted = await persistTeamState(result.state, requestLogger, "team-manual-game");
      if (!persisted) {
        sendJson(res, 500, { ok: false, error: "Team-State konnte nicht gespeichert werden." }, origin, requestId);
        return true;
      }
      sendJson(
        res,
        200,
        {
          ok: true,
          user: toPublicAccount(context.account),
          team: toPublicTeam(state.team.team),
          manualGame: result.manualGame,
          manualGames: state.team.manualGames,
          observations: state.team.observations,
          feedItems: state.team.feedItems,
        },
        origin,
        requestId,
      );
      return true;
    } catch (error) {
      const statusCode = Number(error?.statusCode || 400);
      requestLogger.warn("team manual game failed", { error });
      sendJson(res, statusCode, { ok: false, error: String(error?.message || "Manuelles Spiel konnte nicht gespeichert werden.") }, origin, requestId);
      return true;
    }
  }

  if (req.method === "POST" && url.pathname === "/api/team/goals") {
    const context = requireTeamSession(req, res, origin, requestId);
    if (!context) {
      return true;
    }
    if (!await requireTeamWriteAllowed(req, context, res, origin, requestId, clientIp)) {
      return true;
    }

    try {
      const payload = await readBody(req);
      const result = updateTeamGoals(state.team, context.account, payload, randomUUID);
      const persisted = await persistTeamState(result.state, requestLogger, "team-goals");
      if (!persisted) {
        sendJson(res, 500, { ok: false, error: "Team-State konnte nicht gespeichert werden." }, origin, requestId);
        return true;
      }
      sendJson(
        res,
        200,
        {
          ok: true,
          user: toPublicAccount(context.account),
          team: toPublicTeam(state.team.team),
          manualGames: state.team.manualGames,
          teamGoals: state.team.teamGoals,
          observations: state.team.observations,
          feedItems: state.team.feedItems,
        },
        origin,
        requestId,
      );
      return true;
    } catch (error) {
      const statusCode = Number(error?.statusCode || 400);
      requestLogger.warn("team goals failed", { error });
      sendJson(res, statusCode, { ok: false, error: String(error?.message || "Team-Ziele konnten nicht gespeichert werden.") }, origin, requestId);
      return true;
    }
  }

  if (req.method === "POST" && url.pathname === "/api/team/observations/seen") {
    const context = requireTeamSession(req, res, origin, requestId);
    if (!context) {
      return true;
    }
    if (!await requireTeamWriteAllowed(req, context, res, origin, requestId, clientIp)) {
      return true;
    }

    try {
      const payload = await readBody(req);
      const result = markObservationSeen(state.team, context.account, payload, randomUUID);
      const persisted = await persistTeamState(result.state, requestLogger, "team-observation-seen");
      if (!persisted) {
        sendJson(res, 500, { ok: false, error: "Team-State konnte nicht gespeichert werden." }, origin, requestId);
        return true;
      }
      sendJson(
        res,
        200,
        {
          ok: true,
          user: toPublicAccount(context.account),
          team: toPublicTeam(state.team.team),
          observation: result.observation,
          observations: state.team.observations,
          feedItems: state.team.feedItems,
        },
        origin,
        requestId,
      );
      return true;
    } catch (error) {
      const statusCode = Number(error?.statusCode || 400);
      requestLogger.warn("team observation seen failed", { error });
      sendJson(res, statusCode, { ok: false, error: String(error?.message || "Sichtung konnte nicht gespeichert werden.") }, origin, requestId);
      return true;
    }
  }

  if (req.method === "POST" && url.pathname === "/api/team/observations/reassign") {
    const context = requireTeamSession(req, res, origin, requestId);
    if (!context) {
      return true;
    }
    if (!await requireTeamWriteAllowed(req, context, res, origin, requestId, clientIp)) {
      return true;
    }
    try {
      const payload = await readBody(req);
      const result = reassignObservation(state.team, context.account, payload, randomUUID);
      const persisted = await persistTeamState(result.state, requestLogger, "team-observation-reassign");
      if (!persisted) {
        sendJson(res, 500, { ok: false, error: "Team-State konnte nicht gespeichert werden." }, origin, requestId);
        return true;
      }
      sendJson(
        res,
        200,
        {
          ok: true,
          user: toPublicAccount(context.account),
          team: toPublicTeam(state.team.team),
          observation: result.observation,
          observations: state.team.observations,
          feedItems: state.team.feedItems,
        },
        origin,
        requestId,
      );
      return true;
    } catch (error) {
      const statusCode = Number(error?.statusCode || 400);
      requestLogger.warn("team observation reassign failed", { error });
      sendJson(res, statusCode, { ok: false, error: String(error?.message || "Sichtung konnte nicht umverteilt werden.") }, origin, requestId);
      return true;
    }
  }

  if (req.method === "POST" && url.pathname === "/api/team/observations/report") {
    const context = requireTeamSession(req, res, origin, requestId);
    if (!context) {
      return true;
    }
    if (!await requireTeamWriteAllowed(req, context, res, origin, requestId, clientIp)) {
      return true;
    }

    try {
      const payload = await readBody(req);
      const result = linkObservationReport(state.team, context.account, payload, randomUUID);
      const persisted = await persistTeamState(result.state, requestLogger, "team-observation-report");
      if (!persisted) {
        sendJson(res, 500, { ok: false, error: "Team-State konnte nicht gespeichert werden." }, origin, requestId);
        return true;
      }
      sendJson(
        res,
        200,
        {
          ok: true,
          user: toPublicAccount(context.account),
          team: toPublicTeam(state.team.team),
          observation: result.observation,
          observations: state.team.observations,
          feedItems: state.team.feedItems,
        },
        origin,
        requestId,
      );
      return true;
    } catch (error) {
      const statusCode = Number(error?.statusCode || 400);
      requestLogger.warn("team observation report link failed", { error });
      sendJson(res, statusCode, { ok: false, error: String(error?.message || "Bericht konnte nicht verknuepft werden.") }, origin, requestId);
      return true;
    }
  }

  if (req.method === "POST" && url.pathname === "/api/team/observations/note") {
    const context = requireTeamSession(req, res, origin, requestId);
    if (!context) {
      return true;
    }
    if (!await requireTeamWriteAllowed(req, context, res, origin, requestId, clientIp)) {
      return true;
    }

    try {
      const payload = await readBody(req);
      const result = updateObservationNote(state.team, context.account, payload, randomUUID);
      const persisted = await persistTeamState(result.state, requestLogger, "team-observation-note");
      if (!persisted) {
        sendJson(res, 500, { ok: false, error: "Team-State konnte nicht gespeichert werden." }, origin, requestId);
        return true;
      }
      sendJson(
        res,
        200,
        {
          ok: true,
          user: toPublicAccount(context.account),
          team: toPublicTeam(state.team.team),
          observation: result.observation,
          observations: state.team.observations,
          feedItems: state.team.feedItems,
        },
        origin,
        requestId,
      );
      return true;
    } catch (error) {
      const statusCode = Number(error?.statusCode || 400);
      requestLogger.warn("team observation note failed", { error });
      sendJson(res, statusCode, { ok: false, error: String(error?.message || "Sichtungsnotiz konnte nicht gespeichert werden.") }, origin, requestId);
      return true;
    }
  }

  return false;
}
