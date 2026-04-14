import { describe, expect, it } from "vitest";
import { parseClubCatalogText } from "./clubCatalogImport";

describe("clubCatalogImport", () => {
  it("parses JSON catalog and deduplicates clubs", () => {
    const json = JSON.stringify({
      clubs: [
        {
          name: "Duisburger SV",
          logoUrl: "//www.fussball.de/export.media/dsv.png",
          location: "Duisburg",
          logoLocal: "logos/duisburger-sv.png",
          kreisIds: ["duisburg"],
        },
        { name: "Duisburger SV", logoUrl: "https://example.com/dupe.png", location: "Dupe" },
        { name: "SF Hamborn 07", logoUrl: "https://www.fussball.de/export.media/hamborn.png" },
      ],
    });

    const result = parseClubCatalogText(json, "clubs.json");

    expect(result.stats.totalRows).toBe(3);
    expect(result.stats.validRows).toBe(2);
    expect(result.clubs).toEqual([
      {
        name: "Duisburger SV",
        location: "Duisburg",
        logoUrl: "https://www.fussball.de/export.media/dsv.png",
        logoLocal: "logos/duisburger-sv.png",
        link: "",
        kreisIds: ["duisburg"],
      },
      {
        name: "SF Hamborn 07",
        location: "",
        logoUrl: "https://www.fussball.de/export.media/hamborn.png",
        logoLocal: "",
        link: "",
        kreisIds: [],
      },
    ]);
  });

  it("parses CSV catalog with semicolon delimiter", () => {
    const csv = [
      "name;location;logoUrl;link",
      "Duisburger FV 08;Duisburg;https://www.fussball.de/export.media/dfv.png;https://www.fussball.de/verein/dfv08",
      "Viktoria Buchholz;Duisburg;;",
    ].join("\n");

    const result = parseClubCatalogText(csv, "clubs.csv");

    expect(result.stats.totalRows).toBe(2);
    expect(result.stats.validRows).toBe(2);
    expect(result.clubs[0].name).toBe("Duisburger FV 08");
    expect(result.clubs[1].name).toBe("Viktoria Buchholz");
  });
});
