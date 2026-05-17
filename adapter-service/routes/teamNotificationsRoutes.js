import { parseEventIdsPayload, parsePushSubscriptionPayload } from "../lib/requestValidation.js";
import { applyPushAck, filterNotificationsList, markNotificationsRead } from "../services/teamNotificationsDomainService.js";
import { sendRouteError } from "./routeErrorResponses.js";

export async function handleTeamNotificationsRoutes(req, res, routeContext) {
  const {
    url,
    origin,
    requestId,
    clientIp,
    requestLogger,
    state,
    nowIso,
    readBody,
    sendJson,
    requireTeamSession,
    requireTeamWriteAllowed,
    normalizeEventId,
    persistTeamState,
    teamPushSubscriptions,
    teamPushOutbox,
    pushedCriticalEventIds,
    setCorsHeaders,
    registerTeamPushStream,
    persistPushSubscription,
    removePushOutboxEventsAndMarkAcked,
    notificationsReadsFromDb,
    fetchTeamNotificationsFromDb,
  } = routeContext;

  if (req.method === "GET" && url.pathname === "/api/team/notifications") {
    const context = requireTeamSession(req, res, origin, requestId);
    if (!context) {
      return true;
    }
    let sourceNotifications = state.team?.notifications;
    if (notificationsReadsFromDb) {
      const dbNotifications = await fetchTeamNotificationsFromDb(context.account.teamId, requestLogger);
      if (Array.isArray(dbNotifications)) {
        sourceNotifications = dbNotifications;
      }
    }
    const statusFilter = String(url.searchParams.get("status") || "").trim().toLowerCase();
    const typeFilter = String(url.searchParams.get("type") || "").trim().toLowerCase();
    const visibleNotifications = (Array.isArray(sourceNotifications) ? sourceNotifications : []).filter((item) => {
      const recipientId = String(item?.recipientId || "").trim().toLowerCase();
      if (!recipientId) {
        return true;
      }
      return recipientId === String(context.account?.id || "").trim().toLowerCase();
    });
    const notifications = filterNotificationsList(visibleNotifications, statusFilter, typeFilter);
    sendJson(res, 200, { ok: true, notifications }, origin, requestId);
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/team/notifications/read") {
    const context = requireTeamSession(req, res, origin, requestId);
    if (!context) {
      return true;
    }
    if (!await requireTeamWriteAllowed(req, context, res, origin, requestId, clientIp)) {
      return true;
    }
    try {
      const payload = await readBody(req);
      const ids = parseEventIdsPayload(payload);
      const { notifications, updatedCount } = markNotificationsRead(state.team?.notifications, ids, normalizeEventId);
      const persisted = await persistTeamState(
        {
          ...state.team,
          notifications,
        },
        requestLogger,
        "team-notifications-read",
      );
      if (!persisted) {
        sendJson(res, 500, { ok: false, error: "Benachrichtigungen konnten nicht aktualisiert werden." }, origin, requestId);
        return true;
      }
      sendJson(res, 200, { ok: true, updatedCount }, origin, requestId);
      return true;
    } catch (error) {
      requestLogger.warn("notifications read failed", { error });
      sendRouteError({ res, sendJson, origin, requestId, error, fallbackStatus: 400, fallbackMessage: "Benachrichtigungen konnten nicht aktualisiert werden." });
      return true;
    }
  }

  if (req.method === "POST" && url.pathname === "/api/team/notifications/push/subscribe") {
    const context = requireTeamSession(req, res, origin, requestId);
    if (!context) {
      return true;
    }
    if (!await requireTeamWriteAllowed(req, context, res, origin, requestId, clientIp)) {
      return true;
    }

    try {
      const payload = await readBody(req);
      const subscription = parsePushSubscriptionPayload(payload, context, nowIso);
      teamPushSubscriptions.set(subscription.endpoint, subscription);
      void persistPushSubscription(subscription, requestLogger);
      sendJson(res, 200, { ok: true, subscription }, origin, requestId);
      return true;
    } catch (error) {
      requestLogger.warn("push subscription failed", { error });
      sendRouteError({ res, sendJson, origin, requestId, error, fallbackStatus: 400, fallbackMessage: "Push-Subscription konnte nicht gespeichert werden." });
      return true;
    }
  }

  if (req.method === "GET" && url.pathname === "/api/team/notifications/push/pending") {
    const context = requireTeamSession(req, res, origin, requestId);
    if (!context) {
      return true;
    }
    const subscriptions = [...teamPushSubscriptions.values()].filter((sub) => sub?.teamId === context.account.teamId);
    const events = [...teamPushOutbox.values()].filter((event) => String(event?.teamId || "") === context.account.teamId);
    const statusSummary = events.reduce(
      (acc, item) => {
        const status = String(item?.status || "new").trim().toLowerCase() || "new";
        acc[status] = Number(acc[status] || 0) + 1;
        return acc;
      },
      { new: 0, delivered: 0 },
    );
    sendJson(
      res,
      200,
      {
        ok: true,
        subscriptionCount: subscriptions.length,
        statusSummary,
        events,
      },
      origin,
      requestId,
    );
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/team/notifications/push/stream") {
    const context = requireTeamSession(req, res, origin, requestId);
    if (!context) {
      return true;
    }
    if (typeof setCorsHeaders === "function") {
      setCorsHeaders(res, origin);
    }
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      ...(requestId ? { "X-Request-Id": requestId } : {}),
    });
    res.write(`retry: 10000\ndata: ${JSON.stringify({ ok: true, type: "ready" })}\n\n`);
    const unregister = typeof registerTeamPushStream === "function" ? registerTeamPushStream(context.account.teamId, res) : () => {};
    const keepAlive = setInterval(() => {
      try {
        res.write(`data: ${JSON.stringify({ ok: true, type: "heartbeat", ts: nowIso() })}\n\n`);
      } catch {
        // Closed stream.
      }
    }, 25000);
    const close = () => {
      clearInterval(keepAlive);
      unregister();
      try {
        res.end();
      } catch {
        // no-op
      }
    };
    req.on("close", close);
    req.on("error", close);
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/team/notifications/push/ack") {
    const context = requireTeamSession(req, res, origin, requestId);
    if (!context) {
      return true;
    }
    if (!await requireTeamWriteAllowed(req, context, res, origin, requestId, clientIp)) {
      return true;
    }
    try {
      const payload = await readBody(req);
      const ids = parseEventIdsPayload(payload);
      const { removedCount } = applyPushAck(teamPushOutbox, pushedCriticalEventIds, ids);
      void removePushOutboxEventsAndMarkAcked(ids, context.account.teamId, requestLogger);
      sendJson(res, 200, { ok: true, removedCount }, origin, requestId);
      return true;
    } catch (error) {
      requestLogger.warn("push ack failed", { error });
      sendRouteError({ res, sendJson, origin, requestId, error, fallbackStatus: 400, fallbackMessage: "Push-Ack konnte nicht verarbeitet werden." });
      return true;
    }
  }

  return false;
}
