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
      logger?.warn?.("postgres reports db disabled", { error });
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
      CREATE TABLE IF NOT EXISTS adapter_team_reports (
        team_id TEXT NOT NULL,
        report_key TEXT NOT NULL,
        observation_id TEXT NOT NULL,
        game_id TEXT,
        scout_id TEXT,
        report_id TEXT,
        report_url TEXT,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (team_id, report_key)
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_adapter_team_reports_team_updated
      ON adapter_team_reports (team_id, updated_at DESC)
    `);
    schemaReady = true;
  } catch (error) {
    logger?.warn?.("postgres reports schema init failed", { error });
  }
}

function buildReportRecords(teamState) {
  const observations = Array.isArray(teamState?.observations) ? teamState.observations : [];
  return observations
    .map((item) => {
      const observationId = String(item?.id || "").trim();
      const reportId = String(item?.reportId || "").trim();
      const reportUrl = String(item?.reportUrl || "").trim();
      if (!observationId || (!reportId && !reportUrl)) {
        return null;
      }
      const key = reportId || reportUrl;
      return {
        reportKey: key,
        observationId,
        gameId: String(item?.gameId || "").trim(),
        scoutId: String(item?.scoutId || "").trim(),
        reportId,
        reportUrl,
        payload: {
          observationId,
          gameId: String(item?.gameId || "").trim(),
          scoutId: String(item?.scoutId || "").trim(),
          reportId,
          reportUrl,
        },
      };
    })
    .filter(Boolean);
}

export async function syncTeamReportsToDb(teamState, logger) {
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
    const records = buildReportRecords(teamState);
    const now = new Date().toISOString();
    await client.query("BEGIN");
    await client.query(`DELETE FROM adapter_team_reports WHERE team_id = $1`, [teamId]);
    for (const record of records) {
      await client.query(
        `
        INSERT INTO adapter_team_reports (
          team_id, report_key, observation_id, game_id, scout_id, report_id, report_url, payload, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)
        `,
        [
          teamId,
          record.reportKey,
          record.observationId,
          record.gameId || null,
          record.scoutId || null,
          record.reportId || null,
          record.reportUrl || null,
          JSON.stringify(record.payload),
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
      logger?.warn?.("postgres reports rollback failed", { error: rollbackError });
    }
    logger?.warn?.("postgres reports sync failed", { error });
    return false;
  }
}

export async function fetchTeamReportMapFromDb(teamId, logger) {
  const client = await ensureClient(logger);
  if (!client) {
    return null;
  }
  await ensureSchema(client, logger);
  try {
    const result = await client.query(
      `
      SELECT payload
      FROM adapter_team_reports
      WHERE team_id = $1
      ORDER BY updated_at DESC
      `,
      [String(teamId || "")],
    );
    const map = {};
    for (const row of Array.isArray(result.rows) ? result.rows : []) {
      const payload = row?.payload && typeof row.payload === "object" ? row.payload : null;
      const observationId = String(payload?.observationId || "").trim();
      if (!observationId) {
        continue;
      }
      map[observationId] = {
        reportId: String(payload?.reportId || "").trim(),
        reportUrl: String(payload?.reportUrl || "").trim(),
      };
    }
    return map;
  } catch (error) {
    logger?.warn?.("postgres reports fetch failed", { error });
    return null;
  }
}
