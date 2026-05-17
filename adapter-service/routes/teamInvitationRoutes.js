import { assertMinLength, assertPasswordMinLength, createTimedToken, normalizeInvitationRole } from "../services/teamAuthService.js";
import { acceptInvitation } from "../services/teamAuthDomainService.js";
import { sendRouteError } from "./routeErrorResponses.js";

export async function handleTeamInvitationRoutes(req, res, routeContext) {
  const {
    url,
    origin,
    requestId,
    clientIp,
    requestLogger,
    state,
    randomUUID,
    readBody,
    sendJson,
    normalizeAccountId,
    findTeamAccountRecordById,
    hasTokenExpired,
    createPasswordHash,
    persistTeamState,
    findAccount,
    createTeamSessionForAccount,
    createSessionCookie,
    buildTeamStatePayload,
    canManageTeamMembers,
    requireTeamSession,
    requireTeamWriteAllowed,
    teamInvitations,
    teamInvitationTtlSec,
    runtimeDbEnabled,
    persistRuntimeInvitation,
    fetchRuntimeInvitationByToken,
    deleteRuntimeInvitation,
  } = routeContext;

  if (req.method === "POST" && url.pathname === "/api/team/invitations/create") {
    const context = requireTeamSession(req, res, origin, requestId);
    if (!context) {
      return true;
    }
    if (!await requireTeamWriteAllowed(req, context, res, origin, requestId, clientIp)) {
      return true;
    }
    if (!canManageTeamMembers(context.account)) {
      sendJson(res, 403, { ok: false, error: "Nur Admin oder Koordination koennen Einladungen erstellen." }, origin, requestId);
      return true;
    }

    try {
      const payload = await readBody(req);
      const userId = normalizeAccountId(payload?.userId);
      const name = assertMinLength(payload?.name, 2, "Name muss mindestens 2 Zeichen enthalten.");
      const requestedRole = normalizeAccountId(payload?.role);
      const role = normalizeInvitationRole(requestedRole);
      if (!userId || userId.length < 3) {
        sendJson(res, 400, { ok: false, error: "User-ID muss mindestens 3 Zeichen enthalten." }, origin, requestId);
        return true;
      }
      if (findTeamAccountRecordById(userId)) {
        sendJson(res, 409, { ok: false, error: "Diese User-ID ist bereits vergeben." }, origin, requestId);
        return true;
      }

      const { token, createdAt, expiresAt } = createTimedToken(randomUUID, teamInvitationTtlSec, Date.now());
      const invitation = {
        token,
        userId,
        name,
        role,
        teamId: context.account.teamId,
        invitedBy: context.account.id,
        createdAt,
        expiresAt,
      };
      if (!runtimeDbEnabled) {
        teamInvitations.set(token, invitation);
      }
      if (runtimeDbEnabled) {
        const persisted = await persistRuntimeInvitation(invitation, requestLogger);
        if (!persisted) {
          sendJson(res, 500, { ok: false, error: "Einladung konnte nicht persistent gespeichert werden." }, origin, requestId);
          return true;
        }
      }
      sendJson(
        res,
        201,
        {
          ok: true,
          invitation: { token, userId, name, role, teamId: context.account.teamId, createdAt, expiresAt },
        },
        origin,
        requestId,
      );
      return true;
    } catch (error) {
      requestLogger.warn("team invitation create failed", { error });
      sendRouteError({ res, sendJson, origin, requestId, error, fallbackStatus: 400, fallbackMessage: "Einladung konnte nicht erstellt werden." });
      return true;
    }
  }

  if (req.method === "POST" && url.pathname === "/api/team/invitations/accept") {
    try {
      const payload = await readBody(req);
      const token = String(payload?.token || "").trim();
      const password = assertPasswordMinLength(payload?.password, 8);
      if (!token) {
        sendJson(res, 400, { ok: false, error: "Einladungs-Token fehlt." }, origin, requestId);
        return true;
      }

      const invitation = runtimeDbEnabled
        ? await fetchRuntimeInvitationByToken(token, requestLogger)
        : teamInvitations.get(token);
      if (!invitation) {
        sendJson(res, 404, { ok: false, error: "Einladung wurde nicht gefunden." }, origin, requestId);
        return true;
      }
      if (hasTokenExpired(invitation.expiresAt)) {
        teamInvitations.delete(token);
        if (runtimeDbEnabled) {
          await deleteRuntimeInvitation(token, requestLogger);
        }
        sendJson(res, 400, { ok: false, error: "Einladung ist abgelaufen." }, origin, requestId);
        return true;
      }
      if (findTeamAccountRecordById(invitation.userId)) {
        teamInvitations.delete(token);
        if (runtimeDbEnabled) {
          await deleteRuntimeInvitation(token, requestLogger);
        }
        sendJson(res, 409, { ok: false, error: "Diese User-ID ist bereits vergeben." }, origin, requestId);
        return true;
      }

      await acceptInvitation({
        state: state.team,
        invitation,
        passwordHash: createPasswordHash(password),
        persistTeamState,
        logger: requestLogger,
        findAccount: (id) => findAccount(state.team, id),
      });
      teamInvitations.delete(token);
      if (runtimeDbEnabled) {
        await deleteRuntimeInvitation(token, requestLogger);
      }

      const account = findAccount(state.team, invitation.userId);
      const { sessionId, csrfToken } = await createTeamSessionForAccount(account, String(clientIp || ""), String(req.headers["user-agent"] || ""));
      res.setHeader("Set-Cookie", createSessionCookie(sessionId));
      sendJson(res, 201, { ...buildTeamStatePayload({ account }), csrfToken }, origin, requestId);
      return true;
    } catch (error) {
      requestLogger.warn("team invitation accept failed", { error });
      sendRouteError({ res, sendJson, origin, requestId, error, fallbackStatus: 400, fallbackMessage: "Einladung konnte nicht angenommen werden." });
      return true;
    }
  }

  return false;
}
