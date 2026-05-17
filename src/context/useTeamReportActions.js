import { useCallback } from "react";
import {
  addReportComment,
  addWatchlistEntry,
  attachReportAnalysis,
  createAssignment,
  createWatchlist,
  getActiveUser,
  removeWatchlistEntry,
  updateAssignmentStatus,
  updateReportStatus,
  updateWatchlistEntry,
  upsertReport,
} from "../services/scoutxDomain";

export function normalizeReportTargetId(reportId) {
  return String(reportId || "").trim();
}

export function useTeamReportActions({ setState, setProductError, setAnalysisStateByReportId }) {
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
    [setProductError, setState],
  );

  const onAnalyzeReport = useCallback(
    (reportId) => {
      const id = normalizeReportTargetId(reportId);
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
    },
    [setAnalysisStateByReportId, setState],
  );

  const onUpdateReportStatus = useCallback(
    (reportId, status) => {
      setProductError("");
      setState((prev) => {
        try {
          return updateReportStatus(prev, reportId, status, getActiveUser(prev));
        } catch (error) {
          setProductError(error?.message || "Berichtsstatus konnte nicht aktualisiert werden.");
          return prev;
        }
      });
    },
    [setProductError, setState],
  );

  const onAddReportComment = useCallback(
    (reportId, body) => {
      setProductError("");
      setState((prev) => {
        try {
          return addReportComment(prev, reportId, body, getActiveUser(prev));
        } catch (error) {
          setProductError(error?.message || "Kommentar konnte nicht gespeichert werden.");
          return prev;
        }
      });
    },
    [setProductError, setState],
  );

  const onCreateWatchlist = useCallback(
    (input) => {
      setProductError("");
      setState((prev) => {
        try {
          return createWatchlist(prev, input, getActiveUser(prev));
        } catch (error) {
          setProductError(error?.message || "Watchlist konnte nicht angelegt werden.");
          return prev;
        }
      });
    },
    [setProductError, setState],
  );

  const onAddWatchlistEntry = useCallback(
    (watchlistId, input) => {
      setProductError("");
      setState((prev) => {
        try {
          return addWatchlistEntry(prev, watchlistId, input, getActiveUser(prev));
        } catch (error) {
          setProductError(error?.message || "Watchlist-Eintrag konnte nicht gespeichert werden.");
          return prev;
        }
      });
    },
    [setProductError, setState],
  );

  const onUpdateWatchlistEntry = useCallback(
    (watchlistId, entryId, input) => {
      setProductError("");
      setState((prev) => {
        try {
          return updateWatchlistEntry(prev, watchlistId, entryId, input, getActiveUser(prev));
        } catch (error) {
          setProductError(error?.message || "Watchlist-Eintrag konnte nicht aktualisiert werden.");
          return prev;
        }
      });
    },
    [setProductError, setState],
  );

  const onRemoveWatchlistEntry = useCallback(
    (watchlistId, entryId) => {
      setProductError("");
      setState((prev) => {
        try {
          return removeWatchlistEntry(prev, watchlistId, entryId, getActiveUser(prev));
        } catch (error) {
          setProductError(error?.message || "Watchlist-Eintrag konnte nicht entfernt werden.");
          return prev;
        }
      });
    },
    [setProductError, setState],
  );

  const onCreateAssignment = useCallback(
    (input) => {
      setProductError("");
      setState((prev) => {
        try {
          return createAssignment(prev, input, getActiveUser(prev));
        } catch (error) {
          setProductError(error?.message || "Aufgabe konnte nicht angelegt werden.");
          return prev;
        }
      });
    },
    [setProductError, setState],
  );

  const onUpdateAssignmentStatus = useCallback(
    (assignmentId, status) => {
      setProductError("");
      setState((prev) => {
        try {
          return updateAssignmentStatus(prev, assignmentId, status, getActiveUser(prev));
        } catch (error) {
          setProductError(error?.message || "Aufgabenstatus konnte nicht aktualisiert werden.");
          return prev;
        }
      });
    },
    [setProductError, setState],
  );

  return {
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
  };
}
