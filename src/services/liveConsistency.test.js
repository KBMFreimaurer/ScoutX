import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyAuthoritativeGameCorrections,
  checkPlanConsistency,
  isAdapterSyncContext,
} from "./liveConsistency";
import { fetchGamesWithProviders } from "./dataProvider";

vi.mock("./dataProvider", async () => {
  const actual = await vi.importActual("./dataProvider");
  return {
    ...actual,
    fetchGamesWithProviders: vi.fn(),
  };
});

describe("liveConsistency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("erkennt Adapter-Sync-Kontext korrekt", () => {
    expect(isAdapterSyncContext({ source: "adapter" })).toBe(true);
    expect(isAdapterSyncContext({ source: "history" })).toBe(false);
  });

  it("korrigiert Datum, Uhrzeit und Spielort", () => {
    const games = [
      {
        id: "match-1",
        home: "SF Hamborn 07",
        away: "MSV Duisburg",
        dateObj: new Date(2026, 3, 25),
        time: "11:00",
        venue: "BSA Nord",
      },
    ];

    const authoritative = [
      {
        id: "match-1",
        home: "SF Hamborn 07",
        away: "MSV Duisburg",
        date: "2026-04-25",
        time: "15:00",
        venue: "BSA Hamborn, Platz 1",
      },
    ];

    const result = applyAuthoritativeGameCorrections(games, authoritative);
    expect(result.correctedCount).toBe(1);
    expect(result.games[0].time).toBe("15:00");
    expect(result.games[0].venue).toContain("Hamborn");
    expect(result.changes[0].changedFields).toContain("time");
    expect(result.changes[0].details.join(" ")).toContain("Anstoßzeit");
  });

  it("liefert unsupported für nicht-adapter Pläne", async () => {
    const result = await checkPlanConsistency([], { source: "history" });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("unsupported-source");
  });

  it("führt Live-Abgleich aus und meldet Änderungen", async () => {
    fetchGamesWithProviders.mockResolvedValue({
      games: [
        {
          id: "match-2",
          home: "Hamborn 07",
          away: "MSV Duisburg",
          date: "2026-04-25",
          time: "15:00",
          venue: "Sportpark Hamborn",
        },
      ],
    });

    const games = [
      {
        id: "match-2",
        home: "Hamborn 07",
        away: "MSV Duisburg",
        dateObj: new Date(2026, 3, 25),
        time: "11:00",
        venue: "Alter Platz",
      },
    ];

    const result = await checkPlanConsistency(
      games,
      {
        source: "adapter",
        adapterEndpoint: "/api/games",
        kreisId: "duisburg",
        jugendId: "d-jugend",
        fromDate: "2026-04-20",
        toDate: "2026-04-26",
      },
      5000,
    );

    expect(result.ok).toBe(true);
    expect(result.correctedCount).toBe(1);
    expect(result.games[0].time).toBe("15:00");
    expect(fetchGamesWithProviders).toHaveBeenCalledTimes(1);
  });
});
