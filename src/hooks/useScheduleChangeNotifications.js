import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildScheduleFingerprint,
  buildScheduleScopeKey,
  calculateScheduleDelta,
  readScheduleWatchState,
  writeScheduleWatchState,
} from "../services/scheduleChanges";
import {
  ackTeamPushEvents,
  fetchTeamPushPendingEvents,
  resolveTeamApiBase,
  subscribeTeamPushNotifications,
} from "../services/teamBackendClient";

const MAX_HISTORY = 20;
const PUSH_POLL_INTERVAL_MS = 30000;
const VAPID_PUBLIC_KEY = String(import.meta.env?.VITE_WEB_PUSH_VAPID_PUBLIC_KEY || "").trim();

function getBrowserPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

function formatDateText(value) {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return "-";
  }

  const [year, month, day] = text.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime())) {
    return text;
  }

  return parsed.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function useScheduleChangeNotifications({
  games,
  dataSourceUsed,
  kreisIds,
  kreisId,
  jugendId,
  fromDate,
  toDate,
  kreisLabel,
  jugendLabel,
  teamConnected = false,
}) {
  const [latestNotice, setLatestNotice] = useState(null);
  const [history, setHistory] = useState([]);
  const [browserPermission, setBrowserPermission] = useState(() => getBrowserPermission());
  const [sseConnected, setSseConnected] = useState(false);
  const watchStateRef = useRef(readScheduleWatchState());
  const pushSubscriptionAttemptedRef = useRef(false);

  const browserSupported = browserPermission !== "unsupported";
  const scopeKey = useMemo(
    () =>
      buildScheduleScopeKey({
        kreisIds,
        kreisId,
        jugendId,
        fromDate,
        toDate,
      }),
    [kreisIds, kreisId, jugendId, fromDate, toDate],
  );
  const scheduleFingerprint = useMemo(() => buildScheduleFingerprint(games), [games]);

  const requestBrowserPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return "unsupported";
    }

    try {
      const result = await Notification.requestPermission();
      setBrowserPermission(result);
      return result;
    } catch {
      setBrowserPermission("denied");
      return "denied";
    }
  }, []);

  const showBrowserNotice = useCallback(async ({ title, body, tag = "", eventId = "", url = "/hub" }) => {
    const safeTitle = String(title || "ScoutX Update").trim() || "ScoutX Update";
    const safeBody = String(body || "Neue Team-Aktivität verfügbar.").trim() || "Neue Team-Aktivität verfügbar.";
    const safeTag = String(tag || eventId || "scoutx-update").trim() || "scoutx-update";
    const targetUrl = String(url || "/hub").trim() || "/hub";
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration && typeof registration.showNotification === "function") {
          await registration.showNotification(safeTitle, {
            body: safeBody,
            icon: "/scoutx-icon-192.png",
            badge: "/scoutx-icon-192.png",
            tag: safeTag,
            renotify: true,
            data: { url: targetUrl, eventId: String(eventId || "").trim() },
          });
          return;
        }
      } catch {
        // Fallback to plain Notification below.
      }
    }
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      new Notification(safeTitle, {
        body: safeBody,
        icon: "/scoutx-icon-192.png",
        badge: "/scoutx-icon-192.png",
        tag: safeTag,
        renotify: true,
      });
    }
  }, []);

  const base64UrlToUint8Array = useCallback((value) => {
    const source = String(value || "").trim();
    if (!source) {
      return null;
    }
    const padding = "=".repeat((4 - (source.length % 4)) % 4);
    const normalized = (source + padding).replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(normalized);
    const bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i += 1) {
      bytes[i] = decoded.charCodeAt(i);
    }
    return bytes;
  }, []);

  const ensurePushSubscription = useCallback(async () => {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
      return;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      return;
    }
    if (Notification.permission !== "granted") {
      return;
    }
    if (!VAPID_PUBLIC_KEY || pushSubscriptionAttemptedRef.current) {
      return;
    }
    pushSubscriptionAttemptedRef.current = true;
    try {
      const registration = await navigator.serviceWorker.ready;
      if (!registration?.pushManager) {
        return;
      }
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        const applicationServerKey = base64UrlToUint8Array(VAPID_PUBLIC_KEY);
        if (!applicationServerKey) {
          return;
        }
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      }
      if (subscription) {
        await subscribeTeamPushNotifications(subscription.toJSON());
      }
    } catch {
      // Keep app usable even when push subscription fails.
    }
  }, [base64UrlToUint8Array]);

  const dismissLatestNotice = useCallback(() => {
    setLatestNotice(null);
  }, []);

  // In-App-Popup für Team-Events (z. B. "Team-Plan veröffentlicht"):
  // funktioniert auch ohne Browser-Notification-Berechtigung.
  const showTeamEventsInApp = useCallback((events) => {
    const items = (Array.isArray(events) ? events : []).filter(Boolean);
    if (items.length === 0) {
      return;
    }
    const notices = items.map((item) => ({
      id: String(item?.eventId || item?.id || `team-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
      createdAt: String(item?.createdAt || new Date().toISOString()),
      title: String(item?.title || "Team-Aktivität").trim() || "Team-Aktivität",
      message: String(item?.body || "Neues Team-Event").trim() || "Neues Team-Event",
      detail: "",
    }));
    setLatestNotice(notices[0]);
    setHistory((prev) => [...notices, ...prev].slice(0, MAX_HISTORY));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const currentPermission = getBrowserPermission();
    setBrowserPermission(currentPermission);
  }, []);

  useEffect(() => {
    const safeGames = Array.isArray(games) ? games : [];
    if (String(dataSourceUsed || "").toLowerCase() !== "adapter") {
      return;
    }

    if (!scopeKey || !scheduleFingerprint || safeGames.length === 0) {
      return;
    }

    const watchState = watchStateRef.current || {};
    const previousFingerprint = String(watchState[scopeKey] || "").trim();

    if (!previousFingerprint) {
      watchState[scopeKey] = scheduleFingerprint;
      watchStateRef.current = watchState;
      writeScheduleWatchState(watchState);
      return;
    }

    if (previousFingerprint === scheduleFingerprint) {
      return;
    }

    const scheduleDelta = calculateScheduleDelta(previousFingerprint, scheduleFingerprint);

    watchState[scopeKey] = scheduleFingerprint;
    watchStateRef.current = watchState;
    writeScheduleWatchState(watchState);

    const notice = {
      id: `schedule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      scopeKey,
      gameCount: safeGames.length,
      delta: scheduleDelta,
      message: `Spielplanänderung erkannt für ${String(jugendLabel || "Jugend").trim() || "Jugend"} · ${String(
        kreisLabel || "Kreis",
      ).trim() || "Kreis"}`,
      detail: `${formatDateText(fromDate)} bis ${formatDateText(toDate || fromDate)} · +${scheduleDelta.added} / -${
        scheduleDelta.removed
      } Spiele`,
    };

    setLatestNotice(notice);
    setHistory((prev) => [notice, ...prev].slice(0, MAX_HISTORY));

    void showBrowserNotice({
      title: "ScoutX: Spielplan geändert",
      body: `${notice.message} (${notice.detail})`,
      tag: `schedule-change-${scopeKey}`,
      url: "/games",
    });
  }, [dataSourceUsed, fromDate, games, jugendLabel, kreisLabel, scopeKey, scheduleFingerprint, showBrowserNotice, toDate]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
      return;
    }
    if (!("serviceWorker" in navigator)) {
      return;
    }
    const onMessage = (event) => {
      const data = event?.data || {};
      if (data?.type !== "SCOUTX_NAVIGATE") {
        return;
      }
      const target = String(data.url || "").trim();
      if (!target) {
        return;
      }
      try {
        window.location.assign(target);
      } catch {
        // no-op
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => {
      navigator.serviceWorker.removeEventListener("message", onMessage);
    };
  }, []);

  useEffect(() => {
    void ensurePushSubscription();
  }, [browserPermission, ensurePushSubscription]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      setSseConnected(false);
      return undefined;
    }
    // Nur mit aktiver Team-Session verbinden, sonst 401-Reconnect-Schleife.
    if (!teamConnected) {
      setSseConnected(false);
      return undefined;
    }
    const streamUrl = `${resolveTeamApiBase()}/notifications/push/stream`;
    let source = null;
    let reconnectTimer = null;
    let closed = false;

    const open = () => {
      if (closed) {
        return;
      }
      try {
        source = new EventSource(streamUrl, { withCredentials: true });
      } catch {
        setSseConnected(false);
        reconnectTimer = window.setTimeout(open, 3000);
        return;
      }
      source.onopen = () => {
        setSseConnected(true);
      };
      source.onmessage = async (event) => {
        try {
          const payload = JSON.parse(String(event?.data || "{}"));
          const events = Array.isArray(payload?.events) ? payload.events : [];
          if (events.length === 0) {
            return;
          }
          showTeamEventsInApp(events);
          for (const item of events) {
            await showBrowserNotice({
              title: item?.title || "ScoutX Hinweis",
              body: item?.body || "Neues Team-Event",
              tag: item?.eventId || item?.id || "team-event",
              eventId: item?.eventId || item?.id || "",
              url: "/hub",
            });
          }
          const eventIds = events.map((item) => String(item?.eventId || item?.id || "").trim()).filter(Boolean);
          if (eventIds.length > 0) {
            await ackTeamPushEvents(eventIds);
          }
        } catch {
          // Keep stream running on malformed messages.
        }
      };
      source.onerror = () => {
        setSseConnected(false);
        try {
          source?.close();
        } catch {
          // no-op
        }
        source = null;
        if (!closed) {
          reconnectTimer = window.setTimeout(open, 3000);
        }
      };
    };

    open();
    return () => {
      closed = true;
      setSseConnected(false);
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
      }
      try {
        source?.close();
      } catch {
        // no-op
      }
    };
  }, [showBrowserNotice, showTeamEventsInApp, teamConnected]);

  useEffect(() => {
    if (typeof window === "undefined" || !teamConnected) {
      return undefined;
    }
    if (sseConnected) {
      return undefined;
    }
    let cancelled = false;
    const tick = async () => {
      try {
        const payload = await fetchTeamPushPendingEvents();
        if (cancelled) {
          return;
        }
        const events = Array.isArray(payload?.events) ? payload.events : [];
        if (events.length === 0) {
          return;
        }
        showTeamEventsInApp(events);
        for (const item of events) {
          await showBrowserNotice({
            title: item?.title || "ScoutX Hinweis",
            body: item?.body || "Neues Team-Event",
            tag: item?.eventId || item?.id || "team-event",
            eventId: item?.eventId || item?.id || "",
            url: "/hub",
          });
        }
        const eventIds = events.map((item) => String(item?.eventId || item?.id || "").trim()).filter(Boolean);
        if (eventIds.length > 0) {
          await ackTeamPushEvents(eventIds);
        }
      } catch {
        // Pending pull is best-effort.
      }
    };

    void tick();
    const timer = window.setInterval(() => {
      void tick();
    }, PUSH_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [showBrowserNotice, showTeamEventsInApp, sseConnected, teamConnected]);

  return {
    latestNotice,
    history,
    dismissLatestNotice,
    browserSupported,
    browserPermission,
    requestBrowserPermission,
  };
}
