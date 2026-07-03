import { describe, expect, it } from "vitest";
import { createInitialTeamState, publishTeamPlan } from "./teamBackend.js";

const admin = { id: "user-admin", name: "Leitung", role: "admin", teamId: "team-scoutx", active: true };
const scout = { id: "user-scout", name: "Scout", role: "scout", teamId: "team-scoutx", active: true };

const game = {
  id: "game-1",
  home: "MSV Duisburg U17",
  away: "RWE U17",
  date: "2026-07-11",
  time: "13:00",
  venue: "Sportanlage Test",
};

let counter = 0;
const randomId = () => `id-${(counter += 1)}`;

describe("publishTeamPlan Dopplungs-Benachrichtigung", () => {
  it("meldet einen Konflikt, wenn ein zweiter Scout dasselbe Spiel plant", () => {
    const first = publishTeamPlan(createInitialTeamState(), admin, { games: [game] }, randomId);
    expect(first.state.feedItems.some((item) => item.type === "duplicate_conflict")).toBe(false);
    // Plan-Veröffentlichung erzeugt eine Notification vom Typ "plan" (Push-relevant).
    expect(first.state.notifications.some((item) => item.type === "plan")).toBe(true);

    const second = publishTeamPlan(first.state, scout, { games: [game] }, randomId);
    const duplicate = second.state.feedItems.find((item) => item.type === "duplicate_conflict");
    expect(duplicate).toBeTruthy();
    expect(duplicate.body).toContain("MSV Duisburg U17 vs RWE U17");
    expect(second.state.notifications.some((item) => item.type === "konflikt")).toBe(true);
  });

  it("meldet keinen Konflikt, wenn derselbe Scout erneut veröffentlicht", () => {
    const first = publishTeamPlan(createInitialTeamState(), admin, { games: [game] }, randomId);
    const second = publishTeamPlan(first.state, admin, { games: [game] }, randomId);
    expect(second.state.feedItems.some((item) => item.type === "duplicate_conflict")).toBe(false);
  });
});
