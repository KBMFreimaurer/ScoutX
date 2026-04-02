import { describe, expect, it } from "vitest";
import {
  buildDateRange,
  extractMatchDetails,
  extractMatchesFromDatePage,
  pickAreaIdsForLeague,
  toSpieldatumUrl,
} from "./fussballde";

describe("fussballde helpers", () => {
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
});
