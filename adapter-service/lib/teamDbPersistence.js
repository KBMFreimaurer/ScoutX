export async function ensureTeamDbMirrorsSynced(
  teamState,
  logger,
  {
    persistTeamStateToDb,
    syncTeamAccountsToDb,
    syncTeamNotificationsToDb,
    syncTeamObservationsToDb,
    syncTeamReportsToDb,
    syncTeamFeedItemsToDb,
  },
  options = {},
) {
  const strict = options?.strict === true;
  const operations = [
    ["teamState", persistTeamStateToDb],
    ["accounts", syncTeamAccountsToDb],
    ["notifications", syncTeamNotificationsToDb],
    ["observations", syncTeamObservationsToDb],
    ["reports", syncTeamReportsToDb],
    ["feed", syncTeamFeedItemsToDb],
  ];

  for (const [name, operation] of operations) {
    const ok = await operation(teamState, logger);
    if (!ok) {
      if (!strict) {
        logger?.warn?.("postgres mirror write skipped or failed in fallback mode", { mirror: name });
        continue;
      }
      const error = new Error(`postgres ${name} mirror write failed`);
      error.code = "DB_MIRROR_WRITE_FAILED";
      error.mirror = name;
      throw error;
    }
  }
}
