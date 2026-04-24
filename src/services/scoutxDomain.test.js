import { describe, expect, it } from "vitest";
import {
  addReportComment,
  addWatchlistEntry,
  analyzeReport,
  attachReportAnalysis,
  buildCalendarModel,
  buildGlobalSearchResults,
  buildPlayerProfiles,
  buildScoutingDashboard,
  canViewEntity,
  comparePlayers,
  createAssignment,
  createInitialProductState,
  createReportInput,
  createWatchlist,
  deleteSearchFilter,
  exportProductSnapshot,
  getActiveUser,
  normalizeProductState,
  removeWatchlistEntry,
  saveSearchFilter,
  switchActiveUser,
  updateAssignmentStatus,
  updateReportStatus,
  updateWatchlistEntry,
  upsertReport,
} from "./scoutxDomain";

const fixedClock = () => new Date("2026-04-23T10:00:00.000Z");
const fixedOptions = { clock: fixedClock, random: () => 0.123456 };

function createReportFixture(state, user, overrides = {}) {
  const report = createReportInput(
    {
      type: "player",
      title: "Testbericht",
      context: { playerName: "Mika Muster" },
      ratings: { technical: 4, tactical: 3 },
      sections: [{ id: "overview", title: "Kurzprofil", text: "Schnell, stark und dominant im ersten Kontakt." }],
      ...overrides,
    },
    user,
    fixedOptions,
  );
  return upsertReport(state, report, user, fixedOptions);
}

