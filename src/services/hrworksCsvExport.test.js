import { describe, expect, it } from "vitest";
import { buildHrworksImportCsv } from "./hrworksCsvExport";

describe("hrworksCsvExport", () => {
  it("builds semicolon CSV with escaped values", () => {
    const csv = buildHrworksImportCsv({
      planId: "p1",
      employeeName: "Max, Scout",
      date: "2026-04-20",
      startTime: "08:00",
      endTime: "10:30",
      workHours: 2.5,
      purpose: "Sichtung",
      note: "Spiel \"A\"",
      departureLocation: "Start",
      destinationLocation: "Ziel",
      intermediateStops: ["S1", "S2"],
      routeLegs: [
        { from: "Home", to: "Spiel A" },
        { from: "Spiel A", to: "Home" },
      ],
      costCenter: "321000",
      sourceGames: [{ home: "A", away: "B", venue: "V" }],
    });

    expect(csv).toMatch(/planId;employeeName;date/);
    expect(csv).toMatch(/20\.04\.2026/);
    expect(csv).toMatch(/"Spiel ""A"""/);
    expect(csv).toMatch(/S1 \| S2/);
    expect(csv).toMatch(/Home -> Spiel A \| Spiel A -> Home/);
  });
});
