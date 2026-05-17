let pgClient = null;
let pgDisabled = false;
let pgInitPromise = null;
let schemaReady = false;
const runtimeFilePath = String(process.env.ADAPTER_RUNTIME_STATE_FILE || "").trim();

async function readRuntimeFileStore() {
  if (!runtimeFilePath) {
    return null;
  }
  try {
    const { readFile } = await import("node:fs/promises");
    const raw = await readFile(runtimeFilePath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      sessions: parsed?.sessions && typeof parsed.sessions === "object" ? parsed.sessions : {},
      tokens: parsed?.tokens && typeof parsed.tokens === "object" ? parsed.tokens : {},
      rateLimits: parsed?.rateLimits && typeof parsed.rateLimits === "object" ? parsed.rateLimits : {},
    };
  } catch {
    return { sessions: {}, tokens: {}, rateLimits: {} };
  }
}

async function writeRuntimeFileStore(store) {
  if (!runtimeFilePath) {
    return false;
  }
  try {
    const { mkdir, writeFile } = await import("node:fs/promises");
    const { dirname } = await import("node:path");
    await mkdir(dirname(runtimeFilePath), { recursive: true });
    await writeFile(runtimeFilePath, JSON.stringify(store), "utf8");
    return true;
  } catch {
    return false;
  }
}

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
      const client = new Client({
        connectionString: databaseUrl,
      });
      await client.connect();
      pgClient = client;
      return pgClient;
    } catch (error) {
      pgDisabled = true;
      logger?.warn?.("postgres runtime db disabled", { error });
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
      CREATE TABLE IF NOT EXISTS adapter_team_sessions (
        session_id TEXT PRIMARY KEY,
        team_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        csrf_token TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ,
        user_agent TEXT,
        ip_address TEXT
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_adapter_team_sessions_expires
      ON adapter_team_sessions (expires_at)
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS adapter_team_runtime_tokens (
        token TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        team_id TEXT NOT NULL,
        subject_id TEXT NOT NULL,
        payload JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_adapter_runtime_tokens_kind_expires
      ON adapter_team_runtime_tokens (kind, expires_at)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_adapter_runtime_tokens_team_kind
      ON adapter_team_runtime_tokens (team_id, kind)
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS adapter_runtime_rate_limits (
        scope_key TEXT PRIMARY KEY,
        window_started_at TIMESTAMPTZ NOT NULL,
        window_ms INTEGER NOT NULL,
        request_count INTEGER NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_adapter_runtime_rate_limits_updated
      ON adapter_runtime_rate_limits (updated_at)
    `);
    schemaReady = true;
  } catch (error) {
    logger?.warn?.("postgres runtime schema init failed", { error });
  }
}

function normalizeRuntimeTokenPayload(input) {
  return input && typeof input === "object" ? input : {};
}

async function upsertRuntimeToken(input, logger, kind) {
  const client = await ensureClient(logger);
  if (!client) {
    const store = await readRuntimeFileStore();
    if (!store) return false;
    const token = String(input?.token || "").trim();
    if (!token) return false;
    store.tokens[`${kind}:${token}`] = {
      token,
      kind,
      teamId: String(input?.teamId || "").trim(),
      subjectId: String(input?.subjectId || "").trim(),
      payload: normalizeRuntimeTokenPayload(input?.payload),
      createdAt: String(input?.createdAt || new Date().toISOString()),
      expiresAt: String(input?.expiresAt || new Date().toISOString()),
    };
    return writeRuntimeFileStore(store);
  }
  await ensureSchema(client, logger);
  try {
    const token = String(input?.token || "").trim();
    const teamId = String(input?.teamId || "").trim();
    const subjectId = String(input?.subjectId || "").trim();
    const createdAt = String(input?.createdAt || new Date().toISOString());
    const expiresAt = String(input?.expiresAt || new Date().toISOString());
    if (!token || !teamId || !subjectId) {
      return false;
    }
    await client.query(
      `
      INSERT INTO adapter_team_runtime_tokens (token, kind, team_id, subject_id, payload, created_at, expires_at)
      VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7)
      ON CONFLICT (token) DO UPDATE SET
        kind = EXCLUDED.kind,
        team_id = EXCLUDED.team_id,
        subject_id = EXCLUDED.subject_id,
        payload = EXCLUDED.payload,
        created_at = EXCLUDED.created_at,
        expires_at = EXCLUDED.expires_at
      `,
      [token, kind, teamId, subjectId, JSON.stringify(normalizeRuntimeTokenPayload(input?.payload)), createdAt, expiresAt],
    );
    return true;
  } catch (error) {
    logger?.warn?.("postgres runtime token write failed", { error, kind });
    return false;
  }
}

async function fetchRuntimeTokenByToken(token, logger, kind) {
  const client = await ensureClient(logger);
  if (!client) {
    const store = await readRuntimeFileStore();
    if (!store) return null;
    return store.tokens[`${kind}:${String(token || "").trim()}`] || null;
  }
  await ensureSchema(client, logger);
  try {
    const result = await client.query(
      `
      SELECT token, kind, team_id, subject_id, payload, created_at, expires_at
      FROM adapter_team_runtime_tokens
      WHERE token = $1 AND kind = $2
      LIMIT 1
      `,
      [String(token || "").trim(), kind],
    );
    const row = result.rows?.[0];
    if (!row) {
      return null;
    }
    return {
      token: String(row.token || ""),
      kind: String(row.kind || ""),
      teamId: String(row.team_id || ""),
      subjectId: String(row.subject_id || ""),
      payload: row.payload && typeof row.payload === "object" ? row.payload : {},
      createdAt: String(row.created_at || ""),
      expiresAt: String(row.expires_at || ""),
    };
  } catch (error) {
    logger?.warn?.("postgres runtime token fetch failed", { error, kind });
    return null;
  }
}

async function deleteRuntimeToken(token, logger, kind) {
  const client = await ensureClient(logger);
  if (!client) {
    const store = await readRuntimeFileStore();
    if (!store) return false;
    delete store.tokens[`${kind}:${String(token || "").trim()}`];
    return writeRuntimeFileStore(store);
  }
  await ensureSchema(client, logger);
  try {
    await client.query(`DELETE FROM adapter_team_runtime_tokens WHERE token = $1 AND kind = $2`, [String(token || "").trim(), kind]);
    return true;
  } catch (error) {
    logger?.warn?.("postgres runtime token delete failed", { error, kind });
    return false;
  }
}

export async function persistRuntimeTeamSession(input, logger) {
  const client = await ensureClient(logger);
  if (!client) {
    const store = await readRuntimeFileStore();
    if (!store) return false;
    const sessionId = String(input?.sessionId || "");
    if (!sessionId) return false;
    store.sessions[sessionId] = {
      sessionId,
      teamId: String(input?.teamId || ""),
      accountId: String(input?.accountId || ""),
      csrfToken: String(input?.csrfToken || ""),
      createdAt: String(input?.createdAt || new Date().toISOString()),
      expiresAt: String(input?.expiresAt || new Date().toISOString()),
      revokedAt: input?.revokedAt ? String(input.revokedAt) : "",
    };
    return writeRuntimeFileStore(store);
  }
  await ensureSchema(client, logger);
  try {
    await client.query(
      `
      INSERT INTO adapter_team_sessions (
        session_id, team_id, account_id, csrf_token, created_at, expires_at, revoked_at, user_agent, ip_address
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (session_id) DO UPDATE SET
        team_id = EXCLUDED.team_id,
        account_id = EXCLUDED.account_id,
        csrf_token = EXCLUDED.csrf_token,
        created_at = EXCLUDED.created_at,
        expires_at = EXCLUDED.expires_at,
        revoked_at = EXCLUDED.revoked_at,
        user_agent = EXCLUDED.user_agent,
        ip_address = EXCLUDED.ip_address
      `,
      [
        String(input?.sessionId || ""),
        String(input?.teamId || ""),
        String(input?.accountId || ""),
        String(input?.csrfToken || ""),
        String(input?.createdAt || new Date(0).toISOString()),
        String(input?.expiresAt || new Date(0).toISOString()),
        input?.revokedAt ? String(input.revokedAt) : null,
        input?.userAgent ? String(input.userAgent) : null,
        input?.ipAddress ? String(input.ipAddress) : null,
      ],
    );
    return true;
  } catch (error) {
    logger?.warn?.("postgres runtime session write failed", { error });
    return false;
  }
}

export async function revokeRuntimeTeamSession(sessionId, revokedAt, logger) {
  const client = await ensureClient(logger);
  if (!client) {
    const store = await readRuntimeFileStore();
    if (!store) return false;
    const key = String(sessionId || "");
    const existing = store.sessions[key];
    if (existing) {
      existing.revokedAt = String(revokedAt || new Date().toISOString());
      store.sessions[key] = existing;
    }
    return writeRuntimeFileStore(store);
  }
  await ensureSchema(client, logger);
  try {
    await client.query(
      `UPDATE adapter_team_sessions
       SET revoked_at = $2
       WHERE session_id = $1`,
      [String(sessionId || ""), String(revokedAt || new Date().toISOString())],
    );
    return true;
  } catch (error) {
    logger?.warn?.("postgres runtime session revoke failed", { error });
    return false;
  }
}

export async function revokeRuntimeTeamSessionsForAccount(teamId, accountId, revokedAt, logger) {
  const client = await ensureClient(logger);
  const safeTeamId = String(teamId || "").trim();
  const safeAccountId = String(accountId || "").trim();
  const safeRevokedAt = String(revokedAt || new Date().toISOString());
  if (!safeTeamId || !safeAccountId) {
    return false;
  }
  if (!client) {
    const store = await readRuntimeFileStore();
    if (!store) return false;
    for (const key of Object.keys(store.sessions || {})) {
      const session = store.sessions[key];
      if (!session) {
        continue;
      }
      if (String(session.teamId || "") !== safeTeamId || String(session.accountId || "") !== safeAccountId) {
        continue;
      }
      session.revokedAt = safeRevokedAt;
      store.sessions[key] = session;
    }
    return writeRuntimeFileStore(store);
  }
  await ensureSchema(client, logger);
  try {
    await client.query(
      `UPDATE adapter_team_sessions
       SET revoked_at = $3
       WHERE team_id = $1 AND account_id = $2 AND revoked_at IS NULL`,
      [safeTeamId, safeAccountId, safeRevokedAt],
    );
    return true;
  } catch (error) {
    logger?.warn?.("postgres runtime session revoke(account) failed", { error });
    return false;
  }
}

export async function pruneExpiredRuntimeTeamSessions(nowIso, logger) {
  const client = await ensureClient(logger);
  if (!client) {
    const store = await readRuntimeFileStore();
    if (!store) return false;
    const nowMs = Date.parse(String(nowIso || new Date().toISOString()));
    for (const [id, session] of Object.entries(store.sessions)) {
      const expiresAtMs = Date.parse(String(session?.expiresAt || ""));
      if (!Number.isFinite(expiresAtMs) || expiresAtMs < nowMs || String(session?.revokedAt || "")) {
        delete store.sessions[id];
      }
    }
    return writeRuntimeFileStore(store);
  }
  await ensureSchema(client, logger);
  try {
    await client.query(
      `DELETE FROM adapter_team_sessions
       WHERE expires_at < $1 OR revoked_at IS NOT NULL`,
      [String(nowIso || new Date().toISOString())],
    );
    return true;
  } catch (error) {
    logger?.warn?.("postgres runtime session prune failed", { error });
    return false;
  }
}

export async function fetchRuntimeTeamSessionById(sessionId, logger) {
  const client = await ensureClient(logger);
  if (!client) {
    const store = await readRuntimeFileStore();
    if (!store) return null;
    const row = store.sessions[String(sessionId || "")];
    if (!row) return null;
    return {
      sessionId: String(row.sessionId || ""),
      teamId: String(row.teamId || ""),
      accountId: String(row.accountId || ""),
      csrfToken: String(row.csrfToken || ""),
      createdAt: String(row.createdAt || ""),
      expiresAt: String(row.expiresAt || ""),
      revokedAt: String(row.revokedAt || ""),
    };
  }
  await ensureSchema(client, logger);
  try {
    const result = await client.query(
      `
      SELECT session_id, team_id, account_id, csrf_token, created_at, expires_at, revoked_at
      FROM adapter_team_sessions
      WHERE session_id = $1
      LIMIT 1
      `,
      [String(sessionId || "")],
    );
    const row = result.rows?.[0];
    if (!row) {
      return null;
    }
    return {
      sessionId: String(row.session_id || ""),
      teamId: String(row.team_id || ""),
      accountId: String(row.account_id || ""),
      csrfToken: String(row.csrf_token || ""),
      createdAt: String(row.created_at || ""),
      expiresAt: String(row.expires_at || ""),
      revokedAt: row.revoked_at ? String(row.revoked_at) : "",
    };
  } catch (error) {
    logger?.warn?.("postgres runtime session fetch failed", { error });
    return null;
  }
}

export async function persistRuntimeInvitation(invitation, logger) {
  return upsertRuntimeToken(
    {
      token: invitation?.token,
      teamId: invitation?.teamId,
      subjectId: invitation?.userId,
      createdAt: invitation?.createdAt,
      expiresAt: invitation?.expiresAt,
      payload: {
        userId: String(invitation?.userId || ""),
        name: String(invitation?.name || ""),
        role: String(invitation?.role || ""),
        teamId: String(invitation?.teamId || ""),
        invitedBy: String(invitation?.invitedBy || ""),
      },
    },
    logger,
    "invitation",
  );
}

export async function fetchRuntimeInvitationByToken(token, logger) {
  const row = await fetchRuntimeTokenByToken(token, logger, "invitation");
  if (!row) {
    return null;
  }
  return {
    token: row.token,
    userId: String(row.payload?.userId || row.subjectId || ""),
    name: String(row.payload?.name || ""),
    role: String(row.payload?.role || "scout"),
    teamId: String(row.payload?.teamId || row.teamId || ""),
    invitedBy: String(row.payload?.invitedBy || ""),
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
  };
}

export async function deleteRuntimeInvitation(token, logger) {
  return deleteRuntimeToken(token, logger, "invitation");
}

export async function persistRuntimePasswordResetToken(reset, logger) {
  return upsertRuntimeToken(
    {
      token: reset?.token,
      teamId: reset?.teamId,
      subjectId: reset?.userId,
      createdAt: reset?.createdAt || new Date().toISOString(),
      expiresAt: reset?.expiresAt,
      payload: {
        userId: String(reset?.userId || ""),
        teamId: String(reset?.teamId || ""),
      },
    },
    logger,
    "password_reset",
  );
}

export async function fetchRuntimePasswordResetToken(token, logger) {
  const row = await fetchRuntimeTokenByToken(token, logger, "password_reset");
  if (!row) {
    return null;
  }
  return {
    token: row.token,
    userId: String(row.payload?.userId || row.subjectId || ""),
    teamId: String(row.payload?.teamId || row.teamId || ""),
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
  };
}

export async function deleteRuntimePasswordResetToken(token, logger) {
  return deleteRuntimeToken(token, logger, "password_reset");
}

export async function persistRuntimeKreisPdfPreview(preview, logger) {
  return upsertRuntimeToken(
    {
      token: preview?.token,
      teamId: preview?.teamId,
      subjectId: preview?.createdBy || "unknown",
      createdAt: preview?.createdAt,
      expiresAt: preview?.expiresAt,
      payload: {
        fileName: String(preview?.fileName || "kreis-auswahl.pdf"),
        games: Array.isArray(preview?.games) ? preview.games : [],
        createdBy: String(preview?.createdBy || ""),
      },
    },
    logger,
    "kreis_pdf_preview",
  );
}

export async function fetchRuntimeKreisPdfPreviewByToken(token, logger) {
  const row = await fetchRuntimeTokenByToken(token, logger, "kreis_pdf_preview");
  if (!row) {
    return null;
  }
  return {
    token: row.token,
    fileName: String(row.payload?.fileName || "kreis-auswahl.pdf"),
    games: Array.isArray(row.payload?.games) ? row.payload.games : [],
    createdBy: String(row.payload?.createdBy || row.subjectId || ""),
    teamId: row.teamId,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
  };
}

export async function deleteRuntimeKreisPdfPreview(token, logger) {
  return deleteRuntimeToken(token, logger, "kreis_pdf_preview");
}

export async function pruneExpiredRuntimeTokens(nowIso, logger) {
  const client = await ensureClient(logger);
  if (!client) {
    const store = await readRuntimeFileStore();
    if (!store) return false;
    const nowMs = Date.parse(String(nowIso || new Date().toISOString()));
    for (const [key, token] of Object.entries(store.tokens)) {
      const expiresAtMs = Date.parse(String(token?.expiresAt || ""));
      if (!Number.isFinite(expiresAtMs) || expiresAtMs < nowMs) {
        delete store.tokens[key];
      }
    }
    return writeRuntimeFileStore(store);
  }
  await ensureSchema(client, logger);
  try {
    await client.query(`DELETE FROM adapter_team_runtime_tokens WHERE expires_at < $1`, [String(nowIso || new Date().toISOString())]);
    return true;
  } catch (error) {
    logger?.warn?.("postgres runtime token prune failed", { error });
    return false;
  }
}

export async function checkAndBumpRuntimeRateLimit(scopeKey, maxRequests, windowMs, logger) {
  const client = await ensureClient(logger);
  if (!client) {
    const store = await readRuntimeFileStore();
    if (!store) return null;
    const key = String(scopeKey || "").trim();
    const max = Math.max(1, Number(maxRequests) || 1);
    const window = Math.max(1, Number(windowMs) || 1);
    if (!key) return null;
    const now = Date.now();
    const current = store.rateLimits[key];
    if (!current || now - Number(current.windowStartMs || 0) > window) {
      store.rateLimits[key] = { windowStartMs: now, requestCount: 1, updatedAtMs: now };
      await writeRuntimeFileStore(store);
      return true;
    }
    current.requestCount = Number(current.requestCount || 0) + 1;
    current.updatedAtMs = now;
    store.rateLimits[key] = current;
    await writeRuntimeFileStore(store);
    return current.requestCount <= max;
  }
  await ensureSchema(client, logger);
  const key = String(scopeKey || "").trim();
  const max = Math.max(1, Number(maxRequests) || 1);
  const window = Math.max(1, Number(windowMs) || 1);
  if (!key) {
    return null;
  }
  try {
    const result = await client.query(
      `
      INSERT INTO adapter_runtime_rate_limits (scope_key, window_started_at, window_ms, request_count, updated_at)
      VALUES ($1, NOW(), $2, 1, NOW())
      ON CONFLICT (scope_key) DO UPDATE SET
        request_count = CASE
          WHEN EXTRACT(EPOCH FROM (NOW() - adapter_runtime_rate_limits.window_started_at)) * 1000 > adapter_runtime_rate_limits.window_ms
            THEN 1
          ELSE adapter_runtime_rate_limits.request_count + 1
        END,
        window_started_at = CASE
          WHEN EXTRACT(EPOCH FROM (NOW() - adapter_runtime_rate_limits.window_started_at)) * 1000 > adapter_runtime_rate_limits.window_ms
            THEN NOW()
          ELSE adapter_runtime_rate_limits.window_started_at
        END,
        window_ms = EXCLUDED.window_ms,
        updated_at = NOW()
      RETURNING request_count
      `,
      [key, window],
    );
    const count = Number(result.rows?.[0]?.request_count || 0);
    return count > 0 && count <= max;
  } catch (error) {
    logger?.warn?.("postgres runtime rate-limit check failed", { error, scopeKey: key });
    return null;
  }
}

export async function pruneRuntimeRateLimits(retentionMs, logger) {
  const client = await ensureClient(logger);
  if (!client) {
    const store = await readRuntimeFileStore();
    if (!store) return false;
    const now = Date.now();
    const thresholdMs = Math.max(1000, Number(retentionMs) || 1000);
    for (const [key, item] of Object.entries(store.rateLimits)) {
      if (now - Number(item?.updatedAtMs || 0) > thresholdMs) {
        delete store.rateLimits[key];
      }
    }
    return writeRuntimeFileStore(store);
  }
  await ensureSchema(client, logger);
  const thresholdMs = Math.max(1000, Number(retentionMs) || 1000);
  try {
    await client.query(
      `
      DELETE FROM adapter_runtime_rate_limits
      WHERE EXTRACT(EPOCH FROM (NOW() - updated_at)) * 1000 > $1
      `,
      [thresholdMs],
    );
    return true;
  } catch (error) {
    logger?.warn?.("postgres runtime rate-limit prune failed", { error });
    return false;
  }
}
