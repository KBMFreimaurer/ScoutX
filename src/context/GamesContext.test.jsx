import { describe, expect, it } from "vitest";
import { __gamesContextTestables } from "./GamesContext";

describe("GamesContext mergeGamesAcrossKreise", () => {
  it("keeps games from different age groups when pairing/time/venue are identical", () => {
    const { mergeGamesAcrossKreise } = __gamesContextTestables;
    const merged = mergeGamesAcrossKreise([
      [
        {
          id: "g1",
          home: "MSV Duisburg",
          away: "Fortuna Düsseldorf",
          date: "2026-06-01",
          time: "14:00",
          venue: "Sportanlage Mitte",
          jugendId: "d-jugend",
          priority: 3,
        },
      ],
      [
        {
          id: "g2",
          home: "MSV Duisburg",
          away: "Fortuna Düsseldorf",
          date: "2026-06-01",
          time: "14:00",
          venue: "Sportanlage Mitte",
          jugendId: "c-jugend",
          priority: 4,
        },
      ],
    ]);

    expect(merged).toHaveLength(2);
    expect(merged.map((item) => item.jugendId).sort()).toEqual(["c-jugend", "d-jugend"]);
  });
});

describe("GamesContext applyVenueFallbackHeuristics", () => {
  it("suggests known venue when a game has K/A venue", () => {
    const { applyVenueFallbackHeuristics } = __gamesContextTestables;
    const result = applyVenueFallbackHeuristics([
      { id: "g1", home: "MSV U15", away: "Team A", venue: "Sportpark Nord" },
      { id: "g2", home: "MSV U15", away: "Team B", venue: "K/A" },
    ]);
    const unknown = result.find((item) => item.id === "g2");
    expect(unknown?.venue).toBe("K/A");
    expect(unknown?.venueSuggestion).toBe("Sportpark Nord");
    expect(unknown?.venueIsEstimated).toBe(true);
  });
});
