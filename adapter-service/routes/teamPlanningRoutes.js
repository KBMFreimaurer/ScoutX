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
    applyTeamStateMutation,
    runTeamWriteIdempotent,
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
      const { result } = await runTeamWriteIdempotent(req, context, "team-plan", payload, async () => {
        const result = await applyTeamStateMutation(requestLogger, "team-plan", (currentState) =>
          publishTeamPlan(currentState, context.account, payload, randomUUID));
        return { result };
      });
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
      const { result, previousMember } = await runTeamWriteIdempotent(req, context, "team-member", payload, async () => {
        const targetMemberId = String(payload?.id || payload?.userId || "").trim().toLowerCase();
        const mutation = await applyTeamStateMutation(requestLogger, "team-member", (currentState) => {
          const previousMember = (Array.isArray(currentState?.team?.accounts) ? currentState.team.accounts : []).find(
            (item) => String(item?.id || "").trim().toLowerCase() === targetMemberId,
          ) || null;
          const result = upsertTeamMember(currentState, context.account, payload);
          return { ...result, previousMember };
        });
        return { result: mutation, previousMember: mutation?.previousMember || null };
      });
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
      const { result } = await runTeamWriteIdempotent(req, context, "team-manual-game", payload, async () => {
        const result = await applyTeamStateMutation(requestLogger, "team-manual-game", (currentState) =>
          upsertManualGame(currentState, context.account, payload, randomUUID));
        return { result };
      });
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
      await runTeamWriteIdempotent(req, context, "team-goals", payload, async () => {
        await applyTeamStateMutation(requestLogger, "team-goals", (currentState) =>
          updateTeamGoals(currentState, context.account, payload, randomUUID));
        return { ok: true };
      });
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
      const { result } = await runTeamWriteIdempotent(req, context, "team-observation-seen", payload, async () => {
        const result = await applyTeamStateMutation(requestLogger, "team-observation-seen", (currentState) =>
          markObservationSeen(currentState, context.account, payload, randomUUID));
        return { result };
      });
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
      const { result } = await runTeamWriteIdempotent(req, context, "team-observation-reassign", payload, async () => {
        const result = await applyTeamStateMutation(requestLogger, "team-observation-reassign", (currentState) =>
          reassignObservation(currentState, context.account, payload, randomUUID));
        return { result };
      });
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
      const { result } = await runTeamWriteIdempotent(req, context, "team-observation-report", payload, async () => {
        const result = await applyTeamStateMutation(requestLogger, "team-observation-report", (currentState) =>
          linkObservationReport(currentState, context.account, payload, randomUUID));
        return { result };
      });
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
      const { result } = await runTeamWriteIdempotent(req, context, "team-observation-note", payload, async () => {
        const result = await applyTeamStateMutation(requestLogger, "team-observation-note", (currentState) =>
          updateObservationNote(currentState, context.account, payload, randomUUID));
        return { result };
      });
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
