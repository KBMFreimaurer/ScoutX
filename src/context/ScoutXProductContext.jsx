import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { STORAGE_KEYS } from "../config/storage";
import {
  fetchTeamBackendState,
  getTeamBackendStatus,
  logoutTeamBackend,
  publishTeamBackendPlan,
} from "../services/teamBackendClient";
import {
  buildCalendarModel,
  buildGameObservationMap,
  buildGlobalSearchResults,
  buildPlayerProfiles,
  buildScoutingDashboard,
  buildTeamFeed,
  buildTeamOverview,
  comparePlayers,
  createInitialProductState,
  deleteSearchFilter,
  exportProductSnapshot,
  getActiveUser,
  normalizeProductState,
  publishTeamPlan,
  saveSearchFilter,
  switchActiveUser,
} from "../services/scoutxDomain";
import { createPersistableProductState, mergeTeamBackendPayload } from "./teamBackendStateSync";
import { useTeamObservationActions } from "./useTeamObservationActions";
import { useTeamPlanningActions } from "./useTeamPlanningActions";
import { useTeamReportActions } from "./useTeamReportActions";

const ScoutXProductContext = createContext(null);
const TEAM_PLAN_PUBLISHED_EVENT = "scoutx:team-plan-published";
const TEAM_SYNC_BROADCAST_KEY = "scoutx.team.sync.v1";
const TEAM_PLAN_HISTORY_PRUNED_EVENT = "scoutx:team-plan-history-pruned";

function readProductState() {
  if (typeof window === "undefined") {
    return createInitialProductState();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.productDomain);
    if (!raw) {
      return createInitialProductState();
    }
    return normalizeProductState(JSON.parse(raw));
  } catch {
    return createInitialProductState();
  }
}

