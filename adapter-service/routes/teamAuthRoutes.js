import { assertMinLength, assertPasswordMinLength } from "../services/teamAuthService.js";
import { registerAccount } from "../services/teamAuthDomainService.js";
import { sendRouteError } from "./routeErrorResponses.js";

export async function handleTeamAuthRoutes(req, res, routeContext) {
  const {
    url,
    origin,
    requestId,
    clientIp,
    requestLogger,
    state,
    readBody,
    sendJson,
    normalizeAccountId,
    checkScopedRateLimit,
    teamLoginRateStore,
    teamLoginRateLimitMax,
    getTeamLoginLockState,
    registerTeamLoginFailure,
    clearTeamLoginFailure,
    resolveAccountForAuth,
    verifyPassword,
    createPasswordHash,
    applyTeamStateMutation,
    runTeamWriteIdempotent,
    findAccount,
    createTeamSessionForAccount,
    createSessionCookie,
    buildTeamStatePayload,
    registrationTeamKey,
    isTeamJoinAllowedByAllowlist,
    requireTeamSession,
    clearSessionCookie,
    teamSessions,
    revokeRuntimeTeamSession,
    nowIso,
  } = routeContext;

  if (req.method === "POST" && url.pathname === "/api/team/auth/login") {
    try {
      const payload = await readBody(req);
      const loginUserId = String(payload?.userId || "").trim().toLowerCase() || "unknown";
      if (!(await checkScopedRateLimit(teamLoginRateStore, `${clientIp}:${loginUserId}`, teamLoginRateLimitMax))) {
        sendJson(res, 429, { ok: false, error: "Zu viele Login-Versuche. Bitte später erneut versuchen." }, origin, requestId);
        return true;
      }
      const lockState = getTeamLoginLockState(loginUserId);
      if (lockState.locked) {
        sendJson(res, 429, { ok: false, error: `Konto vorübergehend gesperrt. Bitte in ${lockState.retryAfterSec}s erneut versuchen.` }, origin, requestId);
        return true;
      }
      const loginContext = {
        account: {
          id: `login:${normalizeAccountId(payload?.userId) || "unknown"}`,
          teamId: "public",
        },
      };
      const { account, sessionId, csrfToken } = await runTeamWriteIdempotent(req, loginContext, "team-login", payload, async () => {
        const account = await resolveAccountForAuth(payload?.userId, requestLogger);
        if (!account || account.teamId !== state.team.team.id || !account.passwordHash || !verifyPassword(payload?.password, account.passwordHash)) {
          const failureState = registerTeamLoginFailure(loginUserId);
          if (failureState.locked) {
            requestLogger.warn("team login locked", { loginUserId, failures: failureState.failures });
            const lockError = new Error(`Konto vorübergehend gesperrt. Bitte in ${failureState.retryAfterSec}s erneut versuchen.`);
            lockError.statusCode = 429;
            throw lockError;
          }
          const authError = new Error("Unbekannter oder inaktiver Team-Account.");
          authError.statusCode = 401;
          throw authError;
        }

        clearTeamLoginFailure(loginUserId);
        const session = await createTeamSessionForAccount(account, String(clientIp || ""), String(req.headers["user-agent"] || ""));
        return {
          account,
          sessionId: session.sessionId,
          csrfToken: session.csrfToken,
        };
      });
      res.setHeader("Set-Cookie", createSessionCookie(sessionId));
      sendJson(res, 200, { ...buildTeamStatePayload({ account }), csrfToken }, origin, requestId);
      return true;
    } catch (error) {
      requestLogger.warn("team login failed", { error });
      const statusCode = Number(error?.statusCode || error?.status || 400);
      const message = String(error?.message || "Team-Login fehlgeschlagen.");
      sendJson(res, statusCode, { ok: false, error: message }, origin, requestId);
      return true;
    }
  }

  if (req.method === "POST" && url.pathname === "/api/team/auth/register") {
    try {
      const payload = await readBody(req);
      const loginUserId = String(payload?.userId || "").trim().toLowerCase() || "unknown";
      if (!(await checkScopedRateLimit(teamLoginRateStore, `${clientIp}:${loginUserId}`, teamLoginRateLimitMax))) {
        sendJson(res, 429, { ok: false, error: "Zu viele Registrierungsversuche. Bitte später erneut versuchen." }, origin, requestId);
        return true;
      }

      const accountContext = {
        account: {
          id: `register:${normalizeAccountId(payload?.userId) || "unknown"}`,
          teamId: `register:${normalizeAccountId(payload?.teamKey) || "unknown"}`,
        },
      };
      const { account } = await runTeamWriteIdempotent(req, accountContext, "team-register", payload, async () => {
        const accountId = normalizeAccountId(payload?.userId);
        const displayName = assertMinLength(payload?.name, 2, "Name muss mindestens 2 Zeichen enthalten.");
        const password = assertPasswordMinLength(payload?.password, 8);
        const requestedTeamKey = normalizeAccountId(payload?.teamKey);
        if (!accountId || accountId.length < 3) {
          const validationError = new Error("User-ID muss mindestens 3 Zeichen enthalten.");
          validationError.statusCode = 400;
          throw validationError;
        }
        if (requestedTeamKey !== registrationTeamKey) {
          const validationError = new Error("Aktuell ist nur Team Borussia Mönchengladbach verfügbar.");
          validationError.statusCode = 400;
          throw validationError;
        }
        if (!isTeamJoinAllowedByAllowlist({ teamKey: requestedTeamKey, userId: accountId })) {
          const forbiddenError = new Error("Beitritt nicht erlaubt. Bitte Team-Admin kontaktieren.");
          forbiddenError.statusCode = 403;
          throw forbiddenError;
        }
        const exists = findAccount(state.team, accountId);
        if (exists) {
          const conflictError = new Error("Diese User-ID ist bereits vergeben.");
          conflictError.statusCode = 409;
          throw conflictError;
        }
        const account = await registerAccount({
          accountId,
          displayName,
          passwordHash: createPasswordHash(password),
          applyTeamStateMutation,
          logger: requestLogger,
        });
        return { account };
      });
      const persistedAccount = findAccount(state.team, account);
      if (!persistedAccount) {
        sendJson(res, 500, { ok: false, error: "Team-Account konnte nach Registrierung nicht geladen werden." }, origin, requestId);
        return true;
      }
      const { sessionId, csrfToken } = await createTeamSessionForAccount(
        persistedAccount,
        String(clientIp || ""),
        String(req.headers["user-agent"] || ""),
      );
      res.setHeader("Set-Cookie", createSessionCookie(sessionId));
      sendJson(res, 201, { ...buildTeamStatePayload({ account: persistedAccount }), csrfToken }, origin, requestId);
      return true;
    } catch (error) {
      requestLogger.warn("team registration failed", { error });
      sendRouteError({ res, sendJson, origin, requestId, error, fallbackStatus: 400, fallbackMessage: "Registrierung fehlgeschlagen." });
      return true;
    }
  }

  if (req.method === "POST" && url.pathname === "/api/team/auth/logout") {
    const context = requireTeamSession(req, res, origin, requestId);
    if (!context) {
      return true;
    }
    // Logout is not a state mutation that should require writer role.
    // CSRF is still required to avoid cross-site logout.
    const providedCsrf = String(req.headers["x-csrf-token"] || "");
    if (!providedCsrf || providedCsrf !== String(context?.session?.csrfToken || "")) {
      sendJson(res, 403, { ok: false, error: "CSRF-Token fehlt oder ist ungueltig." }, origin, requestId);
      return true;
    }

    teamSessions.delete(context.sessionId);
    void revokeRuntimeTeamSession(context.sessionId, nowIso(), requestLogger);
    res.setHeader("Set-Cookie", clearSessionCookie());
    sendJson(res, 200, { ok: true }, origin, requestId);
    return true;
  }

  return false;
}
