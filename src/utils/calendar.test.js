import { describe, expect, it } from "vitest";
import { buildScoutCalendarIcs } from "./calendar";

describe("calendar utils", () => {
  it("erstellt gültigen ICS-Inhalt mit Top-5-Spielen", () => {
    const ics = buildScoutCalendarIcs(
      [
        {
          id: "g1",
          home: "Team A",
          away: "Team B",
          date: "2026-04-11",
          time: "14:00",
          venue: "Platz 1",
          priority: 5,
        },
      ],
      { kreisLabel: "Duisburg" },
    );

    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("SUMMARY:Team A vs Team B");
    expect(ics).toContain("LOCATION:Platz 1");
    expect(ics).toContain("END:VCALENDAR");
  });
});
