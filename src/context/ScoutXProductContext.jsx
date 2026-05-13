import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { STORAGE_KEYS } from "../config/storage";
import {
  fetchTeamBackendState,
  getTeamBackendStatus,
  linkTeamBackendObservationReport,
  loginTeamBackend,
  logoutTeamBackend,
  markTeamBackendObservationSeen,
  publishTeamBackendPlan,
  registerTeamBackend,
  updateTeamBackendObservationNote,
  updateTeamBackendGoals,
  upsertTeamBackendMember,
  upsertTeamBackendManualGame,
} from "../services/teamBackendClient";
import {
  addReportComment,
  addWatchlistEntry,
  attachReportAnalysis,
  buildCalendarModel,
  buildGameObservationMap,
  buildGlobalSearchResults,
  buildPlayerProfiles,
  buildScoutingDashboard,
  buildTeamFeed,
  buildTeamOverview,
  comparePlayers,
  createAssignment,
  createInitialProductState,
  createObservationMatchReport,
  createWatchlist,
  deleteSearchFilter,
  exportProductSnapshot,
  getActiveUser,
  markGameObservationSeen,
  markNotificationRead,
  normalizeProductState,
  publishTeamPlan,
  removeWatchlistEntry,
  saveSearchFilter,
  switchActiveUser,
  updateTeamGoals,
  updateAssignmentStatus,
  updateObservationNote,
  updateReportStatus,
  updateWatchlistEntry,
  upsertManualGame,
  upsertTeamAccount,
  upsertReport,
} from "../services/scoutxDomain";

const ScoutXProductContext = createContext(null);
const TEAM_PLAN_PUBLISHED_EVENT = "scoutx:team-plan-published";

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

function mergeTeamBackendPayload(prevState, payload, options = {}) {
  if (!payload || payload.ok === false) {
    return prevState;
  }

  const team = payload.team && typeof payload.team === "object" ? payload.team : prevState.team;
  const accounts = Array.isArray(team?.accounts) ? team.accounts : [];
  const users = accounts.length
    ? accounts.map((account) => ({
        id: account.id,
        name: account.name,
        role: account.role,
        teamId: account.teamId,
        active: account.active !== false,
      }))
    : prevState.users;
  const feedItems = Array.isArray(payload.feedItems) ? payload.feedItems : prevState.feedItems;
  const existingNotificationIds = new Set((prevState.notifications || []).map((notification) => notification.id));
  const feedNotifications = (Array.isArray(payload.feedItems) ? payload.feedItems : [])
    .map((item) => ({
      id: `notif-${item.id}`,
      type: "team_feed",
      title: item.type === "plan_published" ? "Team-Plan veröffentlicht" : item.title || "Team-Aktivität",
      body: item.body || item.title || "",
      entityType: "team_feed",
      entityId: item.id,
      recipientId: "",
      createdAt: item.createdAt || new Date(0).toISOString(),
      readAt: "",
    }))
    .filter((notification) => notification.id && !existingNotificationIds.has(notification.id));

  return normalizeProductState({
    ...prevState,
    users,
    activeUserId: options.switchUser === false ? prevState.activeUserId : payload.user?.id || prevState.activeUserId,
    team,
    manualGames: Array.isArray(payload.manualGames) ? payload.manualGames : prevState.manualGames,
    teamGoals: payload.teamGoals && typeof payload.teamGoals === "object" ? payload.teamGoals : prevState.teamGoals,
    observations: Array.isArray(payload.observations) ? payload.observations : prevState.observations,
    feedItems,
    notifications: [...feedNotifications, ...(prevState.notifications || [])],
  });
}

