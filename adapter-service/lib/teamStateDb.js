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
      logger?.warn?.("postgres team state db disabled", { error });
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
      CREATE TABLE IF NOT EXISTS adapter_team_state (
        team_id TEXT PRIMARY KEY,
        version INTEGER NOT NULL,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_adapter_team_state_updated_at
      ON adapter_team_state (updated_at DESC)
    `);
    schemaReady = true;
  } catch (error) {
    logger?.warn?.("postgres team state schema init failed", { error });
  }
}

export async function persistTeamStateToDb(teamState, logger) {
  const client = await ensureClient(logger);
  if (!client) {
    return false;
  }
  await ensureSchema(client, logger);
  try {
    const teamId = String(teamState?.team?.id || "");
    const version = Number(teamState?.version || 1);
    const payload = teamState && typeof teamState === "object" ? teamState : {};
    const updatedAt = new Date().toISOString();
    if (!teamId) {
      return false;
    }
    await client.query(
      `
      INSERT INTO adapter_team_state (team_id, version, payload, updated_at)
      VALUES ($1, $2, $3::jsonb, $4)
      ON CONFLICT (team_id) DO UPDATE SET
        version = EXCLUDED.version,
        payload = EXCLUDED.payload,
        updated_at = EXCLUDED.updated_at
      `,
      [teamId, version, JSON.stringify(payload), updatedAt],
    );
    return true;
  } catch (error) {
    logger?.warn?.("postgres team state write failed", { error });
    return false;
  }
}

export async function fetchTeamStateFromDb(teamId, logger) {
  const client = await ensureClient(logger);
  if (!client) {
    return null;
  }
  await ensureSchema(client, logger);
  try {
    if (teamId) {
      const result = await client.query(
        `
        SELECT payload
        FROM adapter_team_state
        WHERE team_id = $1
        LIMIT 1
        `,
        [String(teamId)],
      );
      return result.rows?.[0]?.payload || null;
    }

    const result = await client.query(
      `
      SELECT payload
      FROM adapter_team_state
      ORDER BY updated_at DESC
      LIMIT 1
      `,
    );
    return result.rows?.[0]?.payload || null;
  } catch (error) {
    logger?.warn?.("postgres team state read failed", { error });
    return null;
  }
}
