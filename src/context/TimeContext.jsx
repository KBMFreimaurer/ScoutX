import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { STORAGE_KEYS } from "../config/storage";

const TimeContext = createContext(null);

function toIsoDate(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return "";
    }
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }

  const text = String(value || "").trim();
  if (!text) {
    return "";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  if (/^\d{2}\.\d{2}\.\d{4}$/.test(text)) {
    const [day, month, year] = text.split(".").map(Number);
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
}

function sortByUpdatedDesc(entries) {
  return [...entries].sort((left, right) => {
    const leftMs = new Date(left?.updatedAt || 0).getTime();
    const rightMs = new Date(right?.updatedAt || 0).getTime();
    return rightMs - leftMs;
  });
}

function normalizeEntry(raw, index) {
  const gameId = String(raw?.gameId || "").trim();
  const minutes = Number(raw?.minutes);
  if (!gameId || !Number.isFinite(minutes) || minutes <= 0) {
    return null;
  }

  const id = String(raw?.id || `time-${gameId}-${index}`).trim();
  const gameLabel = String(raw?.gameLabel || "").trim();
  const gameDateLabel = String(raw?.gameDateLabel || "").trim();
  const gameVenue = String(raw?.gameVenue || "").trim();
  const note = String(raw?.note || "").trim();
  const gameIsoDate = toIsoDate(raw?.gameIsoDate || raw?.date || raw?.gameDateLabel);
  const createdAt = String(raw?.createdAt || raw?.updatedAt || "").trim() || new Date().toISOString();
  const updatedAt = String(raw?.updatedAt || raw?.createdAt || "").trim() || createdAt;

  return {
    id,
    gameId,
    gameLabel,
    gameDateLabel,
    gameVenue,
    gameIsoDate,
    minutes: Math.max(1, Math.round(minutes)),
    note,
    createdAt,
    updatedAt,
  };
}

function readStoredEntries() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.times);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    const maybeEntries = Array.isArray(parsed) ? parsed : parsed?.entries;
    if (!Array.isArray(maybeEntries)) {
      return [];
    }

    return sortByUpdatedDesc(
      maybeEntries
        .map((entry, index) => normalizeEntry(entry, index))
        .filter(Boolean),
    );
  } catch {
    return [];
  }
}

function buildGameLabel(game) {
  const directLabel = String(game?.label || game?.gameLabel || "").trim();
  if (directLabel) {
    return directLabel;
  }

  const home = String(game?.home || "").trim();
  const away = String(game?.away || "").trim();
  if (home && away) {
    return `${home} vs ${away}`;
  }
  return home || away || "Unbekanntes Spiel";
}

function buildEntryPayload(game, minutes, noteText) {
  const note = String(noteText || "").trim();

  return {
    gameId: String(game?.id || "").trim(),
    gameLabel: buildGameLabel(game),
    gameDateLabel: String(game?.dateLabel || game?.gameDateLabel || "").trim(),
    gameVenue: String(game?.venue || game?.gameVenue || "").trim(),
    gameIsoDate: toIsoDate(game?.dateObj || game?.date || game?.dateLabel || game?.gameIsoDate),
    minutes: Math.max(1, Math.round(Number(minutes))),
    note,
  };
}

function createEntryId(gameId) {
  const nonce = Math.random().toString(36).slice(2, 8);
  return `time-${gameId}-${Date.now().toString(36)}-${nonce}`;
}

export function TimeProvider({ children }) {
  const [timeEntries, setTimeEntries] = useState(() => readStoredEntries());

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(STORAGE_KEYS.times, JSON.stringify({ entries: timeEntries }));
    } catch {
      // Ignore localStorage write errors to keep the UI responsive.
    }
  }, [timeEntries]);

  const onUpsertTimeEntry = useCallback(({ entryId, game, minutes, note }) => {
    const safeMinutes = Number(minutes);
    const gameId = String(game?.id || "").trim();
    if (!gameId || !Number.isFinite(safeMinutes) || safeMinutes <= 0) {
      return false;
    }

    const payload = buildEntryPayload(game, safeMinutes, note);
    const nowIso = new Date().toISOString();

    setTimeEntries((prev) => {
      const next = [...prev];
      const safeEntryId = String(entryId || "").trim();
      const targetIndex = safeEntryId ? next.findIndex((entry) => entry.id === safeEntryId) : -1;

      if (targetIndex >= 0) {
        const existing = next[targetIndex];
        next[targetIndex] = {
          ...existing,
          ...payload,
          id: existing.id,
          createdAt: existing.createdAt,
          updatedAt: nowIso,
        };
        return sortByUpdatedDesc(next);
      }

      return [
        {
          id: createEntryId(payload.gameId),
          ...payload,
          createdAt: nowIso,
          updatedAt: nowIso,
        },
        ...next,
      ];
    });

    return true;
  }, []);

  const onDeleteTimeEntry = useCallback((entryId) => {
    const id = String(entryId || "").trim();
    if (!id) {
      return;
    }
    setTimeEntries((prev) => prev.filter((entry) => entry.id !== id));
  }, []);

  const onClearTimeEntries = useCallback(() => {
    setTimeEntries([]);
  }, []);

  const timeEntriesByGameId = useMemo(
    () =>
      timeEntries.reduce((acc, entry) => {
        if (!acc[entry.gameId]) {
          acc[entry.gameId] = entry;
        }
        return acc;
      }, {}),
    [timeEntries],
  );

  const timeTotalMinutes = useMemo(
    () => timeEntries.reduce((sum, entry) => sum + Number(entry?.minutes || 0), 0),
    [timeEntries],
  );

  const value = useMemo(
    () => ({
      timeEntries,
      timeEntriesByGameId,
      timeTotalMinutes,
      onUpsertTimeEntry,
      onDeleteTimeEntry,
      onClearTimeEntries,
    }),
    [timeEntries, timeEntriesByGameId, timeTotalMinutes, onUpsertTimeEntry, onDeleteTimeEntry, onClearTimeEntries],
  );

  return <TimeContext.Provider value={value}>{children}</TimeContext.Provider>;
}

export function useTimes() {
  const context = useContext(TimeContext);
  if (!context) {
    throw new Error("useTimes muss innerhalb von TimeProvider verwendet werden.");
  }
  return context;
}
