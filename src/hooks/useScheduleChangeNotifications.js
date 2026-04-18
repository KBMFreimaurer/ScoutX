import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildScheduleFingerprint,
  buildScheduleScopeKey,
  calculateScheduleDelta,
  readScheduleWatchState,
  writeScheduleWatchState,
} from "../services/scheduleChanges";

const MAX_HISTORY = 20;

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
  kreisId,
  jugendId,
  fromDate,
  toDate,
  kreisLabel,
  jugendLabel,
}) {
  const [latestNotice, setLatestNotice] = useState(null);
  const [history, setHistory] = useState([]);
  const [browserPermission, setBrowserPermission] = useState(() => getBrowserPermission());
  const watchStateRef = useRef(readScheduleWatchState());

  const browserSupported = browserPermission !== "unsupported";
  const scopeKey = useMemo(
    () =>
      buildScheduleScopeKey({
        kreisId,
        jugendId,
        fromDate,
        toDate,
      }),
    [kreisId, jugendId, fromDate, toDate],
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

  const dismissLatestNotice = useCallback(() => {
    setLatestNotice(null);
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

    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      try {
        new Notification("ScoutX: Spielplan geändert", {
          body: `${notice.message} (${notice.detail})`,
          icon: "/scoutx-icon-192.png",
          badge: "/scoutx-icon-192.png",
          tag: `schedule-change-${scopeKey}`,
          renotify: true,
        });
      } catch {
        // Ignore browser notification errors.
      }
    }
  }, [dataSourceUsed, fromDate, games, jugendLabel, kreisLabel, scopeKey, scheduleFingerprint, toDate]);

  return {
    latestNotice,
    history,
    dismissLatestNotice,
    browserSupported,
    browserPermission,
    requestBrowserPermission,
  };
}
