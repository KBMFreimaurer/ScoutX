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

  it("parses quoted csv cells with delimiters and escaped quotes", () => {
    const csv =
      'date;time;home;away;venue;km;kreisId;jugendId\n2026-05-01;10:00;"Team ""A""";"Team;B";"Platz ""Mitte""; Feld 1";12;duesseldorf;e-jugend';
    const games = parseUploadedGames(csv, "games.csv", {
      kreisId: "duesseldorf",
      jugendId: "e-jugend",
      fromDate: "2026-04-01",
      turnier: false,
    });

    expect(games).toHaveLength(1);
    expect(games[0].home).toBe('Team "A"');
    expect(games[0].away).toBe("Team;B");
    expect(games[0].venue).toBe('Platz "Mitte"; Feld 1');
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

  it("uses fallback date for invalid calendar values instead of JS date rollover", () => {
    const report = parseUploadedGamesReport(`date,time,home,away\n31.02.2026,11:00,Team A,Team B`, "games.csv", {
      kreisId: "duesseldorf",
      jugendId: "e-jugend",
      fromDate: "2026-04-01",
      turnier: false,
    });

    expect(report.games).toHaveLength(1);
    const dateObj = report.games[0].dateObj;
    expect(dateObj.getFullYear()).toBe(2026);
    expect(dateObj.getMonth()).toBe(3);
    expect(dateObj.getDate()).toBe(1);
    expect(report.stats.warnings.some((warning) => warning.includes("Datum ungültig/fehlend"))).toBe(true);
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
      stateCode: "NW",
      regionName: "Düsseldorf",
      regionShortCode: "DU",
      fussballDeMapping: { searchName: "Düsseldorf", verband: "FVN", kreis: "Düsseldorf" },
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
    const payload = JSON.parse(String(fetch.mock.calls[0][1]?.body || "{}"));
    expect(payload).toMatchObject({
      kreisId: "duesseldorf",
      stateCode: "NW",
      regionName: "Düsseldorf",
      regionShortCode: "DU",
      fussballDeMapping: { searchName: "Düsseldorf", verband: "FVN", kreis: "Düsseldorf" },
    });
  });

  it("faellt auf benachbarte Woche zurück, wenn der gewählte Zeitraum leer ist", async () => {
    const fetchMock = vi.fn(async (_input, init) => {
      const payload = JSON.parse(String(init?.body || "{}"));
      const fromDate = String(payload.fromDate || "");
      const toDate = String(payload.toDate || "");

      if (fromDate === "2026-05-01" && toDate === "2026-05-01") {
        return {
          ok: true,
          json: async () => ({ games: [] }),
        };
      }

      if (fromDate === "2026-04-27" && toDate === "2026-05-03") {
        return {
          ok: true,
          json: async () => ({
            games: [
              {
                date: "2026-05-02",
                time: "12:30",
                home: "Team Fallback A",
                away: "Team Fallback B",
                venue: "Sportpark",
                km: 11,
                kreisId: "duesseldorf",
                jugendId: "e-jugend",
              },
            ],
          }),
        };
      }

      return {
        ok: true,
        json: async () => ({ games: [] }),
      };
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchGamesWithProviders({
      mode: "adapter",
      kreisId: "duesseldorf",
      jugendId: "e-jugend",
      fromDate: "2026-05-01",
      toDate: "2026-05-01",
      teams: [],
      uploadedGames: [],
      adapterEndpoint: "http://localhost:3333/games",
      turnier: false,
    });

    expect(result.source).toBe("adapter");
    expect(result.games).toHaveLength(1);
    expect(result.games[0].home).toBe("Team Fallback A");
    expect(fetchMock).toHaveBeenCalledTimes(2);
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

  it("keeps unknown adapter kickoff as '--:--' instead of forcing 10:00", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          games: [
            {
              date: "2026-05-01",
              time: "**",
              home: "Team Unknown Time",
              away: "Team B",
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
      teams: ["Team Unknown Time"],
      uploadedGames: [],
      adapterEndpoint: "http://localhost:3333/games",
      turnier: false,
    });

    expect(result.source).toBe("adapter");
    expect(result.games).toHaveLength(1);
    expect(result.games[0].time).toBe("--:--");
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

  it("faellt bei localhost-endpoint auf /api/games zurueck, wenn localhost nicht erreichbar ist", async () => {
    const fetchMock = vi.fn(async (input) => {
      const url = String(input);
      if (url === "http://localhost:8787/api/games") {
        throw new TypeError("Failed to fetch");
      }

      if (url === "/api/games") {
        return {
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
        };
      }

      return {
        ok: false,
        status: 404,
        json: async () => ({}),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchGamesWithProviders({
      mode: "adapter",
      kreisId: "duesseldorf",
      jugendId: "e-jugend",
      fromDate: "2026-05-01",
      toDate: "2026-05-07",
      teams: ["Team X", "Team Y"],
      uploadedGames: [],
      adapterEndpoint: "http://localhost:8787/api/games",
      turnier: false,
    });

    expect(result.source).toBe("adapter");
    expect(result.games).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      "http://localhost:8787/api/games",
      "/api/games",
    ]);
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

  it("fails fast for invalid fromDate before adapter request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchGamesWithProviders({
        mode: "adapter",
        kreisId: "duesseldorf",
        jugendId: "e-jugend",
        fromDate: "",
        toDate: "2026-04-07",
        teams: ["Team A"],
        uploadedGames: [],
        adapterEndpoint: "http://localhost:3333/games",
      }),
    ).rejects.toThrow("Ungültiges Startdatum");

    expect(fetchMock).not.toHaveBeenCalled();
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

  it("respects empty retryDelaysMs and performs single adapter attempt", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchGamesWithProviders({
        mode: "adapter",
        kreisId: "duesseldorf",
        jugendId: "e-jugend",
        fromDate: "2026-04-01",
        toDate: "2026-04-07",
        teams: ["Team A"],
        uploadedGames: [],
        adapterEndpoint: "http://localhost:3333/games",
        retryDelaysMs: [],
      }),
    ).rejects.toThrow("Adapter HTTP 500");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns actionable 401 message for adapter auth mismatch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({}),
      }),
    );

    await expect(
      fetchGamesWithProviders({
        mode: "adapter",
        kreisId: "duesseldorf",
        jugendId: "e-jugend",
        fromDate: "2026-04-01",
        toDate: "2026-04-07",
        teams: ["Team A"],
        uploadedGames: [],
        adapterEndpoint: "http://localhost:3333/games",
        adapterToken: "",
        retryDelaysMs: [],
      }),
    ).rejects.toThrow("Adapter HTTP 401 (Unauthorized). Interner Zugriffstoken passt nicht zur Adapter-Konfiguration.");
  });

  it("handles empty csv input gracefully", () => {
    const report = parseUploadedGamesReport("date,time,home,away", "games.csv", {
      kreisId: "duesseldorf",
      jugendId: "e-jugend",
      fromDate: "2026-04-01",
      turnier: false,
    });

    expect(report.games).toHaveLength(0);
    expect(report.stats.totalRows).toBe(0);
    expect(report.stats.validRows).toBe(0);
  });

  it("parses null-like values without random fallbacks", () => {
    const games = parseUploadedGames(
      JSON.stringify([
        {
          date: null,
          time: null,
          home: "Team Null A",
          away: "Team Null B",
          venue: "Sportanlage",
          km: null,
        },
      ]),
      "games.json",
      {
        kreisId: "duesseldorf",
        jugendId: "e-jugend",
        fromDate: "2026-04-01",
        turnier: false,
      },
    );

    expect(games).toHaveLength(1);
    expect(games[0].km).toBeNull();
    expect(games[0].time).toBe("10:00");
  });

  it("flags duplicate csv rows for repeated imports", () => {
    const report = parseUploadedGamesReport(
      `date,time,home,away,venue,km,kreisId,jugendId\n2026-05-01,11:00,Team A,Team B,Platz 1,8,duesseldorf,e-jugend\n2026-05-01,11:00,Team A,Team B,Platz 1,8,duesseldorf,e-jugend`,
      "games.csv",
      {
        kreisId: "duesseldorf",
        jugendId: "e-jugend",
        fromDate: "2026-04-01",
        turnier: false,
      },
    );

    expect(report.games).toHaveLength(2);
    expect(report.stats.warnings.some((warning) => warning.toLowerCase().includes("doppeltes spiel erkannt"))).toBe(
      true,
    );
  });
});
