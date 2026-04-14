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

    expect(model.topTeams[0]).toEqual({ team: "SV B", count: 2 });
    expect(model.topTeams[1]).toEqual({ team: "TSV A", count: 2 });
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
    expect(model.topTeams).toEqual([]);
    expect(model.latestReports).toEqual([]);
    expect(model.weekdayActivity).toHaveLength(7);
  });
});
