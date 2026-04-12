import { describe, expect, it } from "vitest";
import { buildAttendanceRows, formatPresenceMinutes, normalizePresenceMinutes } from "./arbeitszeit";

describe("arbeitszeit utils", () => {
  it("normalisiert Minuten-Eingaben robust", () => {
    expect(normalizePresenceMinutes("90")).toBe(90);
    expect(normalizePresenceMinutes("90,4")).toBe(90);
    expect(normalizePresenceMinutes(45.8)).toBe(46);
    expect(normalizePresenceMinutes("")).toBeNull();
    expect(normalizePresenceMinutes("-5")).toBeNull();
    expect(normalizePresenceMinutes("abc")).toBeNull();
  });

  it("formatiert Vor-Ort-Dauer für die Ausgabe", () => {
    expect(formatPresenceMinutes(35)).toBe("35 Min");
    expect(formatPresenceMinutes(120)).toBe("2 h");
    expect(formatPresenceMinutes(125)).toBe("2 h 5 Min");
    expect(formatPresenceMinutes(null)).toBe("nicht erfasst");
  });

  it("baut sortierte Arbeitszeit-Zeilen je Spiel", () => {
    const rows = buildAttendanceRows([
      {
        id: "game-2",
        dateObj: new Date("2026-04-26T00:00:00"),
        time: "16:30",
        home: "Team C",
        away: "Team D",
        venue: "Platz 2",
      },
      {
        id: "game-1",
        dateObj: new Date("2026-04-26T00:00:00"),
        time: "14:00",
        home: "Team A",
        away: "Team B",
        venue: "Platz 1",
      },
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0].id).toBe("game-1");
    expect(rows[0].timeLabel).toBe("14:00");
    expect(rows[1].id).toBe("game-2");
  });
});
