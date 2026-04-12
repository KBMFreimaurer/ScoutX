import { describe, expect, it } from "vitest";
import { buildFahrtkostenRows } from "./fahrtkosten";

describe("fahrtkosten utils", () => {
  it("nutzt Route-Legs für die Abrechnung wenn vorhanden", () => {
    const model = buildFahrtkostenRows(
      [],
      {
        legs: [
          { from: "Start", to: "Team A vs Team B", distanceKm: 12.4, dateKey: "2026-04-18" },
          { from: "Team A vs Team B", to: "Start", distanceKm: 11.8, dateKey: "2026-04-18" },
        ],
      },
    );

    expect(model.mode).toBe("route");
    expect(model.rows).toHaveLength(2);
    expect(model.rows[0].id).toBe("leg-0");
    expect(model.rows[0].label).toContain("Start");
    expect(model.rows[0].dateLabel).toBe("18.04.");
  });

  it("fällt ohne Route-Legs auf Spiel-Distanzen zurück", () => {
    const model = buildFahrtkostenRows(
      [
        {
          id: "game-1",
          home: "Team A",
          away: "Team B",
          distanceKm: 14.2,
          dateObj: new Date("2026-04-19T00:00:00"),
        },
      ],
      null,
    );

    expect(model.mode).toBe("per_game_roundtrip");
    expect(model.rows).toHaveLength(1);
    expect(model.rows[0].id).toBe("game-1");
    expect(model.rows[0].label).toContain("Team A");
    expect(model.rows[0].baseKm).toBeCloseTo(14.2, 4);
  });
});
