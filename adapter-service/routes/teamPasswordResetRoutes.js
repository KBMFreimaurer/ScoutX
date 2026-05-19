import { assertPasswordMinLength, createTimedToken } from "../services/teamAuthService.js";
import { confirmPasswordReset } from "../services/teamAuthDomainService.js";
import { sendRouteError } from "./routeErrorResponses.js";

export async function handleTeamPasswordResetRoutes(req, res, routeContext) {
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
    checkScopedRateLimit,
    teamLoginRateStore,
    teamPasswordResetTokens,
    teamLoginRateLimitMax,
    teamPasswordResetTtlSec,
    exposeResetTokenOnRequest,
    resolveAccountForAuth,
    hasTokenExpired,
    createPasswordHash,
    applyTeamStateMutation,
    runTeamWriteIdempotent,
    findAccount,
    createTeamSessionForAccount,
    createSessionCookie,
    buildTeamStatePayload,
    runtimeDbEnabled,
    persistRuntimePasswordResetToken,
    fetchRuntimePasswordResetToken,
    deleteRuntimePasswordResetToken,
  } = routeContext;

  if (req.method === "POST" && url.pathname === "/api/team/auth/password-reset/request") {
    try {
      const payload = await readBody(req);
      const userId = normalizeAccountId(payload?.userId);
      if (!(await checkScopedRateLimit(teamLoginRateStore, `${clientIp}:reset-request:${userId || "unknown"}`, teamLoginRateLimitMax))) {
        sendJson(res, 429, { ok: false, error: "Zu viele Passwort-Reset-Anfragen. Bitte später erneut versuchen." }, origin, requestId);
        return true;
      }
      const requestContext = {
        account: {
          id: `reset-request:${userId || "unknown"}`,
          teamId: "public",
        },
      };
      const { responsePayload } = await runTeamWriteIdempotent(
        req,
        requestContext,
        "team-password-reset-request",
        payload,
        async () => {
          const account = await resolveAccountForAuth(userId, requestLogger);
          if (!account) {
            return { responsePayload: { ok: true, resetRequested: true } };
          }

          const { token, expiresAt } = createTimedToken(randomUUID, teamPasswordResetTtlSec, Date.now());
          const resetToken = {
            token,
            userId: account.id,
            teamId: account.teamId,
            createdAt: new Date().toISOString(),
            expiresAt,
          };
          if (!runtimeDbEnabled) {
            teamPasswordResetTokens.set(token, resetToken);
          }
          if (runtimeDbEnabled) {
            const persisted = await persistRuntimePasswordResetToken(resetToken, requestLogger);
            if (!persisted) {
              const persistenceError = new Error("Reset-Token konnte nicht persistent gespeichert werden.");
              persistenceError.statusCode = 500;
              throw persistenceError;
            }
          }
          if (exposeResetTokenOnRequest) {
            return { responsePayload: { ok: true, resetRequested: true, reset: { token, expiresAt } } };
          }
          return { responsePayload: { ok: true, resetRequested: true } };
        },
      );
      sendJson(res, 200, responsePayload, origin, requestId);
      return true;
    } catch (error) {
      requestLogger.warn("password reset request failed", { error });
      sendRouteError({ res, sendJson, origin, requestId, error, fallbackStatus: 400, fallbackMessage: "Passwort-Reset konnte nicht angefordert werden." });
      return true;
    }
  }

  if (req.method === "POST" && url.pathname === "/api/team/auth/password-reset/confirm") {
    try {
      const payload = await readBody(req);
      const token = String(payload?.token || "").trim();
      if (!token) {
        sendJson(res, 400, { ok: false, error: "Reset-Token fehlt." }, origin, requestId);
        return true;
      }
      const { account } = await runTeamWriteIdempotent(
        req,
        { account: { id: `reset:${token}`, teamId: "public" } },
        "team-password-reset-confirm",
        payload,
        async () => {
          const password = assertPasswordMinLength(payload?.password, 8);
          const reset = runtimeDbEnabled
            ? await fetchRuntimePasswordResetToken(token, requestLogger)
            : teamPasswordResetTokens.get(token);
          if (!reset) {
            const notFoundError = new Error("Reset-Token wurde nicht gefunden.");
            notFoundError.statusCode = 404;
            throw notFoundError;
          }
          if (hasTokenExpired(reset.expiresAt)) {
            teamPasswordResetTokens.delete(token);
            if (runtimeDbEnabled) {
              await deleteRuntimePasswordResetToken(token, requestLogger);
            }
            const expiredError = new Error("Reset-Token ist abgelaufen.");
            expiredError.statusCode = 400;
            throw expiredError;
          }

          // Consume token before state mutation to keep reset token single-use under concurrent requests.
          teamPasswordResetTokens.delete(token);
          if (runtimeDbEnabled) {
            await deleteRuntimePasswordResetToken(token, requestLogger);
          }

          await confirmPasswordReset({
            reset,
            passwordHash: createPasswordHash(password),
            applyTeamStateMutation,
            logger: requestLogger,
          });
          const account = findAccount(state.team, reset.userId);
          return { account };
        },
      );
      if (!account) {
        sendJson(res, 500, { ok: false, error: "Team-Account konnte nach Passwort-Reset nicht geladen werden." }, origin, requestId);
        return true;
      }
      const { sessionId, csrfToken } = await createTeamSessionForAccount(account, String(clientIp || ""), String(req.headers["user-agent"] || ""));
      res.setHeader("Set-Cookie", createSessionCookie(sessionId));
      sendJson(res, 200, { ...buildTeamStatePayload({ account }), csrfToken }, origin, requestId);
      return true;
    } catch (error) {
      requestLogger.warn("password reset confirm failed", { error });
      sendRouteError({ res, sendJson, origin, requestId, error, fallbackStatus: 400, fallbackMessage: "Passwort-Reset konnte nicht bestätigt werden." });
      return true;
    }
  }

  return false;
}