describe("scoutxDomain", () => {
  it("normalizes invalid product state to a usable MVP state", () => {
    const state = normalizeProductState(null, fixedOptions);

    expect(state.version).toBe(1);
    expect(state.users.length).toBeGreaterThanOrEqual(4);
    expect(state.reports).toHaveLength(0);
    expect(state.watchlists).toHaveLength(0);
    expect(state.assignments).toHaveLength(0);
    expect(state.notifications).toHaveLength(0);
    expect(getActiveUser(state).role).toBe("scout");
  });

  it("removes legacy cockpit seed data from persisted state", () => {
    const state = normalizeProductState(
      {
        activeUserId: "user-scout",
        users: createInitialProductState(fixedOptions).users,
        reports: [{ title: "MVP Beispielbericht: schneller erster Eindruck", context: { playerName: "Beispielspieler" } }],
        watchlists: [{ name: "Shortlist April", entries: [{ playerName: "Beispielspieler" }] }],
        assignments: [{ title: "Follow-up für Beispielspieler planen" }],
        notifications: [{ title: "Neue Zuweisung", body: "Follow-up für Beispielspieler planen" }],
      },
      fixedOptions,
    );

    expect(state.reports).toHaveLength(0);
    expect(state.watchlists).toHaveLength(0);
    expect(state.assignments).toHaveLength(0);
    expect(state.notifications).toHaveLength(0);
  });

  it("enforces private visibility for non-owners and admins", () => {
    const state = createInitialProductState(fixedOptions);
    const scout = state.users.find((user) => user.role === "scout");
    const readonly = state.users.find((user) => user.role === "readonly");
    const admin = state.users.find((user) => user.role === "admin");
    const report = {
      id: "r1",
      title: "Privater Bericht",
      ownerId: scout.id,
      visibility: "private",
    };

    expect(canViewEntity(scout, report)).toBe(true);
    expect(canViewEntity(readonly, report)).toBe(false);
    expect(canViewEntity(admin, report)).toBe(true);
  });

  it("creates and updates reports with versions and AI analysis", () => {
    const state = createInitialProductState(fixedOptions);
    const scout = getActiveUser(state);
    const report = createReportInput(
      {
        type: "player",
        title: "Testspieler U17",
        ratings: { technical: 5, tactical: 4 },
        sections: [
          { id: "overview", title: "Kurzprofil", text: "Schnell, stark und dominant im ersten Kontakt." },
        ],
      },
      scout,
      fixedOptions,
    );

    let next = upsertReport({ ...state, reports: [] }, report, scout, fixedOptions);
    expect(next.reports).toHaveLength(1);

    next = upsertReport(next, { ...next.reports[0], title: "Testspieler U17 aktualisiert" }, scout, fixedOptions);
    expect(next.reports[0].versions).toHaveLength(1);

    next = attachReportAnalysis(next, next.reports[0].id, scout, fixedOptions);
    expect(next.reports[0].ai.summary).toMatch(/Schnell/);
    expect(next.reports[0].ai.strengths.length).toBeGreaterThan(0);
  });

  it("detects contradictions between low ratings and positive report text", () => {
    const result = analyzeReport(
      {
        ratings: { technical: 1, tactical: 2 },
        sections: [{ text: "Sehr stark, schnell und sauber unter Druck." }],
      },
      fixedOptions,
    );

    expect(result.contradictions.some((item) => item.includes("Niedrige Bewertung"))).toBe(true);
  });

  it("supports watchlists, assignments, notifications and dashboard aggregation", () => {
    const state = createInitialProductState(fixedOptions);
    const scout = getActiveUser(state);

    let next = createWatchlist({ ...state, watchlists: [] }, { name: "U17 Fluegel" }, scout, fixedOptions);
    next = addWatchlistEntry(
      next,
      next.watchlists[0].id,
      { playerName: "Mika Muster", club: "VfL Test", priority: 5, labels: ["Tempo"] },
      scout,
      fixedOptions,
    );
    next = createAssignment(next, { title: "Mika Muster live sehen", dueAt: "2026-04-23" }, scout, fixedOptions);
    next = updateAssignmentStatus(next, next.assignments[0].id, "planned", scout, fixedOptions);

    const dashboard = buildScoutingDashboard({ state: next, user: scout });
    expect(dashboard.summary.watchlists).toBe(1);
    expect(dashboard.summary.openAssignments).toBeGreaterThan(0);
    expect(dashboard.priorityPlayers[0].playerName).toBe("Mika Muster");
    expect(next.notifications.length).toBeGreaterThan(state.notifications.length);
  });

  it("indexes reports, watchlists, assignments, players, games and history", () => {
    let state = createInitialProductState(fixedOptions);
    const scout = getActiveUser(state);
    state = createReportFixture(state, scout, {
      title: "Mika Muster Erstbericht",
      context: { playerName: "Mika Muster" },
    });
    state = createWatchlist(state, { name: "U17 Shortlist" }, scout, fixedOptions);
    state = addWatchlistEntry(state, state.watchlists[0].id, { playerName: "Mika Muster", club: "Verein" }, scout, fixedOptions);
    state = createAssignment(state, { title: "Mika Muster live sehen", dueAt: "2026-04-23" }, scout, fixedOptions);
    const results = buildGlobalSearchResults({
      state,
      user: scout,
      query: "Mika Muster",
      games: [{ id: "g1", home: "Team A", away: "Team B", venue: "Arena" }],
      playerSheets: [{ id: "p1", name: "Mika Muster", club: "Verein", position: "ST" }],
      planHistory: [{ id: "h1", planText: "Mika Muster gesehen", meta: { jugendLabel: "U17" } }],
    });

    expect(results.map((result) => result.type)).toEqual(expect.arrayContaining(["report", "watchlist", "assignment", "player", "history"]));
  });

  it("switches active user only to known users", () => {
    const state = createInitialProductState(fixedOptions);
    const readonly = state.users.find((user) => user.role === "readonly");

    expect(switchActiveUser(state, readonly.id).activeUserId).toBe(readonly.id);
    expect(switchActiveUser(state, "missing").activeUserId).toBe(state.activeUserId);
  });

  it("blocks readonly write access", () => {
    const state = createInitialProductState(fixedOptions);
    const readonly = state.users.find((user) => user.role === "readonly");

    expect(() => createAssignment(state, { title: "Nicht erlaubt" }, readonly, fixedOptions)).toThrow(
      /darf keine neuen/,
    );
  });

  it("supports report review comments and status transitions", () => {
    let state = createInitialProductState(fixedOptions);
    const scout = getActiveUser(state);
    state = createReportFixture(state, scout);
    const report = state.reports[0];

    let next = updateReportStatus(state, report.id, "in_review", scout, fixedOptions);
    next = addReportComment(next, report.id, "Bitte gegen zweites Spiel absichern.", scout, fixedOptions);

    expect(next.reports[0].status).toBe("in_review");
    expect(next.reports[0].comments[0].body).toMatch(/zweites Spiel/);
    expect(next.notifications[0].title).toBe("Neuer Report-Kommentar");
  });

  it("updates and removes watchlist entries", () => {
    let state = createInitialProductState(fixedOptions);
    const scout = getActiveUser(state);
    state = createWatchlist(state, { name: "U17 Shortlist" }, scout, fixedOptions);
    state = addWatchlistEntry(state, state.watchlists[0].id, { playerName: "Mika Muster", priority: 4 }, scout, fixedOptions);
    const watchlist = state.watchlists[0];
    const entry = watchlist.entries[0];

    let next = updateWatchlistEntry(state, watchlist.id, entry.id, { priority: 2, status: "hold" }, scout, fixedOptions);
    expect(next.watchlists[0].entries[0].priority).toBe(2);
    expect(next.watchlists[0].entries[0].status).toBe("hold");

    next = removeWatchlistEntry(next, watchlist.id, entry.id, scout, fixedOptions);
    expect(next.watchlists[0].entries).toHaveLength(0);
  });

  it("stores and deletes saved search filters", () => {
    const state = createInitialProductState(fixedOptions);
    const scout = getActiveUser(state);

    let next = saveSearchFilter(state, { name: "Top Reports", query: "MVP", filters: { type: "report" } }, scout, fixedOptions);
    expect(next.savedFilters[0].name).toBe("Top Reports");

    next = deleteSearchFilter(next, next.savedFilters[0].id, scout);
    expect(next.savedFilters).toHaveLength(0);
  });

  it("builds player profiles, compares them and exports visible domain data", () => {
    let state = createInitialProductState(fixedOptions);
    const scout = getActiveUser(state);
    state = createReportFixture(state, scout, {
      title: "Levin Testspieler Erstbericht",
      context: { playerName: "Levin Testspieler" },
    });
    state = createWatchlist(state, { name: "U17 Shortlist" }, scout, fixedOptions);
    const playerSheets = [
      { id: "p1", name: "Levin Testspieler", club: "Verein A", position: "ST", strengths: "Schnell" },
      { id: "p2", name: "Mika Muster", club: "Verein B", position: "RM", strengths: "Robust" },
    ];
    const enriched = addWatchlistEntry(
      state,
      state.watchlists[0].id,
      { playerName: "Mika Muster", club: "Verein B", priority: 5 },
      scout,
      fixedOptions,
    );

    const profiles = buildPlayerProfiles({ state: enriched, user: scout, playerSheets });
    const left = profiles.find((profile) => profile.name === "Levin Testspieler");
    const right = profiles.find((profile) => profile.name === "Mika Muster");
    const comparison = comparePlayers(profiles, left.key, right.key);
    const exported = JSON.parse(exportProductSnapshot({ state: enriched, user: scout, playerSheets }));

    expect(profiles.length).toBeGreaterThanOrEqual(2);
    expect(comparison.metrics.map((metric) => metric.key)).toContain("priority");
    expect(exported.playerProfiles.length).toBeGreaterThanOrEqual(2);
  });

  it("groups assignments for calendar views", () => {
    const base = createInitialProductState(fixedOptions);
    const scout = getActiveUser(base);
    const state = createAssignment(base, { title: "Mika Muster live sehen", dueAt: "2026-04-23" }, scout, fixedOptions);
    const calendar = buildCalendarModel(state.assignments);

    expect(calendar[0].dateKey).toBe("2026-04-23");
    expect(calendar[0].openCount).toBe(1);
  });
});
