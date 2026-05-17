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

export async function fetchRecentTeamArchiveEvents(limit, logger) {
  const client = await initPgClient(logger);
  if (!client) {
    return [];
  }

  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));
  try {
    const result = await client.query(
      `
      SELECT archived_at, organization_external_key, reason, team_state_version, team_state_json
      FROM team_state_events
      ORDER BY archived_at DESC
      LIMIT $1
      `,
      [safeLimit],
    );
    return (Array.isArray(result.rows) ? result.rows : []).map((row) => ({
      archivedAt: row.archived_at ? String(row.archived_at) : "",
      teamId: row.organization_external_key ? String(row.organization_external_key) : "",
      reason: row.reason ? String(row.reason) : "",
      teamStateVersion: Number(row.team_state_version || 1),
      teamState: row.team_state_json && typeof row.team_state_json === "object" ? row.team_state_json : {},
      source: "postgres",
    }));
  } catch (error) {
    logger?.warn?.("postgres archive read failed", { error });
    return [];
  }
}
