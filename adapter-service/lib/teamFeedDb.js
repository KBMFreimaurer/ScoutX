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
      logger?.warn?.("postgres feed db disabled", { error });
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
      CREATE TABLE IF NOT EXISTS adapter_team_feed_items (
        team_id TEXT NOT NULL,
        feed_id TEXT NOT NULL,
        type TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (team_id, feed_id)
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_adapter_team_feed_items_team_created
      ON adapter_team_feed_items (team_id, created_at DESC)
    `);
    schemaReady = true;
  } catch (error) {
    logger?.warn?.("postgres feed schema init failed", { error });
  }
}

export async function syncTeamFeedItemsToDb(teamState, logger) {
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
    const feedItems = Array.isArray(teamState?.feedItems) ? teamState.feedItems : [];
    const now = new Date().toISOString();
    await client.query("BEGIN");
    await client.query(`DELETE FROM adapter_team_feed_items WHERE team_id = $1`, [teamId]);
    for (const item of feedItems) {
      const feedId = String(item?.id || "").trim();
      if (!feedId) {
        continue;
      }
      await client.query(
        `
        INSERT INTO adapter_team_feed_items (team_id, feed_id, type, created_at, payload, updated_at)
        VALUES ($1,$2,$3,$4,$5::jsonb,$6)
        `,
        [
          teamId,
          feedId,
          String(item?.type || ""),
          String(item?.createdAt || new Date(0).toISOString()),
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
      logger?.warn?.("postgres feed rollback failed", { error: rollbackError });
    }
    logger?.warn?.("postgres feed sync failed", { error });
    return false;
  }
}

export async function fetchTeamFeedItemsFromDb(teamId, logger) {
  const client = await ensureClient(logger);
  if (!client) {
    return null;
  }
  await ensureSchema(client, logger);
  try {
    const result = await client.query(
      `
      SELECT payload
      FROM adapter_team_feed_items
      WHERE team_id = $1
      ORDER BY created_at DESC
      `,
      [String(teamId || "")],
    );
    return (Array.isArray(result.rows) ? result.rows : [])
      .map((row) => (row?.payload && typeof row.payload === "object" ? row.payload : null))
      .filter(Boolean);
  } catch (error) {
    logger?.warn?.("postgres feed fetch failed", { error });
    return null;
  }
}
