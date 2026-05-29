import { describe, expect, it } from "vitest";
import { extractMeinturnierplanTournaments, parseDfbNationalGamesFromHtml } from "./externalGameScrapers.js";

describe("external game scrapers region and U21 coverage", () => {
  it("parses DFB U21 fixtures without kickoff time and keeps venue separate", () => {
    const html = `
      <h1>U 21</h1>
      <table>
        <tr><th>Datum</th><th>Uhrzeit</th><th>Veranstaltung</th><th>Ort</th><th>TV</th></tr>
        <tr>
          <td>06.10.2026</td>
          <td></td>
          <td>Deutschland - Georgien (EMQ)</td>
          <td>Aachen</td>
          <td>ProSieben MAXX</td>
        </tr>
      </table>
    `;

    const games = parseDfbNationalGamesFromHtml(html, {
      ageGroup: "U21",
      sourceUrl: "https://www.dfb.de/maenner/nationalmannschaften/u-21/spiele-und-termine",
      fromDate: "2026-10-01",
      toDate: "2026-10-31",
    });

    expect(games).toHaveLength(1);
    expect(games[0]).toMatchObject({
      ageGroup: "U21",
      home: "Deutschland",
      away: "Georgien",
      date: "2026-10-06",
      time: "--:--",
      venue: "Aachen",
      competitionName: "EMQ",
      matchUrl: "https://www.dfb.de/maenner/nationalmannschaften/u-21/spiele-und-termine",
    });
  });

  it("filters meinturnierplan tournaments by selected wizard region", () => {
    const payload = {
      features: [
        {
          properties: {
            name: "Pfingstcup U12",
            url: "/showit.php?id=dui42",
            startDate: "03.06.2026",
            endDate: "03.06.2026",
            venue: "Sportschule Wedau",
            address: "Duisburg",
          },
        },
        {
          properties: {
            name: "Pfingstcup U12",
            url: "/showit.php?id=hh42",
            startDate: "03.06.2026",
            endDate: "03.06.2026",
            venue: "Sportplatz Altona",
            address: "Hamburg",
          },
        },
      ],
    };
    const html = `<script>window.mapSearchTournaments = ${JSON.stringify(payload)};</script>`;

    const tournaments = extractMeinturnierplanTournaments(html, {
      baseUrl: "https://www.meinturnierplan.de",
      fromDate: "2026-06-01",
      toDate: "2026-06-07",
      regionKeywords: ["duisburg", "wedau", "mulheim"],
    });

    expect(tournaments).toHaveLength(1);
    expect(tournaments[0]).toMatchObject({
      externalId: "dui42",
      venue: "Sportschule Wedau, Duisburg",
    });
  });

  it("matches meinturnierplan tournaments by youth age aliases", () => {
    const payload = {
      features: [
        {
          properties: {
            name: "U12 Cup Duisburg",
            url: "/showit.php?id=u12",
            startDate: "03.06.2026",
            endDate: "03.06.2026",
            venue: "Sportpark Mitte",
          },
        },
      ],
    };
    const html = `<script>window.mapSearchTournaments = ${JSON.stringify(payload)};</script>`;

    const tournaments = extractMeinturnierplanTournaments(html, {
      baseUrl: "https://www.meinturnierplan.de",
      fromDate: "2026-06-01",
      toDate: "2026-06-07",
      keywords: ["d-jugend", "u12", "u13"],
    });

    expect(tournaments).toHaveLength(1);
    expect(tournaments[0]).toMatchObject({
      externalId: "u12",
      name: "U12 Cup Duisburg",
    });
  });
});
