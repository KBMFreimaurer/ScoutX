import { describe, expect, it } from "vitest";
import {
  buildGameCompetitionSummary,
  resolveGameCompetitionLabel,
  resolveGameCompetitionType,
} from "./gameCompetition";

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

  it("klassifiziert Turniere und DFB-Spiele als eigene Wettbewerbstypen", () => {
    expect(resolveGameCompetitionType({ source: "tournament", turnier: true }).label).toBe("Turnier");
    expect(resolveGameCompetitionType({ source: "national", provider: "dfb.de", ageGroup: "U21" }).label).toBe(
      "DFB U21",
    );
    expect(resolveGameCompetitionType({ league: "D-Junioren Niederrheinliga" }).label).toBe("Ligaspiel");
  });

  it("baut eine uebersichtliche Zusammenfassung nach Wettbewerbstypen", () => {
    expect(
      buildGameCompetitionSummary([
        { source: "tournament", turnier: true },
        { source: "national", provider: "dfb.de", ageGroup: "U21" },
        { league: "D-Junioren Niederrheinliga" },
      ]),
    ).toEqual([
      { key: "league", label: "Ligaspiele", count: 1 },
      { key: "tournament", label: "Turniere", count: 1 },
      { key: "national", label: "DFB-Spiele", count: 1 },
    ]);
  });
});
