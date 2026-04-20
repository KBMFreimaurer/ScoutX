import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { STORAGE_KEYS } from "../config/storage";
import { calculateDirectStartRoutes, calculateRoute, calculateRouteWithDriving, isGoogleRoutingStrictMode } from "../utils/geo";
import { cleanScoutPlanText } from "./shared";
import { useGames } from "./GamesContext";
import { useSetup } from "./SetupContext";

const PlanContext = createContext(null);
const KNOWN_TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const ROUTE_TIMEOUT_MS = Number(import.meta.env?.VITE_ROUTE_TIMEOUT_MS || 60000);
const PLAN_HISTORY_LIMIT = 20;

function withTimeout(promise, timeoutMs, fallbackValue) {
  const safeTimeout = Number(timeoutMs);
  if (!Number.isFinite(safeTimeout) || safeTimeout <= 0) {
    return Promise.resolve(promise).catch(() => fallbackValue);
  }

  return new Promise((resolve) => {
    let settled = false;
    const timer = globalThis.setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(fallbackValue);
    }, safeTimeout);

    Promise.resolve(promise)
      .then((value) => {
        if (settled) {
          return;
        }
        settled = true;
        globalThis.clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        if (settled) {
          return;
        }
        settled = true;
        globalThis.clearTimeout(timer);
        resolve(fallbackValue);
      });
  });
}

function toSortableKickoff(value) {
  const text = String(value || "").trim();
  return KNOWN_TIME_RE.test(text) ? text : "99:99";
}

function buildManualScoutPlan({ games, jugendLabel, kreisLabel, isTurnier, usedFallbackAll = false }) {
  const sortedGames = [...(Array.isArray(games) ? games : [])].sort((a, b) => {
    const dateDelta = a.dateObj - b.dateObj;
    if (dateDelta !== 0) {
      return dateDelta;
    }
    return toSortableKickoff(a.time).localeCompare(toSortableKickoff(b.time));
  });
  const lines = [];

  lines.push("Manueller Scouting-Plan");
  lines.push("Auswahl durch Scout (keine automatische Empfehlung).");
  lines.push(`Wettbewerb: ${jugendLabel || "n/a"} · ${kreisLabel || "n/a"}`);
  lines.push(`Turniermodus: ${isTurnier ? "Ja" : "Nein"}`);
  if (usedFallbackAll) {
    lines.push(`Keine manuelle Auswahl markiert · alle verfügbaren Spiele übernommen (${sortedGames.length}).`);
  } else {
    lines.push(`Ausgewählte Spiele: ${sortedGames.length}`);
  }
  lines.push("");
  lines.push("Besuchsplan");
  lines.push("ROUTENPLAN");

  if (sortedGames.length === 0) {
    lines.push("Keine Spiele verfügbar.");
  } else {
    sortedGames.forEach((game, index) => {
      const routeTime = KNOWN_TIME_RE.test(String(game.time || "").trim()) ? game.time : "--:--";
      lines.push(`${index + 1}. ${routeTime} — ${game.home} vs. ${game.away} | ${game.venue || "Sportanlage"}`);
    });
  }

  lines.push("");
  lines.push("Hinweis:");
  lines.push("Fahrtkosten-Abrechnung und PDF basieren auf den Spielen dieses Plans.");

  return cleanScoutPlanText(lines.join("\n"));
}

function serializeGameForHistory(game) {
  const dateObjIso = game?.dateObj instanceof Date && !Number.isNaN(game.dateObj.getTime()) ? game.dateObj.toISOString() : null;
  return {
    ...game,
    dateObj: dateObjIso,
  };
}

function deserializeGameFromHistory(game) {
  const dateObjText = String(game?.dateObj || "").trim();
  const parsedDateObj = dateObjText ? new Date(dateObjText) : null;
  return {
    ...game,
    dateObj: parsedDateObj && !Number.isNaN(parsedDateObj.getTime()) ? parsedDateObj : null,
  };
}

function normalizePlanHistoryEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const id = String(entry.id || "").trim();
  const createdAt = String(entry.createdAt || "").trim();
  if (!id || !createdAt) {
    return null;
  }

  const games = Array.isArray(entry.games) ? entry.games : [];
  const selectedGameIds = Array.isArray(entry.selectedGameIds)
    ? entry.selectedGameIds.map((value) => String(value || "").trim()).filter(Boolean)
    : [];

  return {
    id,
    createdAt,
    planText: String(entry.planText || ""),
    games,
    selectedGameIds,
    meta: entry.meta && typeof entry.meta === "object" ? entry.meta : {},
    syncContext: entry.syncContext && typeof entry.syncContext === "object" ? entry.syncContext : {},
    presenceByGame: entry.presenceByGame && typeof entry.presenceByGame === "object" ? entry.presenceByGame : {},
  };
}

function readPlanHistory() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.planHistory);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(normalizePlanHistoryEntry)
      .filter(Boolean)
      .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
      .slice(0, PLAN_HISTORY_LIMIT);
  } catch {
    return [];
  }
}

export function PlanProvider({ children }) {
  const navigate = useNavigate();
  const setup = useSetup();
  const gamesCtx = useGames();
  const strictGoogleRouting = isGoogleRoutingStrictMode();

  const [plan, setPlan] = useState("");
  const [pdfExporting, setPdfExporting] = useState(false);
  const [routeOverview, setRouteOverview] = useState(null);
  const [routeDirectOptions, setRouteDirectOptions] = useState([]);
  const [routeCalculating, setRouteCalculating] = useState(false);
  const [planHistory, setPlanHistory] = useState(() => readPlanHistory());
  const [activeHistoryId, setActiveHistoryId] = useState("");
  const suspendNextPlanResetRef = useRef(false);

  const cfg = useMemo(
    () => ({
      kreisLabel: setup.kreisLabel ?? setup.kreis?.label ?? "",
      jugendLabel: setup.jugend?.label ?? "",
      jugendAlter: setup.jugend?.alter ?? "",
      fromDate: setup.fromDate,
      toDate: setup.toDate,
      startLocationLabel: setup.startLocation?.label ?? "",
    }),
    [setup.kreisLabel, setup.kreis, setup.jugend, setup.fromDate, setup.toDate, setup.startLocation],
  );

  const effectivePlannedGames = useMemo(() => {
    const selectedGames = Array.isArray(gamesCtx.plannedGames) ? gamesCtx.plannedGames : [];
    if (selectedGames.length > 0) {
      return selectedGames;
    }
    return Array.isArray(gamesCtx.games) ? gamesCtx.games : [];
  }, [gamesCtx.plannedGames, gamesCtx.games]);

  const routeGames = useMemo(() => {
    return [...effectivePlannedGames]
      .sort((a, b) => {
        const ad = a?.dateObj instanceof Date ? a.dateObj.getTime() : Number.MAX_SAFE_INTEGER;
        const bd = b?.dateObj instanceof Date ? b.dateObj.getTime() : Number.MAX_SAFE_INTEGER;
        if (ad !== bd) {
          return ad - bd;
        }
        return toSortableKickoff(a.time).localeCompare(toSortableKickoff(b.time));
      });
  }, [effectivePlannedGames]);

  const routePreviewGames = useMemo(() => routeGames.slice(0, 5), [routeGames]);

  useEffect(() => {
    let alive = true;
    const expectedDirectCount = routePreviewGames.length;

    if (!setup.startLocation || routePreviewGames.length === 0) {
      setRouteOverview(null);
      setRouteDirectOptions([]);
      setRouteCalculating(false);
      return () => {
        alive = false;
      };
    }

    if (strictGoogleRouting) {
      setRouteOverview(null);
    } else {
      const fallback = calculateRoute(setup.startLocation, routePreviewGames);
      setRouteOverview(fallback);
    }
    setRouteCalculating(true);

    void Promise.all([
      withTimeout(calculateRouteWithDriving(setup.startLocation, routePreviewGames), ROUTE_TIMEOUT_MS, null),
      withTimeout(
        calculateDirectStartRoutes(setup.startLocation, routePreviewGames, expectedDirectCount),
        ROUTE_TIMEOUT_MS,
        [],
      ),
    ])
      .then(([routed, direct]) => {
        if (!alive) {
          return;
        }
        if (routed) {
          setRouteOverview(routed);
        }
        setRouteDirectOptions(Array.isArray(direct) ? direct : []);
      })
      .catch(() => {})
      .finally(() => {
        if (!alive) {
          return;
        }
        setRouteCalculating(false);
      });

    return () => {
      alive = false;
    };
  }, [setup.startLocation, routePreviewGames, strictGoogleRouting]);

  useEffect(() => {
    if (suspendNextPlanResetRef.current) {
      suspendNextPlanResetRef.current = false;
      return;
    }
    setPlan("");
    setActiveHistoryId("");
  }, [gamesCtx.games, gamesCtx.selectedGameCount]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(STORAGE_KEYS.planHistory, JSON.stringify(planHistory));
    } catch {
      // Ignore localStorage write errors for optional history.
    }
  }, [planHistory]);

  const activeHistoryEntry = useMemo(
    () => planHistory.find((entry) => entry.id === activeHistoryId) || null,
    [planHistory, activeHistoryId],
  );

  const onOpenPlanHistory = useCallback(
    (entryId) => {
      const id = String(entryId || "").trim();
      if (!id) {
        return;
      }

      const entry = planHistory.find((item) => item.id === id);
      if (!entry) {
        return;
      }

      const restoredGames = (Array.isArray(entry.games) ? entry.games : []).map(deserializeGameFromHistory);
      suspendNextPlanResetRef.current = true;
      gamesCtx.setGames(restoredGames);
      gamesCtx.setDataSourceUsed("history");
      gamesCtx.onRestorePlannedGames(entry.selectedGameIds);
      setup.setErr("");
      setPlan(String(entry.planText || ""));
      setActiveHistoryId(entry.id);
      navigate("/plan");
    },
    [gamesCtx, navigate, planHistory, setup],
  );

  const onDeletePlanHistory = useCallback((entryId) => {
    const id = String(entryId || "").trim();
    if (!id) {
      return;
    }

    setPlanHistory((prev) => prev.filter((entry) => entry.id !== id));
    setActiveHistoryId((prev) => (prev === id ? "" : prev));
  }, []);

  const onClearPlanHistory = useCallback(() => {
    setPlanHistory([]);
    setActiveHistoryId("");
  }, []);

  const onUpdatePlanHistoryPresence = useCallback((entryId, presenceByGame) => {
    const id = String(entryId || "").trim();
    if (!id || !presenceByGame || typeof presenceByGame !== "object") {
      return;
    }

    setPlanHistory((prev) =>
      prev.map((entry) => {
        if (entry.id !== id) {
          return entry;
        }
        return {
          ...entry,
          presenceByGame,
        };
      }),
    );
  }, []);

  const onUpdatePlanHistoryGames = useCallback((entryId, games) => {
    const id = String(entryId || "").trim();
    if (!id || !Array.isArray(games)) {
      return;
    }

    const serializedGames = games.map(serializeGameForHistory);
    setPlanHistory((prev) =>
      prev.map((entry) => {
        if (entry.id !== id) {
          return entry;
        }
        return {
          ...entry,
          games: serializedGames,
        };
      }),
    );
  }, []);

  const onGeneratePlanPdf = useCallback(async () => {
    if (pdfExporting) {
      return;
    }

    setup.setErr("");
    setPdfExporting(true);

    try {
      if (String(plan || "").trim()) {
        navigate("/plan");
        return;
      }

      if (!Array.isArray(effectivePlannedGames) || effectivePlannedGames.length === 0) {
        setup.setErr("Keine Spiele für den Plan verfügbar.");
        navigate("/games");
        return;
      }

      const selectedGames = Array.isArray(gamesCtx.plannedGames) ? gamesCtx.plannedGames : [];
      const usedFallbackAll = selectedGames.length === 0;

      const manualPlan = buildManualScoutPlan({
        games: effectivePlannedGames,
        jugendLabel: setup.jugend?.label,
        kreisLabel: setup.kreisLabel || setup.kreis?.label,
        isTurnier: Boolean(setup.jugend?.turnier),
        usedFallbackAll,
      });

      const nowIso = new Date().toISOString();
      const historyId = `plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const historyEntry = normalizePlanHistoryEntry({
        id: historyId,
        createdAt: nowIso,
        planText: manualPlan,
        games: effectivePlannedGames.map(serializeGameForHistory),
        selectedGameIds: usedFallbackAll ? [] : selectedGames.map((game) => String(game?.id || "").trim()).filter(Boolean),
        meta: {
          kreisLabel: setup.kreisLabel || setup.kreis?.label || "",
          jugendLabel: setup.jugend?.label || "",
          fromDate: setup.fromDate || "",
          toDate: setup.toDate || "",
          startLocationLabel: setup.startLocation?.label || "",
          scoutName: setup.scoutName || "",
          kmPauschale: setup.kmPauschale,
        },
        syncContext: {
          source: String(gamesCtx.dataSourceUsed || ""),
          adapterEndpoint: String(setup.adapterEndpoint || ""),
          adapterToken: String(setup.adapterToken || ""),
          kreisId: String(setup.kreisId || ""),
          kreisIds: Array.isArray(setup.kreisIds) ? setup.kreisIds : [],
          jugendId: String(setup.jugendId || ""),
          fromDate: String(setup.fromDate || ""),
          toDate: String(setup.toDate || ""),
          teams: Array.isArray(setup.activeTeams) ? setup.activeTeams : [],
          turnier: Boolean(setup.jugend?.turnier),
        },
      });

      if (historyEntry) {
        setPlanHistory((prev) => [historyEntry, ...prev.filter((entry) => entry.id !== historyEntry.id)].slice(0, PLAN_HISTORY_LIMIT));
        setActiveHistoryId(historyEntry.id);
      }

      setPlan(manualPlan);
      navigate("/plan");
    } finally {
      setPdfExporting(false);
    }
  }, [
    pdfExporting,
    plan,
    gamesCtx.plannedGames,
    gamesCtx.dataSourceUsed,
    effectivePlannedGames,
    navigate,
    setup,
  ]);

  const onBackGames = useCallback(() => {
    navigate("/games");
  }, [navigate]);

  const onResetSoft = useCallback(() => {
    gamesCtx.resetGames();
    setPlan("");
    setActiveHistoryId("");
    setup.setTeamValidation(null);
    setup.setErr("");
    navigate("/setup");
  }, [gamesCtx, setup, navigate]);

  const onResetHard = useCallback(() => {
    onResetSoft();
    setup.resetSetupState();
  }, [onResetSoft, setup]);

  const value = useMemo(
    () => ({
      plan,
      pdfExporting,
      routeDirectOptions,
      routeCalculating,
      cfg,
      routeOverview,
      planHistory,
      activeHistoryEntry,
      setPlan,
      onGeneratePlanPdf,
      onOpenPlanHistory,
      onDeletePlanHistory,
      onClearPlanHistory,
      onUpdatePlanHistoryPresence,
      onUpdatePlanHistoryGames,
      onBackGames,
      onResetSoft,
      onResetHard,
    }),
    [
      plan,
      pdfExporting,
      routeDirectOptions,
      routeCalculating,
      cfg,
      routeOverview,
      planHistory,
      activeHistoryEntry,
      onGeneratePlanPdf,
      onOpenPlanHistory,
      onDeletePlanHistory,
      onClearPlanHistory,
      onUpdatePlanHistoryPresence,
      onUpdatePlanHistoryGames,
      onBackGames,
      onResetSoft,
      onResetHard,
    ],
  );

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan() {
  const context = useContext(PlanContext);
  if (!context) {
    throw new Error("usePlan muss innerhalb von PlanProvider verwendet werden.");
  }
  return context;
}
