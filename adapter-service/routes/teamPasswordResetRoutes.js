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
    persistTeamState,
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

      const account = await resolveAccountForAuth(userId, requestLogger);
      if (!account) {
        sendJson(res, 200, { ok: true, resetRequested: true }, origin, requestId);
        return true;
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
          sendJson(res, 500, { ok: false, error: "Reset-Token konnte nicht persistent gespeichert werden." }, origin, requestId);
          return true;
        }
      }
      if (exposeResetTokenOnRequest) {
        sendJson(res, 200, { ok: true, resetRequested: true, reset: { token, expiresAt } }, origin, requestId);
        return true;
      }
      sendJson(res, 200, { ok: true, resetRequested: true }, origin, requestId);
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
      const password = assertPasswordMinLength(payload?.password, 8);
      if (!token) {
        sendJson(res, 400, { ok: false, error: "Reset-Token fehlt." }, origin, requestId);
        return true;
      }

      const reset = runtimeDbEnabled
        ? await fetchRuntimePasswordResetToken(token, requestLogger)
        : teamPasswordResetTokens.get(token);
      if (!reset) {
        sendJson(res, 404, { ok: false, error: "Reset-Token wurde nicht gefunden." }, origin, requestId);
        return true;
      }
      if (hasTokenExpired(reset.expiresAt)) {
        teamPasswordResetTokens.delete(token);
        if (runtimeDbEnabled) {
          await deleteRuntimePasswordResetToken(token, requestLogger);
        }
        sendJson(res, 400, { ok: false, error: "Reset-Token ist abgelaufen." }, origin, requestId);
        return true;
      }

      await confirmPasswordReset({
        state: state.team,
        reset,
        passwordHash: createPasswordHash(password),
        persistTeamState,
        logger: requestLogger,
      });
      teamPasswordResetTokens.delete(token);
      if (runtimeDbEnabled) {
        await deleteRuntimePasswordResetToken(token, requestLogger);
      }

      const account = findAccount(state.team, reset.userId);
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
