import {
  assertEmail,
  assertMinLength,
  assertPasswordMinLength,
  createTimedToken,
  normalizeEmail,
  normalizeInvitationRole,
} from "../services/teamAuthService.js";
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
    logtoEnabled,
    verifyLogtoIdentity,
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
        // Mit Logto ist die Einladung an die E-Mail des eingeladenen Logto-Users gebunden.
        const email = logtoEnabled || payload?.email ? assertEmail(payload?.email) : "";
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
          email,
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
            email: invitation.email,
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
          const idToken = String(payload?.idToken || "").trim();
          if (logtoEnabled && !idToken) {
            const authError = new Error("Bitte zuerst über Logto anmelden, um die Einladung anzunehmen.");
            authError.statusCode = 401;
            throw authError;
          }
          const identity = idToken ? await verifyLogtoIdentity(idToken) : null;
          const password = identity ? "" : assertPasswordMinLength(payload?.password, 8);
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

          if (identity) {
            if (!invitation.email || normalizeEmail(invitation.email) !== identity.email) {
              const mismatchError = new Error("Diese Einladung ist an eine andere E-Mail-Adresse gebunden.");
              mismatchError.statusCode = 403;
              throw mismatchError;
            }
            const accounts = Array.isArray(state.team?.team?.accounts) ? state.team.team.accounts : [];
            const identityInUse = accounts.some(
              (item) =>
                String(item?.logtoSubject || "") === identity.subject ||
                (identity.email && normalizeEmail(item?.email) === identity.email),
            );
            if (identityInUse) {
              const conflictError = new Error("Für diesen Login existiert bereits ein Team-Account.");
              conflictError.statusCode = 409;
              throw conflictError;
            }
          }

          // Consume token before state mutation to keep invitation single-use under concurrent requests.
          teamInvitations.delete(token);
          if (runtimeDbEnabled) {
            await deleteRuntimeInvitation(token, requestLogger);
          }

          const accountId = await acceptInvitation({
            invitation,
            passwordHash: identity ? "" : createPasswordHash(password),
            logtoSubject: identity?.subject || "",
            email: identity?.email || invitation.email || "",
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
