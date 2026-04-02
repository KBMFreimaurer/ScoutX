import { describe, expect, it } from "vitest";
import { dedupeGames, filterGames, isLikelyTeamMatch, normalizeGames, normalizeTeam } from "./games";

describe("adapter games lib", () => {
  it("normalizes mixed payloads", () => {
    const games = normalizeGames(
      {
        games: [
          {
            heim: "Team A",
            gast: "Team B",
            date: "2026-04-10",
            time: "11:00",
            kreisId: "duesseldorf",
            jugendId: "d-jugend",
          },
          { home: "", away: "Team C", date: "2026-04-10" },
        ],
      },
      { source: "test" },
    );

    expect(games).toHaveLength(1);
    expect(games[0].home).toBe("Team A");
    expect(games[0].away).toBe("Team B");
    expect(games[0].source).toBe("test");
  });

  it("filters by selection payload", () => {
    const games = normalizeGames({
      games: [
        {
          home: "Team A",
          away: "Team B",
          date: "2026-04-10",
          time: "11:00",
          kreisId: "duesseldorf",
          jugendId: "d-jugend",
        },
        {
          home: "Team C",
          away: "Team D",
          date: "2026-04-12",
          time: "12:00",
          kreisId: "duisburg",
          jugendId: "c-jugend",
        },
      ],
    });

    const filtered = filterGames(games, {
      kreisId: "duesseldorf",
      jugendId: "d-jugend",
      fromDate: "2026-04-01",
      toDate: "2026-04-11",
      teams: ["Team A"],
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].home).toBe("Team A");
  });

  it("applies upper week bound via toDate", () => {
    const games = normalizeGames({
      games: [
        { home: "Team A", away: "Team B", date: "2026-04-04", time: "11:00" },
        { home: "Team C", away: "Team D", date: "2026-04-11", time: "11:00" },
      ],
    });

    const filtered = filterGames(games, {
      fromDate: "2026-03-30",
      toDate: "2026-04-05",
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].home).toBe("Team A");
  });

  it("applies team aliases and deduplicates", () => {
    const aliasMap = {
      "fortuna dusseldorf u19": "Fortuna Düsseldorf (U)",
    };

    expect(normalizeTeam("Fortuna Dusseldorf U19", aliasMap)).toBe("Fortuna Düsseldorf (U)");

    const games = normalizeGames(
      [
        {
          home: "Fortuna Dusseldorf U19",
          away: "Team B",
          date: "2026-04-10",
          time: "11:00",
          kreisId: "duesseldorf",
          jugendId: "d-jugend",
        },
        {
          home: "Fortuna Düsseldorf (U)",
          away: "Team B",
          date: "2026-04-10",
          time: "11:00",
          kreisId: "duesseldorf",
          jugendId: "d-jugend",
        },
      ],
      { aliasMap, source: "test" },
    );

    const deduped = dedupeGames(games);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].home).toBe("Fortuna Düsseldorf (U)");
  });

  it("matches team names robustly in filters", () => {
    expect(isLikelyTeamMatch("ETB SW Essen", "ETB Schwarz-Weiß Essen")).toBe(true);
    expect(isLikelyTeamMatch("Uerdingen 05", "KFC Uerdingen 05")).toBe(true);

    const aliasMap = {
      "etb sw essen": "ETB Schwarz-Weiß Essen",
    };

    const games = normalizeGames(
      [
        {
          home: "ETB Schwarz-Weiß Essen",
          away: "SC St.Tönis",
          date: "2026-04-12",
          time: "10:00",
          kreisId: "essen",
          jugendId: "a-jugend",
        },
      ],
      { aliasMap, source: "test" },
    );

    const filtered = filterGames(
      games,
      {
        kreisId: "essen",
        jugendId: "a-jugend",
        fromDate: "2026-04-11",
        toDate: "2026-04-12",
        teams: ["ETB SW Essen"],
      },
      { aliasMap },
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0].home).toBe("ETB Schwarz-Weiß Essen");
  });
});
