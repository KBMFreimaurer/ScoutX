import { describe, expect, it } from "vitest";
import { extractMeinturnierplanTournaments } from "./externalGameScrapers.js";

describe("external game scraper detail candidates", () => {
  it("keeps tournament detail matches from source metadata", () => {
    const payload = {
      features: [
        {
          properties: {
            name: "D-Junioren Pfingstcup Duisburg",
            url: "/showit.php?id=abc123",
            startDate: "23.05.2026",
            startTime: "10:00",
            venue: "Sportpark Duisburg",
            matches: [
              {
                home: "MSV Duisburg U12",
                away: "Rot-Weiss Essen U12",
                date: "23.05.2026",
                time: "10:30",
                venue: "Platz 1",
              },
            ],
          },
        },
      ],
    };
    const html = `<script>window.mapSearchTournaments = ${JSON.stringify(payload)};</script>`;

    const tournaments = extractMeinturnierplanTournaments(html, {
      baseUrl: "https://www.meinturnierplan.de",
      fromDate: "2026-05-20",
      toDate: "2026-05-30",
      keywords: ["d junioren"],
      regionKeywords: ["duisburg"],
    });

    expect(tournaments).toHaveLength(1);
    expect(tournaments[0].matches).toEqual([
      expect.objectContaining({
        home: "MSV Duisburg U12",
        away: "Rot-Weiss Essen U12",
        date: "2026-05-23",
        time: "10:30",
        venue: "Platz 1",
      }),
    ]);
  });

  it("keeps weak region tournament matches as review-required candidates", () => {
    const payload = {
      features: [
        {
          properties: {
            name: "D-Junioren Pfingstcup Nachbarstadt",
            url: "/showit.php?id=weak42",
            startDate: "23.05.2026",
            venue: "Sportpark Nachbarstadt",
          },
        },
      ],
    };
    const html = `<script>window.mapSearchTournaments = ${JSON.stringify(payload)};</script>`;

    const tournaments = extractMeinturnierplanTournaments(html, {
      baseUrl: "https://www.meinturnierplan.de",
      fromDate: "2026-05-20",
      toDate: "2026-05-30",
      keywords: ["d junioren"],
      regionKeywords: ["duisburg"],
      includeReviewCandidates: true,
    });

    expect(tournaments).toHaveLength(1);
    expect(tournaments[0]).toMatchObject({
      externalId: "weak42",
      reviewRequired: true,
      reviewReason: expect.stringMatching(/Region/i),
      matchConfidence: "weak",
    });
  });
});