function createPersistableProductState(state, backendStatus) {
  const normalized = normalizeProductState(state);
  if (backendStatus !== "connected") {
    return normalized;
  }

  const fallback = createInitialProductState();
  return normalizeProductState({
    ...normalized,
    team: fallback.team,
    manualGames: [],
    teamGoals: fallback.teamGoals,
    observations: [],
    feedItems: [],
  });
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
    setTeamBackendState({ status: "connected", error: "" });
    setState((prev) => mergeTeamBackendPayload(prev, payload, options));
  }, []);

  const onLoginTeamBackend = useCallback(
    async (userId, password, options = {}) => {
      try {
        const payload = await loginTeamBackend(userId, password);
        applyTeamBackendPayload(payload, options);
        setProductError("");
        return payload;
      } catch (error) {
        const message = error?.message || "Team-Backend-Anmeldung fehlgeschlagen.";
        setTeamBackendState({ status: "auth_error", error: message });
        setProductError(message);
        throw error;
      }
    },
    [applyTeamBackendPayload],
  );

  const onRegisterTeamBackend = useCallback(
    async (userId, name, password, teamKey, options = {}) => {
      try {
        const payload = await registerTeamBackend(userId, name, password, teamKey);
        applyTeamBackendPayload(payload, options);
        setProductError("");
        return payload;
      } catch (error) {
        const message = error?.message || "Team-Registrierung fehlgeschlagen.";
        setTeamBackendState({ status: "auth_error", error: message });
        setProductError(message);
        throw error;
      }
    },
    [applyTeamBackendPayload],
  );

  const onLogoutTeamBackend = useCallback(async () => {
    try {
      await logoutTeamBackend();
    } finally {
      setTeamBackendState({ status: "auth_required", error: "Abgemeldet. Bitte erneut anmelden." });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!getTeamBackendStatus().enabled) {
      return () => {
        cancelled = true;
      };
    }

    fetchTeamBackendState()
      .then((payload) => {
        if (!cancelled) {
          applyTeamBackendPayload(payload, { switchUser: false });
        }
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        const message =
          error?.status === 401
            ? "Team-Backend bereit. Bitte mit Team-Passwort anmelden, damit Teamdaten synchronisiert werden."
            : error?.message || "Team-Backend nicht verbunden. Lokale Änderungen werden nicht teamweit synchronisiert.";
        setTeamBackendState({ status: error?.status === 401 ? "auth_required" : "local", error: message });
        setProductError(message);
      });

    return () => {
      cancelled = true;
    };
  }, [applyTeamBackendPayload]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const onTeamPlanPublished = (event) => {
      const detail = event?.detail && typeof event.detail === "object" ? event.detail : {};
      setProductError("");
      if (teamBackendState.status === "connected") {
        publishTeamBackendPlan(detail)
          .then((payload) => applyTeamBackendPayload(payload, { switchUser: false }))
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
    };

    window.addEventListener(TEAM_PLAN_PUBLISHED_EVENT, onTeamPlanPublished);
    return () => window.removeEventListener(TEAM_PLAN_PUBLISHED_EVENT, onTeamPlanPublished);
  }, [applyTeamBackendPayload, teamBackendState.status]);

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

  const onPublishTeamPlan = useCallback(
    (input) => {
      setProductError("");
      if (teamBackendState.status === "connected") {
        publishTeamBackendPlan(input)
          .then((payload) => applyTeamBackendPayload(payload, { switchUser: false }))
          .catch((error) => {
            const message = error?.message || "Team-Plan konnte nicht im Backend gespeichert werden.";
            setProductError(message);
            setTeamBackendState({ status: "local", error: message });
          });
        return;
      }
      setState((prev) => {
        try {
          return publishTeamPlan(prev, input, getActiveUser(prev));
        } catch (error) {
          setProductError(error?.message || "Team-Plan konnte nicht veröffentlicht werden.");
          return prev;
        }
      });
    },
    [applyTeamBackendPayload, teamBackendState.status],
  );

  const onMarkGameSeen = useCallback(
    (gameId, scoutId) => {
      setProductError("");
      if (teamBackendState.status === "connected") {
        markTeamBackendObservationSeen({ gameId, scoutId })
          .then((payload) => applyTeamBackendPayload(payload, { switchUser: false }))
          .catch((error) => {
            const message = error?.message || "Sichtung konnte nicht im Backend gespeichert werden.";
            setProductError(message);
            setTeamBackendState({ status: "local", error: message });
          });
        return;
      }
      setState((prev) => {
        try {
          return markGameObservationSeen(prev, gameId, scoutId, getActiveUser(prev));
        } catch (error) {
          setProductError(error?.message || "Sichtung konnte nicht aktualisiert werden.");
          return prev;
        }
      });
    },
    [applyTeamBackendPayload, teamBackendState.status],
  );

  const onCreateObservationMatchReport = useCallback(
    (observationId) => {
      setProductError("");
      const observation = (state.observations || []).find((item) => item.id === observationId);
      if (!observation) {
        setProductError("Sichtung wurde nicht gefunden.");
        return;
      }

      if (teamBackendState.status === "connected") {
        const reportId = observation.reportId || `report-${observation.id}`;
        linkTeamBackendObservationReport({
          observationId,
          reportId,
          reportUrl: `#reports/${reportId}`,
        })
          .then((payload) => {
            setState((prev) => {
              try {
                return createObservationMatchReport(prev, observationId, getActiveUser(prev));
              } catch {
                return prev;
              }
            });
            applyTeamBackendPayload(payload, { switchUser: false });
          })
          .catch((error) => {
            const message = error?.message || "Bericht konnte nicht im Backend verknüpft werden.";
            setProductError(message);
            setTeamBackendState({ status: "local", error: message });
          });
        return;
      }

      let nextState = state;
      try {
        nextState = createObservationMatchReport(state, observationId, activeUser);
      } catch (error) {
        setProductError(error?.message || "Spielbericht konnte nicht angelegt werden.");
        return;
      }

      setState(nextState);
    },
    [activeUser, applyTeamBackendPayload, state, teamBackendState.status],
  );

  const onUpdateObservationNote = useCallback(
    (observationId, note) => {
      setProductError("");
      if (teamBackendState.status === "connected") {
        updateTeamBackendObservationNote({ observationId, note })
          .then((payload) => applyTeamBackendPayload(payload, { switchUser: false }))
          .catch((error) => {
            const message = error?.message || "Sichtungsnotiz konnte nicht im Backend gespeichert werden.";
            setProductError(message);
            setTeamBackendState({ status: "local", error: message });
          });
        return;
      }
      setState((prev) => {
        try {
          return updateObservationNote(prev, observationId, note, getActiveUser(prev));
        } catch (error) {
          setProductError(error?.message || "Sichtungsnotiz konnte nicht gespeichert werden.");
          return prev;
        }
      });
    },
    [applyTeamBackendPayload, teamBackendState.status],
  );

  const onUpsertManualGame = useCallback(
    (input) => {
      setProductError("");
      if (teamBackendState.status === "connected") {
        upsertTeamBackendManualGame(input)
          .then((payload) => applyTeamBackendPayload(payload, { switchUser: false }))
          .catch((error) => {
            const message = error?.message || "Manuelles Spiel konnte nicht im Backend gespeichert werden.";
            setProductError(message);
            setTeamBackendState({ status: "local", error: message });
          });
        return;
      }
      setState((prev) => {
        try {
          return upsertManualGame(prev, input, getActiveUser(prev));
        } catch (error) {
          setProductError(error?.message || "Manuelles Spiel konnte nicht gespeichert werden.");
          return prev;
        }
      });
    },
    [applyTeamBackendPayload, teamBackendState.status],
  );

  const onUpdateTeamGoals = useCallback(
    (input) => {
      setProductError("");
      if (teamBackendState.status === "connected") {
        updateTeamBackendGoals(input)
          .then((payload) => applyTeamBackendPayload(payload, { switchUser: false }))
          .catch((error) => {
            const message = error?.message || "Team-Ziele konnten nicht im Backend gespeichert werden.";
            setProductError(message);
            setTeamBackendState({ status: "local", error: message });
          });
        return;
      }
      setState((prev) => {
        try {
          return updateTeamGoals(prev, input, getActiveUser(prev));
        } catch (error) {
          setProductError(error?.message || "Team-Ziele konnten nicht gespeichert werden.");
          return prev;
        }
      });
    },
    [applyTeamBackendPayload, teamBackendState.status],
  );

  const onUpsertTeamAccount = useCallback(
    (input) => {
      setProductError("");
      if (teamBackendState.status === "connected") {
        upsertTeamBackendMember(input)
          .then((payload) => applyTeamBackendPayload(payload, { switchUser: false }))
          .catch((error) => {
            const message = error?.message || "Team-Account konnte nicht im Backend gespeichert werden.";
            setProductError(message);
            setTeamBackendState({ status: "local", error: message });
          });
        return;
      }
      setState((prev) => {
        try {
          return upsertTeamAccount(prev, input, getActiveUser(prev));
        } catch (error) {
          setProductError(error?.message || "Team-Account konnte nicht gespeichert werden.");
          return prev;
        }
      });
    },
    [applyTeamBackendPayload, teamBackendState.status],
  );

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
      onLoginTeamBackend,
      onRegisterTeamBackend,
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
      onLoginTeamBackend,
      onRegisterTeamBackend,
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
