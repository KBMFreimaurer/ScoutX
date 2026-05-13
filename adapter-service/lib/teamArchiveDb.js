let pgClient = null;
let pgDisabled = false;
let pgInitPromise = null;

function getDatabaseUrl() {
  const direct = String(process.env.ADAPTER_DATABASE_URL || "").trim();
  if (direct) {
    return direct;
  }
  return String(process.env.DATABASE_URL || "").trim();
}

async function initPgClient(logger) {
  if (pgClient || pgDisabled) {
    return pgClient;
  }
  if (pgInitPromise) {
    return pgInitPromise;
  }

  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    pgDisabled = true;
    return null;
  }

  pgInitPromise = (async () => {
    try {
      const { Client } = await import("pg");
      const client = new Client({
        connectionString: databaseUrl,
        application_name: "scoutx-adapter",
      });
      await client.connect();
      pgClient = client;
      return pgClient;
    } catch (error) {
      pgDisabled = true;
      logger?.warn?.("postgres archive disabled", { error });
      return null;
    }
  })();

  return pgInitPromise;
}

export async function persistTeamArchiveEventToDb(input, logger) {
  const client = await initPgClient(logger);
  if (!client) {
    return false;
  }

  const payload = input && typeof input === "object" ? input : {};
  const team = payload.teamState?.team && typeof payload.teamState.team === "object" ? payload.teamState.team : null;

  try {
    await client.query(
      `
      INSERT INTO team_state_events (
        archived_at,
        organization_external_key,
        reason,
        team_state_version,
        team_state_json
      ) VALUES ($1, $2, $3, $4, $5::jsonb)
      `,
      [
        payload.archivedAt || new Date().toISOString(),
        team?.id ? String(team.id) : null,
        String(payload.reason || "team-update"),
        Number(payload.teamStateVersion || 1),
        JSON.stringify(payload.teamState || {}),
      ],
    );
    return true;
  } catch (error) {
    logger?.error?.("postgres archive write failed", { error });
    return false;
  }
}

