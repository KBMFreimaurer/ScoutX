import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchGamesWithProviders, parseUploadedGames, parseUploadedGamesReport } from "./dataProvider";

describe("data provider", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("parses csv uploads", () => {
    const csv = `date;time;home;away;venue;km;kreisId;jugendId\n2026-05-01;10:00;Team A;Team B;Platz 1;12;duesseldorf;e-jugend`;
    const games = parseUploadedGames(csv, "games.csv", {
      kreisId: "duesseldorf",
      jugendId: "e-jugend",
      fromDate: "2026-04-01",
      turnier: false,
    });

    expect(games).toHaveLength(1);
    expect(games[0].home).toBe("Team A");
    expect(games[0].away).toBe("Team B");
    expect(games[0].km).toBe(12);
  });

  it("returns validation stats for mixed import rows", () => {
    const csv = `date,time,home,away\n2026-05-01,11:00,Team A,Team B\ninvalid,xx,Team C,Team D\n2026-05-03,13:00,Team E,`;
    const report = parseUploadedGamesReport(csv, "games.csv", {
      kreisId: "duesseldorf",
      jugendId: "e-jugend",
      fromDate: "2026-04-01",
      turnier: false,
    });

    expect(report.games).toHaveLength(2);
    expect(report.stats.totalRows).toBe(3);
    expect(report.stats.skippedRows).toBe(1);
    expect(report.stats.warnings.length).toBeGreaterThan(0);
  });

  it("uses csv provider in auto mode if matching games exist", async () => {
    const uploadedGames = parseUploadedGames(
      `date,time,home,away,venue,km,kreisId,jugendId\n2026-05-01,11:00,Team A,Team C,Platz 1,8,duesseldorf,e-jugend`,
      "games.csv",
      { kreisId: "duesseldorf", jugendId: "e-jugend", fromDate: "2026-05-01", turnier: false },
    );

    const result = await fetchGamesWithProviders({
      mode: "auto",
      kreisId: "duesseldorf",
      jugendId: "e-jugend",
      fromDate: "2026-05-01",
      toDate: "2026-05-07",
      teams: ["Team A", "Team C"],
      uploadedGames,
      adapterEndpoint: "http://localhost:3333/games",
    });

    expect(result.source).toBe("csv");
    expect(result.games).toHaveLength(1);
  });

  it("uses adapter provider when configured", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          games: [
            {
              date: "2026-05-01",
              time: "12:30",
              home: "Team X",
              away: "Team Y",
              venue: "Sportpark",
              km: 14,
              kreisId: "duesseldorf",
              jugendId: "e-jugend",
            },
          ],
        }),
      }),
    );

    const result = await fetchGamesWithProviders({
      mode: "adapter",
      kreisId: "duesseldorf",
      jugendId: "e-jugend",
      fromDate: "2026-05-01",
      toDate: "2026-05-07",
      teams: ["Team X", "Team Y"],
      uploadedGames: [],
      adapterEndpoint: "http://localhost:3333/games",
      adapterToken: "secret",
      turnier: false,
    });

    expect(result.source).toBe("adapter");
    expect(result.games).toHaveLength(1);
    expect(result.games[0].home).toBe("Team X");
  });

  it("matches adapter team names with fuzzy variants", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          games: [
            {
              date: "2026-05-01",
              time: "12:30",
              home: "ETB Schwarz-Weiß Essen",
              away: "KFC Uerdingen 05",
              venue: "Sportpark",
              km: 14,
              kreisId: "essen",
              jugendId: "a-jugend",
            },
          ],
        }),
      }),
    );

    const result = await fetchGamesWithProviders({
      mode: "adapter",
      kreisId: "essen",
      jugendId: "a-jugend",
      fromDate: "2026-05-01",
      toDate: "2026-05-07",
      teams: ["ETB SW Essen", "Uerdingen 05"],
      uploadedGames: [],
      adapterEndpoint: "http://localhost:3333/games",
      turnier: false,
    });

    expect(result.source).toBe("adapter");
    expect(result.games).toHaveLength(1);
    expect(result.games[0].home).toBe("ETB Schwarz-Weiß Essen");
  });

  it("keeps unfiltered adapter week data when selected teams have no match", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          games: [
            {
              date: "2026-05-01",
              time: "10:00",
              home: "DJK Arminia U12",
              away: "Rhenania Bottrop",
              venue: "Sportpark",
              km: 8,
              kreisId: "duisburg",
              jugendId: "d-jugend",
            },
          ],
        }),
      }),
    );

    const result = await fetchGamesWithProviders({
      mode: "adapter",
      kreisId: "duisburg",
      jugendId: "d-jugend",
      fromDate: "2026-05-01",
      toDate: "2026-05-07",
      teams: ["MSV Duisburg (U)", "SV Hamborn 07"],
      uploadedGames: [],
      adapterEndpoint: "http://localhost:3333/games",
      turnier: false,
    });

    expect(result.source).toBe("adapter");
    expect(result.games).toHaveLength(1);
    expect(result.games[0].home).toBe("DJK Arminia U12");
  });

  it("boosts selected-team matches without excluding other adapter games", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          games: [
            {
              date: "2026-05-01",
              time: "10:00",
              home: "MSV Duisburg U12",
              away: "SV Adler Osterfeld",
              venue: "Sportpark",
              km: 8,
              kreisId: "duisburg",
              jugendId: "d-jugend",
              priority: 3,
            },
            {
              date: "2026-05-01",
              time: "12:00",
              home: "DJK Arminia U12",
              away: "Rhenania Bottrop",
              venue: "Sportpark",
              km: 8,
              kreisId: "duisburg",
              jugendId: "d-jugend",
              priority: 3,
            },
          ],
        }),
      }),
    );

    const result = await fetchGamesWithProviders({
      mode: "adapter",
      kreisId: "duisburg",
      jugendId: "d-jugend",
      fromDate: "2026-05-01",
      toDate: "2026-05-07",
      teams: ["MSV Duisburg (U)"],
      uploadedGames: [],
      adapterEndpoint: "http://localhost:3333/games",
      turnier: false,
    });

    expect(result.source).toBe("adapter");
    expect(result.games).toHaveLength(2);

    const selectedGame = result.games.find((game) => game.home === "MSV Duisburg U12");
    const otherGame = result.games.find((game) => game.home === "DJK Arminia U12");

    expect(selectedGame?.selectedTeamMatch).toBe(true);
    expect(selectedGame?.priority).toBe(5);
    expect(otherGame?.selectedTeamMatch).toBeUndefined();
    expect(otherGame?.priority).toBeGreaterThan(0);
  });

  it("returns a timeout error when adapter request aborts", async () => {
    const abortError = new Error("aborted");
    abortError.name = "AbortError";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortError));

    await expect(
      fetchGamesWithProviders({
        mode: "adapter",
        kreisId: "duesseldorf",
        jugendId: "e-jugend",
        fromDate: "2026-04-01",
        toDate: "2026-04-07",
        teams: ["Team A", "Team B", "Team C", "Team D"],
        uploadedGames: [],
        adapterEndpoint: "http://localhost:3333/games",
      }),
    ).rejects.toThrow("Adapter Timeout");
  });

  it("does not use mock fallback in auto mode", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({}),
      }),
    );

    await expect(
      fetchGamesWithProviders({
        mode: "auto",
        kreisId: "duesseldorf",
        jugendId: "e-jugend",
        fromDate: "2026-04-01",
        toDate: "2026-04-07",
        teams: ["Team A", "Team B", "Team C", "Team D"],
        uploadedGames: [],
        adapterEndpoint: "http://localhost:3333/games",
      }),
    ).rejects.toThrow("Adapter HTTP 500");
  });

  it("does not use mock fallback in csv mode", async () => {
    const uploadedGames = parseUploadedGames(
      `date,time,home,away,venue,km,kreisId,jugendId\n2026-05-01,11:00,Team A,Team C,Platz 1,8,duesseldorf,e-jugend`,
      "games.csv",
      { kreisId: "duesseldorf", jugendId: "e-jugend", fromDate: "2026-04-01", turnier: false },
    );

    await expect(
      fetchGamesWithProviders({
        mode: "csv",
        kreisId: "duesseldorf",
        jugendId: "e-jugend",
        fromDate: "2026-04-01",
        toDate: "2026-04-07",
        teams: ["Team A", "Team C", "Team B", "Team D"],
        uploadedGames,
      }),
    ).rejects.toThrow("Import enthält keine passenden Spiele");
  });
});
