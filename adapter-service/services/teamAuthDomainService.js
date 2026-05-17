import { HttpError } from "../lib/httpErrors.js";

export async function registerAccount(input) {
  const {
    state,
    accountId,
    displayName,
    passwordHash,
    persistTeamState,
    logger,
    findAccount,
    reason = "team-register",
  } = input;
  const accounts = Array.isArray(state.team?.accounts) ? state.team.accounts : [];
  const persisted = await persistTeamState(
    {
      ...state,
      team: {
        ...(state.team || {}),
        accounts: [
          ...accounts,
          {
            id: accountId,
            name: displayName,
            role: "scout",
            teamId: state.team?.id || "team-scoutx",
            active: true,
            passwordHash,
          },
        ],
      },
    },
    logger,
    reason,
  );
  if (!persisted) {
    throw new HttpError(500, "Team-Account konnte nicht gespeichert werden.");
  }
  return findAccount(accountId);
}

export async function acceptInvitation(input) {
  const {
    state,
    invitation,
    passwordHash,
    persistTeamState,
    logger,
    findAccount,
    reason = "team-invitation-accept",
  } = input;
  const accounts = Array.isArray(state.team?.accounts) ? state.team.accounts : [];
  const persisted = await persistTeamState(
    {
      ...state,
      team: {
        ...(state.team || {}),
        accounts: [
          ...accounts,
          {
            id: invitation.userId,
            name: invitation.name,
            role: invitation.role,
            teamId: invitation.teamId,
            active: true,
            passwordHash,
          },
        ],
      },
    },
    logger,
    reason,
  );
  if (!persisted) {
    throw new HttpError(500, "Team-Account konnte nicht gespeichert werden.");
  }
  return findAccount(invitation.userId);
}

export async function confirmPasswordReset(input) {
  const {
    state,
    reset,
    passwordHash,
    persistTeamState,
    logger,
    reason = "team-password-reset",
  } = input;
  const accounts = Array.isArray(state.team?.accounts) ? state.team.accounts : [];
  const index = accounts.findIndex((item) => item?.id === reset.userId && item?.teamId === reset.teamId);
  if (index < 0) {
    throw new HttpError(404, "Team-Account wurde nicht gefunden.");
  }
  const nextAccounts = [...accounts];
  nextAccounts[index] = {
    ...nextAccounts[index],
    active: true,
    passwordHash,
  };
  const persisted = await persistTeamState(
    {
      ...state,
      team: {
        ...(state.team || {}),
        accounts: nextAccounts,
      },
    },
    logger,
    reason,
  );
  if (!persisted) {
    throw new HttpError(500, "Neues Passwort konnte nicht gespeichert werden.");
  }
}
