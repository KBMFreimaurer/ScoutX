import { useCallback } from "react";
import {
  linkTeamBackendObservationReport,
  markTeamBackendObservationSeen,
  markTeamNotificationsRead,
  reassignTeamBackendObservation,
  updateTeamBackendObservationNote,
} from "../services/teamBackendClient";
import {
  createObservationMatchReport,
  getActiveUser,
  markGameObservationSeen,
  markNotificationRead,
  reassignObservation,
  updateObservationNote,
} from "../services/scoutxDomain";

export function normalizeNotificationTargetId(notificationId) {
  const normalized = String(notificationId || "").trim();
  return normalized.replace(/^notif-/, "");
}

export function useTeamObservationActions({
  state,
  teamBackendState,
  applyTeamBackendPayload,
  setState,
  setProductError,
  setTeamBackendState,
}) {
  const onMarkNotificationRead = useCallback(
    (notificationId) => {
      if (teamBackendState.status === "connected") {
        const targetId = normalizeNotificationTargetId(notificationId);
        if (targetId) {
          markTeamNotificationsRead([targetId]).catch(() => {
            // Fallback auf lokale Markierung, wenn Backend-Update fehlschlägt.
          });
        }
      }
      setState((prev) => markNotificationRead(prev, notificationId, getActiveUser(prev)));
    },
    [setState, teamBackendState.status],
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
    [applyTeamBackendPayload, setProductError, setState, setTeamBackendState, teamBackendState.status],
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
        nextState = createObservationMatchReport(state, observationId, getActiveUser(state));
      } catch (error) {
        setProductError(error?.message || "Spielbericht konnte nicht angelegt werden.");
        return;
      }

      setState(nextState);
    },
    [applyTeamBackendPayload, setProductError, setState, setTeamBackendState, state, teamBackendState.status],
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
    [applyTeamBackendPayload, setProductError, setState, setTeamBackendState, teamBackendState.status],
  );

  const onReassignObservation = useCallback(
    (observationId, targetScoutId) => {
      setProductError("");
      if (teamBackendState.status === "connected") {
        reassignTeamBackendObservation({ observationId, targetScoutId })
          .then((payload) => applyTeamBackendPayload(payload, { switchUser: false }))
          .catch((error) => {
            const message = error?.message || "Sichtung konnte nicht umverteilt werden.";
            setProductError(message);
            setTeamBackendState({ status: "local", error: message });
          });
        return;
      }
      setState((prev) => {
        try {
          return reassignObservation(prev, observationId, targetScoutId, getActiveUser(prev));
        } catch (error) {
          setProductError(error?.message || "Sichtung konnte nicht umverteilt werden.");
          return prev;
        }
      });
    },
    [applyTeamBackendPayload, setProductError, setState, setTeamBackendState, teamBackendState.status],
  );

  return {
    onMarkNotificationRead,
    onMarkGameSeen,
    onCreateObservationMatchReport,
    onUpdateObservationNote,
    onReassignObservation,
  };
}
