import { describe, expect, it, vi } from "vitest";
import {
  buildDateRange,
  extractKickoffFromTeamPageHtml,
  extractMatchDetails,
  extractMatchesFromDatePage,
  extractClubSearchResults,
  pickAreaIdsForLeague,
  resolveFussballDeRegionParams,
  toSpieldatumUrl,
} from "./fussballde";

describe("fussballde helpers", () => {
  it("warnt bei fehlenden Match-Selektoren", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const matches = extractMatchesFromDatePage("<div>leer</div>");
    expect(matches).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it("builds a spieldatum url from a competition url", () => {
    const url = toSpieldatumUrl(
      "https://www.fussball.de/spieltagsuebersicht/a-junioren-nrl-niederrhein-a-junioren-niederrheinliga-a-junioren-saison2526-niederrhein/-/staffel/02TP6I0PF4000009VS5489BUVSPHI8RP-G",
      "2026-04-04",
    );

    expect(url).toBe(
      "https://www.fussball.de/spieltag/a-junioren-nrl-niederrhein-a-junioren-niederrheinliga-a-junioren-saison2526-niederrhein/-/spieldatum/2026-04-04/staffel/02TP6I0PF4000009VS5489BUVSPHI8RP-G",
    );
  });

  it("builds an inclusive date range", () => {
    expect(buildDateRange("2026-04-04", "2026-04-06")).toEqual(["2026-04-04", "2026-04-05", "2026-04-06"]);
  });

  it("extracts match rows from a playday page", () => {
    const html = `
      <table>
        <tbody>
          <tr>
            <td class="column-club"><div class="club-name">SC Viktoria Anrath D1</div></td>
            <td class="column-club no-border"><div class="club-name">TSV Kaldenkirchen</div></td>
            <td><a href="https://www.fussball.de/spiel/sc-viktoria-anrath-d1-tsv-kaldenkirchen/-/spiel/02U0CT5KV4000000VS5489BTVUFLAKGJ">Zum Spiel</a></td>
          </tr>
          <tr>
            <td class="column-club"><div class="club-name">JSG Brüggen/&#8203;Bracht D1</div></td>
            <td class="column-club no-border"><div class="club-name">SC Waldniel D1</div></td>
            <td><a href="/spiel/jsg-brueggen-bracht-d1-sc-waldniel-d1/-/spiel/02U0CT5KPG000000VS5489BTVUFLAKGJ">Zum Spiel</a></td>
          </tr>
        </tbody>
      </table>
    `;

    expect(extractMatchesFromDatePage(html)).toEqual([
      {
        home: "SC Viktoria Anrath D1",
        away: "TSV Kaldenkirchen",
        matchUrl: "https://www.fussball.de/spiel/sc-viktoria-anrath-d1-tsv-kaldenkirchen/-/spiel/02U0CT5KV4000000VS5489BTVUFLAKGJ",
      },
      {
        home: "JSG Brüggen/Bracht D1",
        away: "SC Waldniel D1",
        matchUrl: "https://www.fussball.de/spiel/jsg-brueggen-bracht-d1-sc-waldniel-d1/-/spiel/02U0CT5KPG000000VS5489BTVUFLAKGJ",
      },
    ]);
  });

  it("extracts club suggestions with logos from search result page", () => {
    const html = `
      <section id="club-search-results">
        <div class="search-results">
          <div id="clublist">
            <ul>
              <li>
                <a href="/verein/msv-duisburg-ev-niederrhein/-/id/00ES8GN8VS00001TVV0AG08LVUPGND5I" class="image-wrapper">
                  <div class="image">
                    <img src="//www.fussball.de/export.media/-/action/getLogo/format/7/id/00ES8GN8VS00001TVV0AG08LVUPGND5I" alt="logo">
                  </div>
                  <div class="text">
                    <p class="name">MSV Duisburg E.V.<span class="icon-link-arrow"></span></p>
                    <p class="sub">47055&nbsp;Duisburg</p>
                  </div>
                </a>
              </li>
            </ul>
          </div>
        </div>
      </section>
    `;

    expect(extractClubSearchResults(html, 5)).toEqual([
      {
        name: "MSV Duisburg E.V.",
        location: "47055 Duisburg",
        logoUrl: "https://www.fussball.de/export.media/-/action/getLogo/format/7/id/00ES8GN8VS00001TVV0AG08LVUPGND5I",
        link: "https://www.fussball.de/verein/msv-duisburg-ev-niederrhein/-/id/00ES8GN8VS00001TVV0AG08LVUPGND5I",
      },
    ]);
  });

  it("extracts date, kickoff and location from a match page", () => {
    const html = `
      <html>
        <head>
          <title>SC Viktoria Anrath D1 - TSV Kaldenkirchen Ergebnis: D-Junioren Leistungsklasse - D-Junioren - 13.12.2025</title>
        </head>
        <body>
          <a href="https://www.fussball.de/spieltag/d-junioren-kreisleistungsklasse-kreis-kempen-krefeld-d-junioren-leistungsklasse-d-junioren-saison2526-niederrhein/-/spieldatum/2025-12-13/staffel/02U0CS03UO000004VS5489BTVUFLAKGJ-G" class="competition">D-Junioren Kreisleistungsklasse</a>
          <div class="stage-body">
            <div class="team-name"><a>SC Viktoria Anrath D1</a></div>
            <div class="team-name"><a>TSV Kaldenkirchen</a></div>
          </div>
          <a href="https://www.google.de/maps?q=Neersener+Str.+74%2C+47877+Willich" class="location" target="_blank">
            Kunstrasenplatz, Kunstrasenplatz 2, Neersener Str. 74, 47877 Willich
            <span class="icon-location"></span>
          </a>
          <section id="course">
            <h3>Anpfiff</h3>
            <span>11:00Uhr</span>
          </section>
        </body>
      </html>
    `;

    expect(extractMatchDetails(html)).toEqual({
      date: "2025-12-13",
      time: "11:00",
      venue: "Kunstrasenplatz, Kunstrasenplatz 2, Neersener Str. 74, 47877 Willich",
      home: "SC Viktoria Anrath D1",
      away: "TSV Kaldenkirchen",
    });
  });

  it("warnt bei unvollständiger Match-Detailseite", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const details = extractMatchDetails("<html><body><div>ohne struktur</div></body></html>");
    expect(details).toEqual({
      date: "",
      time: "",
      venue: "",
      home: "",
      away: "",
    });
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it("extracts kickoff from team page row data for a specific match id", () => {
    const html = `
      <table>
        <tbody>
          <tr class="row-competition hidden-small">
            <td class="column-date"><span class="hidden-small inline">Sa, 11.04.26 |&nbsp;</span>13:00</td>
          </tr>
          <tr class="odd">
            <td class="column-score">
              <a href="https://www.fussball.de/spiel/team-a-team-b/-/spiel/02TESTMATCHID000000VS5489BTV000000">Zum Spiel</a>
            </td>
          </tr>
        </tbody>
      </table>
    `;

    expect(extractKickoffFromTeamPageHtml(html, "02TESTMATCHID000000VS5489BTV000000")).toBe("13:00");
  });

  it("does not pick unrelated nearby times for team-page kickoff", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const html = `
      <div class="match-meta"><span>Letztes Spiel: 15:00 | Meisterschaften</span></div>
      <a href="https://www.fussball.de/spiel/team-c-team-d/-/spiel/02TESTMATCHID000000VS5489BTV000000">Zum Spiel</a>
    `;

    expect(extractKickoffFromTeamPageHtml(html, "02TESTMATCHID000000VS5489BTV000000")).toBe("");
    warnSpy.mockRestore();
  });

  it("warnt wenn kickoff auf Teamseite nicht ermittelt werden kann", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const kickoff = extractKickoffFromTeamPageHtml(
      '<a href="https://www.fussball.de/spiel/x/-/spiel/02TESTMATCHID000000VS5489BTV000000">Zum Spiel</a>',
      "02TESTMATCHID000000VS5489BTV000000",
    );

    expect(kickoff).toBe("");
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it("matches kreis areas by keyword and falls back to regional areas", () => {
    const areaMap = {
      _00ES8GN000000004VV0AG08LVUPGND5I: "Kreis Düsseldorf",
      _00ES8GMVUO00000DVV0AG08LVUPGND5I: "Kreis Duisburg-Mülheim-Dinslak",
      _0123456789ABCDEF0123456700004110: "Niederrhein",
    };

    expect(pickAreaIdsForLeague(areaMap, "duesseldorf")).toEqual(["00ES8GN000000004VV0AG08LVUPGND5I"]);
    expect(pickAreaIdsForLeague({ _0123456789ABCDEF0123456700004110: "Niederrhein" }, "essen")).toEqual([
      "0123456789ABCDEF0123456700004110",
    ]);
  });

  it("does not fall back to unrelated areas when kreis mapping has no match", () => {
    const areaMap = {
      _00ES8GMVUO00000CVV0AG08LVUPGND5I: "Kreis Oberhausen-Bottrop",
    };

    expect(pickAreaIdsForLeague(areaMap, "duisburg")).toEqual([]);
  });

  it("builds NRW Duisburg adapter mapping params", () => {
    const params = resolveFussballDeRegionParams({
      kreisId: "duisburg",
      stateCode: "NW",
      regionName: "Duisburg",
      regionShortCode: "DUI",
      mapping: { searchName: "Duisburg", verband: "FVN", kreis: "Duisburg" },
    });

    expect(params).toMatchObject({
      stateCode: "NW",
      regionName: "Duisburg",
      regionShortCode: "DUI",
      searchName: "Duisburg",
      verband: "FVN",
      kreis: "Duisburg",
      source: "mapping",
    });
    expect(params.areaKeywords).toContain("duisburg");
  });

  it("builds Bayern München params from fallback mapping", () => {
    const params = resolveFussballDeRegionParams({
      kreisId: "by-m",
      stateCode: "BY",
      regionName: "München",
      regionShortCode: "M",
      mapping: { searchName: "München", verband: "BFV", region: "München" },
    });

    expect(params.stateCode).toBe("BY");
    expect(params.fallbackSearchName).toBe("München");
    expect(params.areaKeywords).toContain("munchen");
  });

  it("supports Berlin and Hamburg city-state fallback search", () => {
    expect(
      resolveFussballDeRegionParams({ kreisId: "be-b", stateCode: "BE", regionName: "Berlin" }),
    ).toMatchObject({ stateCode: "BE", fallbackSearchName: "Berlin" });
    expect(
      resolveFussballDeRegionParams({ kreisId: "hh-hh", stateCode: "HH", regionName: "Hamburg" }),
    ).toMatchObject({ stateCode: "HH", fallbackSearchName: "Hamburg" });
  });
});
