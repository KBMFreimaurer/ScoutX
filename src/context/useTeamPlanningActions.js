import { useCallback } from "react";
import {
  publishTeamBackendPlan,
  updateTeamBackendGoals,
  upsertTeamBackendManualGame,
  upsertTeamBackendMember,
} from "../services/teamBackendClient";
import { getActiveUser, publishTeamPlan, updateTeamGoals, upsertManualGame, upsertTeamAccount } from "../services/scoutxDomain";

export function createBackendFallbackState(message) {
  return {
    status: "local",
    error: String(message || "").trim(),
  };
}

export function useTeamPlanningActions({
  teamBackendState,
  applyTeamBackendPayload,
  setState,
  setProductError,
  setTeamBackendState,
}) {
  const onPublishTeamPlan = useCallback(
    (input) => {
      setProductError("");
      if (teamBackendState.status === "connected") {
        publishTeamBackendPlan(input)
          .then((payload) => applyTeamBackendPayload(payload, { switchUser: false }))
          .catch((error) => {
            const message = error?.message || "Team-Plan konnte nicht im Backend gespeichert werden.";
            setProductError(message);
            setTeamBackendState(createBackendFallbackState(message));
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
    [applyTeamBackendPayload, setProductError, setState, setTeamBackendState, teamBackendState.status],
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
            setTeamBackendState(createBackendFallbackState(message));
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
    [applyTeamBackendPayload, setProductError, setState, setTeamBackendState, teamBackendState.status],
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
            setTeamBackendState(createBackendFallbackState(message));
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
    [applyTeamBackendPayload, setProductError, setState, setTeamBackendState, teamBackendState.status],
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
            setTeamBackendState(createBackendFallbackState(message));
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
    [applyTeamBackendPayload, setProductError, setState, setTeamBackendState, teamBackendState.status],
  );

  return {
    onPublishTeamPlan,
    onUpsertManualGame,
    onUpdateTeamGoals,
    onUpsertTeamAccount,
  };
}
