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
    persistTeamState,
    findAccount,
    createTeamSessionForAccount,
    createSessionCookie,
    buildTeamStatePayload,
    registrationTeamKey,
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
      const account = await resolveAccountForAuth(payload?.userId, requestLogger);
      if (!account || account.teamId !== state.team.team.id || !account.passwordHash || !verifyPassword(payload?.password, account.passwordHash)) {
        const failureState = registerTeamLoginFailure(loginUserId);
        if (failureState.locked) {
          requestLogger.warn("team login locked", { loginUserId, failures: failureState.failures });
          sendJson(
            res,
            429,
            { ok: false, error: `Konto vorübergehend gesperrt. Bitte in ${failureState.retryAfterSec}s erneut versuchen.` },
            origin,
            requestId,
          );
          return true;
        }
        sendJson(res, 401, { ok: false, error: "Unbekannter oder inaktiver Team-Account." }, origin, requestId);
        return true;
      }

      clearTeamLoginFailure(loginUserId);
      const { sessionId, csrfToken } = await createTeamSessionForAccount(account, String(clientIp || ""), String(req.headers["user-agent"] || ""));
      res.setHeader("Set-Cookie", createSessionCookie(sessionId));
      sendJson(res, 200, { ...buildTeamStatePayload({ account }), csrfToken }, origin, requestId);
      return true;
    } catch (error) {
      requestLogger.warn("team login failed", { error });
      sendRouteError({ res, sendJson, origin, requestId, error, fallbackStatus: 400, fallbackMessage: "Team-Login fehlgeschlagen." });
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

      const accountId = normalizeAccountId(payload?.userId);
      const displayName = assertMinLength(payload?.name, 2, "Name muss mindestens 2 Zeichen enthalten.");
      const password = assertPasswordMinLength(payload?.password, 8);
      const requestedTeamKey = normalizeAccountId(payload?.teamKey);
      if (!accountId || accountId.length < 3) {
        sendJson(res, 400, { ok: false, error: "User-ID muss mindestens 3 Zeichen enthalten." }, origin, requestId);
        return true;
      }
      if (requestedTeamKey !== registrationTeamKey) {
        sendJson(res, 400, { ok: false, error: "Aktuell ist nur Team Borussia Mönchengladbach verfügbar." }, origin, requestId);
        return true;
      }
      const exists = findAccount(state.team, accountId);
      if (exists) {
        sendJson(res, 409, { ok: false, error: "Diese User-ID ist bereits vergeben." }, origin, requestId);
        return true;
      }

      const account = await registerAccount({
        state: state.team,
        accountId,
        displayName,
        passwordHash: createPasswordHash(password),
        persistTeamState,
        logger: requestLogger,
        findAccount: (id) => findAccount(state.team, id),
      });
      const { sessionId, csrfToken } = await createTeamSessionForAccount(account, String(clientIp || ""), String(req.headers["user-agent"] || ""));
      res.setHeader("Set-Cookie", createSessionCookie(sessionId));
      sendJson(res, 201, { ...buildTeamStatePayload({ account }), csrfToken }, origin, requestId);
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
