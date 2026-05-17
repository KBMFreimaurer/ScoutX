import { describe, expect, it, vi } from "vitest";
import { ensureTeamDbMirrorsSynced } from "./teamDbPersistence.js";

describe("ensureTeamDbMirrorsSynced", () => {
  it("runs all mirror writes and succeeds when all operations return true", async () => {
    const state = { team: { id: "team-scoutx" } };
    const logger = {};
    const operations = {
      persistTeamStateToDb: vi.fn().mockResolvedValue(true),
      syncTeamAccountsToDb: vi.fn().mockResolvedValue(true),
      syncTeamNotificationsToDb: vi.fn().mockResolvedValue(true),
      syncTeamObservationsToDb: vi.fn().mockResolvedValue(true),
      syncTeamReportsToDb: vi.fn().mockResolvedValue(true),
      syncTeamFeedItemsToDb: vi.fn().mockResolvedValue(true),
    };

    await expect(ensureTeamDbMirrorsSynced(state, logger, operations)).resolves.toBeUndefined();
    expect(operations.persistTeamStateToDb).toHaveBeenCalledWith(state, logger);
    expect(operations.syncTeamAccountsToDb).toHaveBeenCalledWith(state, logger);
    expect(operations.syncTeamNotificationsToDb).toHaveBeenCalledWith(state, logger);
    expect(operations.syncTeamObservationsToDb).toHaveBeenCalledWith(state, logger);
    expect(operations.syncTeamReportsToDb).toHaveBeenCalledWith(state, logger);
    expect(operations.syncTeamFeedItemsToDb).toHaveBeenCalledWith(state, logger);
  });

  it("throws with mirror name when a mirror write reports false", async () => {
    const state = { team: { id: "team-scoutx" } };
    const logger = {};
    const operations = {
      persistTeamStateToDb: vi.fn().mockResolvedValue(true),
      syncTeamAccountsToDb: vi.fn().mockResolvedValue(false),
      syncTeamNotificationsToDb: vi.fn().mockResolvedValue(true),
      syncTeamObservationsToDb: vi.fn().mockResolvedValue(true),
      syncTeamReportsToDb: vi.fn().mockResolvedValue(true),
      syncTeamFeedItemsToDb: vi.fn().mockResolvedValue(true),
    };

    await expect(ensureTeamDbMirrorsSynced(state, logger, operations, { strict: true })).rejects.toMatchObject({
      code: "DB_MIRROR_WRITE_FAILED",
      mirror: "accounts",
    });
    expect(operations.syncTeamNotificationsToDb).not.toHaveBeenCalled();
  });

  it("continues in fallback mode when a mirror write reports false", async () => {
    const state = { team: { id: "team-scoutx" } };
    const logger = { warn: vi.fn() };
    const operations = {
      persistTeamStateToDb: vi.fn().mockResolvedValue(true),
      syncTeamAccountsToDb: vi.fn().mockResolvedValue(false),
      syncTeamNotificationsToDb: vi.fn().mockResolvedValue(true),
      syncTeamObservationsToDb: vi.fn().mockResolvedValue(true),
      syncTeamReportsToDb: vi.fn().mockResolvedValue(true),
      syncTeamFeedItemsToDb: vi.fn().mockResolvedValue(true),
    };

    await expect(ensureTeamDbMirrorsSynced(state, logger, operations)).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith("postgres mirror write skipped or failed in fallback mode", { mirror: "accounts" });
    expect(operations.syncTeamNotificationsToDb).toHaveBeenCalled();
  });
});
