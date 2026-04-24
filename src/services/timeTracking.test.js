import { describe, expect, it } from "vitest";
import { buildTimeTrackingModel, formatCurrency, formatDuration, formatMonthLabel } from "./timeTracking";

describe("timeTracking", () => {
  it("aggregates recorded work time and fuel reimbursement by month", () => {
    const model = buildTimeTrackingModel(
      [
        {
          id: "plan-apr",
          meta: { scoutName: "Scout A", kmPauschale: 0.35, kreisLabel: "Duisburg", jugendLabel: "U17" },
          presenceByGame: { "g-1": 95, "g-2": "" },
          games: [
            { id: "g-1", date: "2026-04-11", time: "10:00", home: "Team A", away: "Team B", venue: "Platz 1", distanceKm: 12 },
            { id: "g-2", date: "2026-04-12", time: "12:00", home: "Team C", away: "Team D", venue: "Platz 2", distanceKm: 8 },
          ],
        },
        {
          id: "plan-may",
          meta: { kmPauschale: 0.4 },
          presenceByGame: { "g-3": 120 },
          games: [
            { id: "g-3", date: "2026-05-03", time: "09:30", home: "Team E", away: "Team F", fromStartRouteDistanceKm: 10 },
          ],
        },
      ],
      { defaultKmRate: 0.3 },
    );

    expect(model.months.map((month) => month.monthKey)).toEqual(["2026-05", "2026-04"]);
    expect(model.summary.sessionCount).toBe(3);
    expect(model.summary.trackedCount).toBe(2);
    expect(model.summary.openCount).toBe(1);
    expect(model.summary.totalMinutes).toBe(215);
    expect(model.summary.totalRoundtripKm).toBe(44);
    expect(model.summary.totalFuelEur).toBe(16.4);
    expect(model.months.find((month) => month.monthKey === "2026-04")).toMatchObject({
      sessionCount: 2,
      trackedCount: 1,
      openCount: 1,
      totalMinutes: 95,
      totalRoundtripKm: 24,
      totalFuelEur: 8.4,
    });
  });

  it("keeps missing distance transparent and excludes it from fuel amount", () => {
    const model = buildTimeTrackingModel([
      {
        id: "plan",
        presenceByGame: { "g-1": 60 },
        games: [{ id: "g-1", date: "2026-04-11", home: "A", away: "B" }],
      },
    ]);

    expect(model.summary.totalFuelEur).toBe(0);
    expect(model.summary.missingDistanceCount).toBe(1);
    expect(model.entries[0]).toMatchObject({ tracked: true, hasDistance: false, fuelEur: 0 });
  });

  it("formats labels for UI display", () => {
    expect(formatMonthLabel("2026-04")).toBe("April 2026");
    expect(formatDuration(125)).toBe("2 h 5 Min");
    expect(formatCurrency(8.4)).toBe("8,40 €");
  });
});
