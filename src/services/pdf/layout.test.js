import { describe, expect, it, vi } from "vitest";
import { CONTENT_TOP, ensureSpace, formatKickoffLabel, parseMinutes, sortGamesByDateTime } from "./layout";

describe("pdf/layout", () => {
  it("parst Anstoßzeiten und formatiert Labels", () => {
    expect(parseMinutes("14:30")).toBe(870);
    expect(parseMinutes("xx")).toBeNull();
    expect(formatKickoffLabel("09:15")).toBe("09:15 Uhr");
    expect(formatKickoffLabel("--:--")).toBe("Anstoß offen");
  });

  it("sortiert Spiele nach Datum und Zeit", () => {
    const games = [
      { home: "A", away: "B", date: "2026-04-12", time: "13:00" },
      { home: "C", away: "D", date: "2026-04-11", time: "14:00" },
      { home: "E", away: "F", date: "2026-04-11", time: "10:00" },
    ];

    const sorted = sortGamesByDateTime(games);
    expect(sorted.map((game) => `${game.date} ${game.time}`)).toEqual([
      "2026-04-11 10:00",
      "2026-04-11 14:00",
      "2026-04-12 13:00",
    ]);
  });

  it("fügt bei Platzmangel eine neue Seite hinzu", () => {
    let pages = 1;
    const doc = {
      addPage: vi.fn(() => {
        pages += 1;
      }),
      getNumberOfPages: vi.fn(() => pages),
    };
    const state = { y: 279, sections: ["Überblick"] };
    const onBreak = vi.fn();

    ensureSpace(doc, state, 5, "Routenplan", onBreak);

    expect(doc.addPage).toHaveBeenCalledTimes(1);
    expect(onBreak).toHaveBeenCalledTimes(1);
    expect(state.y).toBe(CONTENT_TOP);
    expect(state.sections[1]).toBe("Routenplan");
  });
});
