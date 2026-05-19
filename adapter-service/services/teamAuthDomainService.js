import { HttpError } from "../lib/httpErrors.js";

export async function registerAccount(input) {
  const {
    accountId,
    displayName,
    passwordHash,
    applyTeamStateMutation,
    logger,
    reason = "team-register",
  } = input;
  const result = await applyTeamStateMutation(logger, reason, (currentState) => {
    const accounts = Array.isArray(currentState.team?.accounts) ? currentState.team.accounts : [];
    const exists = accounts.some((item) => String(item?.id || "") === accountId);
    if (exists) {
      throw new HttpError(409, "Diese User-ID ist bereits vergeben.");
    }
    const account = {
      id: accountId,
      name: displayName,
      role: "scout",
      teamId: currentState.team?.id || "team-scoutx",
      active: true,
      passwordHash,
    };
    return {
      state: {
        ...currentState,
        team: {
          ...(currentState.team || {}),
          accounts: [...accounts, account],
        },
      },
      accountId: account.id,
    };
  });
  return result?.accountId || accountId;
}

export async function acceptInvitation(input) {
  const {
    invitation,
    passwordHash,
    applyTeamStateMutation,
    logger,
    reason = "team-invitation-accept",
  } = input;
  const result = await applyTeamStateMutation(logger, reason, (currentState) => {
    const accounts = Array.isArray(currentState.team?.accounts) ? currentState.team.accounts : [];
    const exists = accounts.some((item) => String(item?.id || "") === String(invitation.userId || ""));
    if (exists) {
      throw new HttpError(409, "Diese User-ID ist bereits vergeben.");
    }
    const account = {
      id: invitation.userId,
      name: invitation.name,
      role: invitation.role,
      teamId: invitation.teamId,
      active: true,
      passwordHash,
    };
    return {
      state: {
        ...currentState,
        team: {
          ...(currentState.team || {}),
          accounts: [...accounts, account],
        },
      },
      accountId: account.id,
    };
  });
  return result?.accountId || invitation.userId;
}

export async function confirmPasswordReset(input) {
  const {
    reset,
    passwordHash,
    applyTeamStateMutation,
    logger,
    reason = "team-password-reset",
  } = input;
  await applyTeamStateMutation(logger, reason, (currentState) => {
    const accounts = Array.isArray(currentState.team?.accounts) ? currentState.team.accounts : [];
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
    return {
      ...currentState,
      team: {
        ...(currentState.team || {}),
        accounts: nextAccounts,
      },
    };
  });
}