export function ScoutXProductProvider({ children }) {
  const [state, setState] = useState(() => readProductState());
  const [analysisStateByReportId, setAnalysisStateByReportId] = useState({});
  const [productError, setProductError] = useState("");
  const [teamBackendState, setTeamBackendState] = useState({ status: "local", error: "" });
  const initialUserIdRef = useRef("");
  const activeUser = useMemo(() => getActiveUser(state), [state]);

  if (!initialUserIdRef.current) {
    initialUserIdRef.current = activeUser.id;
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(
        STORAGE_KEYS.productDomain,
        JSON.stringify(createPersistableProductState(state, teamBackendState.status)),
      );
    } catch {
      // Persistenz ist lokal optional; die UI bleibt im Memory-State nutzbar.
    }
  }, [state, teamBackendState.status]);

  const applyTeamBackendPayload = useCallback((payload, options = {}) => {
    const status = String(payload?.status || "connected").trim() || "connected";
    setTeamBackendState({ status, error: payload?.error || "" });
    setState((prev) => mergeTeamBackendPayload(prev, payload, options));
  }, []);

  const refreshTeamBackendState = useCallback(async () => {
    const payload = await fetchTeamBackendState();
    applyTeamBackendPayload(payload, { switchUser: false });
    return payload;
  }, [applyTeamBackendPayload]);

  const onLogoutTeamBackend = useCallback(async () => {
    try {
      await logoutTeamBackend();
    } finally {
      setTeamBackendState({ status: "local", error: "" });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!getTeamBackendStatus().enabled) {
      return () => {
        cancelled = true;
      };
    }

    refreshTeamBackendState()
      .then((payload) => {
        if (!cancelled) {
          applyTeamBackendPayload(payload, { switchUser: false });
        }
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        const isAuthMissing = error?.status === 401;
        const message = isAuthMissing ? "" : error?.message || "Team-Backend nicht verbunden. Lokale Änderungen werden nicht teamweit synchronisiert.";
        setTeamBackendState({ status: "local", error: message });
        if (!isAuthMissing) {
          setProductError(message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applyTeamBackendPayload, refreshTeamBackendState]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    if (teamBackendState.status !== "connected") {
      return undefined;
    }

    let active = true;
    const syncFromBackend = () =>
      refreshTeamBackendState().catch(() => {
        if (!active) {
          return;
        }
      });

    const interval = window.setInterval(syncFromBackend, 15000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void syncFromBackend();
      }
    };
    const onStorage = (event) => {
      if (event?.key === TEAM_SYNC_BROADCAST_KEY) {
        void syncFromBackend();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("storage", onStorage);
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("storage", onStorage);
    };
  }, [refreshTeamBackendState, teamBackendState.status]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const onTeamPlanPublished = (event) => {
      const detail = event?.detail && typeof event.detail === "object" ? event.detail : {};
      setProductError("");
      if (teamBackendState.status === "connected") {
        publishTeamBackendPlan(detail)
          .then((payload) => {
            applyTeamBackendPayload(payload, { switchUser: false });
            try {
              window.localStorage.setItem(
                TEAM_SYNC_BROADCAST_KEY,
                JSON.stringify({ at: new Date().toISOString(), source: "plan_published" }),
              );
            } catch {
              // Ignore broadcast failures; local state already updated.
            }
          })
          .catch((error) => {
            const message = error?.message || "Team-Feed konnte nicht im Backend aktualisiert werden.";
            setProductError(message);
            setTeamBackendState({ status: "local", error: message });
          });
        return;
      }
      setState((prev) => {
        try {
          return publishTeamPlan(prev, detail, getActiveUser(prev));
        } catch (error) {
          setProductError(error?.message || "Team-Feed konnte nicht aktualisiert werden.");
          return prev;
        }
      });
      setProductError("Team-Plan nur lokal gespeichert. Bitte im Team-Backend anmelden für teamweite Synchronisation.");
    };

    window.addEventListener(TEAM_PLAN_PUBLISHED_EVENT, onTeamPlanPublished);
    return () => window.removeEventListener(TEAM_PLAN_PUBLISHED_EVENT, onTeamPlanPublished);
  }, [applyTeamBackendPayload, teamBackendState.status]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const onPlanHistoryPruned = (event) => {
      const detail = event?.detail && typeof event.detail === "object" ? event.detail : {};
      const mode = String(detail.mode || "").trim();
      const targetPlanHistoryId = String(detail.planHistoryId || "").trim();
      setState((prev) => {
        const current = Array.isArray(prev?.observations) ? prev.observations : [];
        const nextObservations =
          mode === "all"
            ? current.filter((observation) => observation?.status !== "planned")
            : mode === "single" && targetPlanHistoryId
              ? current.filter(
                  (observation) =>
                    !(observation?.status === "planned" && String(observation?.planHistoryId || "").trim() === targetPlanHistoryId),
                )
              : current;
        if (nextObservations.length === current.length) {
          return prev;
        }
        return {
          ...prev,
          observations: nextObservations,
        };
      });
    };

    window.addEventListener(TEAM_PLAN_HISTORY_PRUNED_EVENT, onPlanHistoryPruned);
    return () => window.removeEventListener(TEAM_PLAN_HISTORY_PRUNED_EVENT, onPlanHistoryPruned);
  }, []);

  const resetProductState = useCallback(() => {
    setState(createInitialProductState());
    setAnalysisStateByReportId({});
  }, []);

  const onSwitchUser = useCallback(
    (userId) => {
      setProductError("");
      setState((prev) => switchActiveUser(prev, userId));
    },
    [],
  );

  const {
    onUpsertReport,
    onAnalyzeReport,
    onUpdateReportStatus,
    onAddReportComment,
    onCreateWatchlist,
    onAddWatchlistEntry,
    onUpdateWatchlistEntry,
    onRemoveWatchlistEntry,
    onCreateAssignment,
    onUpdateAssignmentStatus,
  } = useTeamReportActions({
    setState,
    setProductError,
    setAnalysisStateByReportId,
  });

  const { onMarkNotificationRead, onMarkGameSeen, onCreateObservationMatchReport, onUpdateObservationNote, onReassignObservation } =
    useTeamObservationActions({
      state,
      teamBackendState,
      applyTeamBackendPayload,
      setState,
      setProductError,
      setTeamBackendState,
    });

  const { onPublishTeamPlan, onUpsertManualGame, onUpdateTeamGoals, onUpsertTeamAccount } = useTeamPlanningActions({
    teamBackendState,
    applyTeamBackendPayload,
    setState,
    setProductError,
    setTeamBackendState,
  });

  const onSaveSearchFilter = useCallback((input) => {
    setProductError("");
    setState((prev) => {
      try {
        return saveSearchFilter(prev, input, getActiveUser(prev));
      } catch (error) {
        setProductError(error?.message || "Filter konnte nicht gespeichert werden.");
        return prev;
      }
    });
  }, []);

  const onDeleteSearchFilter = useCallback((filterId) => {
    setState((prev) => deleteSearchFilter(prev, filterId, getActiveUser(prev)));
  }, []);

  const getDashboard = useCallback(
    () =>
      buildScoutingDashboard({
        state,
        user: activeUser,
      }),
    [activeUser, state],
  );

  const search = useCallback(
    (options = {}) =>
      buildGlobalSearchResults({
        ...options,
        state,
        user: activeUser,
      }),
    [activeUser, state],
  );

  const getPlayerProfiles = useCallback(
    (options = {}) =>
      buildPlayerProfiles({
        ...options,
        state,
        user: activeUser,
      }),
    [activeUser, state],
  );

  const getPlayerComparison = useCallback((profiles, leftKey, rightKey) => comparePlayers(profiles, leftKey, rightKey), []);

  const getCalendar = useCallback((assignments, options = {}) => buildCalendarModel(assignments, options), []);

  const getGameObservationMap = useCallback(
    (options = {}) =>
      buildGameObservationMap(state, {
        user: activeUser,
        ...options,
      }),
    [activeUser, state],
  );

  const getTeamFeed = useCallback(
    (options = {}) =>
      buildTeamFeed(state, {
        user: activeUser,
        ...options,
      }),
    [activeUser, state],
  );

  const getTeamOverview = useCallback(
    (options = {}) =>
      buildTeamOverview(state, {
        user: activeUser,
        ...options,
      }),
    [activeUser, state],
  );

  const exportSnapshot = useCallback(
    (options = {}) =>
      exportProductSnapshot({
        ...options,
        state,
        user: activeUser,
      }),
    [activeUser, state],
  );

  const value = useMemo(
    () => ({
      productState: state,
      activeUser,
      productError,
      teamBackendState,
      analysisStateByReportId,
      resetProductState,
      clearProductError: () => setProductError(""),
      onLogoutTeamBackend,
      onSwitchUser,
      onUpsertReport,
      onAnalyzeReport,
      onUpdateReportStatus,
      onAddReportComment,
      onCreateWatchlist,
      onAddWatchlistEntry,
      onUpdateWatchlistEntry,
      onRemoveWatchlistEntry,
      onCreateAssignment,
      onUpdateAssignmentStatus,
      onMarkNotificationRead,
      onPublishTeamPlan,
      onMarkGameSeen,
      onCreateObservationMatchReport,
      onUpdateObservationNote,
      onReassignObservation,
      onUpsertManualGame,
      onUpdateTeamGoals,
      onUpsertTeamAccount,
      onSaveSearchFilter,
      onDeleteSearchFilter,
      getDashboard,
      search,
      getPlayerProfiles,
      getPlayerComparison,
      getCalendar,
      getGameObservationMap,
      getTeamFeed,
      getTeamOverview,
      exportSnapshot,
    }),
    [
      state,
      activeUser,
      productError,
      teamBackendState,
      analysisStateByReportId,
      resetProductState,
      onLogoutTeamBackend,
      onSwitchUser,
      onUpsertReport,
      onAnalyzeReport,
      onUpdateReportStatus,
      onAddReportComment,
      onCreateWatchlist,
      onAddWatchlistEntry,
      onUpdateWatchlistEntry,
      onRemoveWatchlistEntry,
      onCreateAssignment,
      onUpdateAssignmentStatus,
      onMarkNotificationRead,
      onPublishTeamPlan,
      onMarkGameSeen,
      onCreateObservationMatchReport,
      onUpdateObservationNote,
      onReassignObservation,
      onUpsertManualGame,
      onUpdateTeamGoals,
      onUpsertTeamAccount,
      onSaveSearchFilter,
      onDeleteSearchFilter,
      getDashboard,
      search,
      getPlayerProfiles,
      getPlayerComparison,
      getCalendar,
      getGameObservationMap,
      getTeamFeed,
      getTeamOverview,
      exportSnapshot,
    ],
  );

  return <ScoutXProductContext.Provider value={value}>{children}</ScoutXProductContext.Provider>;
}

export function useScoutXProduct() {
  const context = useContext(ScoutXProductContext);
  if (!context) {
    throw new Error("useScoutXProduct muss innerhalb von ScoutXProductProvider verwendet werden.");
  }
  return context;
}
