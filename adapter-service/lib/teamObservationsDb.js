let pgClient = null;
let pgDisabled = false;
let pgInitPromise = null;
let schemaReady = false;

function getDatabaseUrl() {
  const direct = String(process.env.ADAPTER_DATABASE_URL || "").trim();
  if (direct) {
    return direct;
  }
  return String(process.env.DATABASE_URL || "").trim();
}

async function ensureClient(logger) {
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
      const client = new Client({ connectionString: databaseUrl });
      await client.connect();
      pgClient = client;
      return pgClient;
    } catch (error) {
      pgDisabled = true;
      logger?.warn?.("postgres observations db disabled", { error });
      return null;
    }
  })();

  return pgInitPromise;
}

async function ensureSchema(client, logger) {
  if (!client || schemaReady) {
    return;
  }
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS adapter_team_observations (
        team_id TEXT NOT NULL,
        observation_id TEXT NOT NULL,
        game_id TEXT NOT NULL,
        scout_id TEXT NOT NULL,
        status TEXT NOT NULL,
        planned_at TIMESTAMPTZ,
        seen_at TIMESTAMPTZ,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (team_id, observation_id)
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_adapter_team_observations_team_updated
      ON adapter_team_observations (team_id, updated_at DESC)
    `);
    schemaReady = true;
  } catch (error) {
    logger?.warn?.("postgres observations schema init failed", { error });
  }
}

export async function syncTeamObservationsToDb(teamState, logger) {
  const client = await ensureClient(logger);
  if (!client) {
    return false;
  }
  await ensureSchema(client, logger);
  try {
    const teamId = String(teamState?.team?.id || "");
    if (!teamId) {
      return false;
    }
    const observations = Array.isArray(teamState?.observations) ? teamState.observations : [];
    const now = new Date().toISOString();
    await client.query("BEGIN");
    await client.query(`DELETE FROM adapter_team_observations WHERE team_id = $1`, [teamId]);
    for (const item of observations) {
      const observationId = String(item?.id || "").trim();
      if (!observationId) {
        continue;
      }
      await client.query(
        `
        INSERT INTO adapter_team_observations (
          team_id, observation_id, game_id, scout_id, status, planned_at, seen_at, payload, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)
        `,
        [
          teamId,
          observationId,
          String(item?.gameId || ""),
          String(item?.scoutId || ""),
          String(item?.status || "planned"),
          item?.plannedAt ? String(item.plannedAt) : null,
          item?.seenAt ? String(item.seenAt) : null,
          JSON.stringify(item || {}),
          now,
        ],
      );
    }
    await client.query("COMMIT");
    return true;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      logger?.warn?.("postgres observations rollback failed", { error: rollbackError });
    }
    logger?.warn?.("postgres observations sync failed", { error });
    return false;
  }
}

export async function fetchTeamObservationsFromDb(teamId, logger) {
  const client = await ensureClient(logger);
  if (!client) {
    return null;
  }
  await ensureSchema(client, logger);
  try {
    const result = await client.query(
      `
      SELECT payload
      FROM adapter_team_observations
      WHERE team_id = $1
      ORDER BY updated_at DESC
      `,
      [String(teamId || "")],
    );
    return (Array.isArray(result.rows) ? result.rows : [])
      .map((row) => (row?.payload && typeof row.payload === "object" ? row.payload : null))
      .filter(Boolean);
  } catch (error) {
    logger?.warn?.("postgres observations fetch failed", { error });
    return null;
  }
}
