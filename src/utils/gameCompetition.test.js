import { describe, expect, it } from "vitest";
import { resolveGameCompetitionLabel } from "./gameCompetition";

describe("resolveGameCompetitionLabel", () => {
  it("bevorzugt die explizite Liga des Spiels", () => {
    expect(
      resolveGameCompetitionLabel({
        league: "D-Junioren Kreisleistungsklasse",
        competitionName: "D-Junioren Niederrheinliga",
      }),
    ).toBe("D-Junioren Kreisleistungsklasse");
  });

  it("faellt auf weitere Wettbewerbsfelder zurueck", () => {
    expect(
      resolveGameCompetitionLabel({
        staffelName: "B-Junioren Bezirksliga",
      }),
    ).toBe("B-Junioren Bezirksliga");
  });

  it("liefert einen expliziten Fallback wenn keine Liga vorhanden ist", () => {
    expect(resolveGameCompetitionLabel({ home: "Team A", away: "Team B" })).toBe("Nicht angegeben");
  });
});
