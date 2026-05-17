import { describe, expect, it } from "vitest";
import {
  addReportComment,
  addWatchlistEntry,
  analyzeReport,
  attachReportAnalysis,
  buildGameObservationMap,
  buildCalendarModel,
  buildTeamOverview,
  buildTeamFeed,
  buildGlobalSearchResults,
  buildPlayerProfiles,
  buildScoutingDashboard,
  canViewEntity,
  comparePlayers,
  createAssignment,
  createInitialProductState,
  createObservationMatchReport,
  createReportInput,
  createWatchlist,
  deleteSearchFilter,
  exportProductSnapshot,
  getActiveUser,
  markGameObservationSeen,
  normalizeProductState,
  publishTeamPlan,
  reassignObservation,
  removeWatchlistEntry,
  saveSearchFilter,
  switchActiveUser,
  updateAssignmentStatus,
  updateObservationNote,
  updateReportStatus,
  updateTeamGoals,
  updateWatchlistEntry,
  upsertManualGame,
  upsertTeamAccount,
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

    expect(state.version).toBe(2);
    expect(state.team.accounts.map((account) => account.id)).toContain("user-scout");
    expect(state.team.accounts.every((account) => account.active)).toBe(true);
    expect(state.users.length).toBeGreaterThanOrEqual(4);
    expect(state.reports).toHaveLength(0);
    expect(state.watchlists).toHaveLength(0);
    expect(state.assignments).toHaveLength(0);
    expect(state.notifications).toHaveLength(0);
    expect(state.observations).toHaveLength(0);
    expect(state.feedItems).toHaveLength(0);
    expect(getActiveUser(state).role).toBe("scout");
  });

  it("migrates v1 product state to team feed state without losing existing data", () => {
    const legacy = normalizeProductState(
      {
        version: 1,
        activeUserId: "user-scout",
        users: createInitialProductState(fixedOptions).users,
        reports: [
          {
            id: "report-1",
            type: "player",
            title: "Bestandsbericht",
            ownerId: "user-scout",
            authorId: "user-scout",
            visibility: "team",
            createdAt: "2026-04-22T10:00:00.000Z",
            updatedAt: "2026-04-22T10:00:00.000Z",
          },
        ],
        watchlists: [],
        assignments: [],
        notifications: [],
        savedFilters: [],
      },
      fixedOptions,
    );

    expect(legacy.version).toBe(2);
    expect(legacy.reports).toHaveLength(1);
    expect(legacy.team.accounts.find((account) => account.id === "user-scout")).toMatchObject({
      name: "Scout",
      role: "scout",
      active: true,
    });
    expect(legacy.observations).toEqual([]);
    expect(legacy.feedItems).toEqual([]);
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

  it("publishes a finalized plan to team observations and feed items", () => {
    const state = createInitialProductState(fixedOptions);
    const scout = getActiveUser(state);
    const games = [
      { id: "game-1", home: "Team A", away: "Team B", dateLabel: "Fr, 01.05.2026", time: "14:00", venue: "Platz A" },
      { id: "game-2", home: "Team C", away: "Team D", dateLabel: "Sa, 02.05.2026", time: "11:00", venue: "Platz B" },
    ];

    const next = publishTeamPlan(
      state,
      {
        games,
        planHistoryId: "plan-1",
        note: "Wochenendplan",
      },
      scout,
      fixedOptions,
    );

    expect(next.observations).toHaveLength(2);
    expect(next.observations[0]).toMatchObject({
      gameId: "game-1",
      scoutId: scout.id,
      status: "planned",
      planHistoryId: "plan-1",
      note: "Wochenendplan",
    });
    expect(next.feedItems[0]).toMatchObject({
      type: "plan_published",
      actorId: scout.id,
      planHistoryId: "plan-1",
      gameIds: ["game-1", "game-2"],
    });
    expect(next.feedItems[0].title).toMatch(/Scout hat 2 Spiele in seinen Plan genommen/);
    expect(next.notifications[0]).toMatchObject({
      type: "team_feed",
      title: "Team-Plan veröffentlicht",
    });
  });

  it("creates an actionable notification for a direct assignment", () => {
    const state = createInitialProductState(fixedOptions);
    const coordinator = state.users.find((user) => user.role === "coordinator");
    const scout = state.users.find((user) => user.id === "user-scout");

    const next = createAssignment(
      state,
      {
        title: "Spiel Team A vs Team B übernehmen",
        assigneeId: scout.id,
        dueAt: "2026-04-23",
      },
      coordinator,
      fixedOptions,
    );

    expect(next.notifications[0]).toMatchObject({
      type: "direct_assignment",
      title: "Direkte Zuweisung",
      body: "Spiel Team A vs Team B übernehmen",
      entityType: "assignment",
      entityId: next.assignments[0].id,
      recipientId: scout.id,
    });
  });

  it("notifies assigned scouts when their manual game changes or is cancelled", () => {
    let state = createInitialProductState(fixedOptions);
    const coordinator = state.users.find((user) => user.role === "coordinator");
    const scout = getActiveUser(state);

    state = upsertManualGame(
      state,
      {
        id: "manual-1",
        home: "Team A",
        away: "Team B",
        date: "2026-04-23",
        time: "14:00",
        venue: "Platz A",
      },
      coordinator,
      fixedOptions,
    );
    state = publishTeamPlan(state, { games: [state.manualGames[0]], planHistoryId: "plan-manual" }, scout, fixedOptions);

    const changed = upsertManualGame(
      state,
      {
        id: "manual-1",
        home: "Team A",
        away: "Team B",
        date: "2026-04-23",
        time: "15:00",
        venue: "Platz B",
      },
      coordinator,
      fixedOptions,
    );

    expect(changed.notifications[0]).toMatchObject({
      type: "own_game_changed",
      title: "Eigenes Spiel geändert",
      recipientId: scout.id,
      entityType: "game",
      entityId: "manual-1",
    });

    const cancelled = upsertManualGame(
      changed,
      {
        id: "manual-1",
        home: "Team A",
        away: "Team B",
        date: "2026-04-23",
        time: "15:00",
        venue: "Platz B",
        status: "cancelled",
      },
      coordinator,
      fixedOptions,
    );

    expect(cancelled.manualGames[0].status).toBe("cancelled");
    expect(cancelled.notifications[0]).toMatchObject({
      type: "game_cancelled",
      title: "Spielabsage",
      recipientId: scout.id,
      entityType: "game",
      entityId: "manual-1",
    });
  });

  it("creates actionable notifications for detected scout conflicts", () => {
    const state = createInitialProductState(fixedOptions);
    const scout = getActiveUser(state);
    const games = [
      { id: "game-1", home: "Team A", away: "Team B", date: "2026-04-23", time: "14:00", durationMinutes: 90 },
      { id: "game-2", home: "Team C", away: "Team D", date: "2026-04-23", time: "14:30", durationMinutes: 90 },
    ];

    const next = publishTeamPlan(state, { games, planHistoryId: "plan-conflict" }, scout, fixedOptions);

    expect(next.notifications[0]).toMatchObject({
      type: "schedule_conflict",
      title: "Konflikt erkannt",
      recipientId: scout.id,
      entityType: "schedule_conflict",
    });
    expect(next.notifications[0].body).toMatch(/Team A vs Team B.*Team C vs Team D/);
  });

  it("keeps multiple scouts per game and aggregates planning markers", () => {
    let state = createInitialProductState(fixedOptions);
    const scout = getActiveUser(state);
    const coordinator = state.users.find((user) => user.role === "coordinator");
    const game = { id: "game-1", home: "Team A", away: "Team B", dateLabel: "Fr, 01.05.2026", time: "14:00" };

    state = publishTeamPlan(state, { games: [game], planHistoryId: "plan-a" }, scout, fixedOptions);
    state = publishTeamPlan(state, { games: [game], planHistoryId: "plan-b" }, coordinator, {
      ...fixedOptions,
      random: () => 0.654321,
    });

    const map = buildGameObservationMap(state, { user: scout });

    expect(map["game-1"].plannedBy.map((entry) => entry.scoutName)).toEqual(["Koordination", "Scout"]);
    expect(map["game-1"].plannedByOtherScouts).toEqual(["Koordination"]);
    expect(map["game-1"].label).toBe("im Plan von Koordination, Scout");
  });

  it("builds a team overview with today coverage, duplicate games and open games", () => {
    let state = createInitialProductState(fixedOptions);
    const scout = getActiveUser(state);
    const coordinator = state.users.find((user) => user.role === "coordinator");
    const games = [
      { id: "game-1", home: "Team A", away: "Team B", date: "2026-04-23", time: "14:00" },
      { id: "game-2", home: "Team C", away: "Team D", date: "2026-04-23", time: "16:00" },
      { id: "game-3", home: "Team E", away: "Team F", date: "2026-04-24", time: "11:00" },
    ];

    state = publishTeamPlan(state, { games: [games[0]], planHistoryId: "plan-a" }, scout, fixedOptions);
    state = publishTeamPlan(state, { games: [games[0]], planHistoryId: "plan-b" }, coordinator, {
      ...fixedOptions,
      random: () => 0.654321,
    });

    const overview = buildTeamOverview(state, { games, date: "2026-04-23", user: scout });

    expect(overview.activeScoutsToday.map((item) => item.scoutName)).toEqual(["Koordination", "Scout"]);
    expect(overview.duplicateGames[0]).toMatchObject({
      gameId: "game-1",
      scoutNames: ["Koordination", "Scout"],
    });
    expect(overview.openGames.map((item) => item.gameId)).toEqual(["game-2"]);
  });

  it("builds weekly scout load and flags overplanned scouts", () => {
    let state = createInitialProductState(fixedOptions);
    const scout = getActiveUser(state);
    const games = [
      { id: "game-1", home: "Team A", away: "Team B", date: "2026-04-23", time: "10:00" },
      { id: "game-2", home: "Team C", away: "Team D", date: "2026-04-23", time: "13:00" },
      { id: "game-3", home: "Team E", away: "Team F", date: "2026-04-23", time: "16:00" },
      { id: "game-4", home: "Team G", away: "Team H", date: "2026-04-25", time: "11:00" },
    ];

    state = publishTeamPlan(state, { games, planHistoryId: "plan-a" }, scout, fixedOptions);

    const overview = buildTeamOverview(state, {
      games,
      date: "2026-04-23",
      maxGamesPerScoutPerDay: 2,
      user: scout,
    });

    expect(overview.activeScoutsWeek).toEqual([
      expect.objectContaining({
        scoutId: scout.id,
        count: 4,
        dates: ["2026-04-23", "2026-04-25"],
      }),
    ]);
    expect(overview.overplannedScouts).toEqual([
      expect.objectContaining({
        scoutId: scout.id,
        dateKey: "2026-04-23",
        count: 3,
        maxGames: 2,
      }),
    ]);
  });

  it("stores manual games teamwide and adds a feed entry", () => {
    const state = createInitialProductState(fixedOptions);
    const scout = getActiveUser(state);

    const next = upsertManualGame(
      state,
      {
        home: "Inoffizielles Team A",
        away: "Inoffizielles Team B",
        date: "2026-04-23",
        time: "18:00",
        venue: "Nebenplatz",
      },
      scout,
      fixedOptions,
    );

    expect(next.manualGames[0]).toMatchObject({
      source: "manual",
      home: "Inoffizielles Team A",
      away: "Inoffizielles Team B",
      date: "2026-04-23",
      time: "18:00",
    });
    expect(next.feedItems[0]).toMatchObject({
      type: "manual_game_created",
      gameIds: [next.manualGames[0].id],
    });
  });

  it("stores team goals and reports priority coverage", () => {
    let state = createInitialProductState(fixedOptions);
    const scout = getActiveUser(state);
    const games = [
      { id: "game-1", home: "MSV Duisburg U13", away: "Team B", date: "2026-04-23", time: "14:00", jugendId: "d-jugend" },
      { id: "game-2", home: "MSV Duisburg U12", away: "Team C", date: "2026-04-23", time: "16:00", jugendId: "d-jugend" },
      { id: "game-3", home: "Neutral A", away: "Neutral B", date: "2026-04-23", time: "18:00", jugendId: "c-jugend" },
    ];

    state = updateTeamGoals(
      state,
      {
        favoriteClubs: ["MSV Duisburg"],
        leaguePriorities: ["Niederrheinliga"],
        ageGroups: ["d-jugend"],
      },
      scout,
      fixedOptions,
    );
    state = publishTeamPlan(state, { games: [games[0]], planHistoryId: "plan-a" }, scout, fixedOptions);

    const overview = buildTeamOverview(state, { games, date: "2026-04-23", user: scout });

    expect(state.teamGoals).toMatchObject({
      favoriteClubs: ["MSV Duisburg"],
      leaguePriorities: ["Niederrheinliga"],
      ageGroups: ["d-jugend"],
    });
    expect(overview.coverage).toMatchObject({
      priorityGames: 2,
      coveredPriorityGames: 1,
      openPriorityGames: 1,
    });
  });

  it("derives stale priority teams from explicit team goals", () => {
    let state = createInitialProductState(fixedOptions);
    const scout = getActiveUser(state);
    const oldGame = { id: "old-game", home: "MSV Duisburg U13", away: "Team B", date: "2026-04-01", time: "14:00" };
    const games = [
      oldGame,
      { id: "game-1", home: "MSV Duisburg U13", away: "Team C", date: "2026-04-23", time: "14:00" },
      { id: "game-2", home: "VfL Test U12", away: "Team D", date: "2026-04-23", time: "16:00" },
    ];

    state = updateTeamGoals(
      state,
      {
        favoriteTeams: ["MSV Duisburg U13", "VfL Test U12"],
        favoriteClubs: ["MSV Duisburg"],
      },
      scout,
      fixedOptions,
    );
    state = {
      ...state,
      observations: [
        {
          id: "obs-old",
          gameId: oldGame.id,
          scoutId: scout.id,
          status: "seen",
          game: oldGame,
          seenAt: "2026-04-01T10:00:00.000Z",
          createdAt: "2026-04-01T10:00:00.000Z",
          updatedAt: "2026-04-01T10:00:00.000Z",
        },
      ],
    };

    const overview = buildTeamOverview(state, {
      games,
      date: "2026-04-23",
      maxPriorityTeamUnseenDays: 14,
      user: scout,
    });

    expect(state.teamGoals.favoriteTeams).toEqual(["MSV Duisburg U13", "VfL Test U12"]);
    expect(overview.coverage.stalePriorityTeams).toEqual([
      expect.objectContaining({ teamName: "MSV Duisburg U13", daysSinceSeen: 22 }),
      expect.objectContaining({ teamName: "VfL Test U12", daysSinceSeen: null }),
    ]);
  });

  it("flags per-scout time and travel conflicts in the team overview", () => {
    let state = createInitialProductState(fixedOptions);
    const scout = getActiveUser(state);
    const games = [
      {
        id: "game-1",
        home: "Team A",
        away: "Team B",
        date: "2026-04-23",
        time: "14:00",
        durationMinutes: 60,
        travelMinutesToNext: 35,
      },
      { id: "game-2", home: "Team C", away: "Team D", date: "2026-04-23", time: "15:20", durationMinutes: 80 },
    ];

    state = publishTeamPlan(state, { games, planHistoryId: "plan-a" }, scout, fixedOptions);

    const overview = buildTeamOverview(state, { games, date: "2026-04-23", user: scout });

    expect(overview.conflicts).toHaveLength(1);
    expect(overview.conflicts[0]).toMatchObject({
      scoutId: scout.id,
      type: "travel",
      severity: "hard-conflict",
      firstGameId: "game-1",
      secondGameId: "game-2",
    });
  });

  it("flags missing start-location buffer before a scout's first game", () => {
    let state = createInitialProductState(fixedOptions);
    const scout = getActiveUser(state);
    const games = [
      {
        id: "game-1",
        home: "Team A",
        away: "Team B",
        date: "2026-04-23",
        time: "14:00",
        fromStartRouteMinutes: 25,
      },
    ];

    state = publishTeamPlan(state, { games, planHistoryId: "plan-start" }, scout, fixedOptions);

    const overview = buildTeamOverview(state, {
      games,
      date: "2026-04-23",
      startTime: "13:30",
      minBufferMinutes: 10,
      user: scout,
    });

    expect(overview.conflicts).toEqual([
      expect.objectContaining({
        scoutId: scout.id,
        type: "start_travel",
        severity: "warn",
        firstGameId: "",
        secondGameId: "game-1",
        gapMinutes: 30,
        requiredGap: 35,
      }),
    ]);
  });

  it("allows scouts to mark their own planned game as seen and coordinators to correct others", () => {
    let state = createInitialProductState(fixedOptions);
    const scout = getActiveUser(state);
    const coordinator = state.users.find((user) => user.role === "coordinator");
    const game = { id: "game-1", home: "Team A", away: "Team B", dateLabel: "Fr, 01.05.2026", time: "14:00" };

    state = publishTeamPlan(state, { games: [game], planHistoryId: "plan-a" }, scout, fixedOptions);
    state = markGameObservationSeen(state, "game-1", scout.id, scout, { ...fixedOptions, random: () => 0.234567 });

    expect(state.observations[0]).toMatchObject({ status: "seen", seenAt: "2026-04-23T10:00:00.000Z" });

    const corrected = markGameObservationSeen(state, "game-1", scout.id, coordinator, {
      ...fixedOptions,
      random: () => 0.345678,
    });
    expect(corrected.feedItems[0].type).toBe("game_seen");
  });

  it("creates a match report from a seen observation and links it back to the team state", () => {
    let state = createInitialProductState(fixedOptions);
    const scout = getActiveUser(state);
    const game = { id: "game-1", home: "Team A", away: "Team B", date: "2026-05-01", time: "14:00" };

    state = publishTeamPlan(state, { games: [game], planHistoryId: "plan-a" }, scout, fixedOptions);
    state = markGameObservationSeen(state, "game-1", scout.id, scout, { ...fixedOptions, random: () => 0.234567 });

    const next = createObservationMatchReport(state, state.observations[0].id, scout, fixedOptions);

    expect(next.reports[0]).toMatchObject({
      id: `report-${state.observations[0].id}`,
      type: "match",
      title: "Spielbericht: Team A vs Team B",
      context: {
        observationId: state.observations[0].id,
        gameId: "game-1",
        scoutId: scout.id,
      },
    });
    expect(next.observations[0]).toMatchObject({
      reportId: next.reports[0].id,
      reportUrl: `#report-${next.reports[0].id}`,
    });
    expect(next.feedItems[0]).toMatchObject({
      type: "report_linked",
      observationId: state.observations[0].id,
      gameIds: ["game-1"],
    });
  });

  it("notifies watchlist owners when a new report matches their own target", () => {
    let state = createInitialProductState(fixedOptions);
    const scout = getActiveUser(state);
    const coordinator = state.users.find((user) => user.role === "coordinator");

    state = createWatchlist(state, { id: "watchlist-1", name: "Prioritäten", visibility: "team" }, scout, fixedOptions);
    state = addWatchlistEntry(
      state,
      "watchlist-1",
      { playerName: "Max Muster", club: "Team A", priority: 5 },
      scout,
      fixedOptions,
    );

    const next = upsertReport(
      state,
      {
        type: "player",
        title: "Report Max Muster",
        ownerId: coordinator.id,
        visibility: "team",
        context: { playerName: "Max Muster" },
      },
      coordinator,
      fixedOptions,
    );

    expect(next.notifications[0]).toMatchObject({
      type: "target_report_created",
      title: "Neuer Report zu eigenem Ziel",
      body: "Report Max Muster",
      entityType: "report",
      entityId: next.reports[0].id,
      recipientId: scout.id,
    });
  });

  it("adds a note to a seen observation and records the lifecycle feed entry", () => {
    let state = createInitialProductState(fixedOptions);
    const scout = getActiveUser(state);
    const game = { id: "game-1", home: "Team A", away: "Team B", date: "2026-05-01", time: "14:00" };

    state = publishTeamPlan(state, { games: [game], planHistoryId: "plan-a" }, scout, fixedOptions);
    state = markGameObservationSeen(state, "game-1", scout.id, scout, { ...fixedOptions, random: () => 0.234567 });

    const next = updateObservationNote(
      state,
      state.observations[0].id,
      "Nr. 10 im zweiten Drittel nochmal prüfen. @user-coordinator",
      scout,
      fixedOptions,
    );

    expect(next.observations[0]).toMatchObject({
      id: state.observations[0].id,
      note: "Nr. 10 im zweiten Drittel nochmal prüfen. @user-coordinator",
      updatedAt: "2026-04-23T10:00:00.000Z",
    });
    expect(next.feedItems[0]).toMatchObject({
      type: "observation_note_added",
      observationId: state.observations[0].id,
      gameIds: ["game-1"],
    });
    expect(
      next.notifications.some(
        (notification) => String(notification.type || "").trim().toLowerCase() === "mention" && notification.recipientId === "user-coordinator",
      ),
    ).toBe(true);
  });

  it("requires a seen observation before creating an observation match report", () => {
    let state = createInitialProductState(fixedOptions);
    const scout = getActiveUser(state);
    const game = { id: "game-1", home: "Team A", away: "Team B" };

    state = publishTeamPlan(state, { games: [game], planHistoryId: "plan-a" }, scout, fixedOptions);

    expect(() => createObservationMatchReport(state, state.observations[0].id, scout, fixedOptions)).toThrow(
      /gesehen/,
    );
  });

  it("allows coordinators to reassign observations to active scouts", () => {
    let state = createInitialProductState(fixedOptions);
    const scout = getActiveUser(state);
    const coordinator = state.users.find((user) => user.role === "coordinator");
    const game = { id: "game-1", home: "Team A", away: "Team B", date: "2026-05-01", time: "14:00" };

    state = publishTeamPlan(state, { games: [game], planHistoryId: "plan-a" }, scout, fixedOptions);
    const observationId = state.observations[0].id;
    const next = reassignObservation(state, observationId, "user-coordinator", coordinator, fixedOptions);

    expect(next.observations[0]).toMatchObject({
      gameId: "game-1",
      scoutId: "user-coordinator",
    });
    expect(next.feedItems[0]).toMatchObject({
      type: "observation_reassigned",
      gameIds: ["game-1"],
    });
  });

  it("lets coordinators manage team accounts while guests stay read-only", () => {
    const state = createInitialProductState(fixedOptions);
    const coordinator = state.users.find((user) => user.role === "coordinator");
    const readonly = state.users.find((user) => user.role === "readonly");

    const next = upsertTeamAccount(
      state,
      { id: "user-new-scout", name: "Scout Nord", role: "scout", active: false },
      coordinator,
    );

    expect(next.team.accounts.find((account) => account.id === "user-new-scout")).toMatchObject({
      name: "Scout Nord",
      role: "scout",
      active: false,
    });
    expect(next.users.find((user) => user.id === "user-new-scout")).toMatchObject({
      name: "Scout Nord",
      role: "scout",
    });
    expect(() => upsertTeamAccount(next, { id: "user-new-scout", name: "Scout Nord", role: "admin" }, readonly)).toThrow(
      /Team-Accounts verwalten/,
    );
  });

  it("exposes visible feed and exports team planning data", () => {
    const state = publishTeamPlan(
      createInitialProductState(fixedOptions),
      { games: [{ id: "game-1", home: "Team A", away: "Team B" }], planHistoryId: "plan-a" },
      getActiveUser(createInitialProductState(fixedOptions)),
      fixedOptions,
    );
    const feed = buildTeamFeed(state, { user: getActiveUser(state) });
    const exported = JSON.parse(exportProductSnapshot({ state, user: getActiveUser(state) }));

    expect(feed[0].title).toMatch(/Scout hat 1 Spiel in seinen Plan genommen/);
    expect(exported.team.accounts).toHaveLength(state.team.accounts.length);
    expect(exported.observations).toHaveLength(1);
    expect(exported.feedItems).toHaveLength(1);
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
