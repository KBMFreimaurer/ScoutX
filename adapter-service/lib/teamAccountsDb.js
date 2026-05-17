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
      logger?.warn?.("postgres accounts db disabled", { error });
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
      CREATE TABLE IF NOT EXISTS adapter_team_accounts (
        account_id TEXT PRIMARY KEY,
        team_id TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        active BOOLEAN NOT NULL,
        password_hash TEXT,
        updated_at TIMESTAMPTZ NOT NULL
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_adapter_team_accounts_team_id
      ON adapter_team_accounts (team_id)
    `);
    schemaReady = true;
  } catch (error) {
    logger?.warn?.("postgres accounts schema init failed", { error });
  }
}

export async function syncTeamAccountsToDb(teamState, logger) {
  const client = await ensureClient(logger);
  if (!client) {
    return false;
  }
  await ensureSchema(client, logger);
  try {
    const teamId = String(teamState?.team?.id || "");
    const accounts = Array.isArray(teamState?.team?.accounts) ? teamState.team.accounts : [];
    const now = new Date().toISOString();

    await client.query("BEGIN");
    for (const account of accounts) {
      await client.query(
        `
        INSERT INTO adapter_team_accounts (
          account_id, team_id, name, role, active, password_hash, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (account_id) DO UPDATE SET
          team_id = EXCLUDED.team_id,
          name = EXCLUDED.name,
          role = EXCLUDED.role,
          active = EXCLUDED.active,
          password_hash = EXCLUDED.password_hash,
          updated_at = EXCLUDED.updated_at
        `,
        [
          String(account?.id || ""),
          String(account?.teamId || teamId),
          String(account?.name || ""),
          String(account?.role || "scout"),
          account?.active !== false,
          account?.passwordHash ? String(account.passwordHash) : null,
          now,
        ],
      );
    }
    if (teamId) {
      await client.query(
        `
        DELETE FROM adapter_team_accounts
        WHERE team_id = $1
          AND account_id <> ALL($2::text[])
        `,
        [teamId, accounts.map((account) => String(account?.id || "")).filter(Boolean)],
      );
    }
    await client.query("COMMIT");
    return true;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      logger?.warn?.("postgres accounts rollback failed", { error: rollbackError });
    }
    logger?.warn?.("postgres accounts sync failed", { error });
    return false;
  }
}

export async function fetchTeamAccountByIdFromDb(accountId, logger) {
  const client = await ensureClient(logger);
  if (!client) {
    return null;
  }
  await ensureSchema(client, logger);
  try {
    const result = await client.query(
      `
      SELECT account_id, team_id, name, role, active, password_hash
      FROM adapter_team_accounts
      WHERE account_id = $1
      LIMIT 1
      `,
      [String(accountId || "")],
    );
    const row = result.rows?.[0];
    if (!row) {
      return null;
    }
    return {
      id: String(row.account_id || ""),
      teamId: String(row.team_id || ""),
      name: String(row.name || ""),
      role: String(row.role || "scout"),
      active: row.active !== false,
      passwordHash: row.password_hash ? String(row.password_hash) : "",
    };
  } catch (error) {
    logger?.warn?.("postgres account fetch failed", { error });
    return null;
  }
}
