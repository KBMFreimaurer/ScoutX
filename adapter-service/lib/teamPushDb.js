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
      logger?.warn?.("postgres push db disabled", { error });
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
      CREATE TABLE IF NOT EXISTS adapter_team_push_subscriptions (
        endpoint TEXT PRIMARY KEY,
        team_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        p256dh TEXT,
        auth TEXT,
        updated_at TIMESTAMPTZ NOT NULL
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_adapter_team_push_subscriptions_team_id
      ON adapter_team_push_subscriptions (team_id)
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS adapter_team_push_outbox (
        event_id TEXT PRIMARY KEY,
        team_id TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT,
        body TEXT,
        created_at TIMESTAMPTZ NOT NULL,
        status TEXT NOT NULL DEFAULT 'new',
        delivered_count INTEGER NOT NULL DEFAULT 0,
        last_delivered_at TIMESTAMPTZ
      )
    `);
    await client.query(`
      ALTER TABLE adapter_team_push_outbox
      ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'new'
    `);
    await client.query(`
      ALTER TABLE adapter_team_push_outbox
      ADD COLUMN IF NOT EXISTS delivered_count INTEGER NOT NULL DEFAULT 0
    `);
    await client.query(`
      ALTER TABLE adapter_team_push_outbox
      ADD COLUMN IF NOT EXISTS last_delivered_at TIMESTAMPTZ
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_adapter_team_push_outbox_team_id_created
      ON adapter_team_push_outbox (team_id, created_at DESC)
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS adapter_team_push_acked (
        event_id TEXT PRIMARY KEY,
        team_id TEXT NOT NULL,
        acked_at TIMESTAMPTZ NOT NULL
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_adapter_team_push_acked_team_id
      ON adapter_team_push_acked (team_id)
    `);
    schemaReady = true;
  } catch (error) {
    logger?.warn?.("postgres push schema init failed", { error });
  }
}

export async function persistPushSubscription(input, logger) {
  const client = await ensureClient(logger);
  if (!client) {
    return false;
  }
  await ensureSchema(client, logger);
  try {
    await client.query(
      `
      INSERT INTO adapter_team_push_subscriptions (endpoint, team_id, user_id, p256dh, auth, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (endpoint) DO UPDATE SET
        team_id = EXCLUDED.team_id,
        user_id = EXCLUDED.user_id,
        p256dh = EXCLUDED.p256dh,
        auth = EXCLUDED.auth,
        updated_at = EXCLUDED.updated_at
      `,
      [
        String(input?.endpoint || ""),
        String(input?.teamId || ""),
        String(input?.userId || ""),
        String(input?.keys?.p256dh || ""),
        String(input?.keys?.auth || ""),
        String(input?.updatedAt || new Date().toISOString()),
      ],
    );
    return true;
  } catch (error) {
    logger?.warn?.("postgres push subscription write failed", { error });
    return false;
  }
}

export async function persistPushOutboxEvent(input, logger) {
  const client = await ensureClient(logger);
  if (!client) {
    return false;
  }
  await ensureSchema(client, logger);
  try {
    await client.query(
      `
      INSERT INTO adapter_team_push_outbox (event_id, team_id, type, title, body, created_at, status, delivered_count, last_delivered_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (event_id) DO UPDATE SET
        team_id = EXCLUDED.team_id,
        type = EXCLUDED.type,
        title = EXCLUDED.title,
        body = EXCLUDED.body,
        created_at = EXCLUDED.created_at,
        status = EXCLUDED.status,
        delivered_count = EXCLUDED.delivered_count,
        last_delivered_at = EXCLUDED.last_delivered_at
      `,
      [
        String(input?.eventId || ""),
        String(input?.teamId || ""),
        String(input?.type || ""),
        String(input?.title || ""),
        String(input?.body || ""),
        String(input?.createdAt || new Date().toISOString()),
        String(input?.status || "new"),
        Number.isFinite(Number(input?.deliveredCount)) ? Number(input.deliveredCount) : 0,
        String(input?.lastDeliveredAt || "").trim() || null,
      ],
    );
    return true;
  } catch (error) {
    logger?.warn?.("postgres push outbox write failed", { error });
    return false;
  }
}

export async function removePushOutboxEventsAndMarkAcked(eventIds, teamId, logger) {
  const client = await ensureClient(logger);
  if (!client) {
    return false;
  }
  await ensureSchema(client, logger);
  try {
    const ids = (Array.isArray(eventIds) ? eventIds : []).map((id) => String(id || "")).filter(Boolean);
    if (ids.length === 0) {
      return true;
    }
    const now = new Date().toISOString();
    await client.query("BEGIN");
    await client.query(
      `
      DELETE FROM adapter_team_push_outbox
      WHERE event_id = ANY($1::text[])
      `,
      [ids],
    );
    for (const eventId of ids) {
      await client.query(
        `
        INSERT INTO adapter_team_push_acked (event_id, team_id, acked_at)
        VALUES ($1,$2,$3)
        ON CONFLICT (event_id) DO UPDATE SET
          team_id = EXCLUDED.team_id,
          acked_at = EXCLUDED.acked_at
        `,
        [eventId, String(teamId || ""), now],
      );
    }
    await client.query("COMMIT");
    return true;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      logger?.warn?.("postgres push ack rollback failed", { error: rollbackError });
    }
    logger?.warn?.("postgres push ack failed", { error });
    return false;
  }
}

export async function fetchPushRuntimeSnapshot(teamId, logger) {
  const client = await ensureClient(logger);
  if (!client) {
    return null;
  }
  await ensureSchema(client, logger);
  try {
    const team = String(teamId || "");
    const [subs, outbox, acked] = await Promise.all([
      client.query(
        `
        SELECT endpoint, team_id, user_id, p256dh, auth, updated_at
        FROM adapter_team_push_subscriptions
        WHERE team_id = $1
        ORDER BY updated_at DESC
        `,
        [team],
      ),
      client.query(
        `
        SELECT event_id, team_id, type, title, body, created_at, status, delivered_count, last_delivered_at
        FROM adapter_team_push_outbox
        WHERE team_id = $1
        ORDER BY created_at DESC
        `,
        [team],
      ),
      client.query(
        `
        SELECT event_id
        FROM adapter_team_push_acked
        WHERE team_id = $1
        ORDER BY acked_at DESC
        LIMIT 5000
        `,
        [team],
      ),
    ]);
    return {
      subscriptions: (subs.rows || []).map((row) => ({
        endpoint: String(row.endpoint || ""),
        teamId: String(row.team_id || ""),
        userId: String(row.user_id || ""),
        keys: {
          p256dh: String(row.p256dh || ""),
          auth: String(row.auth || ""),
        },
        updatedAt: String(row.updated_at || ""),
      })),
      outboxEvents: (outbox.rows || []).map((row) => ({
        eventId: String(row.event_id || ""),
        teamId: String(row.team_id || ""),
        type: String(row.type || ""),
        title: String(row.title || ""),
        body: String(row.body || ""),
        createdAt: String(row.created_at || ""),
        status: String(row.status || "new"),
        deliveredCount: Number(row.delivered_count || 0),
        lastDeliveredAt: String(row.last_delivered_at || ""),
      })),
      ackedEventIds: (acked.rows || []).map((row) => String(row.event_id || "")).filter(Boolean),
    };
  } catch (error) {
    logger?.warn?.("postgres push snapshot read failed", { error });
    return null;
  }
}
