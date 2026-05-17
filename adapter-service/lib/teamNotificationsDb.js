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
      logger?.warn?.("postgres notifications db disabled", { error });
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
      CREATE TABLE IF NOT EXISTS adapter_team_notifications (
        team_id TEXT NOT NULL,
        event_id TEXT NOT NULL,
        type TEXT NOT NULL,
        unread BOOLEAN NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (team_id, event_id)
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_adapter_team_notifications_team_created
      ON adapter_team_notifications (team_id, created_at DESC)
    `);
    schemaReady = true;
  } catch (error) {
    logger?.warn?.("postgres notifications schema init failed", { error });
  }
}

export async function syncTeamNotificationsToDb(teamState, logger) {
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
    const notifications = Array.isArray(teamState?.notifications) ? teamState.notifications : [];
    const now = new Date().toISOString();
    await client.query("BEGIN");
    await client.query(`DELETE FROM adapter_team_notifications WHERE team_id = $1`, [teamId]);
    for (const item of notifications) {
      const eventId = String(item?.eventId || item?.id || "").trim();
      if (!eventId) {
        continue;
      }
      await client.query(
        `
        INSERT INTO adapter_team_notifications (team_id, event_id, type, unread, created_at, payload, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)
        `,
        [
          teamId,
          eventId,
          String(item?.type || ""),
          item?.unread !== false,
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
      logger?.warn?.("postgres notifications rollback failed", { error: rollbackError });
    }
    logger?.warn?.("postgres notifications sync failed", { error });
    return false;
  }
}

export async function fetchTeamNotificationsFromDb(teamId, logger) {
  const client = await ensureClient(logger);
  if (!client) {
    return null;
  }
  await ensureSchema(client, logger);
  try {
    const result = await client.query(
      `
      SELECT payload
      FROM adapter_team_notifications
      WHERE team_id = $1
      ORDER BY created_at DESC
      `,
      [String(teamId || "")],
    );
    return (Array.isArray(result.rows) ? result.rows : [])
      .map((row) => (row?.payload && typeof row.payload === "object" ? row.payload : null))
      .filter(Boolean);
  } catch (error) {
    logger?.warn?.("postgres notifications fetch failed", { error });
    return null;
  }
}
