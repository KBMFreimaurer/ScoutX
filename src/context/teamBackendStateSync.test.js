import { describe, expect, it } from "vitest";
import { createInitialProductState } from "../services/scoutxDomain";
import { createPersistableProductState, mergeTeamBackendPayload } from "./teamBackendStateSync";

describe("teamBackendStateSync", () => {
  it("merges backend payload into product state", () => {
    const prevState = createInitialProductState();
    const nextState = mergeTeamBackendPayload(prevState, {
      ok: true,
      user: { id: "user-scout" },
      team: {
        id: "team-scoutx",
        name: "ScoutX Team",
        accounts: [{ id: "user-scout", name: "Scout", role: "scout", teamId: "team-scoutx", active: true }],
      },
      manualGames: [{ id: "m1", home: "A", away: "B", date: "2026-01-01", time: "10:00" }],
      feedItems: [
        {
          id: "f1",
          type: "plan_published",
          body: "Plan",
          title: "Plan",
          actorId: "user-scout",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      notifications: [{ id: "n1", eventId: "n1", type: "plan", title: "Plan", body: "Plan", unread: true }],
    });

    expect(nextState.activeUserId).toBe("user-scout");
    expect(nextState.users.some((user) => user.id === "user-scout")).toBe(true);
    expect(nextState.manualGames).toHaveLength(1);
    expect(nextState.feedItems).toHaveLength(1);
    expect(nextState.notifications.length).toBeGreaterThan(0);
  });

  it("keeps active user when switchUser is disabled", () => {
    const prevState = { ...createInitialProductState(), activeUserId: "user-admin" };
    const nextState = mergeTeamBackendPayload(
      prevState,
      {
        ok: true,
        user: { id: "user-scout" },
        team: prevState.team,
      },
      { switchUser: false },
    );
    expect(nextState.activeUserId).toBe("user-admin");
  });

  it("removes team-synced slices from local persistence while connected", () => {
    const state = {
      ...createInitialProductState(),
      manualGames: [{ id: "m1", home: "A", away: "B", date: "2026-01-01", time: "10:00" }],
      observations: [{ id: "o1", gameId: "g1", scoutId: "user-admin", status: "planned" }],
      feedItems: [{ id: "f1", type: "plan_published", actorId: "user-admin", createdAt: "2026-01-01T00:00:00.000Z" }],
    };
    const persisted = createPersistableProductState(state, "connected");
    expect(persisted.manualGames).toEqual([]);
    expect(persisted.observations).toEqual([]);
    expect(persisted.feedItems).toEqual([]);
  });
});
