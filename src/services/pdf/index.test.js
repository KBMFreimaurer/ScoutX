import { describe, expect, it } from "vitest";
import { applyAuthoritativeGameCorrections } from "./index";

describe("pdf/index authoritative correction", () => {
  it("überschreibt Uhrzeit und Spielort anhand gleicher Spiel-ID", () => {
    const games = [
      {
        id: "match-1",
        home: "FSV Duisburg",
        away: "Vogelheimer SV",
        dateObj: new Date(2026, 3, 25),
        time: "17:30",
        venue: "Alter Platz",
      },
    ];

    const authoritative = [
      {
        id: "match-1",
        home: "FSV Duisburg",
        away: "Vogelheimer SV",
        dateObj: new Date(2026, 3, 25),
        time: "15:30",
        venue: "Kunstrasenplatz, FSV Duisburg",
      },
    ];

    const result = applyAuthoritativeGameCorrections(games, authoritative);
    expect(result.correctedCount).toBe(1);
    expect(result.games[0].time).toBe("15:30");
    expect(result.games[0].venue).toBe("Kunstrasenplatz, FSV Duisburg");
  });

  it("matched ohne ID über Teams + Datum und korrigiert Felder", () => {
    const games = [
      {
        home: "SF Hamborn 07",
        away: "TURU 1880 Düsseldorf",
        dateObj: new Date(2026, 3, 25),
        time: "13:00",
        venue: "Sportanlage",
      },
    ];

    const authoritative = [
      {
        home: "SF Hamborn 07",
        away: "TURU 1880 Düsseldorf",
        date: "2026-04-25",
        time: "15:00",
        venue: "BSA Im Holtkamp, Containerbau MiRO Sportarena",
      },
    ];

    const result = applyAuthoritativeGameCorrections(games, authoritative);
    expect(result.correctedCount).toBe(1);
    expect(result.games[0].time).toBe("15:00");
    expect(result.games[0].venue).toContain("BSA Im Holtkamp");
  });

  it("lässt Spiele unverändert wenn bereits identisch", () => {
    const games = [
      {
        id: "match-2",
        home: "Duisburger FV 08",
        away: "TV Jahn Hiesfeld",
        dateObj: new Date(2026, 3, 25),
        time: "15:15",
        venue: "Paul-Esch-Str. 25, 47053 Duisburg",
      },
    ];

    const authoritative = [
      {
        id: "match-2",
        home: "Duisburger FV 08",
        away: "TV Jahn Hiesfeld",
        date: "2026-04-25",
        time: "15:15",
        venue: "Paul-Esch-Str. 25, 47053 Duisburg",
      },
    ];

    const result = applyAuthoritativeGameCorrections(games, authoritative);
    expect(result.correctedCount).toBe(0);
    expect(result.games[0]).toBe(games[0]);
  });
});
