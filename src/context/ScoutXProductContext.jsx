import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { STORAGE_KEYS } from "../config/storage";
import {
  addReportComment,
  addWatchlistEntry,
  attachReportAnalysis,
  buildCalendarModel,
  buildGlobalSearchResults,
  buildPlayerProfiles,
  buildScoutingDashboard,
  comparePlayers,
  createAssignment,
  createInitialProductState,
  createWatchlist,
  deleteSearchFilter,
  exportProductSnapshot,
  getActiveUser,
  markNotificationRead,
  normalizeProductState,
  removeWatchlistEntry,
  saveSearchFilter,
  switchActiveUser,
  updateAssignmentStatus,
  updateReportStatus,
  updateWatchlistEntry,
  upsertReport,
} from "../services/scoutxDomain";

const ScoutXProductContext = createContext(null);

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
  const activeUser = useMemo(() => getActiveUser(state), [state]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(STORAGE_KEYS.productDomain, JSON.stringify(state));
    } catch {
      // Persistenz ist lokal optional; die UI bleibt im Memory-State nutzbar.
    }
  }, [state]);

  const resetProductState = useCallback(() => {
    setState(createInitialProductState());
    setAnalysisStateByReportId({});
  }, []);

  const onSwitchUser = useCallback((userId) => {
    setProductError("");
    setState((prev) => switchActiveUser(prev, userId));
  }, []);

  const onUpsertReport = useCallback(
    (input) => {
      setProductError("");
      setState((prev) => {
        try {
          return upsertReport(prev, input, getActiveUser(prev));
        } catch (error) {
          setProductError(error?.message || "Bericht konnte nicht gespeichert werden.");
          return prev;
        }
      });
    },
    [],
  );

  const onAnalyzeReport = useCallback((reportId) => {
    const id = String(reportId || "").trim();
    if (!id) {
      return;
    }

    setAnalysisStateByReportId((prev) => ({
      ...prev,
      [id]: { status: "loading", error: "" },
    }));

    window.setTimeout(() => {
      setState((prev) => {
        try {
          const next = attachReportAnalysis(prev, id, getActiveUser(prev));
          setAnalysisStateByReportId((statusPrev) => ({
            ...statusPrev,
            [id]: { status: "complete", error: "" },
          }));
          return next;
        } catch (error) {
          setAnalysisStateByReportId((statusPrev) => ({
            ...statusPrev,
            [id]: { status: "error", error: error?.message || "Analyse fehlgeschlagen." },
          }));
          return prev;
        }
      });
    }, 280);
  }, []);

  const onUpdateReportStatus = useCallback((reportId, status) => {
    setProductError("");
    setState((prev) => {
      try {
        return updateReportStatus(prev, reportId, status, getActiveUser(prev));
      } catch (error) {
        setProductError(error?.message || "Berichtsstatus konnte nicht aktualisiert werden.");
        return prev;
      }
    });
  }, []);

  const onAddReportComment = useCallback((reportId, body) => {
    setProductError("");
    setState((prev) => {
      try {
        return addReportComment(prev, reportId, body, getActiveUser(prev));
      } catch (error) {
        setProductError(error?.message || "Kommentar konnte nicht gespeichert werden.");
        return prev;
      }
    });
  }, []);

  const onCreateWatchlist = useCallback((input) => {
    setProductError("");
    setState((prev) => {
      try {
        return createWatchlist(prev, input, getActiveUser(prev));
      } catch (error) {
        setProductError(error?.message || "Watchlist konnte nicht angelegt werden.");
        return prev;
      }
    });
  }, []);

  const onAddWatchlistEntry = useCallback((watchlistId, input) => {
    setProductError("");
    setState((prev) => {
      try {
        return addWatchlistEntry(prev, watchlistId, input, getActiveUser(prev));
      } catch (error) {
        setProductError(error?.message || "Watchlist-Eintrag konnte nicht gespeichert werden.");
        return prev;
      }
    });
  }, []);

  const onUpdateWatchlistEntry = useCallback((watchlistId, entryId, input) => {
    setProductError("");
    setState((prev) => {
      try {
        return updateWatchlistEntry(prev, watchlistId, entryId, input, getActiveUser(prev));
      } catch (error) {
        setProductError(error?.message || "Watchlist-Eintrag konnte nicht aktualisiert werden.");
        return prev;
      }
    });
  }, []);

  const onRemoveWatchlistEntry = useCallback((watchlistId, entryId) => {
    setProductError("");
    setState((prev) => {
      try {
        return removeWatchlistEntry(prev, watchlistId, entryId, getActiveUser(prev));
      } catch (error) {
        setProductError(error?.message || "Watchlist-Eintrag konnte nicht entfernt werden.");
        return prev;
      }
    });
  }, []);

  const onCreateAssignment = useCallback((input) => {
    setProductError("");
    setState((prev) => {
      try {
        return createAssignment(prev, input, getActiveUser(prev));
      } catch (error) {
        setProductError(error?.message || "Aufgabe konnte nicht angelegt werden.");
        return prev;
      }
    });
  }, []);

  const onUpdateAssignmentStatus = useCallback((assignmentId, status) => {
    setProductError("");
    setState((prev) => {
      try {
        return updateAssignmentStatus(prev, assignmentId, status, getActiveUser(prev));
      } catch (error) {
        setProductError(error?.message || "Aufgabenstatus konnte nicht aktualisiert werden.");
        return prev;
      }
    });
  }, []);

  const onMarkNotificationRead = useCallback((notificationId) => {
    setState((prev) => markNotificationRead(prev, notificationId, getActiveUser(prev)));
  }, []);

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
      analysisStateByReportId,
      resetProductState,
      clearProductError: () => setProductError(""),
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
      onSaveSearchFilter,
      onDeleteSearchFilter,
      getDashboard,
      search,
      getPlayerProfiles,
      getPlayerComparison,
      getCalendar,
      exportSnapshot,
    }),
    [
      state,
      activeUser,
      productError,
      analysisStateByReportId,
      resetProductState,
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
      onSaveSearchFilter,
      onDeleteSearchFilter,
      getDashboard,
      search,
      getPlayerProfiles,
      getPlayerComparison,
      getCalendar,
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
