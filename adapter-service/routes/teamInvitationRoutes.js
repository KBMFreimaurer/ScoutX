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
    applyTeamStateMutation,
    runTeamWriteIdempotent,
    findAccount,
    createTeamSessionForAccount,
    createSessionCookie,
    buildTeamStatePayload,
    canManageTeamMembers,
    requireTeamSession,
    requireTeamWriteAllowed,
    teamInvitations,
    teamInvitationTtlSec,
    exposeInvitationTokenOnCreate,
    registrationTeamKey,
    isTeamJoinAllowedByAllowlist,
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
      const { invitation } = await runTeamWriteIdempotent(req, context, "team-invitation-create", payload, async () => {
        const userId = normalizeAccountId(payload?.userId);
        const name = assertMinLength(payload?.name, 2, "Name muss mindestens 2 Zeichen enthalten.");
        const requestedRole = normalizeAccountId(payload?.role);
        const role = normalizeInvitationRole(requestedRole);
        if (!userId || userId.length < 3) {
          const validationError = new Error("User-ID muss mindestens 3 Zeichen enthalten.");
          validationError.statusCode = 400;
          throw validationError;
        }
        if (!isTeamJoinAllowedByAllowlist({ teamKey: registrationTeamKey, userId })) {
          const forbiddenError = new Error("Einladung nicht erlaubt. User ist nicht für den Team-Beitritt freigegeben.");
          forbiddenError.statusCode = 403;
          throw forbiddenError;
        }
        if (findTeamAccountRecordById(userId)) {
          const conflictError = new Error("Diese User-ID ist bereits vergeben.");
          conflictError.statusCode = 409;
          throw conflictError;
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
            const persistenceError = new Error("Einladung konnte nicht persistent gespeichert werden.");
            persistenceError.statusCode = 500;
            throw persistenceError;
          }
        }
        return { invitation };
      });
      sendJson(
        res,
        201,
        {
          ok: true,
          invitation: {
            ...(exposeInvitationTokenOnCreate ? { token: invitation.token } : {}),
            userId: invitation.userId,
            name: invitation.name,
            role: invitation.role,
            teamId: invitation.teamId,
            createdAt: invitation.createdAt,
            expiresAt: invitation.expiresAt,
          },
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
      if (!token) {
        sendJson(res, 400, { ok: false, error: "Einladungs-Token fehlt." }, origin, requestId);
        return true;
      }
      const { account } = await runTeamWriteIdempotent(
        req,
        { account: { id: `invite:${token}`, teamId: "public" } },
        "team-invitation-accept",
        payload,
        async () => {
          const password = assertPasswordMinLength(payload?.password, 8);
          const invitation = runtimeDbEnabled
            ? await fetchRuntimeInvitationByToken(token, requestLogger)
            : teamInvitations.get(token);
          if (!invitation) {
            const notFoundError = new Error("Einladung wurde nicht gefunden.");
            notFoundError.statusCode = 404;
            throw notFoundError;
          }
          if (hasTokenExpired(invitation.expiresAt)) {
            teamInvitations.delete(token);
            if (runtimeDbEnabled) {
              await deleteRuntimeInvitation(token, requestLogger);
            }
            const expiredError = new Error("Einladung ist abgelaufen.");
            expiredError.statusCode = 400;
            throw expiredError;
          }
          if (findTeamAccountRecordById(invitation.userId)) {
            teamInvitations.delete(token);
            if (runtimeDbEnabled) {
              await deleteRuntimeInvitation(token, requestLogger);
            }
            const conflictError = new Error("Diese User-ID ist bereits vergeben.");
            conflictError.statusCode = 409;
            throw conflictError;
          }
          if (!isTeamJoinAllowedByAllowlist({ teamKey: registrationTeamKey, userId: invitation.userId })) {
            const forbiddenError = new Error("Einladung kann nicht angenommen werden. User ist nicht für den Team-Beitritt freigegeben.");
            forbiddenError.statusCode = 403;
            throw forbiddenError;
          }

          // Consume token before state mutation to keep invitation single-use under concurrent requests.
          teamInvitations.delete(token);
          if (runtimeDbEnabled) {
            await deleteRuntimeInvitation(token, requestLogger);
          }

          const accountId = await acceptInvitation({
            invitation,
            passwordHash: createPasswordHash(password),
            applyTeamStateMutation,
            logger: requestLogger,
          });
          const account = findAccount(state.team, accountId);
          return { account };
        },
      );
      if (!account) {
        sendJson(res, 500, { ok: false, error: "Team-Account konnte nach Einladung nicht geladen werden." }, origin, requestId);
        return true;
      }
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
