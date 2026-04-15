import { describe, expect, it } from "vitest";
import { buildDashboardModel, resolveGameDistanceKm } from "./dashboard";

describe("resolveGameDistanceKm", () => {
  it("prefers fromStartRouteDistanceKm over distanceKm", () => {
    const result = resolveGameDistanceKm({
      fromStartRouteDistanceKm: 14.8,
      distanceKm: 8.2,
    });

    expect(result).toBe(14.8);
  });

  it("returns null for invalid distance values", () => {
    const result = resolveGameDistanceKm({
      fromStartRouteDistanceKm: null,
      distanceKm: "n/a",
    });

    expect(result).toBeNull();
  });
});

describe("buildDashboardModel", () => {
  it("aggregates reports, costs and team activity from plan history", () => {
    const history = [
      {
        id: "plan-new",
        createdAt: "2026-04-14T10:00:00.000Z",
        meta: {
          jugendLabel: "C-Jugend",
          kreisLabel: "Duisburg",
          kmPauschale: 0.38,
        },
        selectedGameIds: ["g-2"],
        games: [
          {
            id: "g-1",
            date: "2026-04-12",
            home: "TSV A",
            away: "SV B",
            venue: "Platz Nord",
            distanceKm: 12.5,
          },
          {
            id: "g-2",
            date: "2026-04-13",
            home: "TSV A",
            away: "FC C",
            venue: "Platz Ost",
            fromStartRouteDistanceKm: 7.5,
          },
        ],
      },
      {
        id: "plan-old",
        createdAt: "2026-04-10T08:00:00.000Z",
        meta: {
          jugendLabel: "D-Jugend",
          kreisLabel: "Essen",
          kmPauschale: 0.3,
        },
        selectedGameIds: [],
        games: [
          {
            id: "g-3",
            date: "2026-04-04",
            home: "SV B",
            away: "RW D",
            venue: "Platz Nord",
          },
        ],
      },
    ];

    const model = buildDashboardModel(history);

    expect(model.summary.reportCount).toBe(2);
    expect(model.summary.gameCount).toBe(3);
    expect(model.summary.avgGamesPerReport).toBe(1.5);
    expect(model.summary.uniqueTeamCount).toBe(4);
    expect(model.summary.uniqueVenueCount).toBe(2);
    expect(model.summary.earliestDateKey).toBe("2026-04-04");
    expect(model.summary.latestDateKey).toBe("2026-04-13");
    expect(model.summary.totalDistanceKm).toBe(40);
    expect(model.summary.estimatedCostEur).toBe(15.2);
    expect(model.summary.withDistanceCount).toBe(2);
    expect(model.summary.withoutDistanceCount).toBe(1);
    expect(model.summary.distanceCoveragePct).toBe(66.7);
    expect(model.summary.lowDistanceCoverage).toBe(false);

    expect(model.topTeams).toEqual([
      { team: "FC C", count: 1 },
      { team: "TSV A", count: 1 },
    ]);
    expect(model.activeMonthKey).toBe("2026-04");
    expect(model.monthActivity).toEqual([{ monthKey: "2026-04", count: 3 }]);
    expect(model.weekdayActivity).toEqual([
      { weekday: 1, label: "Mo", count: 1 },
      { weekday: 2, label: "Di", count: 0 },
      { weekday: 3, label: "Mi", count: 0 },
      { weekday: 4, label: "Do", count: 0 },
      { weekday: 5, label: "Fr", count: 0 },
      { weekday: 6, label: "Sa", count: 1 },
      { weekday: 0, label: "So", count: 1 },
    ]);

    expect(model.latestReports[0].id).toBe("plan-new");
    expect(model.latestReports[1].id).toBe("plan-old");
  });

  it("filters metrics by selected month and falls back to latest month", () => {
    const history = [
      {
        id: "plan-may",
        createdAt: "2026-05-12T10:00:00.000Z",
        selectedGameIds: ["g-m1"],
        games: [
          {
            id: "g-m1",
            date: "2026-05-11",
            home: "Team May A",
            away: "Team May B",
            venue: "Platz May",
            distanceKm: 11,
          },
        ],
      },
      {
        id: "plan-apr",
        createdAt: "2026-04-12T10:00:00.000Z",
        selectedGameIds: ["g-a1"],
        games: [
          {
            id: "g-a1",
            date: "2026-04-11",
            home: "Team Apr A",
            away: "Team Apr B",
            venue: "Platz Apr",
            distanceKm: 8,
          },
        ],
      },
    ];

    const mayModel = buildDashboardModel(history, { monthKey: "2026-05" });
    expect(mayModel.activeMonthKey).toBe("2026-05");
    expect(mayModel.summary.gameCount).toBe(1);
    expect(mayModel.summary.totalDistanceKm).toBe(22);
    expect(mayModel.topTeams).toEqual([
      { team: "Team May A", count: 1 },
      { team: "Team May B", count: 1 },
    ]);
    expect(mayModel.latestReports.map((entry) => entry.id)).toEqual(["plan-may"]);

    const aprModel = buildDashboardModel(history, { monthKey: "2026-04" });
    expect(aprModel.activeMonthKey).toBe("2026-04");
    expect(aprModel.summary.gameCount).toBe(1);
    expect(aprModel.summary.totalDistanceKm).toBe(16);
    expect(aprModel.topTeams).toEqual([
      { team: "Team Apr A", count: 1 },
      { team: "Team Apr B", count: 1 },
    ]);
    expect(aprModel.latestReports.map((entry) => entry.id)).toEqual(["plan-apr"]);

    const fallbackModel = buildDashboardModel(history, { monthKey: "2026-01" });
    expect(fallbackModel.activeMonthKey).toBe("2026-05");
  });

  it("uses default km rate when entry kmPauschale is invalid", () => {
    const history = [
      {
        id: "plan-1",
        createdAt: "2026-04-01T12:00:00.000Z",
        meta: {
          kmPauschale: "",
        },
        games: [
          {
            id: "g-1",
            date: "2026-04-01",
            home: "A",
            away: "B",
            distanceKm: 10,
          },
        ],
      },
    ];

    const model = buildDashboardModel(history);

    expect(model.summary.totalDistanceKm).toBe(20);
    expect(model.summary.estimatedCostEur).toBe(6);
    expect(model.latestReports[0].estimatedCostEur).toBe(6);
  });

  it("returns a stable empty model when no history exists", () => {
    const model = buildDashboardModel([]);

    expect(model.summary.reportCount).toBe(0);
    expect(model.summary.gameCount).toBe(0);
    expect(model.summary.totalDistanceKm).toBe(0);
    expect(model.summary.estimatedCostEur).toBe(0);
    expect(model.summary.lowDistanceCoverage).toBe(false);
    expect(model.topTeams).toEqual([]);
    expect(model.latestReports).toEqual([]);
    expect(model.weekdayActivity).toHaveLength(7);
  });

  it("flags low distance coverage when less than 30 percent have distance", () => {
    const history = [
      {
        id: "plan-1",
        createdAt: "2026-04-01T12:00:00.000Z",
        games: [
          { id: "g-1", date: "2026-04-01", home: "A", away: "B", distanceKm: 10 },
          { id: "g-2", date: "2026-04-02", home: "C", away: "D" },
          { id: "g-3", date: "2026-04-03", home: "E", away: "F" },
          { id: "g-4", date: "2026-04-04", home: "G", away: "H" },
          { id: "g-5", date: "2026-04-05", home: "I", away: "J" },
        ],
      },
    ];

    const model = buildDashboardModel(history);

    expect(model.summary.distanceCoveragePct).toBe(20);
    expect(model.summary.lowDistanceCoverage).toBe(true);
  });
});
