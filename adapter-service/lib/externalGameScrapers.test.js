import { describe, expect, it } from "vitest";
import {
  extractMeinturnierplanTournaments,
  parseDfbNationalGamesFromHtml,
} from "./externalGameScrapers.js";

describe("external game scrapers", () => {
  it("parses DFB U-national team fixtures from schedule markup", () => {
    const html = `
      <h1>U 17</h1>
      <table>
        <tr><th>Datum</th><th>Uhrzeit</th><th>Veranstaltung</th><th>Ort</th></tr>
        <tr>
          <td>12.06.2026</td>
          <td>18:00</td>
          <td>LSP Deutschland U17 - Italien U17</td>
          <td>DFB Campus Frankfurt</td>
        </tr>
        <tr>
          <td>20.07.2026</td>
          <td></td>
          <td>Lehrgang</td>
          <td>Kaiserau</td>
        </tr>
      </table>
    `;

    const games = parseDfbNationalGamesFromHtml(html, {
      ageGroup: "U17",
      sourceUrl: "https://www.dfb.de/maenner/nationalmannschaften/u-17/spiele-und-termine",
      fromDate: "2026-06-01",
      toDate: "2026-06-30",
    });

    expect(games).toHaveLength(1);
    expect(games[0]).toMatchObject({
      id: "dfb-u17-2026-06-12-deutschland-u17-italien-u17",
      source: "national",
      provider: "dfb.de",
      ageGroup: "U17",
      home: "Deutschland U17",
      away: "Italien U17",
      date: "2026-06-12",
      time: "18:00",
      venue: "DFB Campus Frankfurt",
      competitionName: "LSP",
      matchUrl: "https://www.dfb.de/maenner/nationalmannschaften/u-17/spiele-und-termine",
    });
  });

  it("keeps DFB date-range events as scoutable national events", () => {
    const html = `
      <h1>U 15</h1>
      <p>Datum Uhrzeit Veranstaltung Ort</p>
      <p>28.05. â€“ 02.06.2026 Â  U 15-Sichtungsturnier Sportschule Wedau, Duisburg</p>
    `;

    const games = parseDfbNationalGamesFromHtml(html, {
      ageGroup: "u15",
      sourceUrl: "https://www.dfb.de/maenner/nationalmannschaften/u-15/spiele-und-termine",
      fromDate: "2026-05-01",
      toDate: "2026-06-30",
    });

    expect(games).toHaveLength(1);
    expect(games[0]).toMatchObject({
      home: "Deutschland U15",
      away: "U 15-Sichtungsturnier",
      date: "2026-05-28",
      dateTo: "2026-06-02",
      time: "--:--",
      venue: "Sportschule Wedau, Duisburg",
      competitionName: "U 15-Sichtungsturnier",
    });
  });

  it("extracts meinturnierplan tournaments from map search JSON with metadata", () => {
    const payload = {
      features: [
        {
          properties: {
            name: "D-Junioren Pfingstcup Duisburg",
            url: "/showit.php?id=abc123",
            startDate: "23.05.2026",
            endDate: "24.05.2026",
            startTime: "10:00",
            endTime: "16:30",
            venue: "Sportpark Duisburg",
            address: "Wedau, Duisburg",
          },
        },
      ],
    };
    const html = `<script>window.mapSearchTournaments = ${JSON.stringify(payload)};</script>`;

    const tournaments = extractMeinturnierplanTournaments(html, {
      baseUrl: "https://www.meinturnierplan.de",
      fromDate: "2026-05-20",
      toDate: "2026-05-30",
      keywords: ["d junioren", "duisburg"],
    });

    expect(tournaments).toHaveLength(1);
    expect(tournaments[0]).toMatchObject({
      id: "mtp-abc123",
      externalId: "abc123",
      source: "tournament",
      provider: "meinturnierplan.de",
      name: "D-Junioren Pfingstcup Duisburg",
      dateFrom: "2026-05-23",
      dateTo: "2026-05-24",
      timeFrom: "10:00",
      timeTo: "16:30",
      venue: "Sportpark Duisburg, Wedau, Duisburg",
      url: "https://www.meinturnierplan.de/showit.php?id=abc123",
    });
  });

  it("extracts meinturnierplan tournaments from public list markup", () => {
    const html = `
      <h3>Coming Soon</h3>
      <a href="/showit.php?id=list42">C1 HFV Pfingst-Cup 2026</a>
      <a href="https://club.example">Habenhauser FV</a>
      22.5.2026 17:15 - 21:15, Bremen, Bunnsackerweg 28, 28279 Bremen
      <a href="/pdf.php?id=list42">PDF</a>
      <a href="/showit.php?id=other">Senioren Hobbycup</a>
      23.5.2026 10:00 - 12:00, Hamburg
    `;

    const tournaments = extractMeinturnierplanTournaments(html, {
      baseUrl: "https://www.meinturnierplan.de",
      fromDate: "2026-05-20",
      toDate: "2026-05-30",
      keywords: ["c1", "pfingst"],
    });

    expect(tournaments).toHaveLength(1);
    expect(tournaments[0]).toMatchObject({
      externalId: "list42",
      name: "C1 HFV Pfingst-Cup 2026",
      dateFrom: "2026-05-22",
      timeFrom: "17:15",
      timeTo: "21:15",
      venue: "Bremen, Bunnsackerweg 28, 28279 Bremen",
    });
  });
});
